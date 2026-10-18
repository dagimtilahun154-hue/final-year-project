const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'frontend/dist');
const outDir = path.join(root, 'docs/screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const port = 4123;
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  let filePath = path.join(distDir, reqPath);

  if (!fs.existsSync(filePath) || (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())) {
    if (path.extname(reqPath) === '') {
      filePath = path.join(distDir, 'index.html');
    }
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, async () => {
  console.log(`Server started on http://localhost:${port}`);
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  const targets = [
    { url: `http://localhost:${port}/`, file: 'web_saas_landing.png', width: 1440, height: 900 },
    { url: `http://localhost:${port}/admin/preview/dashboard`, file: 'web_daycare_admin_dashboard.png', width: 1440, height: 900 },
    { url: `http://localhost:${port}/staff/preview/workspace`, file: 'web_caregiver_attendance_workspace.png', width: 1440, height: 900 },
    { url: `http://localhost:${port}/admin/preview/children`, file: 'web_daycare_children_directory.png', width: 1440, height: 900 },
    { url: `http://localhost:${port}/super-admin`, file: 'web_super_admin_portal.png', width: 1440, height: 900 }
  ];

  for (const t of targets) {
    const outFile = path.join(outDir, t.file);
    console.log(`Capturing ${t.url} -> ${t.file}...`);
    try {
      const cmd = `"${chromePath}" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --virtual-time-budget=4500 --window-size=${t.width},${t.height} --screenshot="${outFile}" "${t.url}"`;
      execSync(cmd, { stdio: 'inherit' });
      if (fs.existsSync(outFile)) {
        console.log(`✓ Saved ${t.file} (${fs.statSync(outFile).size} bytes)`);
      } else {
        console.warn(`✗ File not created: ${outFile}`);
      }
    } catch (err) {
      console.error(`Error capturing ${t.file}:`, err.message);
    }
  }

  server.close(() => {
    console.log('Capture completed and server closed.');
    process.exit(0);
  });
});
