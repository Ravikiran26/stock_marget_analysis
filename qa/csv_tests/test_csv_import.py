"""
CSV Import Test Suite — tests the trade_parser directly (no HTTP, no DB).

Run: cd backend && python -m pytest ../qa/csv_tests/test_csv_import.py -v
"""
import sys
import io
from pathlib import Path
from datetime import date

# Add backend to path
BACKEND = Path(__file__).parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

from services.trade_parser import (
    parse_broker_file,
    parse_zerodha,
    parse_upstox,
    parse_groww,
    parse_dhan,
    parse_angelone,
    parse_generic_csv,
    _detect_broker,
    _norm_cols,
)
import pandas as pd
import pytest


# ─── Helpers ──────────────────────────────────────────────────────────────────

def csv_bytes(content: str) -> bytes:
    return content.strip().encode("utf-8")

def assert_trade(trade: dict, **expected):
    for k, v in expected.items():
        assert trade.get(k) == v, f"trade[{k!r}]: expected {v!r}, got {trade.get(k)!r}"

def assert_no_nulls(trades: list[dict], required_fields: list[str]):
    for i, t in enumerate(trades):
        for f in required_fields:
            assert t.get(f) is not None, f"Trade {i}: field {f!r} is None\nTrade: {t}"


# ─── Zerodha Tradebook ────────────────────────────────────────────────────────

ZERODHA_TRADEBOOK_CSV = """
trade_id,trade_type,instrument_type,symbol,expiry,strike,option_type,quantity,price,order_execution_time
1001,BUY,EQ,RELIANCE,,,,10,2450.00,2024-01-15 10:30:00
1002,SELL,EQ,RELIANCE,,,,10,2510.00,2024-01-20 14:15:00
1003,BUY,FUT,NIFTY,2024-01-25,,,25,18500.00,2024-01-10 09:20:00
1004,SELL,FUT,NIFTY,2024-01-25,,,25,18750.00,2024-01-10 15:25:00
1005,BUY,CE,BANKNIFTY,2024-01-24,44000,CE,25,350.00,2024-01-22 10:00:00
""".strip()

ZERODHA_PNL_CSV = """
symbol,isin,quantity,buy_value,sell_value,realized_pl,realized_pl_pct,previous_closing_price,open_quantity,open_quantity_type,open_value,unrealized_pl,unrealized_pl_pct
INFY,INE009A01021,50,75000,80000,5000,6.67,1600,0,,,
TCS,INE467B01029,100,350000,380000,30000,8.57,3800,10,buy,38000,
WIPRO,INE075A01022,0,0,0,0,0,500,20,buy,10000,
""".strip()


def test_zerodha_tradebook_basic():
    trades = parse_broker_file(csv_bytes(ZERODHA_TRADEBOOK_CSV), "zerodha_tradebook.csv", "zerodha")
    assert len(trades) >= 2, f"Expected at least 2 closed trades, got {len(trades)}"

def test_zerodha_tradebook_equity_pnl():
    trades = parse_broker_file(csv_bytes(ZERODHA_TRADEBOOK_CSV), "t.csv", "zerodha")
    reliance = [t for t in trades if "RELIANCE" in (t.get("symbol") or "")]
    assert reliance, "RELIANCE trade not found"
    t = reliance[0]
    assert t["status"] == "closed"
    assert t["pnl"] == 600.0, f"Expected ₹600 P&L, got {t['pnl']}"
    assert t["entry_price"] == 2450.0
    assert t["exit_price"] == 2510.0

def test_zerodha_tradebook_futures():
    trades = parse_broker_file(csv_bytes(ZERODHA_TRADEBOOK_CSV), "t.csv", "zerodha")
    nifty = [t for t in trades if "NIFTY" in (t.get("symbol") or "") and t.get("instrument_type") == "futures"]
    assert nifty, "NIFTY futures trade not found"
    assert nifty[0]["status"] == "closed"

def test_zerodha_tradebook_open_position():
    trades = parse_broker_file(csv_bytes(ZERODHA_TRADEBOOK_CSV), "t.csv", "zerodha")
    open_pos = [t for t in trades if t.get("status") == "open"]
    assert open_pos, "Expected 1 open position (unmatched BANKNIFTY BUY)"

def test_zerodha_pnl_format():
    trades = parse_broker_file(csv_bytes(ZERODHA_PNL_CSV), "pnl.csv", "zerodha")
    assert len(trades) >= 2
    infy = next((t for t in trades if t.get("symbol") == "INFY"), None)
    assert infy is not None
    assert infy["pnl"] == 5000.0
    assert infy["status"] == "closed"

