const http = require('http');

const PORT = 9999;
const server = http.createServer((req, res) => {
  // allow browser cross-origin POSTs from local dev server
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const obj = JSON.parse(body);
        console.log('--- [BROWSER METRICS LOG] ---');
        console.log(JSON.stringify(obj, null, 2));
        console.log('-----------------------------');
      } catch (err) {
        console.log('[log-receiver] invalid JSON:', err.message);
        console.log(body);
      }
      res.writeHead(204, headers);
      res.end();
    });
    return;
  }

  // health endpoint
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...headers });
    res.end('pong');
    return;
  }

  res.writeHead(404, headers);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[log-receiver] listening on http://127.0.0.1:${PORT}`);
  console.log('Open your app in the browser, click Apply — metrics will be POSTed here and printed.');
});
