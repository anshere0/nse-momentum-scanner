# NSE Market Momentum & Breadth Scanner (Angel One SmartAPI)

An institutional-grade, real-time Indian stock market scanner and quantitative breadth dashboard for NSE Equity and Derivatives (F&O) markets, powered by **Angel One SmartAPI**.

---

## 🌟 Key Features

- **Angel One SmartAPI v2 Integration**:
  - Secure authentication via Client Code, PIN, and RFC 6238 TOTP.
  - Streaming tick updates over WebSocket (`wss://smartapisocket.angelone.in/smart-stream`) with Little-Endian binary packet decoding.
  - REST quote polling and daily historical OHLCV candle loading.
  - Automatic OpenAPIScripMaster caching and symbol-token resolution.
- **Session-Aware Previous-Close Engine**:
  - **Weekend & Holiday Persistence**: Outside market hours (e.g. Saturdays, Sundays, holidays), seamlessly defaults to and displays the most recent completed trading session's final closing snapshot.
  - Never fabricates prices, never overwrites Friday's data with zeros or stale artifacts on weekends.
  - IST-aware trading calendar with automated detection of NSE market holidays and pre-open sessions (09:00–09:15 AM IST).
- **Market Breadth & Sentiment Analysis**:
  - Real-time advancing, declining, and unchanged counts evaluated against previous session close.
  - Advance/Decline (A/D) ratio and Net Breadth percentage.
  - Configurable market sentiment classification: **Positive**, **Negative**, **Sideways**, or **Insufficient Data**.
- **Dynamic Scanner Configuration Panel**:
  - **Market Segment Switcher**: Cash Market, F&O Market, or Both.
  - **Editable Open Interest (OI) Filter**: Real-time adjustable threshold (e.g. +5%, +10%, +20%) with quick presets and direction toggles.
  - **Technical Price Levels**: Previous Day High (PDH), Previous Day Low (PDL), Previous Month High (PMH), and Previous Month Low (PML) breakout/breakdown detection.
  - **Market Capitalization & Volume Filters**: Min/Max thresholds with crore/lakh crore units.
  - **Master Switch & Defaults Reset**: Every filter has an independent enable/disable toggle.
- **Institutional UI/UX**:
  - Ultra-sleek dark theme with glassmorphism, responsive layout, and Framer Motion micro-animations.
  - Dual view modes: **Top Gainers/Losers + Sector Momentum** or **Full Quantitative Scanner Table**.
  - Symbol search, column sorting, signal alerts, and instant CSV export.

---

## 📁 Architecture Overview

```
├── client/                     # Vite + React 19 + Tailwind v4 Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConnectBrokerModal.jsx   # Angel One broker session modal
│   │   │   ├── FilterSettings.jsx       # Comprehensive scanner filters modal
│   │   │   ├── IndicesBarChart.jsx      # Sector indices momentum bar chart
│   │   │   ├── MarketOverview.jsx       # Advance/Decline breadth & sentiment cards
│   │   │   ├── MomentumBoard.jsx        # Top Gainers & Top Losers boards
│   │   │   └── ScannerTable.jsx         # Full tabular scanner with search & CSV export
│   │   ├── App.jsx                      # Main dashboard orchestrator
│   │   └── index.css                    # Design tokens & glassmorphic styles
│   └── vite.config.js
├── server/                     # Node.js Express Backend & Market Engine
│   ├── dataSource/
│   │   ├── angelone.js                  # Angel One SmartAPI connector (WS + REST)
│   │   ├── index.js                     # Data source factory
│   │   └── mock.js                      # Deterministic offline mock engine
│   ├── routes/
│   │   ├── api.js                       # Snapshot, config, breadth, health endpoints
│   │   ├── auth.js                      # Angel One TOTP auth & session management
│   │   └── sse.js                       # Server-Sent Events real-time broadcast
│   ├── services/
│   │   ├── angeloneAuth.js              # TOTP generation, loginByPassword & JWT refresh
│   │   ├── instrumentMaster.js          # Scrip master downloader, cache & indexer
│   │   └── marketSession.js             # IST trading calendar, holiday logic & sessions
│   ├── state/
│   │   └── marketState.js               # In-memory reactive market state & filter engine
│   ├── tests/                           # Automated test suite (node:test)
│   │   ├── authAndReliability.test.js
│   │   ├── filterAndBreadth.test.js
│   │   └── marketSession.test.js
│   └── index.js                         # Application entrypoint
├── data/                                # Local cached scrip master and session tokens
└── package.json
```

