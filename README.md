# RuleMandering
Interactive EU electoral fairness simulator that lets users manipulate electoral parameters (thresholds, formulas, and district magnitudes) to visualize their impact on proportionality.

## Prototype status
- Single-page prototype (static HTML/CSS/JS).
- EU map loaded as an SVG via `fetch` (requires a local web server; so, `file://` will not work).
- Apply updates the legend, map highlight, and metrics; Reset restores defaults and scrolls to top (smooth, no hard reload).
- PDF export captures map + legend + metrics.
- A short product tour guides users through key controls upon first loading the page.

## Run locally (important)
You must open the project with a local web server; otherwise, the map will not load.

Recommended (VS Code):
1. Open the project folder in VS Code.
2. Install the **Live Server** extension by Ritwick Dey.
3. Ctrl + Shift + P -> `index.html` -> type **Live Server: Open with Live Server**.
4. The app opens at `http://127.0.0.1:5500/` (or similar).

Alternative:
1. Run a local server from the project root (e.g., `python -m http.server 5500`).
2. Visit `http://127.0.0.1:5500/index.html`.

## How to use
1. Select a country from the dropdown or directly by doubly-clicking on the map.
2. Adjust threshold, formula, and district magnitude.
3. Click **Apply** to update the map and metrics.
4. Use **Download** to export a PDF report.
5. Click **What’s this?** for a methods explanation or start the tour.