// (function ensureLibsLoaded() {
//   function addScript(src) {
//     return new Promise((resolve) => {
//       const s = document.createElement("script");
//       s.src = src;
//       s.onload = resolve;
//       document.head.appendChild(s);
//     });
//   }

//   // only load if missing
//   const html2canvasPromise = window.html2canvas
//     ? Promise.resolve()
//     : addScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");

//   const jsPdfPromise = window.jspdf
//     ? Promise.resolve()
//     : addScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");

//   Promise.all([html2canvasPromise, jsPdfPromise]).then(initDownloadFeature);
// })();

// function initDownloadFeature() {
//   const downloadBtn = document.querySelector(".map-actions .btn.ghost");
//   if (!downloadBtn) return;

//   downloadBtn.addEventListener("click", async () => {
//     const { jsPDF } = window.jspdf;

//     // Elements to capture
//     const mapEl = document.querySelector(".map-card");
//     const legendEl = document.querySelector(".legend");
//     const metricsEl = document.querySelector(".insights-card");

//     if (!mapEl || !legendEl || !metricsEl) {
//       console.warn("PDF: missing elements");
//       return;
//     }

//     // Helper for capturing a DOM node → canvas → PNG
//     async function capture(el, opts = {}) {
//       const canvas = await html2canvas(el, Object.assign({
//         backgroundColor: "#ffffff",
//         scale: 2,
//         useCORS: true
//       }, opts));
//       return canvas.toDataURL("image/png", 1.0);
//     }

//     // Capture parts
//     // Hide legend while capturing the map to avoid duplication (mapCard contains the legend)
//     let legendBackupDisplay = legendEl.style.display;
//     try {
//       legendEl.style.display = "none";
//       var mapImg = await capture(mapEl);
//     } finally {
//       legendEl.style.display = legendBackupDisplay || "";
//     }

//     // Now capture legend and metrics separately
//     const legendImg = await capture(legendEl);
//     const metricsImg = await capture(metricsEl, { scrollY: -window.scrollY });

//     const pdf = new jsPDF({ unit: "pt", format: "a4" });

//     const pageWidth = pdf.internal.pageSize.getWidth();
//     const pageHeight = pdf.internal.pageSize.getHeight();
//     const marginTop = 40; // top padding on each page
//     let y = marginTop; // current vertical position on current page

//     // Adds an image centered at `y`, updates y to after the image.
//     function addImageCentered(img, maxWidth = pageWidth - 80) {
//       const baseImg = new Image();
//       baseImg.src = img;
//       return new Promise((resolve) => {
//         baseImg.onload = () => {
//           const ratio = baseImg.height / baseImg.width;
//           // Constrain width to maxWidth and scale accordingly
//           const w = Math.min(maxWidth, baseImg.width);
//           const h = w * ratio;
//           const x = (pageWidth - w) / 2;
//           pdf.addImage(img, "PNG", x, y, w, h);
//           y += h + 28; // gap after image
//           resolve();
//         };
//         baseImg.onerror = () => {
//           console.warn("Failed to load image for PDF:", img);
//           resolve();
//         };
//       });
//     }

//     // Add map + legend to the first page (legend is added separately but the map capture didn't include it)
//     await addImageCentered(mapImg);
//     await addImageCentered(legendImg);

//     // Start a new page for metrics to avoid cropping
//     pdf.addPage();
//     y = marginTop;
//     await addImageCentered(metricsImg, pageWidth - 100);

//     // Save
//     pdf.save("RuleMandering-Report.pdf");
//   });
// }

(function ensureLibsLoaded() {
  function addScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  // only load if missing
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

    // Now capture legend and metrics separately
    const legendImg = await capture(legendEl);
    const metricsImg = await capture(metricsEl, { scrollY: -window.scrollY });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginTop = 40; // top padding on each page
    let y = marginTop; // current vertical position on current page

    // Adds an image centered at `y`, updates y to after the image.
    function addImageCentered(img, maxWidth = pageWidth - 80) {
      const baseImg = new Image();
      baseImg.src = img;
      return new Promise((resolve) => {
        baseImg.onload = () => {
          const ratio = baseImg.height / baseImg.width;
          // Constrain width to maxWidth and scale accordingly
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

    // Add map + legend to the first page (legend is added separately but the map capture didn't include it)
    await addImageCentered(mapImg);
    await addImageCentered(legendImg);

    // Start a new page for metrics to avoid cropping
    pdf.addPage();
    y = marginTop;
    await addImageCentered(metricsImg, pageWidth - 100);

    // Save
    pdf.save("RuleMandering-Report.pdf");
  });
}
