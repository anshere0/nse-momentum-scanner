const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const marketSession = require('../services/marketSession');

describe('Market Session & Calendar Tests', () => {
  test('Friday close displayed on Saturday and Sunday', () => {
    // Test Saturday date: 2025-10-11 (Saturday)
    const satDate = new Date('2025-10-11T12:00:00+05:30');
    const lastSessionSat = marketSession.getLastCompletedTradingDay(satDate);
    // Friday was 2025-10-10
    assert.equal(lastSessionSat, '2025-10-10', 'Saturday should resolve to Friday (2025-10-10)');

    // Test Sunday date: 2025-10-12 (Sunday)
    const sunDate = new Date('2025-10-12T12:00:00+05:30');
    const lastSessionSun = marketSession.getLastCompletedTradingDay(sunDate);
    assert.equal(lastSessionSun, '2025-10-10', 'Sunday should resolve to Friday (2025-10-10)');

    // Test Monday before market opens (e.g. 08:30 AM):
    const monMorning = new Date('2025-10-13T08:30:00+05:30');
    const lastSessionMonMorning = marketSession.getLastCompletedTradingDay(monMorning);
    assert.equal(lastSessionMonMorning, '2025-10-10', 'Monday morning before 15:30 should still show Friday');
  });

  test('Holiday-aware previous-session detection', () => {
    // 2025-08-15 is Independence Day (Holiday)
    // 2025-08-15 is Friday. The trading day before should be Thursday 2025-08-14.
    const isHoliday = marketSession.isHoliday('2025-08-15');
    assert.equal(isHoliday, true, '2025-08-15 should be identified as a holiday');

    const holidayDate = new Date('2025-08-15T12:00:00+05:30');
    const lastSession = marketSession.getLastCompletedTradingDay(holidayDate);
    assert.equal(lastSession, '2025-08-14', 'Holiday on Friday should resolve to Thursday 2025-08-14');
  });

  test('09:00–09:15 Pre-open session labeling', () => {
    // A regular Tuesday at 09:05 AM
    const preOpenDate = new Date('2025-10-14T09:05:00+05:30');
    const status = marketSession.getMarketStatus(preOpenDate);
    assert.equal(status.sessionType, 'PRE_OPEN');
    assert.equal(status.isMarketOpen, false, 'Pre-open should not be marked as regular market open');
  });

  test('09:15–15:30 Regular trading session handling', () => {
    // A regular Tuesday at 11:30 AM
    const regularDate = new Date('2025-10-14T11:30:00+05:30');
    const status = marketSession.getMarketStatus(regularDate);
    assert.equal(status.sessionType, 'REGULAR');
    assert.equal(status.isMarketOpen, true);

    // After market close (16:00 IST)
    const afterHours = new Date('2025-10-14T16:00:00+05:30');
    const statusAfter = marketSession.getMarketStatus(afterHours);
    assert.equal(statusAfter.sessionType, 'POST_CLOSE');
    assert.equal(statusAfter.isMarketOpen, false);
  });

  test('Previous completed month calculation without look-ahead bias', () => {
    // Reference date: 2025-10-15 (October)
    const octDate = new Date('2025-10-15T10:00:00+05:30');
    const prevMonth = marketSession.getPreviousCompletedMonth(octDate);

    assert.equal(prevMonth.label, '2025-09', 'Previous completed month for October should be September (2025-09)');
    assert.equal(prevMonth.firstDay, '2025-09-01');
    assert.equal(prevMonth.lastDay, '2025-09-30');

    // Reference date: 2026-01-10 (January)
    const janDate = new Date('2026-01-10T10:00:00+05:30');
    const prevMonthJan = marketSession.getPreviousCompletedMonth(janDate);
    assert.equal(prevMonthJan.label, '2025-12', 'Previous completed month for January should be December of previous year');
  });
});
