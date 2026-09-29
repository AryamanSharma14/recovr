"""TRAI TCCCPR 2018 Distributed Ledger Technology (DLT) Template Registry.

Enforces Indian telecom compliance: validates outbound customer communications
against registered DLT transactional message templates and ensures quiet hours.
"""
from datetime import datetime, timezone, timedelta
from typing import TypedDict


class DLTTemplate(TypedDict):
    id: str
    header: str
    category: str
    pattern: str


DLT_TEMPLATES: dict[str, DLTTemplate] = {
    "TXN_RETRY_LINK": {
        "id": "1407161234567890123",
        "header": "RECOVR",
        "category": "Service_Implicit",
        "pattern": "Your payment of INR {amount} at {merchant} could not be processed. Tap to complete securely: {url}",
    },
    "TXN_UPI_FALLBACK": {
        "id": "1407161234567890124",
        "header": "RECOVR",
        "category": "Service_Implicit",
        "pattern": "Your card payment of INR {amount} failed. Tap to complete instantly via 1-Tap UPI: {url}",
    },
    "PRE_DEBIT_NOTIFICATION": {
        "id": "1407161234567890125",
        "header": "RECOVR",
        "category": "Service_Implicit",
        "pattern": "Pre-debit alert: Your recurring mandate for INR {amount} at {merchant} will execute on {date}. Mandate ID: {mandate_id}",
    },
}

_IST = timezone(timedelta(hours=5, minutes=30))


def is_within_quiet_hours(dt_utc: datetime | None = None) -> bool:
    """TRAI quiet hours: 21:00 (9 PM) to 09:00 (9 AM) IST for non-critical customer notifications."""
    if dt_utc is None:
        dt_utc = datetime.now(timezone.utc)
    elif dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)

    dt_ist = dt_utc.astimezone(_IST)
    hour = dt_ist.hour
    return hour >= 21 or hour < 9


def format_dlt_message(template_key: str, **variables) -> dict:
    """Formats and validates an outbound message against registered DLT templates."""
    template = DLT_TEMPLATES.get(template_key)
    if not template:
        raise ValueError(f"Unknown DLT template key: {template_key}")

    try:
        formatted = template["pattern"].format(**variables)
    except KeyError as e:
        raise ValueError(f"Missing required DLT template variable: {e}")

    return {
        "dlt_template_id": template["id"],
        "dlt_header": template["header"],
        "category": template["category"],
        "message": formatted,
        "compliant": True,
    }
