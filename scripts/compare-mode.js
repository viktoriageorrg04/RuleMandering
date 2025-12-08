(function() {
  console.log("[COMPARE] module loaded");

  const toggle = document.getElementById("compareToggle");
  const mapContainer = document.querySelector(".map");
  const svg = mapContainer?.querySelector("svg");

  if (!toggle || !svg) {
    console.warn("[COMPARE] missing toggle or svg");
    return;
  }

  // Store baseline LSq results for all countries (computed once)
  let countryLSQCache = {};

  // ------------- COLOR MAP -----------------
  function colorFromLSQ(lsq) {
    // typical EU LSq range ~1–20; clamp artificially
    const t = Math.min(1, Math.max(0, lsq / 20));
    // interpolate from blue (#4A74FF) to red (#EF5C67)
    const r1 = 0x4A, g1 = 0x74, b1 = 0xFF;
    const r2 = 0xEF, g2 = 0x5C, b2 = 0x67;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `rgb(${r},${g},${b})`;
  }

  // ------------- COMPUTE LSq FOR ONE COUNTRY -----------------
  async function computeLSQforCountry(countryCode, baselineState) {
    if (!window.CountryData || !window.CountryData[countryCode]) return null;

    const data = window.CountryData[countryCode];
    const scenario = window.EPEngine.computeScenario(data, baselineState);
    if (!scenario || !scenario.parties) return null;

    // compute Gallagher index manually (you already do something similar in app.js)
    const totalSeats = Object.values(scenario.allocatedSeats).reduce((a,b)=>a+b, 0);
    const totalVotes = scenario.parties.reduce((a,p)=>a + Number(p.voteShare || 0), 0);

    let sumSq = 0;
    scenario.parties.forEach(p => {
      const v = Number(p.voteShare) || 0;
      const s = (scenario.allocatedSeats[p.id] / totalSeats) * 100;
      sumSq += Math.pow(s - v, 2);
    });

    return Math.sqrt(sumSq * 0.5);
  }

  // ------------- PAINT WHOLE MAP -----------------
  async function paintMap(baselineState) {
    console.log("[COMPARE] painting entire map");

    const regions = svg.querySelectorAll("[data-country]");
    if (!regions.length) return;

    for (const region of regions) {
      const code = region.getAttribute("data-country");
      if (!code) continue;

      // compute & cache LSq if not already cached
      if (!countryLSQCache[code]) {
        const lsq = await computeLSQforCountry(code, baselineState);
        countryLSQCache[code] = lsq || 0;
      }

      const color = colorFromLSQ(countryLSQCache[code]);
      region.style.transition = "fill 0.5s ease";
      region.style.fill = color;
      region.style.stroke = "white";
      region.style.strokeWidth = "0.6px";
    }
  }

  // ------------- CLEAR COLORS -----------------
  function clearMapColors() {
    console.log("[COMPARE] clearing colors");

    const regions = svg.querySelectorAll("[data-country]");
    for (const region of regions) {
      region.style.transition = "fill 0.5s ease";
      region.style.fill = "";
      region.style.stroke = "";
      region.style.strokeWidth = "";
    }
  }

  // ------------- HIGHLIGHT SELECTED COUNTRY AFTER APPLY -----------------
  function highlightSelectedCountry(selectedCode) {
    const region = svg.querySelector(`[data-country="${selectedCode}"]`);
    if (!region) return;

    region.style.stroke = "#000";
    region.style.strokeWidth = "1.5px";
    region.style.filter = "brightness(1.15)";
  }

  // ------------- ON APPLY → REFRESH SELECTED COUNTRY -----------------
  window.addEventListener("rm:apply", async (ev) => {
    const { selectedCountry, state } = ev.detail;

    if (!toggle.checked) return; // only relevant in compare mode

    // recompute LSq for selected country
    const lsq = await computeLSQforCountry(selectedCountry, state);
    countryLSQCache[selectedCountry] = lsq;

    // recolor entire map using cache
    paintMap(state);

    // highlight selected
    highlightSelectedCountry(selectedCountry);
  });

  // ------------- TOGGLE COMPARE MODE -----------------
  toggle.addEventListener("change", async () => {
    const selectedCountry = window.CurrentCountryCode;
    const baselineState = window.DefaultScenarioState;

    if (toggle.checked) {
      // compare mode → keep full map view, no zoom
      document.body.classList.add("compare-active");

      await paintMap(baselineState);

      // lightly highlight selected country even before apply
      highlightSelectedCountry(selectedCountry);

    } else {
      document.body.classList.remove("compare-active");
      clearMapColors();
    }
  });

})();
