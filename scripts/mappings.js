const fs = require('fs');
const path = require('path');

const DATA = path.join(process.cwd(), 'data', 'parties.json');
const OUT = path.join(process.cwd(), 'data', 'party_names.json');

if (!fs.existsSync(DATA)) {
  console.error('Missing data/parties.json');
  process.exit(1);
}

const src = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const map = {};

// parties.json structure: { countries: [ { countryId, candidates: [ { candidateId, candidateLongName, candidateAcronym } ] } ] }
for (const c of (src.countries || [])) {
  for (const cand of (c.candidates || [])) {
    if (!cand || !cand.candidateId) continue;
    // prefer acronym then long name
    const name = (cand.candidateAcronym || cand.candidateLongName || '').trim();
    if (name) map[cand.candidateId] = name;
  }
}

// write sorted for consistency
const out = {};
Object.keys(map).sort().forEach(k => out[k] = map[k]);

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('Wrote', OUT, 'entries=', Object.keys(out).length);
