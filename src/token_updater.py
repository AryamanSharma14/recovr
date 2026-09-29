"""Card Account Updater (CAU) and Network Tokenization Lifecycle Engine.

Simulates Visa VTS / Mastercard MDES Token Service Provider (TSP) queries
to resolve expiring credentials before triggering permanent Category-1 halts.
"""
from typing import TypedDict


class TokenRefreshResult(TypedDict):
    eligible: bool
    refreshed: bool
    action: str
    network_token: str | None
    new_expiry: str | None
    tsp_reference: str | None
    reason: str


SUPPORTED_ISSUERS = {
    "hdfc", "icici", "sbi", "axis", "kotak", "yes bank", "indusind", "citi", "rbl"
}


def attempt_token_refresh(
    card_network: str | None,
    card_issuer: str | None,
    card_iin: str | None,
    error_reason: str | None,
) -> TokenRefreshResult:
    """Attempts network token refresh via Visa VTS / Mastercard MDES.

    If an instrument declined due to card expiration, check if the issuing
    bank supports automatic lifecycle tokenization.
    """
    reason = (error_reason or "").lower()
    net = (card_network or "").lower()
    issuer = (card_issuer or "").lower()

    # Permanent terminal reasons cannot be refreshed
    if reason in ("invalid_account", "stolen_card", "lost_card", "pickup_card"):
        return {
            "eligible": False,
            "refreshed": False,
            "action": "hard_stop",
            "network_token": None,
            "new_expiry": None,
            "tsp_reference": None,
            "reason": f"TSP lifecycle check failed: terminal state ({reason})",
        }

    # Only card_expired or card_update_required is eligible for token refresh
    if reason not in ("card_expired", "expired_card"):
        return {
            "eligible": False,
            "refreshed": False,
            "action": "proceed",
            "network_token": None,
            "new_expiry": None,
            "tsp_reference": None,
            "reason": "Not an expiring instrument decline",
        }

    # Check if network & issuer support TSP automated token updates
    if net in ("visa", "mastercard", "rupay") and any(sup in issuer for sup in SUPPORTED_ISSUERS):
        mock_token = f"tok_net_{net[:4]}_{card_iin or '424242'}"
        return {
            "eligible": True,
            "refreshed": True,
            "action": "retry_tokenized",
            "network_token": mock_token,
            "new_expiry": "12/29",
            "tsp_reference": f"tsp_ref_{net[:2]}_88921",
            "reason": f"Network Token refreshed via {net.upper()} Token Service ({issuer.upper()})",
        }

    return {
        "eligible": True,
        "refreshed": False,
        "action": "hard_stop",
        "network_token": None,
        "new_expiry": None,
        "tsp_reference": None,
        "reason": f"No active Network Token on file for {issuer or 'unknown issuer'}",
    }
