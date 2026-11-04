"""Tests for loading and calculating over the synthetic portfolio (FR-001, FR-002)."""

import json

import pytest

from wealth_agent.portfolio import (
    PortfolioDataError,
    allocation,
    holdings_with_values,
    load_portfolio,
    project_savings,
    rebalancing_summary,
)


@pytest.fixture
def portfolio():
    return load_portfolio()


def write(tmp_path, data):
    path = tmp_path / "p.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


VALID = {
    "currency": "USD",
    "target_allocation_pct": {"a": 60, "b": 40},
    "holdings": [
        {"symbol": "A", "name": "A", "asset_class": "a", "quantity": 1, "price": 10.0},
    ],
}


# --- loading (FR-001) ---------------------------------------------------------


def test_bundled_portfolio_loads(portfolio):
    assert portfolio["currency"] == "USD"
    assert len(portfolio["holdings"]) == 4


def test_load_from_explicit_path(tmp_path):
    assert load_portfolio(write(tmp_path, VALID))["currency"] == "USD"


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.pop("holdings"),
        lambda d: d.pop("target_allocation_pct"),
        lambda d: d["target_allocation_pct"].update(a=70),  # sums to 110
        lambda d: d["holdings"][0].update(quantity=-1),
        lambda d: d["holdings"][0].update(price="ten"),
        lambda d: d["holdings"][0].update(asset_class="unknown"),
    ],
)
def test_invalid_data_is_rejected(tmp_path, mutate):
    data = json.loads(json.dumps(VALID))
    mutate(data)
    with pytest.raises(PortfolioDataError):
        load_portfolio(write(tmp_path, data))


# --- holdings and allocation (FR-002) -----------------------------------------


def test_holdings_values(portfolio):
    result = holdings_with_values(portfolio)
    assert result["total_value"] == 70000.0
    values = {h["symbol"]: h["market_value"] for h in result["holdings"]}
    assert values == {"VTI": 30000.0, "VXUS": 12000.0, "BND": 18000.0, "CASH": 10000.0}


def test_holdings_do_not_expose_notes(portfolio):
    # Free-text notes are not needed to answer questions and are an injection vector (FR-008).
    for h in holdings_with_values(portfolio)["holdings"]:
        assert "note" not in h


def test_allocation_and_drift(portfolio):
    rows = {r["asset_class"]: r for r in allocation(portfolio)["by_asset_class"]}
    assert rows["us_equity"]["current_pct"] == 42.86
    assert rows["cash"]["current_pct"] == 14.29
    assert rows["cash"]["target_pct"] == 5.0
    assert rows["cash"]["drift_pct"] == 9.29
    assert rows["bonds"]["drift_pct"] == -4.29


# --- rebalancing (FR-002) -----------------------------------------------------


def test_rebalancing_outside_tolerance(portfolio):
    result = rebalancing_summary(portfolio, tolerance_pct=5)
    assert result["within_tolerance"] is False
    adj = {a["asset_class"]: (a["action"], a["amount"]) for a in result["adjustments"]}
    assert adj == {
        "us_equity": ("increase", 1500.0),
        "intl_equity": ("increase", 2000.0),
        "bonds": ("increase", 3000.0),
        "cash": ("decrease", 6500.0),
    }
    assert "informational" in result["note"].lower()


def test_rebalancing_within_tolerance(portfolio):
    result = rebalancing_summary(portfolio, tolerance_pct=10)
    assert result["within_tolerance"] is True
    assert result["adjustments"] == []


# --- projection (FR-002) ------------------------------------------------------


def test_projection_monthly_compounding():
    r = project_savings(initial_amount=10000, monthly_contribution=0, annual_return_pct=10, years=1)
    assert r["future_value"] == 11047.13
    assert r["total_contributed"] == 10000.0
    assert r["growth"] == 1047.13


def test_projection_with_contributions():
    r = project_savings(initial_amount=0, monthly_contribution=100, annual_return_pct=12, years=1)
    # 100 * ((1.01^12 - 1) / 0.01), contributions at month end
    assert r["future_value"] == 1268.25
    assert r["total_contributed"] == 1200.0


def test_projection_zero_return():
    r = project_savings(initial_amount=1000, monthly_contribution=100, annual_return_pct=0, years=1)
    assert r["future_value"] == 2200.0
    assert r["growth"] == 0.0
