"""Unit tests for direct UPI Intent URI generator."""
from urllib.parse import parse_qs, urlparse
from src.upi_intent import generate_upi_intent_uri


def test_generate_upi_intent_uri():
    uri = generate_upi_intent_uri(
        payee_vpa="recovr.test@icici",
        payee_name="Acme Corp",
        transaction_ref="pay_test_12345",
        amount_inr=1499.0,
        currency="INR",
        note="Subscription Recovery",
    )
    assert uri.startswith("upi://pay?")
    parsed = urlparse(uri)
    params = parse_qs(parsed.query)

    assert params["pa"] == ["recovr.test@icici"]
    assert params["pn"] == ["Acme Corp"]
    assert params["tr"] == ["pay_test_12345"]
    assert params["am"] == ["1499.00"]
    assert params["cu"] == ["INR"]
    assert params["tn"] == ["Subscription Recovery"]
