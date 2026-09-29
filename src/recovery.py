"""Recovery action: create Razorpay Payment Link + send nudge."""
import time
from datetime import datetime, timedelta

import httpx

from src import compliance, config, db, events
from src import scheduler as sched

MAX_ATTEMPTS = 3
_CLAUDE_DECIDE_PROMPT = """You are a payment recovery decision engine. Given payment context, decide the recovery action.

Context: {context}

Rules:
- "abandon": clear trajectory escalation (soft→hard), amount<₹100 (not worth cost), or 3rd+ attempt failed
- "reroute": card fail on fundable reason AND UPI not yet tried → route to upi
- "retry": standard soft decline, retry on same rail
- "escalate": stuck trajectory (same error 3×) → try different channel only

Respond ONLY as JSON (no markdown): {{"action": "retry"|"reroute"|"escalate"|"abandon", "rail": "card"|"upi"|null, "reasoning": "one sentence", "confidence": 0.0-1.0}}"""
RAZORPAY_LINKS_URL = "https://api.razorpay.com/v1/payment_links"

# Card declines on a fundable/issuer reason: route recovery to UPI Autopay — a different
# rail off the failing card network. Hard declines never reach rail selection (guarded upstream).
RAIL_ROUTABLE = {"insufficient_funds", "issuer_down", "do_not_honor"}


def claude_decide(context: dict) -> dict:
    """Call Claude for a structured recovery decision. Falls back to None on error/no key."""
    if not config.ANTHROPIC_API_KEY:
        return None  # ML-only path
    try:
        import anthropic, json as _json
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": _CLAUDE_DECIDE_PROMPT.format(
                context=_json.dumps(context)
            )}],
        )
        return _json.loads(resp.content[0].text.strip())
    except Exception:
        return None


def select_rail(event: dict) -> str:
    """Recovery rail for this event. Returns 'upi' when a card decline is routed off-network,
    else the original method. Only card payments on a RAIL_ROUTABLE reason reroute."""
    method = event.get("method") or "card"
    if method == "card" and (event.get("error_reason") or "") in RAIL_ROUTABLE:
        return "upi"
    return method


