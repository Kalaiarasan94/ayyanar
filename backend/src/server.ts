import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import apiRoutes from './routes/api';
import { db, initDb } from './db';
import { getErrorLogs, logError } from './logger';

const app = express();
// Hostinger (and most hosts) inject the port via the PORT env variable
const PORT = parseInt(process.env.PORT || '5000');
const startedAt = new Date();

app.use(cors());
app.use(express.json());

// ---------- Photo uploads (attendance selfies, site photos) ----------
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `photo-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

// Serve uploaded photos publicly so the admin app can display them
app.use('/uploads', express.static(uploadsDir));

app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    logError('POST /api/upload', new Error('No image file received'));
    res.status(400).json({ success: false, error: 'No image file received.' });
    return;
  }
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}` });
});

// Attach all endpoints prefixed with /api
app.use('/api', apiRoutes);

// The tables the app expects (from database/schema.sql + auto-migrations)
const EXPECTED_TABLES = [
  'users', 'sites', 'workers', 'attendance', 'ledger', 'leads',
  'site_allocations', 'supervisor_attendance',
  'site_photos', 'driver_records', 'account_transactions',
];

// Deployment status page: backend health, DB connection, imported tables, error logs
app.get('/', async (req, res) => {
  let dbConnected = false;
  let dbError = '';
  let tables: string[] = [];

  try {
    const result = await db.query(
      'SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY TABLE_NAME'
    );
    tables = (result.rows || []).map((r: any) => r.name || r.NAME);
    dbConnected = true;
  } catch (error: any) {
    dbError = error?.message || String(error);
  }

  const missingTables = EXPECTED_TABLES.filter((t) => !tables.includes(t));
  const errorLogs = getErrorLogs();
  const uptimeMin = Math.floor(process.uptime() / 60);

  const badge = (ok: boolean, okText: string, failText: string) =>
    `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-weight:bold;font-size:13px;
      background:${ok ? '#DCFCE7' : '#FEE2E2'};color:${ok ? '#15803D' : '#B91C1C'};">${ok ? '✅ ' + okText : '❌ ' + failText}</span>`;

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ayyanar Backend Status</title>
        <style>
          body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#F1F5F9; color:#0F172A; margin:0; padding:24px; }
          .wrap { max-width: 820px; margin: 0 auto; }
          h1 { color:#E21A12; font-size:22px; margin: 0 0 4px; }
          .sub { color:#64748B; font-size:13px; margin-bottom:20px; }
          .card { background:#FFF; border:1px solid #E2E8F0; border-radius:12px; padding:18px; margin-bottom:14px; }
          .card h2 { font-size:14px; text-transform:uppercase; color:#64748B; margin:0 0 10px; letter-spacing:.4px; }
          .big { font-size:16px; font-weight:bold; margin-top:8px; }
          .grid { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
          .table-chip { background:#F1F5F9; border:1px solid #E2E8F0; border-radius:8px; padding:6px 12px; font-size:12.5px; font-weight:600; }
          .missing { background:#FEE2E2; border-color:#FCA5A5; color:#B91C1C; }
          .log { background:#0F172A; color:#F8FAFC; border-radius:8px; padding:12px 14px; font-family:Menlo,Consolas,monospace; font-size:12px; line-height:1.7; overflow-x:auto; }
          .log .t { color:#94A3B8; }
          .log .c { color:#FCA5A5; font-weight:bold; }
          .ok-line { color:#15803D; font-weight:bold; }
          .meta { color:#64748B; font-size:12.5px; margin-top:6px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Ayyanar Construction — Backend</h1>
          <div class="sub">apkayyanar.nexoraapp.in &bull; checked at ${new Date().toLocaleString('en-IN')}</div>

          <div class="card">
            <h2>Backend Server</h2>
            ${badge(true, 'Backend deployed successfully', '')}
            <div class="meta">Running on port ${PORT} &bull; Node ${process.version} &bull; started ${startedAt.toLocaleString('en-IN')} &bull; uptime ${uptimeMin} min</div>
          </div>

          <div class="card">
            <h2>Database</h2>
            ${badge(dbConnected, 'Database connected successfully', 'Database connection FAILED')}
            ${dbConnected
              ? `<div class="big">${tables.length} tables imported</div>
                 <div class="meta">Expected ${EXPECTED_TABLES.length} app tables — ${missingTables.length === 0
                   ? '<span class="ok-line">all present ✔</span>'
                   : `missing: <b>${missingTables.join(', ')}</b> (import database/schema.sql via phpMyAdmin)`}</div>
                 <div class="grid">${tables.map((t) => `<span class="table-chip${EXPECTED_TABLES.includes(t) ? '' : ''}">${t}</span>`).join('')}</div>`
              : `<div class="log" style="margin-top:10px;"><span class="c">${dbError}</span></div>
                 <div class="meta">Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME environment variables in hPanel.</div>`}
          </div>

          <div class="card">
            <h2>Error Logs (last ${errorLogs.length})</h2>
            ${errorLogs.length === 0
              ? '<div class="ok-line">No errors logged since the server started. ✔</div>'
              : `<div class="log">${errorLogs
                  .slice(0, 20)
                  .map((e) => `<div><span class="t">[${new Date(e.time).toLocaleString('en-IN')}]</span> <span class="c">${e.context}</span><br/>&nbsp;&nbsp;${e.message}</div>`)
                  .join('')}</div>`}
          </div>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, async () => {
  console.log(`=========================================`);
  console.log(`🚀 BACKEND SERVER ACTIVE on port ${PORT}`);
  console.log(`📡 Linked cleanly to your MySQL Database`);
  console.log(`=========================================`);

  // Run Database Schema migrations
  await initDb();
});
