import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowLeft, Mic2, Settings, User, Eye, EyeOff } from 'lucide-react';
import { safeStorage } from '../utils/storage';

export function Login() {
  const [error, setError] = useState('');
  const [accountName, setAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  const searchParams = new URLSearchParams(location.search);
  const queryRole = searchParams.get('role')?.replace(/[^a-zA-Z]/g, '');
  const queryAccount = searchParams.get('account') || '';
  const role = queryRole || location.state?.role || 'judge';

  useEffect(() => {
    if (queryAccount) setAccountName(queryAccount);

    // トークンが保存済みなら再ログイン不要でそのまま遷移
    const adminToken = safeStorage.getItem('adminToken');
    const judgeToken = safeStorage.getItem('judgeToken');
    if (role === 'admin' && adminToken) {
      navigate('/admin', { replace: true });
    } else if (role === 'judge' && judgeToken) {
      navigate('/judge', { replace: true });
    } else if (!queryRole && judgeToken && !adminToken) {
      navigate('/judge', { replace: true });
    }
  }, [queryRole, queryAccount, navigate]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = isRegistering ? '/api/auth/admin/register' : '/api/auth/admin/login';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName, password, inviteCode }),
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        safeStorage.setItem('adminToken', data.token);
        safeStorage.setItem('judgeToken', data.token); // Admin is also a judge
        navigate('/admin', { replace: true });
      } else {
        setError(data.message || 'ログインに失敗しました');
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    }
  };

  const handleJudgeAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/auth/judge/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName }),
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        safeStorage.setItem('judgeToken', data.token);
        navigate('/judge', { replace: true });
      } else {
        setError(data.message || 'ログインに失敗しました');
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-zinc-100 relative overflow-hidden">
      {/* Stage Lighting Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] -translate-y-1/2 mix-blend-screen" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[100px] translate-y-1/2 mix-blend-screen" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 max-w-md w-full bg-zinc-900/80 p-8 rounded-3xl shadow-2xl border border-zinc-800 backdrop-blur-xl"
      >
        <button 
          onClick={() => navigate('/')}
          className="flex items-center text-sm text-zinc-400 hover:text-zinc-100 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          戻る
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-700/50 shadow-inner">
            {role === 'admin' ? (
              <Settings className="w-8 h-8 text-fuchsia-400" />
            ) : (
              <Mic2 className="w-8 h-8 text-indigo-400" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-wide">
            {role === 'admin' ? '管理者ログイン' : '審査員ログイン'}
          </h2>
        </div>

        {role === 'admin' && (
          <div className="flex bg-zinc-800/50 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setIsRegistering(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${!isRegistering ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${isRegistering ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              新規作成
            </button>
          </div>
        )}

        <form onSubmit={role === 'admin' ? handleAdminAuth : handleJudgeAuth} className="space-y-5">
          {error && (
            <p className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-lg border border-red-400/20">{error}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              {role === 'admin' ? 'アカウント名' : '対象の管理者アカウント名'}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-all"
                placeholder="アカウント名を入力"
              />
            </div>
          </div>

          {role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">パスワード</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl py-3 pl-10 pr-12 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-all"
                  placeholder="パスワードを入力"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 focus:outline-none p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {/* 新規作成時のみ招待コード入力欄を表示 */}
          {role === 'admin' && isRegistering && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">招待コード</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-all"
                  placeholder="管理者から受け取った招待コード"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">アカウント作成には招待コードが必要です</p>
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-4 px-4 text-white rounded-xl font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 shadow-lg mt-4 ${
              role === 'admin' 
                ? 'bg-fuchsia-600 hover:bg-fuchsia-500 focus:ring-fuchsia-500 shadow-fuchsia-500/20' 
                : 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500 shadow-indigo-500/20'
            }`}
          >
            {role === 'admin' ? (isRegistering ? 'アカウントを作成して入場' : 'ログインして入場') : '入場する'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