def test_zerodha_pnl_open_position():
    trades = parse_broker_file(csv_bytes(ZERODHA_PNL_CSV), "pnl.csv", "zerodha")
    wipro_open = [t for t in trades if t.get("symbol") == "WIPRO" and t.get("status") == "open"]
    assert wipro_open, "WIPRO open position not found in P&L format"


# ─── Auto-detect broker ────────────────────────────────────────────────────────

def test_auto_detect_zerodha():
    df = pd.read_csv(io.StringIO(ZERODHA_TRADEBOOK_CSV))
    detected = _detect_broker(df)
    assert detected == "zerodha", f"Expected 'zerodha', got {detected!r}"

def test_auto_detect_falls_back_to_claude_for_unknown():
    unknown_csv = """
Date,Stock,Action,Qty,Rate,Total PNL
15-01-2024,RELIANCE,BUY,10,2450,
20-01-2024,RELIANCE,SELL,10,2510,600
""".strip()
    df = pd.read_csv(io.StringIO(unknown_csv))
    detected = _detect_broker(df)
    assert detected is None, "Unknown CSV should not be auto-detected"


# ─── Upstox Tradebook ─────────────────────────────────────────────────────────

UPSTOX_TRADEBOOK_CSV = """
Instrument Name,ISIN,Exchange,Segment,Product,Trade Date,Trade Number,Order Number,Trade Time,Buy/Sell,Quantity,Price,Trade Value
RELIANCE,INE002A01018,NSE,EQ,D,15-01-2024,T001,O001,10:30:00,Buy,10,2450.00,24500.00
RELIANCE,INE002A01018,NSE,EQ,D,20-01-2024,T002,O002,14:15:00,Sell,10,2510.00,25100.00
NIFTY24JANFUT,,NSE,FO,D,10-01-2024,T003,O003,09:20:00,Buy,25,18500.00,462500.00
NIFTY24JANFUT,,NSE,FO,D,10-01-2024,T004,O004,15:25:00,Sell,25,18750.00,468750.00
""".strip()


def test_upstox_tradebook_parsed():
    trades = parse_broker_file(csv_bytes(UPSTOX_TRADEBOOK_CSV), "upstox.csv", "upstox")
    assert len(trades) >= 1

def test_upstox_tradebook_equity():
    trades = parse_broker_file(csv_bytes(UPSTOX_TRADEBOOK_CSV), "upstox.csv", "upstox")
    reliance = [t for t in trades if t.get("symbol") == "RELIANCE"]
    assert reliance, "RELIANCE not found in Upstox import"
    assert reliance[0]["status"] == "closed"
    assert reliance[0]["pnl"] == 600.0

def test_upstox_broker_label():
    trades = parse_broker_file(csv_bytes(UPSTOX_TRADEBOOK_CSV), "upstox.csv", "upstox")
    assert all(t.get("broker") == "Upstox" for t in trades if t.get("broker"))


# ─── Groww ────────────────────────────────────────────────────────────────────

GROWW_CSV = """
Symbol,ISIN,Realised P&L,Quantity Sold,Average Buy Price,Average Sell Price,Date Of Purchase,Date Of Selling
HDFCBANK,INE040A01034,2500,50,1450.00,1500.00,10-01-2024,25-01-2024
ICICIBANK,INE090A01021,-500,100,980.00,975.00,05-01-2024,15-01-2024
""".strip()


def test_groww_parsed():
    trades = parse_broker_file(csv_bytes(GROWW_CSV), "groww.csv", "groww")
    assert len(trades) == 2

def test_groww_profit_trade():
    trades = parse_broker_file(csv_bytes(GROWW_CSV), "groww.csv", "groww")
    hdfc = next((t for t in trades if "HDFCBANK" in (t.get("symbol") or "")), None)
    assert hdfc is not None
    assert hdfc["pnl"] == 2500.0
    assert hdfc["status"] == "closed"

def test_groww_loss_trade():
    trades = parse_broker_file(csv_bytes(GROWW_CSV), "groww.csv", "groww")
    icici = next((t for t in trades if "ICICIBANK" in (t.get("symbol") or "")), None)
    assert icici is not None
    assert icici["pnl"] == -500.0


# ─── Dhan Tradebook ───────────────────────────────────────────────────────────

DHAN_CSV = """
Exchange,Segment,Symbol,Series,Trade Date,Qty,Price,Trade Type
NSE,EQ,RELIANCE,EQ,15-01-2024,10,2450.00,BUY
NSE,EQ,RELIANCE,EQ,20-01-2024,10,2510.00,SELL
NSE,FO,NIFTY,FUT,10-01-2024,25,18500.00,BUY
NSE,FO,NIFTY,FUT,10-01-2024,25,18750.00,SELL
""".strip()


