import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic2, Settings, Music, Speaker, Play, Volume2 } from 'lucide-react';
import { safeStorage } from '../utils/storage';

export function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const judgeToken = safeStorage.getItem('judgeToken');
    const adminToken = safeStorage.getItem('adminToken');
    if (judgeToken && !adminToken) {
      navigate('/judge', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Stage Lighting Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] -translate-y-1/2 mix-blend-screen" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[100px] -translate-y-1/2 mix-blend-screen" />
      <div className="absolute bottom-0 left-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] -translate-x-1/2 translate-y-1/2 mix-blend-screen" />

      {/* Floating Instrument Icons */}
      <motion.div 
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} 
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-[10%] text-zinc-800/40 hidden md:block"
      >
        <Music className="w-32 h-32" />
      </motion.div>
      <motion.div 
        animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }} 
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-1/4 right-[10%] text-zinc-800/40 hidden md:block"
      >
        <Speaker className="w-40 h-40" />
      </motion.div>
      <motion.div 
        animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }} 
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute top-1/3 right-[20%] text-zinc-800/30 hidden md:block"
      >
        <Mic2 className="w-24 h-24" />
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md w-full space-y-12"
      >
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center justify-center p-4 bg-zinc-900/50 rounded-full border border-zinc-800 backdrop-blur-sm mb-4 shadow-[0_0_30px_rgba(99,102,241,0.2)]"
          >
            <Volume2 className="w-8 h-8 text-indigo-400" />
          </motion.div>
          <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            AUDITION<br/>RANKER
          </h1>
          <p className="text-zinc-400 font-medium tracking-widest text-sm uppercase letter-spacing-2">
            Live Stage Evaluation System
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => navigate('/judge')}
            className="group relative overflow-hidden flex items-center gap-4 p-6 bg-zinc-900/80 border border-zinc-800 rounded-2xl hover:border-indigo-500/50 transition-all backdrop-blur-md shadow-lg hover:shadow-indigo-500/10"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <Mic2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="text-left flex-1">
              <div className="font-bold text-lg text-zinc-100 tracking-wide">審査員ログイン</div>
              <div className="text-sm text-zinc-500">開催中のイベントに投票する</div>
            </div>
            <Play className="w-5 h-5 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/admin')}
            className="group relative overflow-hidden flex items-center gap-4 p-6 bg-zinc-900/80 border border-zinc-800 rounded-2xl hover:border-fuchsia-500/50 transition-all backdrop-blur-md shadow-lg hover:shadow-fuchsia-500/10"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 rounded-full bg-fuchsia-500/10 flex items-center justify-center border border-fuchsia-500/20 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div className="text-left flex-1">
              <div className="font-bold text-lg text-zinc-100 tracking-wide">管理者ログイン</div>
              <div className="text-sm text-zinc-500">イベントの作成と結果の確認</div>
            </div>
            <Play className="w-5 h-5 text-zinc-600 group-hover:text-fuchsia-400 transition-colors" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
