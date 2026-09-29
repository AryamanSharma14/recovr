"""Unit tests for recovr CLI."""
import subprocess
import sys


def test_cli_version():
    res = subprocess.run(
        [sys.executable, "-m", "src.cli", "version"],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0
    assert "recovr v0.1.0" in res.stdout


def test_cli_status():
    res = subprocess.run(
        [sys.executable, "-m", "src.cli", "status"],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0
    assert "recovr - Autonomous Revenue Recovery Engine" in res.stdout
    assert "Engine Status    : HEALTHY" in res.stdout
