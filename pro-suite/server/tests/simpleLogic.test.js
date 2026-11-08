const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const cashUniverseService = require('../services/cashUniverseService');

describe('Pro-Suite Simple Stock & Screener Filter Logic', () => {
  it('should initialize cash universe without crashing', async () => {
    const universe = await cashUniverseService.initializeCashUniverse();
    assert.ok(Array.isArray(universe), 'Universe should be an array');
    assert.ok(universe.length > 0, 'Universe should contain stocks');
  });

  it('should return Cash stocks strictly separated with null OI', async () => {
    const res = await cashUniverseService.getStocks({ segment: 'CASH', limit: 10 });
    assert.equal(res.segment, 'CASH');
    assert.ok(res.stocks.length > 0);
    for (const stock of res.stocks) {
      assert.equal(stock.segment, 'CASH');
      assert.equal(stock.isFno, false);
      assert.equal(stock.oi, null, 'Cash stocks must not carry OI');
      assert.equal(stock.oiChange, null, 'Cash stocks must not carry OI change');
    }
  });

  it('should filter gainers correctly', async () => {
    const res = await cashUniverseService.getStocks({ segment: 'CASH', filter: 'GAINERS', limit: 50 });
    for (const stock of res.stocks) {
      assert.ok(stock.pChange >= 0, `Expected positive change, got ${stock.pChange}`);
    }
  });

  it('should filter losers correctly', async () => {
    const res = await cashUniverseService.getStocks({ segment: 'CASH', filter: 'LOSERS', limit: 50 });
    for (const stock of res.stocks) {
      assert.ok(stock.pChange <= 0, `Expected negative change, got ${stock.pChange}`);
    }
  });

  it('should support LTP range filter', async () => {
    const res = await cashUniverseService.getStocks({
      segment: 'CASH',
      ltpFilterEnabled: true,
      minLtp: 500,
      maxLtp: 1500,
      limit: 50
    });
    for (const stock of res.stocks) {
      assert.ok(stock.ltp >= 500 && stock.ltp <= 1500, `Stock LTP ${stock.ltp} should be in [500, 1500]`);
    }
  });

  it('should support Volume filter', async () => {
    const res = await cashUniverseService.getStocks({
      segment: 'CASH',
      volumeFilterEnabled: true,
      minVolume: 100000,
      limit: 50
    });
    for (const stock of res.stocks) {
      assert.ok(stock.volume >= 100000, `Stock volume ${stock.volume} should be >= 100000`);
    }
  });

  it('should paginate results cleanly', async () => {
    const page1 = await cashUniverseService.getStocks({ segment: 'CASH', page: 1, limit: 10 });
    const page2 = await cashUniverseService.getStocks({ segment: 'CASH', page: 2, limit: 10 });
    assert.equal(page1.stocks.length, 10);
    assert.equal(page2.stocks.length, 10);
    if (page1.stocks[0] && page2.stocks[0]) {
      assert.notEqual(page1.stocks[0].symbol, page2.stocks[0].symbol, 'Page 1 and Page 2 should have different stocks');
    }
  });
});
