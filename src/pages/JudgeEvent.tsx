import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Send, Music, Speaker, Mic2, RotateCcw } from 'lucide-react';
import { safeStorage } from '../utils/storage';

export function JudgeEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [bands, setBands] = useState<any[]>([]);
  const [rankings, setRankings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [restored, setRestored] = useState(false);
  const draftKey = `draft_${id}`;
  const isFirstRender = useRef(true);

  const getToken = () =>
    safeStorage.getItem('judgeToken') || safeStorage.getItem('adminToken') || '';

  useEffect(() => {
    // 投票済みチェック
    if (safeStorage.getItem(`submitted_${id}`)) {
      setSubmitted(true);
      setLoading(false);
      return;
    }
    // 下書き復元
    try {
      const saved = safeStorage.getItem(draftKey);
      if (saved) {
        const { rankings: r, comments: c } = JSON.parse(saved);
        if (r && Object.keys(r).length > 0) {
          setRankings(r);
          setComments(c || {});
          setRestored(true);
          setTimeout(() => setRestored(false), 4000);
        }
      }
    } catch (_) {}
    // イベント取得
    fetchEventData();
  }, [id]);

  // 入力変化時に自動保存
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (submitted) return;
    try {
      safeStorage.setItem(draftKey, JSON.stringify({ rankings, comments }));
    } catch (_) {}
  }, [rankings, comments]);

  const fetchEventData = async () => {
    try {
      const res = await fetch(`/api/events/${id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status !== 'open') {
          setLoading(false);
          navigate('/judge');
          return;
        }
        setEvent(data);
        setBands(data.bands || []);
      } else {
        if (res.status === 401 || res.status === 403) {
          safeStorage.removeItem('judgeToken');
          navigate('/login');
        } else {
          navigate('/judge');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRankChange = (bandId: string, rank: number) => {
    setRankings(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === rank) delete next[k]; });
      next[bandId] = rank;
      return next;
    });
    setError('');
  };

  const handleCommentChange = (bandId: string, comment: string) => {
    setComments(prev => ({ ...prev, [bandId]: comment }));
  };

  const handleReset = () => {
    if (!confirm('入力内容をすべてリセットしますか？')) return;
    setRankings({});
    setComments({});
    try { safeStorage.removeItem(draftKey); } catch (_) {}
  };

  const handleSubmit = async () => {
    if (bands.length === 0) { setError('バンドが登録されていません'); return; }
    if (Object.keys(rankings).length !== bands.length) { setError('すべてのバンドに順位をつけてください'); return; }
    if (sending) return;
    setSending(true);
    setError('');
    const votes = Object.entries(rankings).map(([bandId, rank]) => ({
      band_id: bandId, rank: Number(rank), comment: comments[bandId] || ''
    }));
    try {
      const res = await fetch(`/api/events/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ votes }),
      });
      if (res.status === 403) { setError('このイベントの投票受付は終了しています'); setSending(false); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `エラー(${res.status})`); }
      try { safeStorage.removeItem(draftKey); } catch (_) {}
      safeStorage.setItem(`submitted_${id}`, 'true');
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'ネットワークエラーが発生しました。再度送信ボタンを押してください。');
      setSending(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-400 animate-pulse">読み込み中...</p>
    </div>
  );

  if (!event) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
      <p className="text-zinc-400">イベントを読み込めませんでした</p>
      <button onClick={() => navigate('/judge')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500">
        ダッシュボードに戻る
      </button>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] -translate-y-1/2 mix-blend-screen" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[100px] translate-y-1/2 mix-blend-screen" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 max-w-md w-full bg-zinc-900/80 p-8 rounded-3xl shadow-2xl border border-zinc-800 backdrop-blur-xl text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">投票完了</h2>
        <p className="text-zinc-400 mb-8">ご協力ありがとうございました。<br/>結果は管理者が集計します。</p>
        <button onClick={() => navigate('/judge')}
          className="w-full py-4 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all">
          ダッシュボードに戻る
        </button>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 pb-28 text-zinc-100 relative overflow-hidden">
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -translate-y-1/2 mix-blend-screen pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[120px] translate-y-1/2 mix-blend-screen pointer-events-none" />
      <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 6, repeat: Infinity }}
        className="fixed top-1/4 left-[5%] text-zinc-800/30 hidden lg:block pointer-events-none">
        <Music className="w-32 h-32" />
      </motion.div>
      <motion.div animate={{ y: [0, 15, 0] }} transition={{ duration: 7, repeat: Infinity, delay: 1 }}
        className="fixed bottom-1/4 right-[5%] text-zinc-800/30 hidden lg:block pointer-events-none">
        <Speaker className="w-40 h-40" />
      </motion.div>

      <AnimatePresence>
        {restored && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-800/90 border border-emerald-500/50 text-emerald-200 px-5 py-3 rounded-xl text-sm font-bold shadow-xl backdrop-blur-md flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />前回の入力を復元しました
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-zinc-900/80 border-b border-zinc-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/judge')} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-zinc-100 truncate max-w-[200px] sm:max-w-md">{event.name}</h1>
          </div>
          <button onClick={handleReset} className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />リセット
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-indigo-900/30 border border-indigo-500/30 text-indigo-200 p-4 rounded-xl text-sm flex gap-3 items-start">
          <div>
            <p className="font-bold mb-1 text-indigo-300">審査方法</p>
            <p>各バンドに講評を記入し、1位から{bands.length}位まで順位をつけてください。</p>
            <p className="mt-1 text-indigo-300/70 text-xs">※ 入力内容は自動保存されます。画面を閉じても続きから再開できます。</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm font-bold text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {bands.map((band) => (
            <motion.div key={band.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`bg-zinc-900/60 p-5 rounded-2xl shadow-lg border backdrop-blur-md transition-all ${rankings[band.id] ? 'border-indigo-500/50' : 'border-zinc-800'}`}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-zinc-100 text-xl flex items-center gap-2">
                    <Mic2 className="w-5 h-5 text-indigo-400" />{band.name}
                  </h3>
                  <div className="flex items-center gap-3 bg-zinc-950/50 p-2 rounded-xl border border-zinc-800">
                    <span className="text-sm font-bold text-zinc-400">順位:</span>
                    <select value={rankings[band.id] || ''} onChange={(e) => handleRankChange(band.id, Number(e.target.value))}
                      className="w-24 px-3 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-zinc-100 bg-zinc-800">
                      <option value="" disabled>-</option>
                      {Array.from({ length: bands.length }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num} disabled={Object.values(rankings).includes(num) && rankings[band.id] !== num}>
                          {num}位
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-400 mb-2">講評</label>
                  <textarea value={comments[band.id] || ''} onChange={(e) => handleCommentChange(band.id, e.target.value)}
                    placeholder="バンドへの講評やアドバイスを入力してください"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[100px] bg-zinc-950/50 text-zinc-100 placeholder-zinc-600" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-900/90 border-t border-zinc-800 backdrop-blur-xl z-40">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm font-bold text-zinc-400 bg-zinc-950 px-4 py-2 rounded-lg border border-zinc-800">
              <span className={Object.keys(rankings).length === bands.length ? 'text-emerald-400' : 'text-zinc-100'}>
                {Object.keys(rankings).length}
              </span>/{bands.length} 入力済
            </div>
            <button onClick={handleSubmit} disabled={Object.keys(rankings).length !== bands.length || sending}
              className="flex items-center gap-2 py-3 px-8 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20">
              {sending ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : <Send className="w-5 h-5" />}
              {sending ? '送信中...' : '投票を送信'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
