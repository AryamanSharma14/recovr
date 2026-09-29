"""Scenario simulator for the demo dashboard.

Builds Razorpay-shaped webhook payloads and routes them through the REAL
pipeline — the same handler functions that /webhook/razorpay uses — so every
classifier rule, compliance guard, ML schedule and audit row exercised here
is the production code path, not a re-implementation.

`advance_hours > 0` is the time-travel knob: scheduled retries are force-fired
(as if the clock moved forward) and active downtimes are resolved, so a full
recovery lifecycle lands in the dashboard within seconds.
"""
import random
import uuid

from fastapi import APIRouter, Response
from pydantic import BaseModel

from src import config, db, events
from src.webhook import (
    _handle_payment_failed,
    _handle_downtime_started,
    _handle_downtime_resolved,
)

router = APIRouter()

SCENARIOS = (
    "soft", "hard", "downtime", "card_testing", "trajectory",
    "ev_negative", "payday", "cau_refresh", "rbi_predebit"
)

# PSU issuers get the govt-payday (7th) window in addition to weekends
_PSU_DEFAULT = "SBI"
_DOWNTIME_DEFAULT_ISSUER = "KOTAK"


class SimulateRequest(BaseModel):
    scenario: str
    count: int = 3
    issuer: str | None = None
    network: str | None = None
    amount_min_inr: float | None = None
    amount_max_inr: float | None = None
    international: bool = False
    advance_hours: int = 0


def _pid(tag: str) -> str:
    return f"pay_sim_{tag}_{uuid.uuid4().hex[:8]}"


def _order_id() -> str:
    return f"order_sim_{uuid.uuid4().hex[:10]}"


def _iin() -> str:
    return f"4{random.randint(10000, 99999)}"


def _amount_paise(req: SimulateRequest) -> int:
    lo = int((req.amount_min_inr or 200) * 100)
    hi = int((req.amount_max_inr or 5000) * 100)
    if hi < lo:
        hi = lo
    return random.randint(lo, hi)


def _failed_payload(pid: str, order_id: str, req: SimulateRequest, *,
                    reason: str, source: str, step: str = "payment_authorization",
                    issuer: str, network: str, iin: str,
                    amount_paise: int | None = None, method: str = "card") -> dict:
    entity = {
        "id": pid,
        "order_id": order_id,
        "amount": amount_paise if amount_paise is not None else _amount_paise(req),
        "currency": "INR",
        "email": f"sim+{pid[-8:]}@example.com",
        "contact": "+919800000000",
        "error_source": source,
        "error_step": step,
        "error_reason": reason,
        "error_code": reason.upper(),
        "method": method,
        "international": req.international,
    }
    if method == "card":
        entity["card"] = {"network": network, "type": "credit", "issuer": issuer, "iin": iin}
    return {"event": "payment.failed", "payload": {"payment": {"entity": entity}}}


def _force_fire(pid: str) -> None:
    """Same code path as POST /retry/{pid}/now — guards still apply."""
    from src.dashboard import force_retry
    force_retry(pid)


def _scheduled_pids(pids: list[str]) -> list[str]:
    return [p for p in pids if (db.get_event(p) or {}).get("retry_at")]


# ── scenarios ─────────────────────────────────────────────────────────────────

def _scenario_soft(req: SimulateRequest) -> list[str]:
    issuer = req.issuer or "HDFC"
    network = req.network or "Visa"
    pids = []
    for _ in range(max(1, req.count)):
        pid = _pid("soft")
        _handle_payment_failed(_failed_payload(
            pid, _order_id(), req, reason="insufficient_funds", source="bank",
            issuer=issuer, network=network, iin=_iin()))
        pids.append(pid)
    if req.advance_hours:
        for pid in _scheduled_pids(pids):
            _force_fire(pid)
    return pids


def _scenario_hard(req: SimulateRequest) -> list[str]:
    issuer = req.issuer or "HDFC"
    network = req.network or "Visa"
    pids = []
    for _ in range(max(1, req.count)):
        pid = _pid("hard")
        _handle_payment_failed(_failed_payload(
            pid, _order_id(), req, reason="card_expired", source="customer",
            issuer=issuer, network=network, iin=_iin()))
        pids.append(pid)
    if req.advance_hours:
        # Prove the guard: force-fire must still produce zero recovery actions
        for pid in pids:
            _force_fire(pid)
    return pids


