import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

const DB_PATH = process.env.DB_PATH || 'audition.db';
const db = new Database(DB_PATH);

// WALモード: 読み込みと書き込みを並行処理できる
db.pragma('journal_mode = WAL');
// 書き込みが重なったとき最大10秒待つ
db.pragma('busy_timeout = 10000');
// 外部キー制約を有効化
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bands (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    band_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    comment TEXT,
    submission_group TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE
  );
`);

// マイグレーション
try {
  const eventsInfo = db.prepare("PRAGMA table_info(events)").all() as any[];
  if (!eventsInfo.some((col: any) => col.name === 'admin_id')) {
    db.exec("ALTER TABLE events ADD COLUMN admin_id INTEGER DEFAULT 1;");
  }
  const votesInfo = db.prepare("PRAGMA table_info(votes)").all() as any[];
  if (!votesInfo.some((col: any) => col.name === 'comment')) {
    db.exec("ALTER TABLE votes ADD COLUMN comment TEXT;");
  }

  // 既存の平文パスワードをbcryptにマイグレーション
  const admins = db.prepare('SELECT id, password FROM admins').all() as any[];
  for (const admin of admins) {
    if (!admin.password.startsWith('$2')) {
      const hashed = bcrypt.hashSync(admin.password, 10);
      db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashed, admin.id);
      console.log('パスワードをハッシュ化しました (admin id: ' + admin.id + ')');
    }
  }
} catch (e) {
  console.error("Migration error:", e);
}

// ============================================================
// 結果キャッシュ（30〜100人同時アクセス対策の核心）
//
// 「5秒ごとに全員が結果を取りに来る」問題を解決する仕組み。
// 最初の1人がDBに問い合わせたら、その結果を3秒間メモリに保持。
// 3秒以内に来た2〜100人目はDBに触れず、メモリから即答する。
// これでDBへの問い合わせ回数が最大1/100に激減する。
// ============================================================
const resultsCache = new Map<string, { data: any; timestamp: number }>();
const detailedVotesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 3000; // 3秒キャッシュ

// 投票が来たらそのイベントのキャッシュを破棄（新しい結果を反映させる）
function invalidateCache(eventId: string) {
  resultsCache.delete(eventId);
  detailedVotesCache.delete(eventId);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // リクエストサイズ制限（異常に大きいデータでサーバーが落ちないように）
  app.use(express.json({ limit: '100kb' }));

  // ---- JWT認証ミドルウェア ----
  const decodeToken = (req: any, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
      } catch (e) {}
    }
    res.status(401).json({ error: 'Unauthorized' });
  };

  const authenticateAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
    decodeToken(req, res, () => {
      if (req.user?.role === 'admin') {
        const admin = db.prepare('SELECT id FROM admins WHERE id = ?').get(Number(req.user.id));
        if (admin) return next();
      }
      res.status(401).json({ error: 'Unauthorized' });
    });
  };

  const authenticateJudge = (req: any, res: express.Response, next: express.NextFunction) => {
    decodeToken(req, res, () => {
      if (req.user?.role === 'judge' || req.user?.role === 'admin') {
        const adminId = req.user.role === 'admin' ? req.user.id : req.user.adminId;
        const admin = db.prepare('SELECT id FROM admins WHERE id = ?').get(Number(adminId));
        if (admin) return next();
      }
      res.status(401).json({ error: 'Unauthorized' });
    });
  };

  // ---- 認証 ----
  app.post('/api/auth/admin/register', (req, res) => {
    const { accountName, password, inviteCode } = req.body;
    if (!accountName || !password) {
      return res.status(400).json({ success: false, message: 'アカウント名とパスワードを入力してください' });
    }

    // 招待コード検証
    // INVITE_CODEが設定されていない場合は登録を拒否（未設定のまま公開しない）
    const requiredCode = process.env.INVITE_CODE;
    if (!requiredCode) {
      return res.status(403).json({ success: false, message: 'サーバーに招待コードが設定されていません。管理者に連絡してください。' });
    }
    if (!inviteCode || inviteCode.trim() !== requiredCode) {
      return res.status(403).json({ success: false, message: '招待コードが正しくありません' });
    }

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const info = db.prepare('INSERT INTO admins (account_name, password) VALUES (?, ?)').run(accountName, hashedPassword);
      const id = typeof info.lastInsertRowid === 'bigint' ? Number(info.lastInsertRowid) : info.lastInsertRowid;
      const token = jwt.sign({ id, accountName, role: 'admin' }, JWT_SECRET, { expiresIn: '262800h' });
      res.json({ success: true, token });
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ success: false, message: 'このアカウント名は既に使用されています' });
      } else {
        res.status(500).json({ success: false, message: '登録エラー' });
      }
    }
  });

  app.post('/api/auth/admin/login', (req, res) => {
    const { accountName, password } = req.body;
    if (!accountName || !password) {
      return res.status(400).json({ success: false, message: 'アカウント名とパスワードを入力してください' });
    }
    const admin = db.prepare('SELECT * FROM admins WHERE account_name = ?').get(accountName) as any;
    if (admin && bcrypt.compareSync(password, admin.password)) {
      // 管理者トークンは事実上永続（30年）。ブラウザに保存すれば再ログイン不要
      const token = jwt.sign({ id: admin.id, accountName: admin.account_name, role: 'admin' }, JWT_SECRET, { expiresIn: '262800h' });
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, message: 'アカウント名またはパスワードが間違っています' });
    }
  });

  // QRコードに埋め込む審査員入場トークンを発行する
  // このトークンにはadminIdが含まれ、そのadminのイベントのみ閲覧できる
  app.post('/api/auth/judge/qr-token', authenticateAdmin, (req: any, res) => {
    const token = jwt.sign(
      { adminId: req.user.id, adminName: req.user.accountName, role: 'judge_entry' },
      JWT_SECRET,
      { expiresIn: '262800h' } // 事実上永続
    );
    res.json({ token });
  });

  // QRを読んだ審査員が即入場（名前入力なし・完全匿名）
  app.post('/api/auth/judge/enter', (req, res) => {
    const { entryToken } = req.body;
    if (!entryToken) {
      return res.status(400).json({ success: false, message: 'トークンがありません' });
    }
    try {
      const decoded = jwt.verify(entryToken, JWT_SECRET) as any;
      if (decoded.role !== 'judge_entry') {
        return res.status(401).json({ success: false, message: '無効なトークンです' });
      }
      const admin = db.prepare('SELECT id FROM admins WHERE id = ?').get(Number(decoded.adminId)) as any;
      if (!admin) {
        return res.status(401).json({ success: false, message: '管理者が見つかりません' });
      }
      // 完全匿名: 名前なしでjudgeトークン発行
      const token = jwt.sign(
        { adminId: admin.id, role: 'judge' },
        JWT_SECRET,
        { expiresIn: '72h' }
      );
      res.json({ success: true, token });
    } catch (e) {
      res.status(401).json({ success: false, message: 'QRコードが無効または期限切れです' });
    }
  });

  // 後方互換: 旧judge loginも残す
  app.post('/api/auth/judge/login', (req, res) => {
    const { accountName } = req.body;
    if (!accountName) {
      return res.status(400).json({ success: false, message: 'アカウント名を入力してください' });
    }
    const admin = db.prepare('SELECT * FROM admins WHERE account_name = ?').get(accountName.trim()) as any;
    if (admin) {
      const token = jwt.sign({ adminId: admin.id, accountName: admin.account_name, role: 'judge' }, JWT_SECRET, { expiresIn: '72h' });
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, message: '対象の管理者アカウントが見つかりません' });
    }
  });

  app.get('/api/auth/admin/me', authenticateAdmin, (req: any, res) => {
    const admin = db.prepare('SELECT account_name FROM admins WHERE id = ?').get(Number(req.user.id)) as any;
    if (admin) {
      res.json({ accountName: admin.account_name });
    } else {
      res.status(404).json({ error: 'Admin not found' });
    }
  });

  // ---- イベント ----
  app.get('/api/events', authenticateJudge, (req: any, res) => {
    const adminId = req.user.role === 'admin' ? req.user.id : req.user.adminId;
    const events = req.user.role === 'judge'
      ? db.prepare("SELECT * FROM events WHERE admin_id = ? AND status = 'open' ORDER BY created_at DESC").all(adminId)
      : db.prepare("SELECT * FROM events WHERE admin_id = ? ORDER BY created_at DESC").all(adminId);
    res.json(events);
  });

  app.post('/api/events', authenticateAdmin, (req: any, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'イベント名を入力してください' });
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO events (id, name, status, admin_id) VALUES (?, ?, ?, ?)').run(id, name.trim().slice(0, 100), 'open', req.user.id);
    res.json({ id, name, status: 'open' });
  });

  app.get('/api/events/:id', authenticateJudge, (req: any, res) => {
    const adminId = req.user.role === 'admin' ? req.user.id : req.user.adminId;
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND admin_id = ?').get(req.params.id, adminId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const bands = db.prepare('SELECT * FROM bands WHERE event_id = ?').all(req.params.id);
    res.json({ ...event, bands });
  });

  app.put('/api/events/:id/status', authenticateAdmin, (req: any, res) => {
    db.prepare('UPDATE events SET status = ? WHERE id = ? AND admin_id = ?').run(req.body.status, req.params.id, req.user.id);
    // ステータスが変わったらキャッシュも破棄
    invalidateCache(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/events/:id/band/:bandId/comments', authenticateAdmin, (req, res) => {
    const band = db.prepare('SELECT name FROM bands WHERE id = ?').get(req.params.bandId) as any;
    if (!band) return res.status(404).json({ error: 'Band not found' });
    const comments = db.prepare(`SELECT comment FROM votes WHERE event_id = ? AND band_id = ? AND comment != ''`).all(req.params.id, req.params.bandId);
    res.json({ bandName: band.name, comments: comments.map((c: any) => c.comment) });
  });

  app.delete('/api/events/:id', authenticateAdmin, (req: any, res) => {
    db.prepare('DELETE FROM events WHERE id = ? AND admin_id = ?').run(req.params.id, req.user.id);
    invalidateCache(req.params.id);
    res.json({ success: true });
  });

  // ---- バンド ----
  app.post('/api/events/:id/bands', authenticateAdmin, (req: any, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'バンド名を入力してください' });
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND admin_id = ?').get(req.params.id, req.user.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const bandId = crypto.randomUUID();
    db.prepare('INSERT INTO bands (id, event_id, name) VALUES (?, ?, ?)').run(bandId, req.params.id, name.trim().slice(0, 50));
    invalidateCache(req.params.id);
    res.json({ id: bandId, event_id: req.params.id, name });
  });

  app.delete('/api/bands/:id', authenticateAdmin, (req: any, res) => {
    const band = db.prepare('SELECT b.id, b.event_id FROM bands b JOIN events e ON b.event_id = e.id WHERE b.id = ? AND e.admin_id = ?').get(req.params.id, req.user.id) as any;
    if (!band) return res.status(404).json({ error: 'Band not found' });
    db.prepare('DELETE FROM bands WHERE id = ?').run(req.params.id);
    invalidateCache(band.event_id);
    res.json({ success: true });
  });

  // ---- 投票 ----
  app.post('/api/events/:id/vote', authenticateJudge, (req: any, res) => {
    const { votes } = req.body;

    if (!votes || !Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ error: '投票データがありません' });
    }

    const event = db.prepare('SELECT status FROM events WHERE id = ?').get(req.params.id) as any;
    if (!event) return res.status(404).json({ error: 'イベントが見つかりません' });
    if (event.status !== 'open') {
      return res.status(403).json({ error: 'このイベントの投票受付は終了しています' });
    }

    // 完全匿名: 名前を一切記録しない
    const submission_group = crypto.randomUUID();
    const insert = db.prepare('INSERT INTO votes (event_id, band_id, rank, comment, submission_group) VALUES (?, ?, ?, ?, ?)');

    const transaction = db.transaction((votes: any[]) => {
      for (const vote of votes) {
        insert.run(req.params.id, vote.band_id, vote.rank, vote.comment || '', submission_group);
      }
    });

    try {
      transaction(votes);
      // 投票が来たらキャッシュを破棄（次の取得で最新を返す）
      invalidateCache(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Vote insert error:', e);
      res.status(500).json({ error: '投票の保存に失敗しました。もう一度お試しください。' });
    }
  });

  // ---- 集計結果（キャッシュあり）----
  app.get('/api/events/:id/results', authenticateAdmin, (req, res) => {
    const eventId = req.params.id;
    const now = Date.now();

    // キャッシュが3秒以内なら即返す（DBに触らない）
    const cached = resultsCache.get(eventId);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const bands = db.prepare('SELECT id, name FROM bands WHERE event_id = ?').all(eventId) as any[];
    const votes = db.prepare('SELECT band_id, rank, comment FROM votes WHERE event_id = ?').all(eventId) as any[];
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

    // キャッシュに保存
    resultsCache.set(eventId, { data: rankedResults, timestamp: now });
    res.json(rankedResults);
  });

  // ---- 詳細投票一覧（キャッシュあり・完全匿名）----
  app.get('/api/events/:id/detailed-votes', authenticateAdmin, (req, res) => {
    const eventId = req.params.id;
    const now = Date.now();

    const cached = detailedVotesCache.get(eventId);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const votes = db.prepare(`
      SELECT v.submission_group, b.name as band_name, v.rank, v.comment
      FROM votes v
      JOIN bands b ON v.band_id = b.id
      WHERE v.event_id = ?
      ORDER BY v.submission_group, v.rank ASC
    `).all(eventId) as any[];

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
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on http://localhost:' + PORT);
  });
}

startServer();
