# Pro-Suite Implementation & Deployment Plan (PLAN.md)

## Status: PHASE 0 COMPLETE — PENDING USER APPROVAL

---

## 1. Safety Backup Confirmation
Before modifying any state, the entire existing repository was backed up using two independent methods:
1. **Git Tag**: Created tag `before-pro-suite` on branch `main` (`git tag -l "before-pro-suite"` confirmed).
2. **Sibling Directory Backup**: Full recursive copy created at:
   `C:\Users\ansha\Downloads\backup_before_pro\`
   (Verified: 58 files, 19 directories, excluding `node_modules` and `.git`).
3. **Absolute Zero-Touch Guarantee**: The existing codebase at the root (`/server`, `/client`, `/package.json`, `/.env`) remains completely untouched. All new development lives exclusively inside `/pro-suite/`.

---

## 2. Server Inspection & Health Audit
Read-only inspection performed on the AWS EC2 instance (`http://52.66.84.144:3000/`):
- **Server Specifications**:
  - **Memory (RAM)**: `909 MB total`, `481 MB used`, `222 MB free`, `428 MB available`, `0 MB swap`.
  - **CPU**: 2 vCPUs (`nproc = 2`).
- **Existing Process**:
  - Managed by **pm2**:
    - ID: `0`
    - Name: `nse-scanner`
    - Script Path: `/home/ubuntu/scanner/server/index.js`
    - Memory: `~181.6 MB`
    - Status: `online` (uptime > 7 hours)
  - Port 3000 is directly exposed and actively serving live market JSON snapshots at `http://52.66.84.144:3000/api/snapshot`.
  - Nginx service is active on systemd.
- **Resource Assessment & Safety Rule**:
  - The EC2 instance has ~1 GB total RAM with ~428 MB available.
  - **CRITICAL DIRECTIVE**: Running `npm run build` (Vite client compilation) on the EC2 server could easily exhaust RAM, trigger Linux OOM (Out Of Memory) killer, and terminate the existing `nse-scanner` process on port 3000!
  - **Solution**: We will **compile the frontend build locally** on the workstation (`cd pro-suite/client && npm run build`) and upload only the static compiled `dist` folder to `/pro-suite/client/dist` on EC2.
  - On the server, we will start the Pro-Suite backend with a strict memory limit:
    `pm2 start /home/ubuntu/pro-suite/server/index.js --name "pro-suite" --max-memory-restart 250M`

---

## 3. Architecture & File Tree

All new code resides strictly in `/pro-suite`:

