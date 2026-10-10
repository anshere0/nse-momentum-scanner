/**
 * Verification Script: Last Trading Day Data
 * Uses Yahoo Finance for price data (free, no subscription needed)
 * Shows Top 10 Gainers / Losers with PDH/PDL filter verification
 */
require('dotenv').config();
const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');

// ─── Load F&O Universe ───
async function loadFnoUniverse() {
  console.log('📥 Downloading Dhan scrip master...');
  const resp = await axios.get('https://images.dhan.co/api-data/api-scrip-master.csv', { responseType: 'text' });
  
  const allInstruments = [];
  await new Promise((resolve, reject) => {
    Readable.from(resp.data)
      .pipe(csv())
      .on('data', (row) => allInstruments.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  const futureGroups = {};
  allInstruments.forEach(inst => {
    if (inst.SEM_EXM_EXCH_ID === 'NSE' && inst.SEM_INSTRUMENT_NAME === 'FUTSTK') {
      const clean = (inst.SEM_TRADING_SYMBOL || '').split('-')[0];
      if (clean && !clean.includes('TEST') && /^[A-Z]/.test(clean)) {
        if (!futureGroups[clean]) futureGroups[clean] = [];
        futureGroups[clean].push(inst);
      }
    }
  });

  const universe = [];
  for (const symbol in futureGroups) {
    const futures = futureGroups[symbol].filter(f => f.SEM_EXPIRY_DATE);
    if (futures.length > 0) {
      futures.sort((a, b) => new Date(a.SEM_EXPIRY_DATE) - new Date(b.SEM_EXPIRY_DATE));
      universe.push({
        instrument_key: futures[0].SEM_SMST_SECURITY_ID,
        tradingsymbol: futures[0].SEM_TRADING_SYMBOL,
        name: symbol,
        underlying: symbol,
        type: 'STOCK',
      });
    }
  }

  console.log(`✅ F&O Universe: ${universe.length} stocks\n`);
  return universe;
}

// ─── Fetch price data from Yahoo Finance ───
async function fetchYahooData(universe) {
  console.log('📈 Fetching last 2 weeks of price data from Yahoo Finance...');
  const YahooFinance = require('yahoo-finance2').default;
  const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });
  const results = {};

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const today = new Date();
  let fetched = 0, failed = 0;

  for (let i = 0; i < universe.length; i += 20) {
    const chunk = universe.slice(i, i + 20);
    await Promise.all(chunk.map(async (u) => {
      try {
        const yfSymbol = `${u.underlying}.NS`;
        const data = await yf.historical(yfSymbol, {
          period1: twoWeeksAgo, period2: today, interval: '1d'
        });

        if (data && data.length >= 2) {
          results[u.instrument_key] = {
            symbol: u.name,
            // Last candle = most recent trading day (today/Friday)
            todayOpen: data[data.length - 1].open,
            todayHigh: data[data.length - 1].high,
            todayLow: data[data.length - 1].low,
            todayClose: data[data.length - 1].close,
            todayVolume: data[data.length - 1].volume,
            todayDate: new Date(data[data.length - 1].date).toLocaleDateString('en-IN'),
            // Previous day candle
            prevClose: data[data.length - 2].close,
            prevHigh: data[data.length - 2].high,
            prevLow: data[data.length - 2].low,
            prevDate: new Date(data[data.length - 2].date).toLocaleDateString('en-IN'),
            // % change
            pctChange: ((data[data.length - 1].close - data[data.length - 2].close) / data[data.length - 2].close * 100),
          };
          fetched++;
        }
      } catch (e) {
        failed++;
      }
    }));
    await new Promise(r => setTimeout(r, 400));
    process.stdout.write(`   ${Math.min(i + 20, universe.length)}/${universe.length} (${fetched} ok)\r`);
  }

  console.log(`\n✅ Yahoo data fetched for ${fetched} symbols (${failed} failed)\n`);
  return results;
}

// ─── Fetch OI from NSE ───
async function fetchNseOI() {
  console.log('🔍 Fetching OI data from NSE website...');
  try {
    // First get NSE session cookies
    const session = await axios.get('https://www.nseindia.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000
    });

    const cookies = session.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
    
    // Now fetch F&O data
    const resp = await axios.get('https://www.nseindia.com/api/live-analysis-oi-spurts', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com/market-data/live-market-analysis',
        'Cookie': cookies,
      },
      timeout: 10000
    });

    if (resp.data && resp.data.data) {
      const oiMap = {};
      resp.data.data.forEach(item => {
        oiMap[item.symbol] = {
          oi: item.latestOI || item.openInterest,
          prevOi: item.prevOI || item.previousOI,
          oiChangePct: item.pchangeinOI || item.pChange,
          ltp: item.underlyingValue || item.ltp,
        };
      });
      console.log(`✅ NSE OI data for ${Object.keys(oiMap).length} symbols\n`);
      return oiMap;
    }
  } catch (e) {
    console.log(`   ⚠️  NSE API unavailable (${e.message}). OI data will show as N/A.`);
    console.log('   (This is normal — NSE blocks automated access outside market hours)\n');
  }
  return {};
}