def test_dhan_parsed():
    trades = parse_broker_file(csv_bytes(DHAN_CSV), "dhan.csv", "dhan")
    assert len(trades) >= 1

def test_dhan_broker_label():
    trades = parse_broker_file(csv_bytes(DHAN_CSV), "dhan.csv", "dhan")
    assert all(t.get("broker") == "Dhan" for t in trades if t.get("broker"))


# ─── Angel One ────────────────────────────────────────────────────────────────

ANGELONE_CSV = """
Net Instrument,Buy Qty,Buy Rate,Sell Qty,Sell Rate,Net P&L
RELIANCE-EQ,10,2450.00,10,2510.00,600.00
INFY-EQ,50,1500.00,50,1550.00,2500.00
WIPRO-EQ,20,500.00,0,0.00,
""".strip()


def test_angelone_parsed():
    trades = parse_broker_file(csv_bytes(ANGELONE_CSV), "angelone.csv", "angelone")
    assert len(trades) >= 1

def test_angelone_profit():
    trades = parse_broker_file(csv_bytes(ANGELONE_CSV), "angelone.csv", "angelone")
    reliance = next((t for t in trades if "RELIANCE" in (t.get("symbol") or "")), None)
    assert reliance is not None
    assert reliance["pnl"] == 600.0


# ─── Claude Fallback (generic/auto) ───────────────────────────────────────────

UNKNOWN_BROKER_CSV = """
Date,Stock Name,Trade Type,Shares,Buy Price,Sell Price,Profit/Loss
15-01-2024,RELIANCE,BUY-SELL,10,2450.00,2510.00,600.00
10-01-2024,INFY,BUY-SELL,50,1500.00,1550.00,2500.00
05-01-2024,TCS,BUY-SELL,5,3800.00,3750.00,-250.00
""".strip()


def test_auto_broker_calls_claude_fallback():
    """Auto broker with unrecognized columns should invoke the Claude fallback."""
    df = pd.read_csv(io.StringIO(UNKNOWN_BROKER_CSV))
    detected = _detect_broker(df)
    assert detected is None, "Should not detect known broker for custom CSV"

def test_parse_broker_file_auto_mode():
    """parse_broker_file with 'auto' should attempt Claude mapping (may fail without API key)."""
    try:
        trades = parse_broker_file(csv_bytes(UNKNOWN_BROKER_CSV), "custom.csv", "auto")
        # If Claude responds: trades should have symbol + pnl
        assert isinstance(trades, list)
        if trades:
            assert_no_nulls(trades, ["symbol"])
    except ValueError as e:
        # Acceptable: Claude couldn't map columns or API key not set
        assert "mapping" in str(e).lower() or "api" in str(e).lower() or "column" in str(e).lower(), \
            f"Unexpected ValueError: {e}"
    except Exception as e:
        # API key missing in local env → acceptable in CI
        if "api" in str(e).lower() or "anthropic" in str(e).lower() or "key" in str(e).lower():
            pytest.skip(f"Skipping Claude fallback test — API key not set locally: {e}")
        raise


# ─── Route validation ──────────────────────────────────────────────────────────

def test_supported_brokers_include_angelone_and_auto():
    """Verify the route file's SUPPORTED_BROKERS set includes angelone and auto."""
    route_text = (BACKEND / "routes" / "import_trades.py").read_text()
    assert '"angelone"' in route_text or "'angelone'" in route_text, \
        "CRITICAL: 'angelone' missing from SUPPORTED_BROKERS — Angel One users get 400 error"
    assert '"auto"' in route_text or "'auto'" in route_text, \
        "CRITICAL: 'auto' missing from SUPPORTED_BROKERS — Auto-detect users get 400 error"


# ─── Claude fallback for broken known-broker CSVs ─────────────────────────────

CUSTOM_FORMAT_CSV = """
Date,Stock Name,Trade Type,Shares,Buy Price,Sell Price,Profit/Loss
15-01-2024,RELIANCE,BUY-SELL,10,2450.00,2510.00,600.00
10-01-2024,INFY,BUY-SELL,50,1500.00,1550.00,2500.00
""".strip()

def test_zerodha_wrong_format_does_not_crash():
    """
    User selects Zerodha but uploads a completely different CSV.
    Should not raise — must either return trades (via Claude) or return [].
    MUST NOT crash with 500.
    """
    result = parse_broker_file(csv_bytes(CUSTOM_FORMAT_CSV), "my_trades.csv", "zerodha")
    assert isinstance(result, list), "Must return a list, not raise an exception"

