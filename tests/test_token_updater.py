"""Unit tests for Card Account Updater and Network Tokenization engine."""
import pytest
from src.token_updater import attempt_token_refresh


def test_token_refresh_eligible_visa_hdfc():
    result = attempt_token_refresh(
        card_network="Visa",
        card_issuer="HDFC",
        card_iin="424242",
        error_reason="card_expired",
    )
    assert result["eligible"] is True
    assert result["refreshed"] is True
    assert result["action"] == "retry_tokenized"
    assert "tok_net_visa" in result["network_token"]
    assert result["new_expiry"] == "12/29"


def test_token_refresh_eligible_mastercard_icici():
    result = attempt_token_refresh(
        card_network="Mastercard",
        card_issuer="ICICI",
        card_iin="522222",
        error_reason="card_expired",
    )
    assert result["eligible"] is True
    assert result["refreshed"] is True
    assert result["action"] == "retry_tokenized"
    assert "tok_net_mast" in result["network_token"]


def test_token_refresh_unsupported_issuer():
    result = attempt_token_refresh(
        card_network="Visa",
        card_issuer="Cooperative Bank Unknown",
        card_iin="411111",
        error_reason="card_expired",
    )
    assert result["eligible"] is True
    assert result["refreshed"] is False
    assert result["action"] == "hard_stop"
    assert result["network_token"] is None


def test_token_refresh_terminal_stolen_account():
    result = attempt_token_refresh(
        card_network="Visa",
        card_issuer="HDFC",
        card_iin="424242",
        error_reason="invalid_account",
    )
    assert result["eligible"] is False
    assert result["refreshed"] is False
    assert result["action"] == "hard_stop"


def test_token_refresh_non_expiring_reason():
    result = attempt_token_refresh(
        card_network="Visa",
        card_issuer="HDFC",
        card_iin="424242",
        error_reason="insufficient_funds",
    )
    assert result["eligible"] is False
    assert result["action"] == "proceed"