// ─── Main ───
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  F&O MOMENTUM SCANNER — DATA VERIFICATION');
  console.log('  Last Trading Day Closing Data');
  console.log('═══════════════════════════════════════════════════\n');

  const universe = await loadFnoUniverse();
  const yahooData = await fetchYahooData(universe);
  const nseOI = await fetchNseOI();

  // Config
  const MIN_PCT = parseFloat(process.env.MIN_PCT_CHANGE || '0.5');
  const MAX_PCT = parseFloat(process.env.MAX_PCT_CHANGE || '20.0');
  const requirePDH = process.env.REQUIRE_OPEN_ABOVE_PDH_FOR_GAINERS !== 'false';
  const requirePDL = process.env.REQUIRE_OPEN_BELOW_PDL_FOR_LOSERS !== 'false';

  console.log('═══════════════════════════════════════════════════');
  console.log('  CONFIG');
  console.log(`  Min/Max % Change: ${MIN_PCT}% — ${MAX_PCT}%`);
  console.log(`  Require Open > PDH for Gainers: ${requirePDH}`);
  console.log(`  Require Open < PDL for Losers:  ${requirePDL}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Build combined dataset
  const allStocks = [];
  for (const u of universe) {
    const key = u.instrument_key;
    const yd = yahooData[key];
    if (!yd) continue;

    const nse = nseOI[u.name] || {};

    allStocks.push({
      symbol: u.name,
      open: yd.todayOpen,
      close: yd.todayClose,
      prevClose: yd.prevClose,
      pctChange: yd.pctChange,
      pdh: yd.prevHigh,    // Previous Day High
      pdl: yd.prevLow,     // Previous Day Low
      volume: yd.todayVolume,
      todayDate: yd.todayDate,
      prevDate: yd.prevDate,
      // OI from NSE (if available)
      oi: nse.oi || null,
      prevOi: nse.prevOi || null,
      oiChangePct: nse.oiChangePct || null,
    });
  }

  // Filter
  const validStocks = allStocks.filter(s => {
    if (s.close <= 0) return false;
    const absPc = Math.abs(s.pctChange);
    return absPc >= MIN_PCT && absPc <= MAX_PCT;
  });

  // GAINERS
  let gainers = validStocks.filter(s => s.pctChange > 0);
  const gainersBeforeFilter = gainers.length;
  if (requirePDH) {
    gainers = gainers.filter(s => s.pdh !== null && s.open > s.pdh);
  }
  gainers.sort((a, b) => b.pctChange - a.pctChange);
  const top10Gainers = gainers.slice(0, 10);

  // LOSERS
  let losers = validStocks.filter(s => s.pctChange < 0);
  const losersBeforeFilter = losers.length;
  if (requirePDL) {
    losers = losers.filter(s => s.pdl !== null && s.open < s.pdl);
  }
  losers.sort((a, b) => a.pctChange - b.pctChange);
  const top10Losers = losers.slice(0, 10);

  // Display
  const dateLabel = allStocks.length > 0 ? allStocks[0].todayDate : 'N/A';
  const prevDateLabel = allStocks.length > 0 ? allStocks[0].prevDate : 'N/A';

  console.log(`═══════════════════════════════════════════════════════════════════════════════`);
  console.log(`  📈 TOP 10 GAINERS — ${dateLabel} (PDH from ${prevDateLabel})`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════`);
  console.log(`  #  Symbol          Close      Open       PrevCls    %Chg      PDH        Open>PDH   OI Chg%`);
  console.log(`  ─  ──────          ─────      ────       ───────    ────      ───        ────────   ───────`);
  top10Gainers.forEach((s, i) => {
    const pdhCheck = s.pdh ? (s.open > s.pdh ? '✅ YES' : '❌ NO ') : '  N/A  ';
    const oiStr = s.oiChangePct != null ? `${s.oiChangePct > 0 ? '+' : ''}${s.oiChangePct.toFixed(2)}%` : 'N/A';
    console.log(
      `  ${String(i+1).padStart(2)}. ${s.symbol.padEnd(15)} ${f(s.close)}  ${f(s.open)}   ${f(s.prevClose)}  ${fp(s.pctChange)}  ${f(s.pdh)}  ${pdhCheck}   ${oiStr}`
    );
  });
  if (top10Gainers.length === 0) console.log('  (No stocks matched gainer criteria)');
  console.log(`  ── ${gainersBeforeFilter} positive stocks → ${gainers.length} after PDH filter → showing top ${top10Gainers.length}\n`);

  console.log(`═══════════════════════════════════════════════════════════════════════════════`);
  console.log(`  📉 TOP 10 LOSERS — ${dateLabel} (PDL from ${prevDateLabel})`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════`);
  console.log(`  #  Symbol          Close      Open       PrevCls    %Chg      PDL        Open<PDL   OI Chg%`);
  console.log(`  ─  ──────          ─────      ────       ───────    ────      ───        ────────   ───────`);
  top10Losers.forEach((s, i) => {
    const pdlCheck = s.pdl ? (s.open < s.pdl ? '✅ YES' : '❌ NO ') : '  N/A  ';
    const oiStr = s.oiChangePct != null ? `${s.oiChangePct > 0 ? '+' : ''}${s.oiChangePct.toFixed(2)}%` : 'N/A';
    console.log(
      `  ${String(i+1).padStart(2)}. ${s.symbol.padEnd(15)} ${f(s.close)}  ${f(s.open)}   ${f(s.prevClose)}  ${fp(s.pctChange)}  ${f(s.pdl)}  ${pdlCheck}   ${oiStr}`
    );
  });
  if (top10Losers.length === 0) console.log('  (No stocks matched loser criteria)');
  console.log(`  ── ${losersBeforeFilter} negative stocks → ${losers.length} after PDL filter → showing top ${top10Losers.length}\n`);

  // Summary
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  SUMMARY`);
  console.log(`  Total F&O Stocks:    ${universe.length}`);
  console.log(`  With Yahoo data:     ${allStocks.length}`);
  console.log(`  After % filter:      ${validStocks.length}`);
  console.log(`  Gainers (total):     ${gainersBeforeFilter} → ${gainers.length} after PDH`);
  console.log(`  Losers  (total):     ${losersBeforeFilter} → ${losers.length} after PDL`);
  console.log(`═══════════════════════════════════════════════════\n`);

  // Also show ALL movers without PDH/PDL filter for reference
  console.log(`═══════════════════════════════════════════════════════════════════════════════`);
  console.log(`  ALL TOP 15 MOVERS (no PDH/PDL filter, for reference)`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════`);
  const allMovers = validStocks.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  console.log(`  #  Symbol          Close      %Chg      Open       PDH        PDL        Open>PDH  Open<PDL`);
  allMovers.slice(0, 15).forEach((s, i) => {
    const pdhOk = s.pdh ? (s.open > s.pdh ? '✅' : '❌') : '—';
    const pdlOk = s.pdl ? (s.open < s.pdl ? '✅' : '❌') : '—';
    console.log(
      `  ${String(i+1).padStart(2)}. ${s.symbol.padEnd(15)} ${f(s.close)}  ${fp(s.pctChange)}  ${f(s.open)}   ${f(s.pdh)}  ${f(s.pdl)}  ${pdhOk}         ${pdlOk}`
    );
  });
}

function f(val) {
  if (val == null) return '     N/A ';
  return String(val.toFixed(2)).padStart(9);
}

function fp(val) {
  if (val == null) return '   N/A ';
  const sign = val >= 0 ? '+' : '';
  return (sign + val.toFixed(2) + '%').padStart(8);
}

main().catch(console.error);
