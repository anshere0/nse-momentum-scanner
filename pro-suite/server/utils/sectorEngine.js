const fs = require('fs');
const path = require('path');

const SECTOR_MAP_FILE = path.join(__dirname, '..', '..', 'data', 'sector_map.json');

function loadSectorMap() {
  try {
    if (fs.existsSync(SECTOR_MAP_FILE)) {
      return JSON.parse(fs.readFileSync(SECTOR_MAP_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load sector map:', err.message);
  }
  return {};
}

function saveSectorMap(newMap) {
  const dir = path.dirname(SECTOR_MAP_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SECTOR_MAP_FILE, JSON.stringify(newMap, null, 2), 'utf8');
}

/**
 * Find parent sector for a stock symbol
 */
function getParentSector(symbol, sectorMap) {
  const sym = symbol.toUpperCase().trim();
  for (const [sector, stocks] of Object.entries(sectorMap)) {
    if (stocks.includes(sym)) {
      return sector;
    }
  }
  return 'OTHER';
}

/**
 * Compute Sector Alignment & RS Score vs Nifty 50
 */
function computeSectorMetrics(stock, sectorMap, indicesData = [], settings = {}) {
  const symbol = (stock.symbol || '').toUpperCase().trim();
  const stockPChange = Number(stock.pChange) || 0;
  const parentSector = getParentSector(symbol, sectorMap);

  // Find Nifty 50 % change
  const nifty50Index = indicesData.find(idx => (idx.name || '').toUpperCase().includes('NIFTY 50'));
  const nifty50Change = nifty50Index ? Number(nifty50Index.pc || 0) : 0;

  // Find Parent Sector Index % change
  let sectorChange = 0;
  let foundSector = null;

  if (parentSector !== 'OTHER') {
    foundSector = indicesData.find(idx => {
      const idxName = (idx.name || '').toUpperCase().replace(/ /g, '');
      const target = parentSector.toUpperCase().replace(/ /g, '');
      return idxName.includes(target) || target.includes(idxName);
    });
    if (foundSector) {
      sectorChange = Math.round((Number(foundSector.pc) || 0) * 100) / 100;
    }
  }

  // 1. Sector Tailwind & Alignment
  let isAligned = false;
  let alignmentStatus = 'AGAINST_SECTOR';
  let alignmentBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  let alignmentText = 'Against Sector';

  if (stockPChange > 0 && sectorChange > 0) {
    isAligned = true;
    alignmentStatus = 'ALIGNED_BULLISH';
    alignmentBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    alignmentText = `🟢 Aligned with ${parentSector} (+${sectorChange}%)`;
  } else if (stockPChange < 0 && sectorChange < 0) {
    isAligned = true;
    alignmentStatus = 'ALIGNED_BEARISH';
    alignmentBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    alignmentText = `🔴 Aligned with ${parentSector} (${sectorChange}%)`;
  } else {
    alignmentText = `⚠️ Against ${parentSector} (${sectorChange > 0 ? '+' : ''}${sectorChange}%)`;
  }

  // 2. Relative Strength (RS) Score vs Nifty 50
  const rsThreshold = settings.rsThreshold || 0.75;
  const rsScore = Math.round((stockPChange - nifty50Change) * 100) / 100;

  let rsBadge = 'NEUTRAL';
  let rsText = 'Neutral RS';
  let rsBadgeClass = 'bg-gray-800 text-gray-300 border-gray-700';

  if (rsScore >= rsThreshold) {
    rsBadge = 'RS_LEADER';
    rsText = `🚀 RS Leader (+${rsScore.toFixed(2)}%)`;
    rsBadgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20';
  } else if (rsScore <= -rsThreshold) {
    rsBadge = 'RS_LAGGARD';
    rsText = `📉 RS Laggard (${rsScore.toFixed(2)}%)`;
    rsBadgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/50';
  } else {
    rsText = `Market In-Line (${rsScore > 0 ? '+' : ''}${rsScore.toFixed(2)}%)`;
  }

  return {
    parentSector,
    sectorChange,
    nifty50Change,
    isAligned,
    alignmentStatus,
    alignmentText,
    alignmentBadge,
    rsScore,
    rsBadge,
    rsText,
    rsBadgeClass
  };
}

module.exports = {
  loadSectorMap,
  saveSectorMap,
  getParentSector,
  computeSectorMetrics
};