def _scenario_downtime(req: SimulateRequest) -> list[str]:
    issuer = req.issuer or _DOWNTIME_DEFAULT_ISSUER
    network = req.network or "Visa"
    _handle_downtime_started({
        "event": "payment.downtime.started",
        "payload": {"downtime": {"entity": {
            "method": "card", "instrument": {"issuer": issuer}}}},
    })
    pids = []
    for _ in range(max(1, req.count)):
        pid = _pid("dt")
        _handle_payment_failed(_failed_payload(
            pid, _order_id(), req, reason="issuer_down", source="bank",
            issuer=issuer, network=network, iin=_iin()))
        pids.append(pid)
    if req.advance_hours:
        # Network restored: queue drains and recovery fires for each parked payment
        _handle_downtime_resolved({
            "event": "payment.downtime.resolved",
            "payload": {"downtime": {"entity": {
                "method": "card", "instrument": {"issuer": issuer}}}},
        })
    return pids


def _scenario_card_testing(req: SimulateRequest) -> list[str]:
    """Rapid bursts on ONE credential: first payment recovers, the rest trip the
    card-testing spacing guard (24h minimum between attempts per credential)."""
    issuer = req.issuer or "HDFC"
    network = req.network or "Visa"
    shared_iin = _iin()
    pids = []
    for i in range(max(2, req.count)):
        pid = _pid("ct")
        _handle_payment_failed(_failed_payload(
            pid, _order_id(), req, reason="insufficient_funds", source="bank",
            issuer=issuer, network=network, iin=shared_iin))
        pids.append(pid)
        if i == 0:
            # Fire the first recovery so it records a network attempt; every
            # later payment on this credential is then blocked at the webhook.
            for p in _scheduled_pids([pid]):
                _force_fire(p)
    return pids


def _scenario_trajectory(req: SimulateRequest) -> list[str]:
    """Same order declines twice, escalating soft→hard; force-fire must stop."""
    issuer = req.issuer or "HDFC"
    network = req.network or "Visa"
    pids = []
    for _ in range(max(1, req.count)):
        order = _order_id()
        pid1 = _pid("traj")
        _handle_payment_failed(_failed_payload(
            pid1, order, req, reason="insufficient_funds", source="bank",
            issuer=issuer, network=network, iin=_iin()))
        pid2 = _pid("traj")
        _handle_payment_failed(_failed_payload(
            pid2, order, req, reason="do_not_honor", source="bank",
            issuer=issuer, network=network, iin=_iin()))
        pids += [pid1, pid2]
        if req.advance_hours:
            _force_fire(pid2)  # trajectory_escalating → blocked
    return pids


def _scenario_ev_negative(req: SimulateRequest) -> list[str]:
    """₹0.01 micro-payment: recovery cost exceeds expected value → skipped."""
    issuer = req.issuer or "HDFC"
    network = req.network or "Visa"
    pid = _pid("ev")
    _handle_payment_failed(_failed_payload(
        pid, _order_id(), req, reason="insufficient_funds", source="bank",
        issuer=issuer, network=network, iin=_iin(), amount_paise=1))
    _force_fire(pid)  # EV guard trips inside run_recovery
    return [pid]


def _scenario_payday(req: SimulateRequest) -> list[str]:
    """Govt-salary-day scheduling: insufficient_funds retries snap to the next
    payday window (weekends + 7th for PSU issuers) instead of the raw ML pick."""
    issuer = req.issuer or _PSU_DEFAULT
    network = req.network or "RuPay"
    pids = []
    for _ in range(max(1, req.count)):
        pid = _pid("payday")
        _handle_payment_failed(_failed_payload(
            pid, _order_id(), req, reason="insufficient_funds", source="bank",
            issuer=issuer, network=network, iin=_iin()))
        pids.append(pid)
    return pids


