import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Mic2, Calendar, Music, Speaker, Settings, LogOut } from 'lucide-react';
import { safeStorage } from '../utils/storage';

export function Judge() {
  const [events, setEvents] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const getToken = () => safeStorage.getItem('judgeToken') || safeStorage.getItem('adminToken') || '';

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events?role=judge', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      } else if (res.status === 401) {
        safeStorage.removeItem('judgeToken');
        navigate('/login?role=judge');
      }
      // 401以外のエラー（503など）はトークンを消さずそのまま待つ
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setEvents([]);
    }
  };

  const handleLogout = () => {
    if (!confirm('ログアウトしますか？')) return;
    safeStorage.removeItem('judgeToken');
    navigate('/login', { replace: true });
  };

  const isAdmin = !!safeStorage.getItem('adminToken');

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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic2 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-lg font-bold text-zinc-100 tracking-wide">審査員ダッシュボード</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="text-sm px-3 py-1.5 bg-fuchsia-600/20 text-fuchsia-400 hover:bg-fuchsia-600/30 hover:text-fuchsia-300 rounded-md flex items-center gap-1.5 transition-colors border border-fuchsia-500/20"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">管理者画面へ</span>
              </button>
            )}
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

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2 tracking-wide">
              <Calendar className="w-6 h-6 text-zinc-400" />
              開催中のイベント
            </h2>
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-sm font-bold">
              {events.length}件
            </span>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-16 bg-zinc-900/40 rounded-3xl border border-zinc-800 border-dashed backdrop-blur-sm">
              <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
                <Mic2 className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-lg font-bold text-zinc-300 mb-2">現在受付中のイベントはありません</h3>
              <p className="text-zinc-500">管理者がイベントを開始するまでお待ちください</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/judge/event/${event.id}`)}
                  className="bg-zinc-900/60 p-6 rounded-3xl shadow-lg border border-zinc-800 hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all cursor-pointer group flex items-center justify-between backdrop-blur-md"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-bold text-zinc-100 text-xl group-hover:text-indigo-400 transition-colors mb-2 truncate">
                      {event.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span>
                      受付中
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors border border-zinc-700/50 group-hover:border-indigo-500/30 shrink-0">
                    <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-indigo-400" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
