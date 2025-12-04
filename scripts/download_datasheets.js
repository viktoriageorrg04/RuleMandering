process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require('fs');
const path = require('path');
const https = require('https');

const INDEX_URL = 'https://results.elections.europa.eu/en/tools/download-datasheets/';
const OUT_DIR = path.resolve(__dirname, '..', 'data');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': '*/*',
  'Referer': INDEX_URL
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    https.get(url, { headers: HEADERS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(outPath);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

(async () => {
  try {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    console.log("Fetching index page...");
    const html = await fetchText(INDEX_URL);

    const re = /href="([^"]+\.(json|csv))"/gi;
    const allLinks = [];
    let match;

    while ((match = re.exec(html)) !== null) {
      let href = match[1];
      if (href.startsWith('/')) href = 'https://results.elections.europa.eu' + href;
      if (!href.startsWith('http')) href = new URL(href, INDEX_URL).href;
      if (!allLinks.includes(href)) allLinks.push(href);
    }

    // only download files located inside 2024–2029 directories
    const only2024to2029 = allLinks.filter(url =>
      /\/2024-2029\//i.test(url)
    );

    if (!only2024to2029.length) {
      console.log("No files found under /2024-2029/. The website structure may have changed.");
      return;
    }

    console.log(`Found ${only2024to2029.length} file(s) in 2024–2029 legislature.`);

    for (const url of only2024to2029) {
      const fname = path.basename(new URL(url).pathname);
      const outPath = path.join(OUT_DIR, fname);

      try {
        await downloadFile(url, outPath);
        console.log(`Saved → ${outPath}`);
      } catch (err) {
        console.log(`Failed to download ${url}: ${err.message}`);
      }
    }

    console.log("✓ Done. Only 2024–2029 files saved into /data");

  } catch (err) {
    console.error("Error:", err.message);
  }
})();