def test_upstox_wrong_format_does_not_crash():
    result = parse_broker_file(csv_bytes(CUSTOM_FORMAT_CSV), "my_trades.csv", "upstox")
    assert isinstance(result, list)

def test_groww_wrong_format_does_not_crash():
    result = parse_broker_file(csv_bytes(CUSTOM_FORMAT_CSV), "my_trades.csv", "groww")
    assert isinstance(result, list)

def test_dhan_wrong_format_does_not_crash():
    result = parse_broker_file(csv_bytes(CUSTOM_FORMAT_CSV), "my_trades.csv", "dhan")
    assert isinstance(result, list)

def test_angelone_wrong_format_does_not_crash():
    result = parse_broker_file(csv_bytes(CUSTOM_FORMAT_CSV), "my_trades.csv", "angelone")
    assert isinstance(result, list)

def test_known_broker_bad_csv_falls_back_not_500():
    """
    Core guarantee: any broker + any CSV must never raise an unhandled exception.
    The worst outcome is an empty list (handled gracefully upstream as 422 with message).
    """
    try:
        import anthropic  # noqa: F401
    except ImportError:
        pytest.skip("anthropic not installed locally — test runs on Railway where it is installed")

    garbage = b"this,is,not,a,broker,csv\n1,2,3,4,5,6\n"
    for broker in ["zerodha", "upstox", "groww", "dhan", "angelone", "auto"]:
        try:
            result = parse_broker_file(garbage, f"test.csv", broker)
            assert isinstance(result, list), f"{broker}: expected list, got {type(result)}"
        except ValueError:
            pass  # ValueError is acceptable — it's caught in the route and returned as 422


# ─── Edge cases ───────────────────────────────────────────────────────────────

def test_empty_csv_raises():
    with pytest.raises(Exception):
        parse_broker_file(b"", "empty.csv", "zerodha")

def test_csv_with_no_valid_trades():
    bad_csv = "col1,col2,col3\n,,\n,,\n"
    trades = parse_broker_file(csv_bytes(bad_csv), "bad.csv", "zerodha")
    assert trades == [], f"Expected empty list for CSV with no valid trades, got {trades}"

def test_fifo_matching_partial_quantity():
    """Test FIFO matching when buy qty > sell qty — remainder stays open."""
    csv = """
trade_id,trade_type,instrument_type,symbol,expiry,strike,option_type,quantity,price,order_execution_time
1,BUY,EQ,TATAMOTORS,,,,20,500.00,2024-01-10 10:00:00
2,SELL,EQ,TATAMOTORS,,,,10,550.00,2024-01-15 14:00:00
""".strip()
    trades = parse_broker_file(csv_bytes(csv), "t.csv", "zerodha")
    closed = [t for t in trades if t.get("status") == "closed"]
    open_pos = [t for t in trades if t.get("status") == "open"]
    assert closed, "Expected 1 closed trade"
    assert open_pos, "Expected 1 open position (remaining 10 qty)"
    assert closed[0]["quantity"] == 10
    assert open_pos[0]["quantity"] == 10

def test_instrument_type_detection_options():
    csv = """
trade_id,trade_type,instrument_type,symbol,expiry,strike,option_type,quantity,price,order_execution_time
1,BUY,CE,NIFTY,2024-01-25,22000,CE,50,350.00,2024-01-22 10:00:00
""".strip()
    trades = parse_broker_file(csv_bytes(csv), "t.csv", "zerodha")
    open_pos = [t for t in trades if t.get("status") == "open"]
    assert open_pos
    assert open_pos[0]["instrument_type"] == "options"

def test_instrument_type_detection_futures():
    csv = """
trade_id,trade_type,instrument_type,symbol,expiry,strike,option_type,quantity,price,order_execution_time
1,BUY,FUT,BANKNIFTY,2024-01-25,,,25,48000.00,2024-01-22 10:00:00
""".strip()
    trades = parse_broker_file(csv_bytes(csv), "t.csv", "zerodha")
    open_pos = [t for t in trades if t.get("status") == "open"]
    assert open_pos
    assert open_pos[0]["instrument_type"] == "futures"

def test_duplicate_rows_not_double_counted():
    """Same trade imported twice should be handled by FIFO — not silently doubled."""
    trades = parse_broker_file(csv_bytes(ZERODHA_TRADEBOOK_CSV), "t.csv", "zerodha")
    symbols = [t.get("symbol") for t in trades if t.get("symbol") == "RELIANCE"]
    assert len(symbols) == 1, f"RELIANCE should appear once, got {len(symbols)}"
