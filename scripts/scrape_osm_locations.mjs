import fs from 'fs/promises';
import path from 'path';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

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

function normalizeName(s) {
  return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function tokens(s){ return (s||'').split(/\s+/).filter(Boolean); }

function tokenOverlap(a,b){
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  let common = 0; for (const x of A) if (B.has(x)) common++;
  return common / Math.max(1, Math.max(A.size, B.size));
}

function toNumber(v){ const n = parseFloat(v); return Number.isFinite(n)?n:NaN; }

function haversine(a,b){
  const toRad = v=>v*Math.PI/180; const R=6371000;
  const dLat=toRad(b.lat-a.lat); const dLon=toRad(b.lng-a.lng);
  const lat1=toRad(a.lat), lat2=toRad(b.lat);
  const sinDLat=Math.sin(dLat/2), sinDLon=Math.sin(dLon/2);
  const c=2*Math.asin(Math.sqrt(sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon));
  return R*c;
}

const CITY_CENTERS = {
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Liverpool: { lat: 53.4084, lng: -2.9916 },
  Preston: { lat: 53.7632, lng: -2.7046 },
  Blackpool: { lat: 53.8141, lng: -3.0507 },
  Warrington: { lat: 53.3900, lng: -2.5950 },
  Chester: { lat: 53.1910, lng: -2.8958 },
  Southport: { lat: 53.6458, lng: -3.0075 },
  Ormskirk: { lat: 53.5676, lng: -2.8849 }
};

async function overpassFetch(lat,lng,radiusMeters=10000){
  const radii = [radiusMeters, Math.floor(radiusMeters/2), Math.floor(radiusMeters/4)];
  for (const r of radii){
    const q = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:${r},${lat},${lng});way["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:${r},${lat},${lng});relation["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:${r},${lat},${lng}););out center tags;`;
    for (let attempt=0; attempt<3; attempt++){
      try{
        const res = await fetch(OVERPASS, { method: 'POST', body: q, headers: { 'Content-Type': 'text/plain' } });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        const data = await res.json();
        const elems = (data.elements||[]).map(e=>{
          const latE = e.type==='node' ? e.lat : (e.center && e.center.lat);
          const lngE = e.type==='node' ? e.lon : (e.center && e.center.lon);
          return { id: `${e.type}/${e.id}`, name: e.tags && e.tags.name ? e.tags.name : '', lat: latE, lng: lngE, tags: e.tags||{} };
        }).filter(e=>e.lat && e.lng && e.name);
        return elems;
      }catch(err){
        console.warn(`Overpass attempt ${attempt+1} failed for radius ${r}:`, err.message);
        await new Promise(res=>setTimeout(res, 1200 * (attempt+1)));
      }
    }
    console.warn('Falling back to smaller radius or next retry.');
  }
  throw new Error('Overpass failed after retries');
}

async function ensureDir(dir){ try{ await fs.mkdir(dir, { recursive:true }); }catch{} }

async function runOne(cleanCsvPath, outCsvPath, reportPath){
  const full = path.join(process.cwd(), cleanCsvPath);
  const content = await fs.readFile(full, 'utf8');
  const { header, cols, rows } = (parseCSV(content));

  // group cities
  const cities = {};
  for (const r of rows){
    const city = (r.city||'').trim(); if (!city) continue;
    if (city.toLowerCase()==='ormskirk') continue; // skip
    if (!cities[city]) cities[city]=[]; cities[city].push(r);
  }

  const cityPOIs = {};
  for (const city of Object.keys(cities)){
    const center = CITY_CENTERS[city];
    if (!center){ console.warn('No center for', city); continue; }
    console.log('Querying OSM for', city);
    const pois = await overpassFetch(center.lat, center.lng, 10000);
    cityPOIs[city]=pois;
    // be polite
    await new Promise(res=>setTimeout(res, 1100));
  }

  const outRows = [];
  const report = { input: cleanCsvPath, total: rows.length, matched:0, suggestions:0, details: [] };

  for (const r of rows){
    const out = { ...r, osm_id:'', osm_name:'', osm_lat:'', osm_lng:'', osm_distance_m:'', match_confidence:'' };
    const city = (r.city||'').trim();
    if (!city || city.toLowerCase()==='ormskirk'){ outRows.push(out); continue; }
    const pois = cityPOIs[city]||[];
    const lat = toNumber(r.lat), lng = toNumber(r.lng);
    const rnorm = normalizeName(r.name || r.id || '');

    // find close matches
    let best=null; let bestScore=0;
    for (const p of pois){
      const pnorm = normalizeName(p.name);
      const overlap = tokenOverlap(rnorm, pnorm);
      const dist = (Number.isFinite(lat) && Number.isFinite(lng)) ? haversine({lat,lng},{lat:p.lat,lng:p.lng}) : Infinity;
      // scoring: prefer proximity and token overlap
      const score = (overlap*0.7) + (dist<200?0.3: (dist<500?0.15:0));
      if (score>bestScore){ bestScore=score; best={p,dist,overlap}; }
    }

    if (best && bestScore>=(0.35)){
      out.osm_id = best.p.id; out.osm_name = best.p.name; out.osm_lat = best.p.lat; out.osm_lng = best.p.lng; out.osm_distance_m = Math.round(best.dist); out.match_confidence = (bestScore.toFixed(2)); report.matched++; report.details.push({ id:r.id, match:out.osm_id, distance:out.osm_distance_m, score:out.match_confidence });
    } else if (pois.length){
      // provide top suggestion (closest by distance)
      const byDist = pois.map(p=>({p,dist: (Number.isFinite(lat) && Number.isFinite(lng))?haversine({lat,lng},{lat:p.lat,lng:p.lng}):999999})).sort((a,b)=>a.dist-b.dist);
      const s = byDist[0]; if (s){ out.osm_id=s.p.id; out.osm_name=s.p.name; out.osm_lat=s.p.lat; out.osm_lng=s.p.lng; out.osm_distance_m=Math.round(s.dist); out.match_confidence='suggestion'; report.suggestions++; report.details.push({ id:r.id, suggestion: out.osm_id, distance: out.osm_distance_m }); }
    }

    outRows.push(out);
  }

  const outCols = [...cols, 'osm_id','osm_name','osm_lat','osm_lng','osm_distance_m','match_confidence'];
  await ensureDir(path.dirname(path.join(process.cwd(), outCsvPath)));
  await fs.writeFile(path.join(process.cwd(), outCsvPath), toCSV(outCols.join(','), outRows, outCols), 'utf8');
  await fs.writeFile(path.join(process.cwd(), reportPath), JSON.stringify(report, null, 2), 'utf8');
  return report;
}

async function main(){
  try{
    console.log('Starting OSM scrape and match (Overpass API).');
    const tasks = [
      { in:'data/venues.cleaned.csv', out:'data/venues.osm_suggestions.csv', report:'data/venues.osm_suggestions.json' },
      { in:'data/food_venues.cleaned.csv', out:'data/food_venues.osm_suggestions.csv', report:'data/food_venues.osm_suggestions.json' }
    ];
    for (const t of tasks){
      console.log('Processing', t.in);
      const r = await runOne(t.in, t.out, t.report);
      console.log('Report:', r.input, 'matched=', r.matched, 'suggestions=', r.suggestions);
    }
    console.log('Done. Suggestion CSVs written next to original cleaned files.');
  }catch(err){ console.error('Error:', err); process.exitCode=2; }
}

main();
