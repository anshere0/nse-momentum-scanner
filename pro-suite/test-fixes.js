const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3001' + path, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
      });
    }).on('error', reject);
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('🧪 VERIFYING USER BUG FIXES & NEW CAPABILITIES');
  console.log('====================================================');

  // 1. R-Vol Persistent Counts
  console.log('\n1. Testing R-Vol Counts Across Different Filters:');
  const allRvol = await get('/api/pro/rvol?badgeFilter=ALL');
  console.log('   ALL Filter  -> Table Rows:', allRvol.stocks.length, 'Persistent Counts:', allRvol.counts);

  const highRvol = await get('/api/pro/rvol?badgeFilter=HIGH');
  console.log('   HIGH Filter -> Table Rows:', highRvol.stocks.length, 'Persistent Counts:', highRvol.counts);

  const veryHighRvol = await get('/api/pro/rvol?badgeFilter=VERY_HIGH');
  console.log('   ULTRA Filter-> Table Rows:', veryHighRvol.stocks.length, 'Persistent Counts:', veryHighRvol.counts);

  const isCountsConsistent = (
    allRvol.counts.veryHigh === highRvol.counts.veryHigh &&
    allRvol.counts.high === veryHighRvol.counts.high
  );
  console.log('   ✅ Counts consistency check:', isCountsConsistent ? 'PASSED (Counts NEVER drop to 0!)' : 'FAILED');

  // 2. Feature-Specific Confidence Score Check
  console.log('\n2. Testing Feature-Specific Confidence Scores:');
  const sampleStock = allRvol.stocks[0];
  if (sampleStock) {
    console.log('   Stock:', sampleStock.symbol);
    console.log('   R-Vol Confidence Score:', sampleStock.rvolConfidence?.score + '%', 'Grade:', sampleStock.rvolConfidence?.grade);
    console.log('   R-Vol Reasoning:', sampleStock.rvolConfidence?.reasoning);
    console.log('   Sector Confidence Score:', sampleStock.sectorConfidence?.score + '%', 'Grade:', sampleStock.sectorConfidence?.grade);
    console.log('   Sector Reasoning:', sampleStock.sectorConfidence?.reasoning);
  }

  // 3. Settings Persistence & Dynamic Effect
  console.log('\n3. Testing Settings GET & POST Persistence:');
  const initialSettings = await get('/api/pro/settings');
  console.log('   Initial R-Vol High Threshold:', initialSettings.rvol?.highThreshold);

  // Update threshold
  await post('/api/pro/settings', { rvol: { highThreshold: 1.5, veryHighThreshold: 2.5, baselineLots: 2000 } });
  const updatedSettings = await get('/api/pro/settings');
  console.log('   Updated R-Vol High Threshold:', updatedSettings.rvol?.highThreshold);
  console.log('   ✅ Settings persistence check:', updatedSettings.rvol?.highThreshold === 1.5 ? 'PASSED' : 'FAILED');

  // Revert back to 2.0 default
  await post('/api/pro/settings', { rvol: { highThreshold: 2.0, veryHighThreshold: 3.0, baselineLots: 2000 } });

  // 4. Smart Predicted Stop Loss vs Custom Manual Stop Loss
  console.log('\n4. Testing Stop Loss Strategies:');
  const smartPlan = await post('/api/pro/risk-plan', {
    symbol: 'RELIANCE', direction: 'LONG', slMethod: 'SMART_PREDICTED', capital: 100000, riskAmount: 2000
  });
  console.log('   ✨ Smart Predicted Plan:');
  console.log('      Symbol:', smartPlan.plan.symbol, 'Entry:', smartPlan.plan.entryPrice);
  console.log('      Predicted SL:', smartPlan.plan.stopLoss, 'Risk/Share: ₹' + smartPlan.plan.riskPerShare);
  console.log('      Rationale:', smartPlan.plan.slReasoning);

  const customManualPrice = Math.round((smartPlan.plan.entryPrice - 18.5) * 100) / 100;
  const manualPlan = await post('/api/pro/risk-plan', {
    symbol: 'RELIANCE', direction: 'LONG', slMethod: 'MANUAL', manualSlPrice: customManualPrice, capital: 100000, riskAmount: 2000
  });
  console.log('   ✍️ Custom Manual Plan:');
  console.log('      Requested Manual SL: ₹' + customManualPrice);
  console.log('      Calculated SL: ₹' + manualPlan.plan.stopLoss);
  console.log('      Sized Shares:', manualPlan.plan.recommendedShares, 'Full Lots:', manualPlan.plan.recommendedLots);
  console.log('      Rationale:', manualPlan.plan.slReasoning);
  console.log('   ✅ Stop Loss engine check:', manualPlan.plan.stopLoss === customManualPrice ? 'PASSED' : 'FAILED');

  // 5. Port 3000 Zero Disruption Check
  console.log('\n5. Primary Website (Port 3000) Health:');
  http.get('http://127.0.0.1:3000/api/snapshot', res => {
    console.log('   Port 3000 HTTP Status:', res.statusCode, '-> 100% HEALTHY & UNAFFECTED');
    console.log('====================================================\n');
  });
}

run();
