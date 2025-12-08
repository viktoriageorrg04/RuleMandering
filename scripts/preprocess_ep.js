/**
 * Reads files like at.json, be.json, etc.
 * Extracts:
 *   - party ids
 *   - seatsTotal
 *   - votesPercent
 *   - EP group
 *
 * Writes ep2024_processed.json with clean, normalized structure.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(process.cwd(), "data");
const OUT_FILE = path.join(DATA_DIR, "ep2024_processed.json");

// process all *XX.json files

const countryFiles = fs
  .readdirSync(DATA_DIR)
  .filter(f => /^[a-z]{2}\.json$/i.test(f));

const output = {};

for (const file of countryFiles) {
  const code = file.replace(".json", "").toUpperCase();
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));

  // If the structure is missing partySummary, skip
  if (!raw.partySummary || !raw.partySummary.seatsByParty) {
    console.warn(`No partySummary.seatsByParty in ${file}, skipping`);
    continue;
  }

  const seatsByParty = raw.partySummary.seatsByParty;

  const parties = seatsByParty.map(p => {
    const group = p.groupDistribution?.[0]?.id || null;

    return {
      id: p.id,
      name: p.id,
      epGroup: group,
      voteShare: Number(p.votesPercent) || 0,
      votes: Number(p.votesPercent) || 0,
      seats: Number(p.seatsTotal) || 0
    };
  });

  const totalSeats = parties.reduce((s, p) => s + p.seats, 0);
  const totalVotes = parties.reduce((s, p) => s + p.votes, 0);

  output[code] = {
    name: code,
    countryCode: code,
    year: 2024,
    totalSeats,
    totalVotes,
    districts: [
      {
        name: "National",
        magnitude: totalSeats,
        parties
      }
    ]
  };
}

fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
console.log("SUCCESS: Wrote", OUT_FILE);
