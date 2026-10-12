const logger = require('../utils/logger');

// IST offset: UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// NSE Market Holidays (configurable list, YYYY-MM-DD format)
// Includes major NSE holidays for 2025-2027
const NSE_HOLIDAYS = new Set([
  // 2025
  '2025-02-26', // Maha Shivaratri
  '2025-03-14', // Holi
  '2025-03-31', // Idul Fitr
  '2025-04-10', // Shri Mahavir Jayanti
  '2025-04-14', // Dr Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-08-15', // Independence Day
  '2025-08-27', // Ganesh Chaturthi
  '2025-10-02', // Mahatma Gandhi Jayanti
  '2025-10-20', // Diwali Laxmi Puja (day before Dussehra varies)
  '2025-10-21', // Dussehra
  '2025-10-22', // Diwali Balipratipada
  '2025-11-05', // Guru Nanak Jayanti
  '2025-12-25', // Christmas
  // 2026
  '2026-01-26', // Republic Day
  '2026-02-17', // Maha Shivaratri
  '2026-03-04', // Holi
  '2026-03-20', // Idul Fitr
  '2026-03-30', // Shri Mahavir Jayanti
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-05-27', // Bakri Eid
  '2026-08-15', // Independence Day
  '2026-08-17', // Ganesh Chaturthi
  '2026-10-02', // Mahatma Gandhi Jayanti
  '2026-10-10', // Dussehra
  '2026-10-19', // Muharram
  '2026-11-09', // Diwali Laxmi Puja
  '2026-11-10', // Diwali Balipratipada
  '2026-11-25', // Guru Nanak Jayanti
  '2026-12-25', // Christmas
  // 2027
  '2027-01-26', // Republic Day
  '2027-03-22', // Holi
  '2027-03-23', // Good Friday (may vary)
  '2027-04-14', // Dr Ambedkar Jayanti
  '2027-05-01', // Maharashtra Day
  '2027-08-15', // Independence Day
  '2027-10-02', // Mahatma Gandhi Jayanti
  '2027-12-25', // Christmas
]);

/**
 * Get current time in IST (accepts optional refDate for deterministic testing)
 */
function getNowIST(refDate = null) {
  const now = refDate ? new Date(refDate) : new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  return new Date(utcMs + IST_OFFSET_MS);
}

/**
 * Convert a Date object to IST
 */
