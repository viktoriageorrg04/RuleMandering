(function ensureLibsLoaded() {
  function addScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  const html2canvasPromise = window.html2canvas
    ? Promise.resolve()
    : addScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");

  const jsPdfPromise = window.jspdf
    ? Promise.resolve()
    : addScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");

  Promise.all([html2canvasPromise, jsPdfPromise]).then(initDownloadFeature);
})();

function initDownloadFeature() {
  const downloadBtn = document.querySelector(".map-actions .btn.ghost");
  if (!downloadBtn) return;

  downloadBtn.addEventListener("click", async (ev) => {
    // EARLY GUARD: abort if marked disabled via class/aria
    if (downloadBtn.classList.contains("is-disabled") || downloadBtn.getAttribute("aria-disabled") === "true") {
      ev && ev.preventDefault && ev.preventDefault();
      ev && ev.stopPropagation && ev.stopPropagation();
      if (window.showErrorToast) {
        window.showErrorToast("No results to download — click Apply first.");
      } else {
        alert("No results to download — click Apply first.");
      }
      return;
    }

    const { jsPDF } = window.jspdf;

    // Elements to capture
    const mapEl = document.querySelector(".map-card");
    const legendEl = document.querySelector(".legend");
    const metricsEl = document.querySelector(".insights-card");

    if (!mapEl || !legendEl || !metricsEl) {
      console.warn("PDF: missing elements");
      return;
    }

    // Helper for capturing a DOM node → canvas → PNG
    async function capture(el, opts = {}) {
      const canvas = await html2canvas(el, Object.assign({
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true
      }, opts));
      return canvas.toDataURL("image/png", 1.0);
    }

    // Capture parts
    // Hide legend while capturing the map to avoid duplication (mapCard contains the legend)
    let legendBackupDisplay = legendEl.style.display;
    try {
      legendEl.style.display = "none";
      var mapImg = await capture(mapEl);
    } finally {
      legendEl.style.display = legendBackupDisplay || "";
    }

    // Capture legend separately
    const legendImg = await capture(legendEl);

    // Build metrics capture element
    // If we have the last engine result, build an off-screen cloned metrics card that contains ALL parties.
    let metricsClone = null;
    let metricsToCapture = metricsEl;
    try {
      const engineResult = window._lastEngineResult || null;
      if (engineResult && Array.isArray(engineResult.parties)) {
        // clone the visual card so styles apply
        metricsClone = metricsEl.cloneNode(true);
        // ensure clone is off-screen but styled
        metricsClone.style.position = "fixed";
        metricsClone.style.left = "-9999px";
        metricsClone.style.top = "0";
        metricsClone.style.width = `${metricsEl.getBoundingClientRect().width}px`;
        metricsClone.style.boxSizing = "border-box";
        document.body.appendChild(metricsClone);

        // find seat-bonus container inside clone
        const seatTop = metricsClone.querySelector('.seat-bonus-top') || metricsClone.querySelector('.seat-bonus') || null;
        if (seatTop) {
          let topList = seatTop.querySelector('.top-list');
          if (!topList) {
            topList = document.createElement('div');
            topList.className = 'top-list';
            seatTop.appendChild(topList);
          }

          // reconstruct ordered parties using engineResult
          const parties = (engineResult.parties || []).slice();
          const seatBonus = engineResult.seatBonus || {};
          const allocatedSeats = engineResult.allocatedSeats || {};

          const ordered = parties.sort((a,b) => (seatBonus[b.id]||0) - (seatBonus[a.id]||0));

          const header = `
            <div class="top-row header" aria-hidden="true">
              <div class="header-dot"></div>
              <div class="name-wrap header-label">Party</div>
              <div class="votes header-label">% Votes</div>
              <div class="bonus header-label">Bonus</div>
              <div class="allocated header-label">Seats</div>
            </div>
          `;

          const rowsHtml = ordered.map(p => {
            const id = p.id || p.name || '—';
            const fullName = (window.PARTY_NAMES && window.PARTY_NAMES[id]) || p.name || id;
            const display = String(fullName || id);
            const esc = s => String(s || '').replace(/"/g, '&quot;');
            const bonus = seatBonus[p.id] || 0;
            const newVal = Number(p.voteShare || p.votes) || 0;
            const allocated = (allocatedSeats && typeof allocatedSeats[p.id] !== 'undefined') ? allocatedSeats[p.id] : null;
            const color = bonus > 0 ? '#10B981' : (bonus < 0 ? '#EF4444' : '#94A3B8');
            return `
              <div class="top-row" data-id="${esc(id)}">
                <div class="dot" style="background:${color}"></div>
                <div class="name-wrap">
                  <div class="party-name" title="${esc(fullName)}" aria-label="${esc(fullName)}">${esc(display)}</div>
                </div>
                <div class="votes">${newVal.toFixed(2)}%</div>
                <div class="bonus">${bonus>0?'+':''}${bonus}</div>
                <div class="allocated">${allocated !== null ? allocated + 's' : ''}</div>
              </div>`;
          }).join('');

          topList.innerHTML = header + rowsHtml;

          // remove any pager/dots from the clone so the copy shows everything
          const pager = seatTop.querySelector('.top-pager');
          if (pager) pager.remove();
        }

        metricsToCapture = metricsClone;
      }

      // now capture metricsToCapture
      const metricsImg = await capture(metricsToCapture, { scrollY: -window.scrollY });

      const pdf = new jsPDF({ unit: "pt", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const marginTop = 40; // top padding on each page
      let y = marginTop; // current vertical position on current page

      // Adds an image centered at `y`, updates y to after the image.
      function addImageCentered(img, maxWidth = pageWidth - 80) {
        const baseImg = new Image();
        baseImg.src = img;
        return new Promise((resolve) => {
          baseImg.onload = () => {
            const ratio = baseImg.height / baseImg.width;
            const w = Math.min(maxWidth, baseImg.width);
            const h = w * ratio;
            const x = (pageWidth - w) / 2;
            pdf.addImage(img, "PNG", x, y, w, h);
            y += h + 28; // gap after image
            resolve();
          };
          baseImg.onerror = () => {
            console.warn("Failed to load image for PDF:", img);
            resolve();
          };
        });
      }

      // Add map + legend to the first page
      await addImageCentered(mapImg);
      await addImageCentered(legendImg);

      // Start a new page for metrics to avoid cropping
      pdf.addPage();
      y = marginTop;
      await addImageCentered(metricsImg, pageWidth - 100);

      // Save
      pdf.save("RuleMandering-Report.pdf");
    } finally {
      // cleanup clone if used
      if (metricsClone && metricsClone.parentNode) metricsClone.parentNode.removeChild(metricsClone);
    }
  });
}
