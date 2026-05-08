import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mic2 } from 'lucide-react';
import { safeStorage } from '../utils/storage';

// QRコードを読んだ審査員がここに来る。
// トークンを検証してそのまま即入場（名前入力なし・完全匿名）。
export function Enter() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    // すでにjudgeTokenがあればそのまま審査員ページへ
    const existing = safeStorage.getItem('judgeToken');
    if (existing) {
      navigate('/judge', { replace: true });
      return;
    }

    if (!token || token.split('.').length !== 3) {
      setError('invalid');
      return;
    }

    // トークンを即送信して審査員トークンを取得
    (async () => {
      try {
        const res = await fetch('/api/auth/judge/enter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryToken: token }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          safeStorage.setItem('judgeToken', data.token);
          navigate('/judge', { replace: true });
        } else {
          setError(data.message || 'エラーが発生しました');
        }
      } catch {
        setError('ネットワークエラーが発生しました。接続を確認してください。');
      }
    })();
  }, [token, navigate]);

  if (error === 'invalid') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center text-zinc-400">
          <p className="text-lg font-bold mb-2">無効なQRコードです</p>
          <p className="text-sm">管理者に正しいQRコードを発行してもらってください</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center text-zinc-400">
          <p className="text-lg font-bold mb-2 text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-indigo-400 hover:text-indigo-300 underline"
          >
            再試行する
          </button>
        </div>
      </div>
    );
  }

  // 処理中のローディング表示
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] -translate-y-1/2 mix-blend-screen" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[100px] translate-y-1/2 mix-blend-screen" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center"
      >
        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
          <Mic2 className="w-10 h-10 text-indigo-400 animate-pulse" />
        </div>
        <p className="text-zinc-300 font-bold text-lg">入場しています...</p>
      </motion.div>
    </div>
  );
}