---

## 🔑 Angel One SmartAPI Setup

1. **Register on SmartAPI**:
   - Go to [https://smartapi.angelone.in/](https://smartapi.angelone.in/) and sign up or log in.
2. **Create an App**:
   - Click **Create an App**.
   - Select **Trading / Market Feeds**.
   - Note down your **API Key**.
3. **Get your TOTP Secret**:
   - In your Angel One account or profile security settings, enable TOTP authentication (using Google Authenticator or an authenticator app).
   - Save the secret key (16-32 alphanumeric Base32 characters) as your `ANGEL_TOTP_SECRET`.
4. **Configure `.env`**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your credentials:
   ```env
   ANGEL_API_KEY=your_smartapi_key
   ANGEL_CLIENT_CODE=your_client_code
   ANGEL_PIN=your_4_digit_pin
   ANGEL_TOTP_SECRET=your_totp_secret_key
   DATA_SOURCE=angelone
   PORT=3000
   PUBLIC_BASE_URL=http://localhost:3000
   ```

> 🔒 **Security Notice**: Credentials are strictly stored server-side. The frontend client and public API responses never expose API keys, client codes, PINs, or JWT tokens.

---

## 🚀 Getting Started

### 1. Install Dependencies

Root and server dependencies:
```bash
npm install
```

Client dependencies:
```bash
cd client
npm install
cd ..
```

### 2. Build the Frontend

```bash
npm run build
```

### 3. Run the Development Server

Runs both backend and Vite frontend with hot reload:
```bash
npm run dev
```

Or start the production server:
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Testing

The repository contains an automated test suite using Node.js built-in `node:test` runner. The tests do not require real broker credentials:

```bash
npm test
```

### Test Coverage Highlights:
- **Session & Weekend Logic**: Verifies that Friday's close is accurately identified and served on Saturday, Sunday, and Monday morning before market open.
- **Holiday Awareness**: Tests NSE holiday resolution (e.g. Independence Day, Diwali, Gandhi Jayanti).
- **Session Types**: Confirms `PRE_OPEN` (09:00–09:15), `REGULAR` (09:15–15:30), and `POST_CLOSE` periods.
- **Previous Month**: Ensures previous completed month calculation has zero look-ahead bias.
- **Open Interest Math**: Validates OI change % calculation with positive, negative, and zero reference values.
- **Dynamic Config**: Verifies that OI and technical thresholds can be updated and reset via API without modifying code.
- **Breadth & Sentiment**: Tests net breadth percentage and sentiment classification (Positive / Negative / Sideways / Insufficient Data).
- **Authentication & Security**: Validates RFC 6238 TOTP generation, token expiry checks, and ensures no credential exposure.

---

## 📊 Market-Data Modes

| Mode | Trigger Condition | Display Behavior |
|------|-------------------|------------------|
| **Live Market** | Regular trading session (09:15–15:30 IST on trading days) | Streaming WebSocket ticks and live quote evaluations. |
| **Previous Close** | Outside market hours (weekends, holidays, post-close) | Displays last completed session's closing OHLCV prices and levels. |
| **Cached Snapshot** | Temporary network interruption | Retains timestamped cached snapshot clearly marked as stale. |
| **Unavailable** | Broker connection down without cache | Displays explicit data-unavailable status. |

---

## 📝 License

MIT
#   N S E - M A R K E T - S C A N N E R - A N G E L 1  
 