function toIST(date) {
  const utcMs = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  return new Date(utcMs + IST_OFFSET_MS);
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format date as DD MMM YYYY (e.g. "10 Oct 2026")
 */
function formatDateDisplay(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Check if a date (YYYY-MM-DD) is a weekend
 */
function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a date (YYYY-MM-DD) is a market holiday
 */
function isHoliday(dateStr) {
  return NSE_HOLIDAYS.has(dateStr);
}

/**
 * Check if a date is a trading day (not weekend, not holiday)
 */
function isTradingDay(dateStr) {
  return !isWeekend(dateStr) && !isHoliday(dateStr);
}

/**
 * Get time in minutes from midnight IST
 */
function getISTTimeInMinutes(refDate = null) {
  const ist = getNowIST(refDate);
  return ist.getHours() * 60 + ist.getMinutes();
}

/**
 * Check if market is currently in pre-open session (09:00 - 09:15 IST)
 */
function isPreOpen(refDate = null) {
  const ist = getNowIST(refDate);
  const dateStr = formatDate(ist);
  if (!isTradingDay(dateStr)) return false;

  const timeMinutes = ist.getHours() * 60 + ist.getMinutes();
  return timeMinutes >= 540 && timeMinutes < 555; // 9:00 - 9:15
}

/**
 * Check if market is in regular trading session (09:15 - 15:30 IST)
 */
function isRegularSession(refDate = null) {
  const ist = getNowIST(refDate);
  const dateStr = formatDate(ist);
  if (!isTradingDay(dateStr)) return false;

  const timeMinutes = ist.getHours() * 60 + ist.getMinutes();
  return timeMinutes >= 555 && timeMinutes <= 930; // 9:15 - 15:30
}

/**
 * Check if market is open (pre-open or regular session)
 */
function isMarketOpen(refDate = null) {
  return isPreOpen(refDate) || isRegularSession(refDate);
}

/**
 * Check if within configurable scan window
 */
function isWithinScanWindow(startTime = '09:00', endTime = '15:30', refDate = null) {
  const ist = getNowIST(refDate);
  const dateStr = formatDate(ist);
  if (!isTradingDay(dateStr)) return false;

  const timeMinutes = ist.getHours() * 60 + ist.getMinutes();
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

/**
 * Get the most recent completed trading day
 * If today is a trading day and market has closed (after 15:30), today is the answer.
 * Otherwise, walk backwards to find the last trading day.
 */
function getLastCompletedTradingDay(refDate = null) {
  const ist = getNowIST(refDate);
  const todayStr = formatDate(ist);
  const timeMinutes = ist.getHours() * 60 + ist.getMinutes();

  // If today is a trading day and market has closed (after 15:30)
  if (isTradingDay(todayStr) && timeMinutes > 930) {
    return todayStr;
  }

  // Walk backwards from yesterday
  let checkDate = new Date(ist);
  for (let i = 0; i < 15; i++) { // max 15 days back (covers long holiday stretches)
    checkDate.setDate(checkDate.getDate() - 1);
    const dateStr = formatDate(checkDate);
    if (isTradingDay(dateStr)) {
      return dateStr;
    }
  }

  // Fallback: just return 15 days ago
  logger.warn('Could not find a recent trading day in the last 15 days');
  const fallback = new Date(ist);
  fallback.setDate(fallback.getDate() - 15);
  return formatDate(fallback);
}

/**
 * Get the previous completed calendar month's first and last day
 * For example, in October, returns September's range.
 */
function getPreviousCompletedMonth(refDate = null) {
  const ist = getNowIST(refDate);
  const year = ist.getFullYear();
  const month = ist.getMonth(); // 0-indexed, current month

  // Previous month
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = year - 1;
  }

  const firstDay = new Date(prevYear, prevMonth, 1);
  const lastDay = new Date(prevYear, prevMonth + 1, 0); // last day of prev month
  const monthStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
  const displayLabel = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][prevMonth]} ${prevYear}`;

  return {
    firstDay: formatDate(firstDay),
    lastDay: formatDate(lastDay),
    label: monthStr,
    displayLabel
  };
}

/**
 * Get comprehensive market status
 */
function getMarketStatus(refDate = null) {
  const ist = getNowIST(refDate);
  const todayStr = formatDate(ist);
  const lastTradingDay = getLastCompletedTradingDay(refDate);

  let status;
  let sessionType;
  let label;

  if (!isTradingDay(todayStr)) {
    status = 'HOLIDAY';
    sessionType = 'HOLIDAY';
    label = isWeekend(todayStr) ? 'Weekend' : 'Market Holiday';
  } else {
    const timeMinutes = ist.getHours() * 60 + ist.getMinutes();
    if (timeMinutes >= 540 && timeMinutes < 555) {
      status = 'PRE_OPEN';
      sessionType = 'PRE_OPEN';
      label = 'Pre-Open (09:00-09:15)';
    } else if (timeMinutes >= 555 && timeMinutes <= 930) {
      status = 'OPEN';
      sessionType = 'REGULAR';
      label = 'Market Open (09:15-15:30)';
    } else if (timeMinutes < 540) {
      status = 'PRE_MARKET';
      sessionType = 'PRE_MARKET';
      label = 'Before Market Hours';
    } else {
      status = 'CLOSED';
      sessionType = 'POST_CLOSE';
      label = 'Market Closed';
    }
  }

  return {
    status,
    sessionType,
    label,
    todayDate: todayStr,
    todayDisplay: formatDateDisplay(ist),
    lastTradingDay,
    lastTradingDayDisplay: formatDateDisplay(new Date(lastTradingDay + 'T00:00:00+05:30')),
    isTradingDay: isTradingDay(todayStr),
    isMarketOpen: sessionType === 'REGULAR',
    isPreOpen: sessionType === 'PRE_OPEN',
    currentTimeIST: ist.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }),
    timestamp: Date.now()
  };
}

/**
 * Get N previous trading days from a given date
 */
function getPreviousTradingDays(fromDateStr, count = 5) {
  const result = [];
  let checkDate = new Date(fromDateStr + 'T00:00:00+05:30');

  for (let i = 0; i < 30 && result.length < count; i++) {
    checkDate.setDate(checkDate.getDate() - 1);
    const dateStr = formatDate(checkDate);
    if (isTradingDay(dateStr)) {
      result.push(dateStr);
    }
  }

  return result;
}

/**
 * Add a custom holiday
 */
function addHoliday(dateStr) {
  NSE_HOLIDAYS.add(dateStr);
}

/**
 * Remove a holiday
 */
function removeHoliday(dateStr) {
  NSE_HOLIDAYS.delete(dateStr);
}

/**
 * Get all configured holidays
 */
function getHolidays() {
  return Array.from(NSE_HOLIDAYS).sort();
}

module.exports = {
  getNowIST,
  toIST,
  formatDate,
  formatDateDisplay,
  isWeekend,
  isHoliday,
  isTradingDay,
  isPreOpen,
  isRegularSession,
  isMarketOpen,
  isWithinScanWindow,
  getLastCompletedTradingDay,
  getPreviousCompletedMonth,
  getMarketStatus,
  getPreviousTradingDays,
  getISTTimeInMinutes,
  addHoliday,
  removeHoliday,
  getHolidays
};
