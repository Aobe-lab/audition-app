import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Settings, ChevronRight, Calendar, Music, Speaker, Mic2, User, QrCode, Copy, Check, LogOut } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { safeStorage } from '../utils/storage';

export function Admin() {
  const [events, setEvents] = useState<any[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [adminInfo, setAdminInfo] = useState<{accountName: string} | null>(null);
  const [judgeQrUrl, setJudgeQrUrl] = useState<string>('');
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
    fetchAdminInfo();
    fetchOrCreateJudgeQr();
  }, []);

  // ログアウト：adminToken・judgeQrTokenを削除してログイン画面へ
  const handleLogout = () => {
    if (!confirm('ログアウトしますか？')) return;
    safeStorage.removeItem('adminToken');
    safeStorage.removeItem('judgeQrToken');
    navigate('/login?role=admin', { replace: true });
  };

  useEffect(() => {
    fetchEvents();
    fetchAdminInfo();
    fetchOrCreateJudgeQr();
  }, []);

  const fetchAdminInfo = async () => {
    try {
      const res = await fetch('/api/auth/admin/me', {
        headers: { 'Authorization': `Bearer ${safeStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin info:', err);
    }
  };

  // 審査員入場用QRトークンを発行してURLを生成する
  const fetchOrCreateJudgeQr = async () => {
    // 一度発行したQRトークンはlocalStorageにキャッシュ（毎回APIを叩かないため）
    const cached = safeStorage.getItem('judgeQrToken');
    if (cached) {
      setJudgeQrUrl(`${window.location.origin}/enter/${cached}`);
      return;
    }
    try {
      const res = await fetch('/api/auth/judge/qr-token', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${safeStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const { token } = await res.json();
        safeStorage.setItem('judgeQrToken', token);
        setJudgeQrUrl(`${window.location.origin}/enter/${token}`);
      }
    } catch (err) {
      console.error('Failed to fetch judge QR token:', err);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events', {
        headers: { 'Authorization': `Bearer ${safeStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      } else {
        if (res.status === 401 || res.status === 403) {
          safeStorage.removeItem('adminToken');
          navigate('/login?role=admin');
        } else {
          setEvents([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setEvents([]);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${safeStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ name: newEventName }),
    });
    if (res.ok) {
      setNewEventName('');
      fetchEvents();
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(judgeQrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden">
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -translate-y-1/2 mix-blend-screen pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[120px] translate-y-1/2 mix-blend-screen pointer-events-none" />

      <motion.div
        animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="fixed top-1/4 left-[5%] text-zinc-800/30 hidden lg:block pointer-events-none"
      >
        <Music className="w-32 h-32" />
      </motion.div>
      <motion.div
        animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="fixed bottom-1/4 right-[5%] text-zinc-800/30 hidden lg:block pointer-events-none"
      >
        <Speaker className="w-40 h-40" />
      </motion.div>

      <header className="bg-zinc-900/80 border-b border-zinc-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-fuchsia-400" />
            <h1 className="text-lg font-bold text-zinc-100 tracking-wide">管理者ダッシュボード</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/judge')}
              className="text-sm px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 rounded-md flex items-center gap-1.5 transition-colors border border-indigo-500/20"
            >
              <Mic2 className="w-4 h-4" />
              <span className="hidden sm:inline">審査員画面へ</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 rounded-md flex items-center gap-1.5 transition-colors border border-zinc-700"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          <div className="md:col-span-1 space-y-6">
            {adminInfo && (
              <div className="bg-zinc-900/60 p-6 rounded-2xl shadow-lg border border-zinc-800 backdrop-blur-md">
                <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2 tracking-wide">
                  <User className="w-5 h-5 text-fuchsia-400" />
                  管理者情報
                </h2>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">アカウント名</label>
                  <div className="text-zinc-100 font-medium bg-zinc-950/50 px-3 py-2 rounded-lg border border-zinc-800">
                    {adminInfo.accountName}
                  </div>
                </div>
              </div>
            )}

            {/* 審査員用QRコード */}
            <div className="bg-zinc-900/60 p-6 rounded-2xl shadow-lg border border-zinc-800 backdrop-blur-md">
              <h2 className="text-lg font-bold text-zinc-100 mb-1 flex items-center gap-2 tracking-wide">
                <QrCode className="w-5 h-5 text-indigo-400" />
                審査員入場QR
              </h2>
              <p className="text-xs text-zinc-500 mb-4">このQRを読んだ人だけが審査員として入場できます</p>

              {judgeQrUrl && (
                <>
                  <button
                    onClick={() => setShowQr(!showQr)}
                    className="w-full py-2.5 px-4 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-xl font-bold text-sm transition-colors border border-indigo-500/30 mb-3"
                  >
                    {showQr ? 'QRを隠す' : 'QRを表示する'}
                  </button>

                  {showQr && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="bg-white p-3 rounded-xl">
                        <QRCodeSVG value={judgeQrUrl} size={180} />
                      </div>
                      <p className="text-xs text-zinc-500 text-center">スマホで読み取って名前を入力するだけで入場できます</p>
                      <button
                        onClick={handleCopyUrl}
                        className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-zinc-700"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'コピーしました' : 'URLをコピー'}
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            <div className="bg-zinc-900/60 p-6 rounded-2xl shadow-lg border border-zinc-800 backdrop-blur-md sticky top-24">
              <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2 tracking-wide">
                <Plus className="w-5 h-5 text-fuchsia-400" />
                新規イベント作成
              </h2>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label htmlFor="eventName" className="block text-sm font-bold text-zinc-400 mb-2">
                    イベント名
                  </label>
                  <input
                    id="eventName"
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    placeholder="例: 第1回 軽音部オーディション"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all bg-zinc-950/50 text-zinc-100 placeholder-zinc-600"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-fuchsia-600 text-white rounded-xl font-bold hover:bg-fuchsia-500 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 shadow-lg shadow-fuchsia-500/20"
                >
                  作成する
                </button>
              </form>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2 tracking-wide">
              <Calendar className="w-5 h-5 text-zinc-400" />
              イベント一覧
            </h2>

            {events.length === 0 ? (
              <div className="text-center py-16 bg-zinc-900/40 rounded-3xl border border-zinc-800 border-dashed backdrop-blur-sm">
                <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
                  <Calendar className="w-8 h-8 text-zinc-500" />
                </div>
                <h3 className="text-lg font-bold text-zinc-300 mb-2">イベントがありません</h3>
                <p className="text-zinc-500">左のフォームから新しいイベントを作成してください</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {events.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate(`/admin/event/${event.id}`)}
                    className="bg-zinc-900/60 p-6 rounded-3xl shadow-lg border border-zinc-800 hover:border-fuchsia-500/50 hover:shadow-fuchsia-500/10 transition-all cursor-pointer group flex items-center justify-between backdrop-blur-md"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-bold text-zinc-100 text-xl group-hover:text-fuchsia-400 transition-colors mb-2 truncate">
                        {event.name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                          event.status === 'open' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          event.status === 'closed' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}>
                          {event.status === 'open' ? '受付中' : event.status === 'closed' ? '締切' : '終了'}
                        </span>
                        <span className="text-zinc-500 font-medium">
                          {new Date(event.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center group-hover:bg-fuchsia-500/20 transition-colors border border-zinc-700/50 group-hover:border-fuchsia-500/30 shrink-0">
                      <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-fuchsia-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
