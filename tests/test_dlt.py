"""Unit tests for TRAI DLT template engine."""
import pytest
from datetime import datetime, timezone, timedelta
from src.dlt import format_dlt_message, is_within_quiet_hours, DLT_TEMPLATES


def test_format_dlt_message_valid():
    res = format_dlt_message(
        "TXN_RETRY_LINK",
        amount="1499.00",
        merchant="Cult.fit",
        url="https://rzp.io/i/test",
    )
    assert res["compliant"] is True
    assert res["dlt_template_id"] == DLT_TEMPLATES["TXN_RETRY_LINK"]["id"]
    assert "1499.00" in res["message"]
    assert "Cult.fit" in res["message"]


def test_format_dlt_message_missing_var_raises():
    with pytest.raises(ValueError):
        format_dlt_message("TXN_RETRY_LINK", amount="1499.00")


def test_format_dlt_message_unknown_template_raises():
    with pytest.raises(ValueError):
        format_dlt_message("NON_EXISTENT_TEMPLATE")


def test_is_within_quiet_hours():
    # 22:30 IST is 17:00 UTC (within quiet hours 21:00-09:00 IST)
    dt_night = datetime(2026, 9, 29, 17, 0, tzinfo=timezone.utc)
    assert is_within_quiet_hours(dt_night) is True

    # 14:00 IST is 08:30 UTC (outside quiet hours)
    dt_day = datetime(2026, 9, 29, 8, 30, tzinfo=timezone.utc)
    assert is_within_quiet_hours(dt_day) is False
