// // Add at the very top of ep-engine.js
// if (typeof window === 'undefined') {
//   global.window = global;  // Simulate window for Node.js
// }

// Seat-allocation logic for RuleMandering.
// No DOM, only console logs and math.
(function (global) {
  console.log("[EP_ENGINE] loaded");

  // ---- helper: magnitude from UI state ----
  function getMagnitude(baseDistrict, state) {
    const baseMag = Number(baseDistrict.magnitude) || 1;
    let m = baseMag;

    // state.dmMode is a string like "Mode 1", "Mode 2", "Mode 3"
    const mode = state.dmMode || "";
    const sliderVal = Number(state.dmMag) || 0;

    if (mode.includes("Mode 2")) {
      // direct override by slider
      if (sliderVal > 0) m = sliderVal;
    } else if (mode.includes("Mode 3")) {
      // scale base magnitude by slider percentage (0–10 -> 0–100%)
      const factor = sliderVal > 0 ? sliderVal : 10; // default = 10 (100%)
      m = Math.round(baseMag * (factor / 10));
    }
    // Mode 1 → keep baseMag

    m = Math.max(1, m);

    console.log("[EP_ENGINE] getMagnitude →", {
      baseMag,
      mode,
      sliderVal,
      magnitude: m
    });

    return m;
  }

  // ---- seat allocation (D’Hondt / Sainte-Laguë / fallback) ----
  function allocateSeats(parties, magnitude, formula) {
    console.log("[EP_ENGINE] allocateSeats start", {
      magnitude,
      formula,
      parties: parties.length
    });

    const ids = parties.map(p => p.id);

    const votes = parties.reduce((obj, p) => {
      obj[p.id] = Number(p.votes) || Number(p.voteShare) || 0;
      return obj;
    }, {});

    const results = {};
    ids.forEach(id => { results[id] = 0; });

    function divisorDHondt(k) { return k + 1; }
    function divisorSainteLague(k) { return 2 * k + 1; }

    for (let seat = 0; seat < magnitude; seat++) {
      let bestParty = null;
      let bestScore = -Infinity;

      ids.forEach(id => {
        const allocated = results[id];
        const v = votes[id] || 0;
        let score;

        if (formula && formula.includes("Hondt")) {
          score = v / divisorDHondt(allocated);
        } else if (formula && formula.includes("Laguë")) {
          score = v / divisorSainteLague(allocated);
        } else {
          // Hare quota or anything else → simple proportional
          score = v;
        }

        if (score > bestScore) {
          bestScore = score;
          bestParty = id;
        }
      });

      if (bestParty != null) {
        results[bestParty] += 1;
      }
    }

    console.log("[EP_ENGINE] allocateSeats result", results);
    return results;
  }

  // ---- main: computeScenario(countryData, state) ----
  function computeScenario(countryData, state) {
    if (!countryData || !countryData.districts || !countryData.districts.length) {
      console.warn("[EP_ENGINE] computeScenario: invalid countryData", countryData);
      return null;
    }

    const baseDistrict = countryData.districts[0];

    const threshold = Number(state.threshold) || 0;

    console.log("[EP_ENGINE] computeScenario start", {
      country: countryData.countryCode || countryData.name,
      threshold,
      dmMode: state.dmMode,
      dmMag: state.dmMag,
      formula: state.formula
    });

    // copy + threshold filter
    let parties = baseDistrict.parties || [];
    const beforeCount = parties.length;

    parties = parties
      .filter(p => Number(p.voteShare) >= threshold)
      .map(p => ({ ...p }));

    console.log(
      `[EP_ENGINE] threshold ${threshold}% removed ${
        beforeCount - parties.length
      } parties; remaining: ${parties.length}`
    );

    const magnitude = getMagnitude(baseDistrict, state);
    const allocated = allocateSeats(parties, magnitude, state.formula);

    const bonus = {};
    parties.forEach(p => {
      const current = allocated[p.id] || 0;
      const baseline = Number(p.seats) || 0;
      bonus[p.id] = current - baseline;
    });

    const result = {
      parties,
      allocatedSeats: allocated,
      seatBonus: bonus,
      threshold,
      magnitude,
      formula: state.formula,
      countryName: countryData.name
    };

    console.log("[EP_ENGINE] computeScenario result", result);
    return result;
  }

  // expose API
  global.EPEngine = {
    computeScenario,
    allocateSeats,
    getMagnitude
  };

})(window);

// // sample country data for testing
// const sampleCountryData = {
//   name: "Austria",
//   countryCode: "AT",
//   districts: [
//     {
//       name: "National",
//       magnitude: 20,
//       parties: [
//         { id: "AT01", name: "ÖVP", voteShare: 24.52, votes: 245200, seats: 5 },
//         { id: "AT02", name: "SPÖ", voteShare: 23.22, votes: 232200, seats: 5 },
//         { id: "AT03", name: "FPÖ", voteShare: 16.23, votes: 162300, seats: 3 },
//         { id: "AT04", name: "Grüne", voteShare: 8.24, votes: 82400, seats: 2 },
//         { id: "AT05", name: "NEOS", voteShare: 4.45, votes: 44500, seats: 1 },
//         { id: "AT06", name: "Other", voteShare: 3.34, votes: 33400, seats: 0 }
//       ]
//     }
//   ]
// };

// // sample UI state
// const sampleState = {
//   threshold: 4,  // 4% threshold
//   formula: "D’Hondt",
//   dmMode: "Mode 1",  // Use base magnitude
//   dmMag: 20  // Slider value (not used in Mode 1)
// };

// console.log("Testing EPEngine...");
// const result = window.EPEngine.computeScenario(sampleCountryData, sampleState);
// console.log("Result:", result);
