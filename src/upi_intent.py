"""Direct UPI Intent URI Generator (NPCI Specification).

Generates standardized upi://pay deep links for instant mobile app switching
(Google Pay, PhonePe, Paytm, CRED, BHIM) on Indian mobile checkouts.
"""
from urllib.parse import urlencode


def generate_upi_intent_uri(
    payee_vpa: str = "recovr.merchant@icici",
    payee_name: str = "Merchant Checkout",
    transaction_ref: str = "",
    amount_inr: float = 0.0,
    currency: str = "INR",
    note: str = "Payment Recovery",
) -> str:
    """Constructs a valid NPCI UPI Intent deep link URL.

    Format:
        upi://pay?pa=<vpa>&pn=<name>&tr=<ref>&am=<amount>&cu=INR&tn=<note>
    """
    params = {
        "pa": payee_vpa,
        "pn": payee_name,
        "tr": transaction_ref,
        "am": f"{amount_inr:.2f}",
        "cu": currency,
        "tn": note[:80],
    }
    return f"upi://pay?{urlencode(params)}"
