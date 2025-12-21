import fs from 'fs/promises';
import path from 'path';

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  const cols = header.split(',');
  const rows = lines.map(line => {
    const parts = line.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, (parts[i] ?? '').trim()]));
  });
  return { header, cols, rows };
}

function haversine(a, b) {
  const toRad = v => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon));
  return R * c;
}

const cityCenters = {
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Liverpool: { lat: 53.4084, lng: -2.9916 },
  Preston: { lat: 53.7632, lng: -2.7046 },
  Blackpool: { lat: 53.8141, lng: -3.0507 },
  Warrington: { lat: 53.3900, lng: -2.5950 },
  Chester: { lat: 53.1910, lng: -2.8958 },
  Southport: { lat: 53.6458, lng: -3.0075 },
  Ormskirk: { lat: 53.5676, lng: -2.8849 }
};

async function checkFile(relPath, maxMeters = 10000) {
  const full = path.join(process.cwd(), relPath);
  const content = await fs.readFile(full, 'utf8');
  const { header, cols, rows } = parseCSV(content);

  const flagged = [];
  for (const r of rows) {
    const city = (r.city || '').trim();
    if (!city) { flagged.push({ row: r, reason: 'missing-city' }); continue; }
    if (city.toLowerCase() === 'ormskirk') continue; // skip Ormskirk per request

    const center = cityCenters[city];
    if (!center) { flagged.push({ row: r, reason: 'unknown-city' }); continue; }

    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) { flagged.push({ row: r, reason: 'bad-coords' }); continue; }

    const dist = haversine({ lat, lng }, center);
    if (dist > maxMeters) flagged.push({ row: r, reason: 'far-from-center', meters: Math.round(dist) });
  }

  const outReport = { input: relPath, total: rows.length, flagged: flagged.length, details: flagged.slice(0,200) };
  const outPath = full.replace('.csv', '.check.json');
  await fs.writeFile(outPath, JSON.stringify(outReport, null, 2), 'utf8');
  return outReport;
}

async function main() {
  try {
    const files = ['data/venues.cleaned.csv', 'data/food_venues.cleaned.csv'];
    const results = [];
    for (const f of files) {
      console.log('Checking', f);
      const r = await checkFile(f, 10000);
      console.log(`${f}: total=${r.total}, flagged=${r.flagged}`);
      results.push(r);
    }
    console.log('Reports written next to CSVs as .check.json');
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 2;
  }
}

main();
