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

function toCSV(header, rows, cols) {
  const lines = [header];
  for (const r of rows) {
    const line = cols.map(c => r[c] ?? '').join(',');
    lines.push(line);
  }
  return lines.join('\n') + '\n';
}

function titleCase(s) {
  return s.toLowerCase().split(/\s+/).map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

function validateRow(r) {
  const issues = [];
  const lat = parseFloat(r.lat);
  const lng = parseFloat(r.lng);
  if (!r.lat || Number.isNaN(lat) || lat < -90 || lat > 90) issues.push('bad-lat');
  if (!r.lng || Number.isNaN(lng) || lng < -180 || lng > 180) issues.push('bad-lng');
  if (r.baseline === undefined || r.baseline === '' || Number.isNaN(parseInt(r.baseline,10))) issues.push('bad-baseline');
  return issues;
}

async function processFile(relPath) {
  const full = path.join(process.cwd(), relPath);
  const content = await fs.readFile(full, 'utf8');
  const { header, cols, rows } = parseCSV(content);

  const seenIds = new Set();
  const report = { total: rows.length, ormskirk: 0, duplicates: 0, invalid: 0, normalizedCities: 0 };

  const ormskirkRows = [];
  const otherRows = [];

  for (const r of rows) {
    const id = r.id;
    if (seenIds.has(id)) { report.duplicates++; continue; }
    seenIds.add(id);

    const city = (r.city || '').trim();
    if (city.toLowerCase() === 'ormskirk') {
      ormskirkRows.push(r);
      report.ormskirk++;
      continue;
    }

    const issues = validateRow(r);
    if (issues.length) {
      report.invalid++;
    }

    const normalizedCity = titleCase(city || '');
    if (normalizedCity !== city) report.normalizedCities++;
    r.city = normalizedCity;

    r.name = (r.name || '').trim();

    otherRows.push(r);
  }

  otherRows.sort((a,b) => {
    if (a.city === b.city) return (a.name || '').localeCompare(b.name || '');
    return (a.city || '').localeCompare(b.city || '');
  });

  const cleanedRows = [...ormskirkRows, ...otherRows];

  const outPath = path.join(process.cwd(), relPath.replace('.csv', '.cleaned.csv'));
  await fs.writeFile(outPath, toCSV(header, cleanedRows, cols), 'utf8');

  return { report, outPath, input: relPath };
}

async function main() {
  try {
    const files = ['data/venues.csv', 'data/food_venues.csv'];
    const results = [];
    for (const f of files) {
      console.log('Processing', f);
      const r = await processFile(f);
      results.push(r);
      console.log(`Wrote cleaned file: ${r.outPath}`);
      console.log('Report:', r.report);
    }
    console.log('\nSummary:');
    for (const r of results) {
      console.log(`- ${r.input}: total=${r.report.total}, ormskirk=${r.report.ormskirk}, duplicatesRemoved=${r.report.duplicates}, invalid=${r.report.invalid}, citiesNormalized=${r.report.normalizedCities}`);
    }
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 2;
  }
}

main();
