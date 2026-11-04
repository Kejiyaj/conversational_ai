"""Portfolio data loading and pure, deterministic calculations.

No agent framework imports here, so everything can be unit tested without a model.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

DEFAULT_DATA_PATH = Path(__file__).resolve().parent / "data" / "portfolio.json"


class PortfolioDataError(ValueError):
    """The portfolio data file is missing fields or contains invalid values."""


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def load_portfolio(path: Path | str | None = None) -> dict:
    """Load and validate the portfolio JSON (FR-001)."""
    path = Path(path) if path is not None else DEFAULT_DATA_PATH
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PortfolioDataError(f"cannot read portfolio data: {exc}") from exc

    for key in ("currency", "target_allocation_pct", "holdings"):
        if key not in data:
            raise PortfolioDataError(f"missing field: {key}")

    targets = data["target_allocation_pct"]
    if not isinstance(targets, dict) or not targets:
        raise PortfolioDataError("target_allocation_pct must be a non-empty object")
    if not all(_is_number(v) and v >= 0 for v in targets.values()):
        raise PortfolioDataError("target percentages must be non-negative numbers")
    if not math.isclose(sum(targets.values()), 100, abs_tol=1e-6):
        raise PortfolioDataError("target percentages must sum to 100")

    holdings = data["holdings"]
    if not isinstance(holdings, list) or not holdings:
        raise PortfolioDataError("holdings must be a non-empty list")
    for h in holdings:
        for key in ("symbol", "name", "asset_class", "quantity", "price"):
            if key not in h:
                raise PortfolioDataError(f"holding missing field: {key}")
        if not (_is_number(h["quantity"]) and h["quantity"] >= 0):
            raise PortfolioDataError(f"invalid quantity for {h['symbol']}")
        if not (_is_number(h["price"]) and h["price"] >= 0):
            raise PortfolioDataError(f"invalid price for {h['symbol']}")
        if h["asset_class"] not in targets:
            raise PortfolioDataError(f"unknown asset class for {h['symbol']}")
    return data


def holdings_with_values(portfolio: dict) -> dict:
    """Holdings with market values. Free-text fields such as notes are not returned."""
    rows = [
        {
            "symbol": h["symbol"],
            "name": h["name"],
            "asset_class": h["asset_class"],
            "quantity": h["quantity"],
            "price": round(h["price"], 2),
            "market_value": round(h["quantity"] * h["price"], 2),
        }
        for h in portfolio["holdings"]
    ]
    total = sum(h["quantity"] * h["price"] for h in portfolio["holdings"])
    return {"holdings": rows, "total_value": round(total, 2), "currency": portfolio["currency"]}


def _class_values(portfolio: dict) -> tuple[dict[str, float], float]:
    values = {cls: 0.0 for cls in portfolio["target_allocation_pct"]}
    for h in portfolio["holdings"]:
        values[h["asset_class"]] += h["quantity"] * h["price"]
    return values, sum(values.values())


def allocation(portfolio: dict) -> dict:
    """Current vs target allocation by asset class; drift = current - target."""
    values, total = _class_values(portfolio)
    rows = []
    for cls, target in portfolio["target_allocation_pct"].items():
        current = (values[cls] / total * 100) if total else 0.0
        rows.append(
            {
                "asset_class": cls,
                "value": round(values[cls], 2),
                "current_pct": round(current, 2),
                "target_pct": round(float(target), 2),
                "drift_pct": round(current - target, 2),
            }
        )
    return {
        "total_value": round(total, 2),
        "currency": portfolio["currency"],
        "by_asset_class": rows,
    }


REBALANCE_NOTE = (
    "Informational only: amounts needed to bring each asset class back to target. "
    "No orders are placed. Consult a licensed advisor before acting."
)


def rebalancing_summary(portfolio: dict, tolerance_pct: float = 5.0) -> dict:
    """If any class drifts beyond tolerance, list amounts to return every class to target."""
    values, total = _class_values(portfolio)
    targets = portfolio["target_allocation_pct"]
    drifts = {
        cls: ((values[cls] / total * 100) if total else 0.0) - targets[cls] for cls in targets
    }
    within = all(abs(d) <= tolerance_pct for d in drifts.values())
    adjustments = []
    if not within:
        for cls, target in targets.items():
            delta = total * target / 100 - values[cls]
            if round(delta, 2) != 0:
                adjustments.append(
                    {
                        "asset_class": cls,
                        "action": "increase" if delta > 0 else "decrease",
                        "amount": round(abs(delta), 2),
                    }
                )
    return {
        "within_tolerance": within,
        "tolerance_pct": tolerance_pct,
        "currency": portfolio["currency"],
        "adjustments": adjustments,
        "note": REBALANCE_NOTE,
    }


def project_savings(
    initial_amount: float, monthly_contribution: float, annual_return_pct: float, years: int
) -> dict:
    """Future value with monthly compounding; contributions at the end of each month."""
    months = years * 12
    r = annual_return_pct / 100 / 12
    if r == 0:
        fv = initial_amount + monthly_contribution * months
    else:
        growth_factor = (1 + r) ** months
        fv = initial_amount * growth_factor + monthly_contribution * (growth_factor - 1) / r
    contributed = initial_amount + monthly_contribution * months
    return {
        "future_value": round(fv, 2),
        "total_contributed": round(contributed, 2),
        "growth": round(fv - contributed, 2),
        "assumptions": "Constant return, monthly compounding, contributions at month end. "
        "Not a guarantee of future performance.",
    }