```
pro-suite/
├── DATA_SOURCES.md               # Detailed source mapping for all features
├── PLAN.md                       # This plan and execution checklist
├── package.json                  # Pro-Suite root package.json (port 3001 scripts)
├── .env.example                  # Environment template for port 3001
├── server/
│   ├── index.js                  # Express backend on PORT=3001, serves API + static client
│   ├── routes/
│   │   ├── simpleRoutes.js       # Endpoints for Page 1 (/simple all cash stocks)
│   │   ├── proRoutes.js          # Endpoints for Page 2 (/pro features 1-10)
│   │   ├── settingsRoutes.js     # Persistent config read/write (/api/pro/settings)
│   │   └── healthRoutes.js       # Health check (/api/health)
│   ├── services/
│   │   ├── proxyClient.js        # Reads snapshot & SSE from localhost:3000 (read-only)
│   │   ├── cashUniverseService.js# Fetches and caches full NSE-EQ universe
│   │   ├── candleService.js      # Historical candle fetcher (ORB, R-Vol, ATR) with caching
│   │   ├── optionChainService.js # OI walls, PCR, and Max Pain calculator
│   │   └── journalService.js     # Signal journaling & hit-rate evaluator
│   ├── utils/
│   │   ├── quadrantCalc.js       # Pure function: 4-quadrant classification
│   │   ├── vwapCalc.js           # Pure function: VWAP distance & overextended status
│   │   ├── rvolCalc.js           # Pure function: R-Vol calculation
│   │   ├── riskEngine.js         # Pure function: Position size & lot rounding
│   │   └── logger.js             # Winston logger with 10MB size rotation
│   └── tests/
│       └── proLogic.test.js      # Unit tests for pure calculations
├── client/
│   ├── package.json              # Vite + React frontend dependencies
│   ├── vite.config.js            # Base path and build setup
│   ├── index.html
│   └── src/
│       ├── App.jsx               # Client router (/simple, /pro, /settings, /help)
│       ├── index.css             # Tailwind / styling
│       ├── components/
│       │   ├── common/
│       │   │   ├── InfoBox.jsx   # "ⓘ What is this?" explanation modal/accordion
│       │   │   ├── SettingsModal.jsx # Settings editor per feature with Reset button
│       │   │   ├── SoundAlert.jsx# Audio chime + on-screen toast manager
│       │   │   └── TradingViewChart.jsx # lightweight-charts slide-over
│       │   ├── simple/
│       │   │   └── SimpleTable.jsx # Clean, large-font table of all NSE EQ stocks
│       │   └── pro/
│       │       ├── QuadrantCard.jsx   # Feature 1: F&O 4-Quadrant badges & table
│       │       ├── VwapCard.jsx       # Feature 2: VWAP distance & status
│       │       ├── OrbCard.jsx        # Feature 3: 15/30 min Opening Range Breakout
│       │       ├── RvolCard.jsx       # Feature 4: Relative Volume badges
│       │       ├── SectorTailwind.jsx # Feature 5: Sector alignment & RS scores
│       │       ├── RiskPlanner.jsx    # Feature 6: Position sizing & Basket planner
│       │       ├── DerivativesEdge.jsx# Feature 7: OI walls, PCR, VIX badge
│       │       └── SignalJournal.jsx  # Feature 10: Signal stats & hit-rate table
│       └── data/
│           ├── defaultSettings.json
│           └── defaultSectorMap.json
├── data/                         # Persistent server storage (git-ignored)
│   ├── settings.json             # Saved user settings
│   ├── sector_map.json           # Editable sector-stock mappings
│   ├── journal.json              # Recorded trade signals and outcomes
│   ├── orb_cache.json            # Daily cached ORB levels
│   └── rvol_baseline.json        # 10-day volume baseline profiles
└── logs/                         # Rotated log files
```

---

## 4. Phase-by-Phase Roadmap

### Phase 0: Discovery, Backup, Server Audit & Planning (CURRENT)
- [x] Create git tag `before-pro-suite`.
- [x] Create directory backup at `..\backup_before_pro\`.
- [x] Inspect EC2 server specs (1GB RAM, 2 vCPUs) and verify port 3000 process.
- [x] Write `DATA_SOURCES.md` and `PLAN.md`.
- **Checkpoint**: Await user confirmation before proceeding to Phase 1.

### Phase 1: Skeleton App + Page 1 (`/simple`)
- Build `/pro-suite` project scaffold (`package.json`, Express server on port 3001, React client).
- Implement `/api/health` checking both port 3000 and port 3001.
- Implement `/simple` page:
  - Clean table displaying all NSE-EQ stocks with large fonts, live price, change, day high/low, and volume.
  - Search, column sort, Gainers/Losers/All filter.
  - Background cash universe poller with server-side caching so multiple client sessions do not trigger additional broker calls.
- Build client bundle locally.
- Deploy to EC2 on port 3001 under pm2 process name `pro-suite` without touching `nse-scanner`.
- Verify `http://52.66.84.144:3000` remains completely operational.

### Phase 2: `/pro` Foundation + Core Momentum (Features 1–3)
- Navigation bar, tab layout, global settings loader, and `"ⓘ What is this?"` component.
- **Feature 1: F&O 4-Quadrant Engine**:
  - Classify Long Buildup, Short Buildup, Short Covering, Long Unwinding with color-coded badges and plain-English tooltips.
- **Feature 2: VWAP Distance Filter**:
  - Intraday VWAP calculation, distance %, Overextended badge, filter controls.
- **Feature 3: Opening Range Breakout (ORB)**:
  - 15-min and 30-min ORB high/low capture with breakout status.
- Unit tests for quadrant and VWAP math.

