# Pro-Suite Data Sources & Architecture

## Overview
The Pro-Suite (`/pro-suite`) is an independent, non-intrusive companion application running on port **3001**.
It consumes data primarily from the existing live scanner on port **3000** without making duplicate broker login calls, supplementing it with targeted, rate-limited Angel One APIs only where deeper derivative or historical data is required.

---

## 1. Data Mapping Matrix

| Feature / UI Component | Data Required | Source & Mechanism | Broker Calls / Rate Limit Impact |
| :--- | :--- | :--- | :--- |
| **Page 1: /simple** (All NSE EQ Stocks) | ~2,000 NSE Cash Stocks (LTP, Chg, %Chg, High, Low, Vol) | **Instrument Master (`OpenAPIScripMaster.json`)** + Batched Quote polling on backend | Single shared background poller (batches of 50 tokens every 15s). Cached server-side; viewers do not multiply requests. |
| **Feature 1: F&O 4-Quadrant** | Price Change %, Current OI, Reference OI, OI Change % | **Port 3000 (`/api/snapshot` or `/sse/live`)** | **Zero broker calls**. Consumes local HTTP/SSE from port 3000. |
| **Feature 2: VWAP Filter** | Intraday VWAP, LTP, VWAP Distance % | **Port 3000 Snapshot** (Average Traded Price / ATP if present in feed, or calculated from 1-min aggregated ticks) | **Zero extra broker calls**. Computed from live tick feed. |
| **Feature 3: 15m/30m ORB** | High and Low of 09:15-09:30 AM session | **Port 3000 feed** (captured in memory after 09:30 AM) or **SmartAPI Historical Candle API** (`getCandleData`) | Single candle fetch per symbol at 09:31 AM, cached for the rest of the day in `/pro-suite/data/orb_cache.json`. |
| **Feature 4: Relative Volume (R-Vol)** | Today's cumulative volume vs 10-day average cumulative volume at current time | **Port 3000 volume** + **SmartAPI 5-min historical candles (10 days)** | Pre-computed once daily at pre-market (08:45 AM) and cached in `/pro-suite/data/rvol_cache.json`. During market hours: **Zero broker candle calls**. |
| **Feature 5: Sector Tailwind & RS** | Sector Indices % Chg, Nifty 50 % Chg, Stock % Chg | **Port 3000 (`/api/snapshot` `indices` array)** + `/pro-suite/data/sector_map.json` | **Zero broker calls**. Consumes existing sector indices already tracked on port 3000. |
| **Feature 6: Risk Engine & Basket** | Entry LTP, Lot Size, ATR for Stop Loss | **Port 3000 Snapshot** + **Scrip Master (`lotsize`)** + Daily candle ATR | **Zero broker calls** for live calculations. All planning is client/server memory only. NO order APIs. |
| **Feature 7: Derivatives Edge** | Call/Put OI Walls, PCR, Max Pain, India VIX | **SmartAPI Option Chain / Market Quote** + India VIX index quote from port 3000 | On-demand for currently viewed symbol; background rotation every 90 seconds for top candidates. Rate-limited queue. |
| **Feature 8: Embedded Chart** | 5-min OHLCV historical candles | **SmartAPI Historical Candle API** (`getCandleData`) | On-demand only when a user clicks a stock to open the chart slide-over. Cached for 60s per stock. |
| **Feature 9: Audio & Screen Alerts** | Trigger criteria evaluation | **In-memory evaluation of Pro-Suite state** | **Zero broker calls**. Alerts are purely client-side browser chime + toast. |
| **Feature 10: Signal Journal** | Signal record, post-market win/loss check | **Local JSON/SQLite journal** (`/pro-suite/data/journal.json`) + End-of-day candle evaluation | Evaluated on-demand or at 15:45 IST once market closes. |

---

## 2. Broker Connection Conflict Prevention
- **Existing App (Port 3000)** maintains the primary WebSocket session (`smartapisocket.angelone.in`) and token refresh cycle.
- **Pro-Suite (Port 3001)** does **NOT** initiate a second competing WebSocket connection that could invalidate port 3000's session token.
- For candles and option chains, Pro-Suite uses REST endpoints with a dedicated token store or passes through authenticated requests using the local credentials in `/pro-suite/.env`.
- An optional `DATA_SOURCE=mock` mode allows full testing outside market hours and offline without needing any broker credentials or internet connection.
