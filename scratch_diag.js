// Diagnostic script to inspect Dhan scrip master CSV structure
require('dotenv').config();
const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');

async function inspect() {
  console.log('Downloading Dhan scrip master...');
  const resp = await axios.get('https://images.dhan.co/api-data/api-scrip-master.csv', { responseType: 'text' });
  
  const allInstruments = [];
  await new Promise((resolve, reject) => {
    Readable.from(resp.data)
      .pipe(csv())
      .on('data', (row) => allInstruments.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`Total instruments: ${allInstruments.length}`);
  
  // Check column names from first row
  if (allInstruments.length > 0) {
    console.log('\n=== Column Names ===');
    console.log(Object.keys(allInstruments[0]).join(', '));
  }

  // Find all unique values for SEM_EXM_EXCH_ID
  const exchangeIds = new Set();
  allInstruments.forEach(i => exchangeIds.add(i.SEM_EXM_EXCH_ID));
  console.log('\n=== Unique SEM_EXM_EXCH_ID values ===');
  console.log([...exchangeIds].join(', '));

  // Find all unique SEM_INSTRUMENT_NAME values
  const instrumentNames = new Set();
  allInstruments.forEach(i => instrumentNames.add(i.SEM_INSTRUMENT_NAME));
  console.log('\n=== Unique SEM_INSTRUMENT_NAME values ===');
  console.log([...instrumentNames].join(', '));

  // Find FUTSTK instruments - check what exchange they belong to
  const futstk = allInstruments.filter(i => i.SEM_INSTRUMENT_NAME === 'FUTSTK');
  console.log(`\n=== FUTSTK count: ${futstk.length} ===`);
  
  const futExchanges = new Set();
  futstk.forEach(i => futExchanges.add(i.SEM_EXM_EXCH_ID));
  console.log('FUTSTK exchange IDs:', [...futExchanges].join(', '));

  // Show first 3 FUTSTK rows
  if (futstk.length > 0) {
    console.log('\n=== Sample FUTSTK rows ===');
    futstk.slice(0, 3).forEach(row => {
      console.log(JSON.stringify({
        SEM_EXM_EXCH_ID: row.SEM_EXM_EXCH_ID,
        SEM_INSTRUMENT_NAME: row.SEM_INSTRUMENT_NAME,
        SM_SYMBOL_NAME: row.SM_SYMBOL_NAME,
        SEM_TRADING_SYMBOL: row.SEM_TRADING_SYMBOL,
        SEM_SMST_SECURITY_ID: row.SEM_SMST_SECURITY_ID,
        SEM_EXPIRY_DATE: row.SEM_EXPIRY_DATE,
        SEM_SEGMENT: row.SEM_SEGMENT,
        SEM_EXCH_SEGMENT: row.SEM_EXCH_SEGMENT,
      }, null, 2));
    });
  }

  // Count unique underlying symbols for FUTSTK
  const underlyings = new Set();
  futstk.forEach(i => underlyings.add(i.SM_SYMBOL_NAME));
  console.log(`\n=== Unique FUTSTK underlyings: ${underlyings.size} ===`);
  console.log([...underlyings].slice(0, 20).join(', '), '...');

  // Also check if there's a segment column
  const segValues = new Set();
  allInstruments.forEach(i => {
    if (i.SEM_SEGMENT) segValues.add(i.SEM_SEGMENT);
    if (i.SEM_EXCH_SEGMENT) segValues.add('EXCH:' + i.SEM_EXCH_SEGMENT);
  });
  console.log('\n=== SEM_SEGMENT values ===');
  console.log([...segValues].join(', '));
}

inspect().catch(console.error);