### Phase 3: Relative Edge & Trade Planning (Features 4–6)
- **Feature 4: Relative Volume (R-Vol)**:
  - 10-day baseline cache and R-Vol multiplier badge (Normal, High >2x, Very High >3x).
- **Feature 5: Sector Tailwind & RS Score**:
  - Sector mapping (`sector_map.json`), sector trend alignment badge, RS score vs Nifty 50.
- **Feature 6: Risk Management & Basket Engine**:
  - Suggested SL (VWAP / ORB / ATR), Target 1 (1.5x) and Target 2 (2x).
  - Lot size resolution from scrip master.
  - Trade Planner modal: Capital, risk per trade, calculated quantity (shares & lots), margin checks.
  - Basket planner: Add to basket, portfolio risk summary, auto-allocation, CSV export (NO broker order placement).

### Phase 4: Derivatives Edge & Charting (Features 7–8)
- **Feature 7: Derivatives Edge**:
  - Call/Put OI walls (highest CE/PE strike), distance warnings.
  - PCR gauge (>1.4 overbought, <0.6 oversold) and Max Pain strike.
  - India VIX card at top with volatility regimes.
- **Feature 8: Embedded Chart**:
  - Sliding drawer with TradingView `lightweight-charts` (free, Apache-2.0 compliant with proper attribution).
  - Displays 5-minute candles, VWAP line, and ORB levels.

### Phase 5: Alerts, Journal & Verification (Features 9–10)
- **Feature 9: Audio Chime & Screen Toast**:
  - Multi-condition high-conviction trigger.
  - Audio chime (Web Audio API synthesized chime or lightweight sound file) with "Click to enable sound" permission handler and volume slider.
  - Alert history table and daily cooldown limits.
- **Feature 10: Signal Journal & Hit-Rate Tracker**:
  - Persistent record in `/pro-suite/data/journal.json`.
  - Post-market evaluation: Target hit vs SL hit vs Open.
  - Win rate statistics by setup type and day, with reliable sample size caveat (<30 signals warning).
- Final verification of port 3000 and 3001.

---

## 5. Deployment, Rollback & AWS Instructions

### AWS Security Group Instructions (Inbound TCP 3001)
To allow external access to the new Pro-Suite port:
1. Log in to the **AWS Management Console**.
2. Go to **EC2** → **Instances** → Select your instance (`52.66.84.144`).
3. Under the **Security** tab at the bottom, click on the **Security Groups** link.
4. Click **Edit inbound rules** → Click **Add rule**:
   - **Type**: Custom TCP
   - **Port range**: `3001`
   - **Source**: `Anywhere-IPv4` (`0.0.0.0/0`) or your specific IP
   - **Description**: `Pro-Suite Port`
5. Click **Save rules**.
> *Note on Elastic IP*: If `52.66.84.144` is an ephemeral public IP (not an Elastic IP), stopping and starting the instance will change the IP address.

### PM2 Process Deployment
```bash
# 1. On local workstation: build client
cd pro-suite/client
npm install
npm run build

# 2. On EC2 instance: start ONLY pro-suite
cd /home/ubuntu/pro-suite
pm2 start server/index.js --name "pro-suite" --max-memory-restart 250M
# Note: DO NOT run 'pm2 restart all' or 'pm2 delete all'!
```

### 100% Non-Disruptive Rollback
If you ever want to completely remove the Pro-Suite without touching the original site:
```bash
pm2 stop pro-suite && pm2 delete pro-suite
rm -rf /home/ubuntu/pro-suite
```
The original site on port 3000 will continue running uninterrupted.

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **EC2 Out Of Memory (OOM)** | High | Never run `npm run build` or `vite build` on EC2. Run build on local PC; deploy static `dist/`. Limit Node process to `--max-memory-restart 250M`. |
| **Angel One Session Conflict** | High | Pro-Suite consumes existing app's data on `http://localhost:3000` via internal HTTP/SSE. It never opens a competing WebSocket. |
| **Broker Rate Limiting** | Medium | All requests are cached; single shared background poller for all client sessions; historical candles and option chains fetched with throttled queues. |
| **Disk Exhaustion** | Low | Log rotation enforced (max 10MB per log file, max 3 files) in `/pro-suite/logs`. Cache data pruned automatically. |
