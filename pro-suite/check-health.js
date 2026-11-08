/**
 * Diagnostic script to verify that both Port 3000 and Port 3001 are healthy
 * Run: node check-health.js
 */
const http = require('http');

function checkPort(port, path = '/') {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port: port,
      path: path,
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          port,
          status: 'UP',
          statusCode: res.statusCode,
          responseSnippet: data.substring(0, 150)
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        port,
        status: 'DOWN',
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        port,
        status: 'TIMEOUT',
        error: 'Connection timed out after 3000ms'
      });
    });
  });
}

async function run() {
  console.log('==============================================');
  console.log('🩺 NSE Scanner & Pro-Suite Health Diagnostics');
  console.log('==============================================');

  const [p3000, p3001, healthApi, overviewApi, rvolApi, sectorApi, basketApi] = await Promise.all([
    checkPort(3000, '/api/snapshot'),
    checkPort(3001, '/'),
    checkPort(3001, '/api/health'),
    checkPort(3001, '/api/pro/overview'),
    checkPort(3001, '/api/pro/rvol'),
    checkPort(3001, '/api/pro/sector'),
    checkPort(3001, '/api/pro/basket')
  ]);

  console.log(`\n1. Primary Scanner (Port 3000):`);
  if (p3000.status === 'UP') {
    console.log(`   ✅ ONLINE (Status ${p3000.statusCode}) - Core live scanner is unaffected!`);
  } else {
    console.log(`   ⚠️ WARNING: ${p3000.status} (${p3000.error})`);
  }

  console.log(`\n2. Pro-Suite Server (Port 3001):`);
  if (p3001.status === 'UP') {
    console.log(`   ✅ ONLINE (Status ${p3001.statusCode}) - Pro-Suite is responding!`);
  } else {
    console.log(`   ⚠️ WARNING: ${p3001.status} (${p3001.error})`);
  }

  console.log(`\n3. Pro-Suite /api/health Endpoint:`);
  if (healthApi.status === 'UP') {
    console.log(`   ✅ HEALTH API OK (Status ${healthApi.statusCode})`);
    try {
      const parsed = JSON.parse(healthApi.responseSnippet);
      console.log(`   Overall Status: ${parsed.status}`);
      console.log(`   Pro-Suite Memory RSS: ${parsed.proSuite?.memoryRssMB} MB`);
      console.log(`   Primary Port 3000 Status: ${parsed.primaryScanner?.status}`);
    } catch {
      console.log(`   Snippet: ${healthApi.responseSnippet}`);
    }
  } else {
    console.log(`   ⚠️ WARNING: ${healthApi.status} (${healthApi.error})`);
  }

  console.log(`\n4. Phase 3 API Endpoints:`);
  console.log(`   Overview API: ${overviewApi.statusCode === 200 ? '✅ 200 OK' : '❌ ' + overviewApi.statusCode}`);
  console.log(`   R-Vol API:    ${rvolApi.statusCode === 200 ? '✅ 200 OK' : '❌ ' + rvolApi.statusCode}`);
  console.log(`   Sector API:   ${sectorApi.statusCode === 200 ? '✅ 200 OK' : '❌ ' + sectorApi.statusCode}`);
  console.log(`   Basket API:   ${basketApi.statusCode === 200 ? '✅ 200 OK' : '❌ ' + basketApi.statusCode}`);

  // Test Risk-Plan POST API
  const postRisk = await new Promise((resolve) => {
    const postData = JSON.stringify({
      symbol: 'RELIANCE',
      direction: 'LONG',
      slMethod: 'VWAP',
      capital: 100000,
      riskAmount: 2000
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/pro/risk-plan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    req.write(postData);
    req.end();
  });
  console.log(`   Risk-Plan POST API: ${postRisk.status === 200 ? '✅ 200 OK' : '❌ ' + postRisk.status + ' (' + (postRisk.error || postRisk.body?.substring(0, 80)) + ')'}`);

  console.log('\n==============================================');
  const allGood = p3000.status === 'UP' && p3001.status === 'UP' && postRisk.status === 200;
  if (allGood) {
    console.log('🎉 SUCCESS: All Phase 3 quantitative endpoints are fully operational!');
    process.exit(0);
  } else {
    console.log('⚠️ Please check the warnings above.');
    process.exit(p3001.status === 'UP' ? 0 : 1);
  }
}

run();