def create_payment_link(event: dict) -> dict:
    pid = event["payment_id"]

    if not config.RAZORPAY_KEY_ID or not config.RAZORPAY_KEY_SECRET:
        mock_id = f"plink_mock_{pid}"
        db.log_audit(pid, "link_mock", "no Razorpay keys")
        return {"id": mock_id, "short_url": "https://rzp.io/i/mock"}

    body = {
        "amount": event["amount_paise"],
        "currency": event.get("currency", "INR"),
        "customer": {
            "email": event.get("email") or "",
            "contact": event.get("contact") or "",
        },
        "notify": {"sms": True, "email": True},
        "reminder_enable": True,
        "notes": {"recovery_for": pid},
        "description": f"Recovery for failed payment {pid}",
    }

    if event.get("chosen_rail") == "upi":
        body["options"] = {"checkout": {"method": {"upi": "1"}}}

    resp = httpx.post(
        RAZORPAY_LINKS_URL,
        json=body,
        auth=(config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET),
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    db.log_audit(pid, "link_created", data.get("id", ""))
    return {"id": data["id"], "short_url": data["short_url"]}


def run_recovery(payment_id: str):
    event = db.get_event(payment_id)
    if not event:
        return

    # Guards: never retry hard, already recovered, or cancelled
    if event.get("classification") == "hard":
        db.log_audit(payment_id, "hard_guard", "hard-decline recovery blocked")
        events.push("hard_guard", payment_id, {})
        return
    if event.get("recovered"):
        db.log_audit(payment_id, "already_recovered", "skip")
        return
    if event.get("merchant_cancelled"):
        db.log_audit(payment_id, "cancelled_guard", "merchant cancelled")
        return

    allowed, why = compliance.check_retry_allowed(event)
    if not allowed:
        action = ("cardtesting_spacing_block" if why.startswith("cardtesting_spacing_block")
                  else "network_cap_block")
        db.log_audit(payment_id, action, why)
        events.push(action, payment_id, {"why": why})
        return

    upi_ok, upi_why = compliance.check_upi_mandate_allowed(event)
    if not upi_ok:
        db.log_audit(payment_id, "upi_mandate_cycle_block", upi_why)
        return

    from src.classifier import classify_trajectory
    trajectory = classify_trajectory(db.get_decline_history(payment_id))
    if trajectory == "trajectory_escalating":
        db.log_audit(payment_id, "trajectory_block", "escalating decline pattern — stopping retry")
        events.push("trajectory_block", payment_id, {})
        return

    # EV guard: skip if expected value negative across all channels
    amount_inr = (event.get("amount_paise") or 0) / 100
    confidence = event.get("confidence") or 0.5
    min_cost = min(config.CHANNEL_COSTS_INR.values())
    ev = confidence * amount_inr - min_cost
    if ev <= 0:
        arithmetic = f"EV={confidence:.2f}*{amount_inr:.2f}-{min_cost:.2f}={ev:.2f}<=0"
        db.log_audit(payment_id, "skipped_uneconomic", arithmetic)
        events.push("ev_skip", payment_id, {"arithmetic": arithmetic})
        return

    # Claude decision engine — structured action decision before committing attempt
    ctx = {
        "decline_reason": event.get("error_reason"),
        "attempt_number": (event.get("attempts") or 0) + 1,
        "trajectory": trajectory,
        "card_network": event.get("card_network"),
        "issuer": event.get("card_issuer"),
        "amount_inr": amount_inr,
        "ev_score": round(ev, 2),
        "method": event.get("method"),
    }
    claude = claude_decide(ctx)
    if claude:
        db.update_event(payment_id,
                        claude_decision=claude.get("action"),
                        claude_reasoning=claude.get("reasoning"))
        db.log_audit(payment_id, "claude_decision",
                     f"action={claude.get('action')} conf={claude.get('confidence')}")
        if claude.get("action") == "abandon":
            db.log_audit(payment_id, "claude_abandon", claude.get("reasoning", ""))
            return

    compliance.record_attempt(event)

    attempts = (event.get("attempts") or 0) + 1
    db.update_event(payment_id, attempts=attempts)
    db.log_audit(payment_id, "recovery_attempt", f"attempt={attempts}")

    rail = select_rail(event)
    # Claude reroute override
    if claude and claude.get("action") == "reroute" and claude.get("rail"):
        rail = claude["rail"]
        db.log_audit(payment_id, "claude_reroute", f"claude overrides rail to {rail}")
    event["chosen_rail"] = rail
    if rail != (event.get("method") or "card"):
        db.update_event(payment_id, chosen_rail=rail)
        db.log_audit(payment_id, "rail_routed", f"{event.get('error_reason')}->{rail}")

    try:
        link = create_payment_link(event)
    except Exception as e:
        db.log_audit(payment_id, "link_error", str(e)[:200])
        return

    from src.upi_intent import generate_upi_intent_uri
    amount_inr = (event.get("amount_paise") or 0) / 100
    upi_intent = generate_upi_intent_uri(
        payee_vpa=config.RECOVR_UPI_VPA,
        payee_name=config.RECOVR_MERCHANT_NAME,
        transaction_ref=payment_id,
        amount_inr=amount_inr,
        note=f"Payment recovery for {payment_id}",
    )
    event["upi_intent_url"] = upi_intent

    db.update_event(
        payment_id,
        payment_link_id=link["id"],
        payment_link_url=link["short_url"],
        upi_intent_url=upi_intent,
    )
    events.push("recovery_attempt", payment_id,
                {"attempt": attempts, "rail": rail, "link_id": link["id"], "upi_intent_url": upi_intent})

    # Send nudge (imported here to avoid circular at module level)
    try:
        from src.nudge import send as nudge_send
        nudge_send(event, link["short_url"])
    except Exception as e:
        db.log_audit(payment_id, "nudge_error", str(e)[:200])

    # Reschedule if under cap and not yet recovered
    if attempts < MAX_ATTEMPTS:
        prediction = sched.predict_retry_window({
            "method": event.get("method", "card"),
            "international": bool(event.get("international")),
            "error_reason": event.get("error_reason", "payment_failed"),
            "amount_paise": event.get("amount_paise", 0),
            "card_network": event.get("card_network"),
            "card_type": event.get("card_type"),
            "card_issuer": event.get("card_issuer"),
        })
        sched.schedule_retry(payment_id, prediction["delay_hours"],
                             error_reason=event.get("error_reason", ""),
                             issuer=event.get("card_issuer") or "",
                             method=event.get("method") or "card")
    else:
        db.log_audit(payment_id, "give_up", f"max attempts ({MAX_ATTEMPTS}) reached")
