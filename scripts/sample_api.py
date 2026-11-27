"""Sample API responses for screenshots. Callers here are invented placeholders, not real people."""
import time, datetime as dt
from urllib.parse import urlparse, parse_qs

NOW = int(time.time() * 1000)
H = 3600_000
SOL = 142.0

def week_bounds(ms):
    d = dt.datetime.utcfromtimestamp(ms / 1000)
    start = dt.datetime(d.year, d.month, d.day) - dt.timedelta(days=d.weekday())
    s = int(start.replace(tzinfo=dt.timezone.utc).timestamp() * 1000)
    return s, s + 7 * 24 * H

WS, WE = week_bounds(NOW)
import os
EMPTY = os.environ.get("EMPTY") == "1"

def config():
    return {"ticker": "CALLED", "ca": None, "x": None, "platform": {"id": "P1atformXXXX", "own": True, "name": "CALLED", "feeRate": 0.01, "creatorFeeRate": 0},
            "ownPlatformExpected": "P1atformXXXX", "platformAdmin": "AdminXXXX", "treasury": "AdminXXXX", "protocolFee": 0.0025, "solUsd": SOL}

def coin(i, sym, name, mc, status="curve", fill=0.4, calls=0):
    return {"mint": f"{sym}Mint{i}XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"[:44], "poolId": f"Pool{i}", "name": name, "symbol": sym, "image": None,
            "creator": f"Creator{i}XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", "createdAt": NOW - (i + 1) * 3 * H, "platformId": "P1atformXXXX", "status": status,
            "mcSol": mc, "mcUsd": mc * SOL, "priceSol": mc / 1e9, "fill": fill if status == "curve" else 1, "raiseSol": 85, "raisedSol": 85 * fill,
            "startMcSol": 27.96, "gradMcSol": 410.83, "isCalled": True, "calls": calls}

COINS = [coin(0, "LEDGER", "Ledger Dog", 182, fill=0.46, calls=3), coin(1, "STUB", "Stub", 64, fill=0.12, calls=1), coin(2, "TALLY", "Tally", 520, status="graduated", calls=4),
         coin(3, "PRINT", "Print", 96, fill=0.22, calls=0), coin(4, "SLIP", "Slip", 240, fill=0.61, calls=2), coin(5, "INK", "Ink", 41, fill=0.05, calls=0)]

def snap(mc, at, status="curve", src="launchlab"):
    return {"at": at, "priceSol": mc / 1e9, "mcSol": mc, "mcUsd": mc * SOL, "status": status, "source": src}

def call(i, handle, c, entry, after=None, buyers=0, med=None, pts=None, flagged=False, hours_ago=30, live=None):
    at = NOW - hours_ago * H
    res = None
    if after is not None:
        res = {"price": snap(after, at + 24 * H), "callReturn": after / entry - 1, "buyers": buyers, "buyersExact": True, "tradesRead": buyers * 2 + 5,
               "followerMedian": med, "weight": min(1, (buyers / 40) ** 0.5), "points": pts, "flagged": flagged, "settledAt": at + 24 * H}
    return {"id": f"{i:016x}", "seq": 100 + i, "wallet": f"W{handle}XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"[:44], "handle": handle, "xVerified": True,
            "mint": c["mint"], "symbol": c["symbol"], "name": c["name"], "image": None, "post": f"https://x.com/{handle}/status/1", "postAt": at,
            "postVerified": True, "at": at, "due": at + 24 * H, "week": "2026-W48", "entry": snap(entry, at),
            "live": snap(live, NOW) if live else None, "sells": {"checkedAt": NOW, "sold": flagged}, "result": res}

CALLS_ = [
    call(1, "sample_caller_a", COINS[2], 210, after=520, buyers=58, med=0.71, pts=71.0, hours_ago=40),
    call(2, "sample_caller_b", COINS[0], 120, after=182, buyers=22, med=0.31, pts=23.0, hours_ago=30),
    call(3, "sample_caller_c", COINS[4], 300, after=240, buyers=17, med=-0.24, pts=-24.0, hours_ago=28),
    call(4, "sample_caller_d", COINS[1], 30, after=64, buyers=9, med=0.4, pts=0.0, flagged=True, hours_ago=26),
    call(5, "sample_caller_a", COINS[0], 150, live=182, hours_ago=6),
    call(6, "sample_caller_b", COINS[4], 220, live=240, hours_ago=3),
]

def row(handle, calls, settled, hits, med, fmed, flagged, rank, share):
    return {"wallet": f"W{handle}XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"[:44], "handle": handle, "xVerified": True, "calls": calls, "settled": settled, "open": calls - settled,
            "hits": hits, "hitRate": hits / settled if settled else None, "medianPoints": med, "followerMedian": fmed, "flagged": flagged,
            "qualifies": rank is not None, "rank": rank, "share": share, "estSol": 4.21 * share if rank else None}

ROWS = [row("sample_caller_a", 6, 5, 4, 41.2, 0.52, 0, 1, 0.35), row("sample_caller_b", 5, 4, 3, 18.6, 0.27, 0, 2, 0.25),
        row("sample_caller_c", 4, 3, 1, -8.0, -0.11, 0, None, 0), row("sample_caller_d", 3, 2, 1, 0.0, 0.2, 1, None, 0)]

def board():
    b = {"at": NOW, "week": "2026-W48", "weekStart": WS, "weekEnd": WE,
         "pot": {"sol": 4.21, "usd": 4.21 * SOL, "vaultSol": 8.42, "potShare": 0.5},
         "rows": [] if EMPTY else ROWS, "recent": [] if EMPTY else CALLS_, "best": None if EMPTY else CALLS_[0],
         "flagged": [] if EMPTY else [CALLS_[3]],
         "stats": {"calls": 14, "callers": 6, "settled": 9, "open": 5, "flagged": 1, "registered": 11},
         "lastWeek": None, "payouts": [], "treasury": "AdminXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}
    return b

def respond(url, method, body):
    u = urlparse(url)
    q = parse_qs(u.query)
    path = u.path
    if path == "/api/config":
        return config()
    if path == "/api/board":
        return board()
    if path == "/api/coins":
        if "mint" in q:
            c = next((x for x in COINS if x["mint"] == q["mint"][0]), COINS[0])
            return {"coin": c, "calls": [k for k in CALLS_ if k["mint"] == c["mint"]], "now": NOW}
        return {"at": NOW, "coins": [] if EMPTY else COINS, "stats": {"launched": 6, "onCurve": 5, "graduated": 1}}
    if path == "/api/callers":
        w = q.get("wallet", [""])[0]
        k = [c for c in CALLS_ if c["wallet"] == w]
        if not k:
            return {"caller": None, "code": "CALLED-B032E6", "calls": [], "row": None}
        return {"caller": {"wallet": w, "handle": k[0]["handle"], "xVerified": True, "proofPost": "https://x.com/a/status/1", "registeredAt": NOW - 9 * 24 * H},
                "code": "CALLED-B032E6", "calls": k, "row": ROWS[0]}
    if path == "/api/calls":
        if "id" in q:
            return {"call": next((c for c in CALLS_ if c["id"] == q["id"][0]), CALLS_[0])}
        return {"at": NOW, "calls": CALLS_}
    return None
