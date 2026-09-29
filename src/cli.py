"""recovr command-line interface.

Autonomous Revenue Recovery Engine and Dunning Middleware.
"""
import argparse
import sys
from datetime import datetime


def cmd_serve(args):
    import uvicorn
    print(f"Starting recovr engine on {args.host}:{args.port} (reload={args.reload})...")
    uvicorn.run("src.main:app", host=args.host, port=args.port, reload=args.reload)


def cmd_status(args):
    from src import config, db
    print("==================================================")
    print("recovr - Autonomous Revenue Recovery Engine")
    print("==================================================")
    print(f"Environment Mode : {'SANDBOX' if config.DEMO_MODE else 'LIVE'}")
    print(f"Database Path    : {config.DB_PATH}")

    try:
        events = db.all_events()
        audit_rows = db.get_audit_log(limit=0)
        recovered = [e for e in events if e.get("recovered")]
        soft = [e for e in events if e.get("classification") == "soft"]
        hard = [e for e in events if e.get("classification") == "hard"]
        downtimes = db.all_active_downtimes()

        total_rev_inr = sum(e.get("amount_paise", 0) for e in recovered) / 100

        print(f"Total Transactions: {len(events)}")
        print(f"  - Soft Declines : {len(soft)}")
        print(f"  - Hard Declines : {len(hard)}")
        print(f"  - Recovered     : {len(recovered)} (INR {total_rev_inr:,.2f})")
        print(f"Audit Entries    : {len(audit_rows)}")
        print(f"Active Downtimes : {len(downtimes)}")
        print("Engine Status    : HEALTHY (ready to accept gateway webhooks)")
    except Exception as e:
        print(f"Error querying database: {e}")
    print("==================================================")


def cmd_backtest(args):
    print("Running multi-policy recovery backtest benchmark...")
    try:
        from scripts.backtest import run
        res = run(output_md=True)
        print("\nBacktest completed successfully. Summary:")
        print(f"  - Evaluated Transactions : {res['soft_total']}")
        print(f"  - Control Recovery Rate  : {res['control_rate_pct']}%")
        print(f"  - recovr ML Recovery Rate: {res['recovery_rate_pct']}%")
        print(f"  - Net Recovery Lift      : {res['lift_pts']:+.1f} pts")
        print(f"  - Network Fines Incurred : INR {res['ours_fines_inr']:.2f}")
    except Exception as e:
        print(f"Error executing backtest: {e}")
        sys.exit(1)


def cmd_version(args):
    print("recovr v0.1.0 (Autonomous Revenue Recovery Engine)")


def main():
    parser = argparse.ArgumentParser(
        prog="recovr",
        description="Autonomous Revenue Recovery Engine and Dunning Middleware",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # serve
    p_serve = subparsers.add_parser("serve", help="Start the HTTP API server and recovery daemon")
    p_serve.add_argument("--host", default="0.0.0.0", help="Host interface to bind (default: 0.0.0.0)")
    p_serve.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    p_serve.add_argument("--reload", action="store_true", help="Enable code hot-reload")

    # status
    subparsers.add_parser("status", help="Inspect local recovery engine state and database metrics")

    # backtest
    subparsers.add_parser("backtest", help="Run comparative multi-policy recovery benchmark")

    # version
    subparsers.add_parser("version", help="Print version information")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    handlers = {
        "serve": cmd_serve,
        "status": cmd_status,
        "backtest": cmd_backtest,
        "version": cmd_version,
    }
    handlers[args.command](args)


if __name__ == "__main__":
    main()
