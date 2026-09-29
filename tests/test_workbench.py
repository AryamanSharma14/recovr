"""Unit tests for developer workbench and advanced scenarios."""
import pytest
from fastapi.testclient import TestClient

from src import db, events


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr("src.config.DB_PATH", str(tmp_path / "workbench_test.db"))
    monkeypatch.setattr("src.recovery.claude_decide", lambda ctx: None)
    db.init_db()
    events.clear()
    from src.main import app
    yield TestClient(app)
    events.clear()


def test_workbench_dispatch_cau_refresh(client):
    resp = client.post(
        "/api/v1/workbench/dispatch",
        json={"scenario": "cau_refresh", "count": 1, "issuer": "HDFC", "network": "Visa"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["created"]) == 1
    pid = data["created"][0]
    ev = db.get_event(pid)
    assert ev["token_refreshed"] == 1
    assert ev["classification"] == "soft"
    assert "Network Token refreshed" in ev["classify_reason"]


def test_workbench_dispatch_rbi_predebit(client):
    resp = client.post(
        "/api/v1/workbench/dispatch",
        json={"scenario": "rbi_predebit", "count": 1}
    )
    assert resp.status_code == 200
    pid = resp.json()["created"][0]
    audit_rows = db.get_audit_log(limit=0, payment_id=pid)
    actions = [r["action"] for r in audit_rows]
    assert "rbi_pre_debit_dispatched" in actions
