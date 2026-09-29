import os
from dotenv import load_dotenv

load_dotenv()

SANDBOX_MODE = os.getenv("SANDBOX_MODE", os.getenv("DEMO_MODE", "true")).lower() == "true"
DEMO_MODE = SANDBOX_MODE

RECOVR_UPI_VPA = os.getenv("RECOVR_UPI_VPA", "recovr.checkout@icici")
RECOVR_MERCHANT_NAME = os.getenv("RECOVR_MERCHANT_NAME", "Merchant Checkout")

DB_PATH = os.getenv("DB_PATH", "recovery.db")

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

TWILIO_SID = os.getenv("TWILIO_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")

SENDGRID_KEY = os.getenv("SENDGRID_KEY", "")
SENDGRID_FROM = os.getenv("SENDGRID_FROM", "")

# Channel costs (INR) — declared assumptions, not measured rates. Tune via env or here.
CHANNEL_COSTS_INR = {
    "whatsapp": float(os.getenv("COST_WHATSAPP_INR", "0.35")),
    "email": float(os.getenv("COST_EMAIL_INR", "0.02")),
    "sms": float(os.getenv("COST_SMS_INR", "0.15")),
}

# Bank maintenance windows (IST start/end in minutes from midnight). Crosses-midnight if start>end.
BANK_MAINTENANCE_WINDOWS: dict = {
    "hdfc":  [(23 * 60, 1 * 60)],           # 23:00–01:00 IST daily
    "icici": [(0, 2 * 60)],                  # 00:00–02:00 IST daily
    "axis":  [(23 * 60, 1 * 60)],            # 23:00–01:00 IST daily
    "sbi":   [(23 * 60 + 30, 0 * 60 + 30)],  # 23:30–00:30 IST Sundays (approximated daily)
}
_MAINTENANCE_DEFAULT = [(23 * 60, 1 * 60)]  # conservative default for unknown issuers

ISSUER_DEGRADATION_THRESHOLD = int(os.getenv("ISSUER_DEGRADATION_THRESHOLD", "5"))
ISSUER_DEGRADATION_WINDOW_MINUTES = int(os.getenv("ISSUER_DEGRADATION_WINDOW_MINUTES", "15"))

_REQUIRED_LIVE = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]

def validate():
    if not DEMO_MODE:
        missing = [k for k in _REQUIRED_LIVE if not os.getenv(k)]
        if missing:
            raise RuntimeError(f"Missing required env vars (DEMO_MODE=false): {', '.join(missing)}")