def _scenario_cau_refresh(req: SimulateRequest) -> list[str]:
    """Card Account Updater (CAU) scenario: card_expired on supported bank
    triggers automatic network token refresh (Visa VTS / Mastercard MDES)."""
    from src.token_updater import attempt_token_refresh
    issuer = req.issuer or "HDFC"
    network = req.network or "Visa"
    iin = _iin()
    pids = []
    for _ in range(max(1, req.count)):
        pid = _pid("cau")
        order_id = _order_id()
        payload = _failed_payload(
            pid, order_id, req, reason="card_expired", source="bank",
            issuer=issuer, network=network, iin=iin)
        _handle_payment_failed(payload)

        # Apply CAU network token update
        tsp_result = attempt_token_refresh(network, issuer, iin, "card_expired")
        if tsp_result["refreshed"]:
            db.update_event(pid, token_refreshed=1, classification="soft",
                            classify_reason=tsp_result["reason"])
            db.log_audit(pid, "cau_token_refreshed", tsp_result["reason"])
            events.push("token_refreshed", pid, {
                "token": tsp_result["network_token"],
                "expiry": tsp_result["new_expiry"]
            })
            # Schedule tokenized retry
            from src import scheduler as sc
            sc.schedule_retry(pid, 24, error_reason="token_refreshed", issuer=issuer, method="card")
        pids.append(pid)

    if req.advance_hours:
        for pid in _scheduled_pids(pids):
            _force_fire(pid)
    return pids


def _scenario_rbi_predebit(req: SimulateRequest) -> list[str]:
    """RBI e-Mandate framework scenario: 24-hour advance customer notification (PND)
    dispatched prior to scheduled recurring auto-debit."""
    from src.dlt import format_dlt_message
    issuer = req.issuer or "SBI"
    network = req.network or "RuPay"
    pids = []
    for _ in range(max(1, req.count)):
        pid = _pid("rbi")
        order_id = _order_id()
        payload = _failed_payload(
            pid, order_id, req, reason="mandate_execution_failed", source="bank",
            issuer=issuer, network=network, iin=_iin(), method="upi")
        _handle_payment_failed(payload)

        amt_inr = (payload["payload"]["payment"]["entity"]["amount"]) / 100
        dlt = format_dlt_message(
            "PRE_DEBIT_NOTIFICATION",
            amount=f"{amt_inr:.2f}",
            merchant="Merchant Subscription",
            date="Tomorrow 10:00 AM",
            mandate_id=f"man_{pid[-8:]}"
        )
        db.log_audit(pid, "rbi_pre_debit_dispatched", f"DLT-ID: {dlt['dlt_template_id']} - {dlt['message']}")
        events.push("rbi_predebit", pid, {"dlt": dlt})
        pids.append(pid)
    return pids


_HANDLERS = {
    "soft": _scenario_soft,
    "hard": _scenario_hard,
    "downtime": _scenario_downtime,
    "card_testing": _scenario_card_testing,
    "trajectory": _scenario_trajectory,
    "ev_negative": _scenario_ev_negative,
    "payday": _scenario_payday,
    "cau_refresh": _scenario_cau_refresh,
    "rbi_predebit": _scenario_rbi_predebit,
}


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("/simulate")
@router.post("/api/v1/workbench/dispatch")
def simulate(req: SimulateRequest):
    if not config.DEMO_MODE:
        return Response(status_code=403, content="Simulator is disabled outside DEMO_MODE")
    if req.scenario not in SCENARIOS:
        return Response(status_code=400,
                        content=f"unknown scenario; expected one of {', '.join(SCENARIOS)}")
    before = events.bus_size()
    created = _HANDLERS[req.scenario](req)
    return {"created": created, "events_emitted": events.bus_size() - before}


@router.post("/simulate/reset")
@router.post("/api/v1/workbench/reset")
def simulate_reset(reseed: bool = False):
    if not config.DEMO_MODE:
        return Response(status_code=403, content="Simulator is disabled outside DEMO_MODE")
    from src import scheduler as sched
    for job in sched.scheduler.get_jobs():
        job.remove()
    db.reset_db()
    events.clear()
    if reseed:
        from src.seed import seed_database
        seed_database(force=True)
    return {"reset": True}

