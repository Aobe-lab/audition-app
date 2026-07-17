import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      account_name TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bands (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
      rank INTEGER NOT NULL,
      comment TEXT,
      submission_group TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS judge_presence (
      session_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      last_seen TIMESTAMP DEFAULT NOW(),
      submitted BOOLEAN DEFAULT FALSE
    )
  `);
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS admin_id INTEGER DEFAULT 1`);
  await pool.query(`ALTER TABLE votes ADD COLUMN IF NOT EXISTS comment TEXT`);
  await pool.query(`ALTER TABLE bands ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`);
  console.log('DB initialized');
}

const resultsCache = new Map<string, { data: any; timestamp: number }>();
const detailedVotesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 3000;

function invalidateCache(eventId: string) {
  resultsCache.delete(eventId);
  detailedVotesCache.delete(eventId);
}

async function startServer() {
  await initDb();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100kb' }));

  const authenticateAdmin = async (req: any, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
      if (user?.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
      const result = await pool.query('SELECT id FROM admins WHERE id = $1', [Number(user.id)]);
      if (!result.rows[0]) return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  const authenticateJudge = async (req: any, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
      if (user?.role !== 'judge' && user?.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
      const adminId = user.role === 'admin' ? user.id : user.adminId;
      const result = await pool.query('SELECT id FROM admins WHERE id = $1', [Number(adminId)]);
      if (!result.rows[0]) return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  // ---- 認証 ----
  app.post('/api/auth/admin/register', async (req, res) => {
    const { accountName, password, inviteCode } = req.body;
    if (!accountName || !password) {
      return res.status(400).json({ success: false, message: 'アカウント名とパスワードを入力してください' });
    }
    const requiredCode = process.env.INVITE_CODE;
    if (!requiredCode) {
      return res.status(403).json({ success: false, message: 'サーバーに招待コードが設定されていません。管理者に連絡してください。' });
    }
    if (!inviteCode || inviteCode.trim() !== requiredCode) {
      return res.status(403).json({ success: false, message: '招待コードが正しくありません' });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO admins (account_name, password) VALUES ($1, $2) RETURNING id',
        [accountName, hashedPassword]
      );
      const id = result.rows[0].id;
      const token = jwt.sign({ id, accountName, role: 'admin' }, JWT_SECRET, { expiresIn: '262800h' });
      res.json({ success: true, token });
    } catch (e: any) {
      if (e.code === '23505') {
        res.status(400).json({ success: false, message: 'このアカウント名は既に使用されています' });
      } else {
        res.status(500).json({ success: false, message: '登録エラー' });
      }
    }
  });

  app.post('/api/auth/admin/login', async (req, res) => {
    const { accountName, password } = req.body;
    if (!accountName || !password) {
      return res.status(400).json({ success: false, message: 'アカウント名とパスワードを入力してください' });
    }
    try {
      const result = await pool.query('SELECT * FROM admins WHERE account_name = $1', [accountName]);
      const admin = result.rows[0];
      if (admin && await bcrypt.compare(password, admin.password)) {
        const token = jwt.sign({ id: admin.id, accountName: admin.account_name, role: 'admin' }, JWT_SECRET, { expiresIn: '262800h' });
        res.json({ success: true, token });
      } else {
        res.status(401).json({ success: false, message: 'アカウント名またはパスワードが間違っています' });
      }
    } catch {
      res.status(500).json({ success: false, message: 'サーバーエラー' });
    }
  });

  app.post('/api/auth/judge/qr-token', authenticateAdmin, (req: any, res) => {
    const token = jwt.sign(
      { adminId: req.user.id, adminName: req.user.accountName, role: 'judge_entry' },
      JWT_SECRET,
      { expiresIn: '262800h' }
    );
    res.json({ token });
  });

  app.post('/api/auth/judge/enter', async (req, res) => {
    const { entryToken } = req.body;
    if (!entryToken) return res.status(400).json({ success: false, message: 'トークンがありません' });
    try {
      const decoded = jwt.verify(entryToken, JWT_SECRET) as any;
      if (decoded.role !== 'judge_entry') {
        return res.status(401).json({ success: false, message: '無効なトークンです' });
      }
      const result = await pool.query('SELECT id FROM admins WHERE id = $1', [Number(decoded.adminId)]);
      if (!result.rows[0]) return res.status(401).json({ success: false, message: '管理者が見つかりません' });
      const token = jwt.sign({ adminId: result.rows[0].id, role: 'judge' }, JWT_SECRET, { expiresIn: '72h' });
      res.json({ success: true, token });
    } catch {
      res.status(401).json({ success: false, message: 'QRコードが無効または期限切れです' });
    }
  });

  app.post('/api/auth/judge/login', async (req, res) => {
    const { accountName } = req.body;
    if (!accountName) return res.status(400).json({ success: false, message: 'アカウント名を入力してください' });
    try {
      const result = await pool.query('SELECT * FROM admins WHERE account_name = $1', [accountName.trim()]);
      const admin = result.rows[0];
      if (admin) {
        const token = jwt.sign({ adminId: admin.id, accountName: admin.account_name, role: 'judge' }, JWT_SECRET, { expiresIn: '72h' });
        res.json({ success: true, token });
      } else {
        res.status(401).json({ success: false, message: '対象の管理者アカウントが見つかりません' });
      }
    } catch {
      res.status(500).json({ success: false, message: 'サーバーエラー' });
    }
  });

  app.get('/api/auth/admin/me', authenticateAdmin, async (req: any, res) => {
    try {
      const result = await pool.query('SELECT account_name FROM admins WHERE id = $1', [Number(req.user.id)]);
      const admin = result.rows[0];
      if (admin) {
        res.json({ accountName: admin.account_name });
      } else {
        res.status(404).json({ error: 'Admin not found' });
      }
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  // ---- イベント ----
  app.get('/api/events', authenticateJudge, async (req: any, res) => {
    try {
      const adminId = req.user.role === 'admin' ? req.user.id : req.user.adminId;
      const result = req.user.role === 'judge'
        ? await pool.query("SELECT * FROM events WHERE admin_id = $1 AND status = 'open' ORDER BY created_at DESC", [adminId])
        : await pool.query("SELECT * FROM events WHERE admin_id = $1 ORDER BY created_at DESC", [adminId]);
      res.json(result.rows);
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  app.post('/api/events', authenticateAdmin, async (req: any, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'イベント名を入力してください' });
    try {
      const id = crypto.randomUUID();
      await pool.query(
        'INSERT INTO events (id, name, status, admin_id) VALUES ($1, $2, $3, $4)',
        [id, name.trim().slice(0, 100), 'open', req.user.id]
      );
      res.json({ id, name, status: 'open' });
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  app.get('/api/events/:id', authenticateJudge, async (req: any, res) => {
    try {
      const adminId = req.user.role === 'admin' ? req.user.id : req.user.adminId;
      const eventResult = await pool.query('SELECT * FROM events WHERE id = $1 AND admin_id = $2', [req.params.id, adminId]);
      if (!eventResult.rows[0]) return res.status(404).json({ error: 'Event not found' });
      const bandsResult = await pool.query('SELECT * FROM bands WHERE event_id = $1 ORDER BY sort_order ASC, name ASC', [req.params.id]);
      res.json({ ...eventResult.rows[0], bands: bandsResult.rows });
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  app.put('/api/events/:id/status', authenticateAdmin, async (req: any, res) => {
    try {
      await pool.query('UPDATE events SET status = $1 WHERE id = $2 AND admin_id = $3', [req.body.status, req.params.id, req.user.id]);
      invalidateCache(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  app.get('/api/events/:id/band/:bandId/comments', authenticateAdmin, async (req, res) => {
    try {
      const bandResult = await pool.query('SELECT name FROM bands WHERE id = $1', [req.params.bandId]);
      if (!bandResult.rows[0]) return res.status(404).json({ error: 'Band not found' });
      const commentsResult = await pool.query(
        `SELECT comment FROM votes WHERE event_id = $1 AND band_id = $2 AND comment IS NOT NULL AND comment <> ''`,
        [req.params.id, req.params.bandId]
      );
      res.json({ bandName: bandResult.rows[0].name, comments: commentsResult.rows.map((c: any) => c.comment) });
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  app.delete('/api/events/:id', authenticateAdmin, async (req: any, res) => {
    try {
      await pool.query('DELETE FROM events WHERE id = $1 AND admin_id = $2', [req.params.id, req.user.id]);
      invalidateCache(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  // ---- バンド ----
  app.post('/api/events/:id/bands', authenticateAdmin, async (req: any, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'バンド名を入力してください' });
    try {
      const eventResult = await pool.query('SELECT id FROM events WHERE id = $1 AND admin_id = $2', [req.params.id, req.user.id]);
      if (!eventResult.rows[0]) return res.status(404).json({ error: 'Event not found' });
      const bandId = crypto.randomUUID();
      const countResult = await pool.query('SELECT COUNT(*) as cnt FROM bands WHERE event_id = $1', [req.params.id]);
      const sortOrder = parseInt(countResult.rows[0].cnt);
      await pool.query('INSERT INTO bands (id, event_id, name, sort_order) VALUES ($1, $2, $3, $4)', [bandId, req.params.id, name.trim().slice(0, 50), sortOrder]);
      invalidateCache(req.params.id);
      res.json({ id: bandId, event_id: req.params.id, name });
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  app.put('/api/events/:id/bands/reorder', authenticateAdmin, async (req: any, res) => {
    const { bandIds } = req.body;
    if (!Array.isArray(bandIds)) return res.status(400).json({ error: '不正なリクエストです' });
    try {
      const eventResult = await pool.query('SELECT id FROM events WHERE id = $1 AND admin_id = $2', [req.params.id, req.user.id]);
      if (!eventResult.rows[0]) return res.status(404).json({ error: 'Event not found' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (let i = 0; i < bandIds.length; i++) {
          await client.query('UPDATE bands SET sort_order = $1 WHERE id = $2 AND event_id = $3', [i, bandIds[i], req.params.id]);
        }
        await client.query('COMMIT');
        invalidateCache(req.params.id);
        res.json({ success: true });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  app.delete('/api/bands/:id', authenticateAdmin, async (req: any, res) => {
    try {
      const bandResult = await pool.query(
        'SELECT b.id, b.event_id FROM bands b JOIN events e ON b.event_id = e.id WHERE b.id = $1 AND e.admin_id = $2',
        [req.params.id, req.user.id]
      );
      if (!bandResult.rows[0]) return res.status(404).json({ error: 'Band not found' });
      await pool.query('DELETE FROM bands WHERE id = $1', [req.params.id]);
      invalidateCache(bandResult.rows[0].event_id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  // ---- 投票 ----
  app.post('/api/events/:id/vote', authenticateJudge, async (req: any, res) => {
    const { votes } = req.body;
    if (!votes || !Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ error: '投票データがありません' });
    }
    try {
      const eventResult = await pool.query('SELECT status FROM events WHERE id = $1', [req.params.id]);
      const event = eventResult.rows[0];
      if (!event) return res.status(404).json({ error: 'イベントが見つかりません' });
      if (event.status !== 'open') return res.status(403).json({ error: 'このイベントの投票受付は終了しています' });

      const submission_group = crypto.randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const vote of votes as any[]) {
          await client.query(
            'INSERT INTO votes (event_id, band_id, rank, comment, submission_group) VALUES ($1, $2, $3, $4, $5)',
            [req.params.id, vote.band_id, vote.rank, vote.comment || '', submission_group]
          );
        }
        await client.query('COMMIT');
        invalidateCache(req.params.id);
        res.json({ success: true });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      console.error('Vote insert error:', e);
      res.status(500).json({ error: '投票の保存に失敗しました。もう一度お試しください。' });
    }
  });

  // ---- 参加者プレゼンス ----
  app.post('/api/events/:id/presence', authenticateJudge, async (req: any, res) => {
    const { sessionId, submitted } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionIdが必要です' });
    try {
      await pool.query(`
        INSERT INTO judge_presence (session_id, event_id, last_seen, submitted)
        VALUES ($1, $2, NOW(), $3)
        ON CONFLICT (session_id) DO UPDATE SET last_seen = NOW(), submitted = EXCLUDED.submitted
      `, [sessionId, req.params.id, submitted || false]);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  app.get('/api/events/:id/presence', authenticateAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE submitted = true)::int AS submitted,
          COUNT(*) FILTER (WHERE submitted = false AND last_seen > NOW() - INTERVAL '2 minutes')::int AS in_progress,
          (COUNT(*) FILTER (WHERE submitted = true) + COUNT(*) FILTER (WHERE submitted = false AND last_seen > NOW() - INTERVAL '2 minutes'))::int AS total
        FROM judge_presence
        WHERE event_id = $1
      `, [req.params.id]);
      res.json(result.rows[0]);
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  // ---- 集計結果 ----
  app.get('/api/events/:id/results', authenticateAdmin, async (req, res) => {
    const eventId = req.params.id;
    const now = Date.now();
    const cached = resultsCache.get(eventId);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) return res.json(cached.data);

    try {
      const bandsResult = await pool.query('SELECT id, name FROM bands WHERE event_id = $1 ORDER BY sort_order ASC, name ASC', [eventId]);
      const bands = bandsResult.rows as any[];
      const votesResult = await pool.query('SELECT band_id, rank, comment FROM votes WHERE event_id = $1', [eventId]);
      const votes = votesResult.rows as any[];
      const numBands = bands.length;

      const results = bands.map(band => {
        const bandVotes = votes.filter(v => v.band_id === band.id);
        let total_score = 0;
        const rank_counts: Record<number, number> = {};
        const comments: string[] = [];
        for (let i = 1; i <= numBands; i++) { rank_counts[i] = 0; }
        bandVotes.forEach(v => {
          total_score += (numBands - v.rank + 1);
          rank_counts[v.rank] = (rank_counts[v.rank] || 0) + 1;
          if (v.comment) comments.push(v.comment);
        });
        return { band_id: band.id, band_name: band.name, total_score, rank_counts, num_bands: numBands, comments };
      });

      results.sort((a, b) => b.total_score - a.total_score);

      let currentRank = 1;
      let previousScore: number | null = null;
      let skip = 0;
      const rankedResults = results.map((r: any) => {
        if (r.total_score === 0) return { ...r, rank: '-' };
        if (previousScore !== null && r.total_score === previousScore) {
          skip++;
        } else {
          currentRank += skip;
          skip = 1;
          previousScore = r.total_score;
        }
        return { ...r, rank: currentRank };
      });

      resultsCache.set(eventId, { data: rankedResults, timestamp: now });
      res.json(rankedResults);
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  // ---- 詳細投票一覧 ----
  app.get('/api/events/:id/detailed-votes', authenticateAdmin, async (req, res) => {
    const eventId = req.params.id;
    const now = Date.now();
    const cached = detailedVotesCache.get(eventId);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) return res.json(cached.data);

    try {
      const votesResult = await pool.query(`
        SELECT v.submission_group, b.name as band_name, v.rank, v.comment
        FROM votes v
        JOIN bands b ON v.band_id = b.id
        WHERE v.event_id = $1
        ORDER BY v.submission_group, v.rank ASC
      `, [eventId]);
      const votes = votesResult.rows as any[];

      const grouped: Record<string, any> = {};
      let counter = 1;
      for (const v of votes) {
        if (!grouped[v.submission_group]) {
          grouped[v.submission_group] = { label: '審査員 ' + counter, votes: [] };
          counter++;
        }
        grouped[v.submission_group].votes.push({ band_name: v.band_name, rank: v.rank, comment: v.comment });
      }

      const data = Object.values(grouped);
      detailedVotesCache.set(eventId, { data, timestamp: now });
      res.json(data);
    } catch {
      res.status(500).json({ error: 'サーバーエラー' });
    }
  });

  // ---- Vite / 静的ファイル ----
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on http://localhost:' + PORT);
  });
}

startServer();
