import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Users, BarChart3, Settings, AlertCircle, MessageSquare, Copy, QrCode, Music, Speaker, ClipboardList } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { safeStorage } from '../utils/storage';

export function AdminEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [bands, setBands] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [detailedVotes, setDetailedVotes] = useState<any[]>([]);
  const [newBandName, setNewBandName] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false);
  const [confirmDeleteBand, setConfirmDeleteBand] = useState<string | null>(null);

  useEffect(() => {
    fetchEventData();
    fetchResults();
    fetchDetailedVotes();
  }, [id]);

  // 自動リフレッシュ: event?.statusを依存配列に入れると無限ループになるためuseRefで管理
  const eventStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    eventStatusRef.current = event?.status;
  }, [event?.status]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (eventStatusRef.current === 'open') {
        fetchResults();
        fetchDetailedVotes();
      }
    }, 10000); // 10秒（サーバー側3秒キャッシュと組み合わせてDB負荷を抑制）
    return () => clearInterval(interval);
  }, [id]);

  const fetchEventData = async () => {
    try {
      const res = await fetch(`/api/events/${id}`, {
        headers: { 'Authorization': `Bearer ${safeStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
        setBands(data.bands || []);
      } else {
        if (res.status === 401 || res.status === 403) {
          safeStorage.removeItem('adminToken');
          navigate('/login?role=admin');
        } else {
          navigate('/admin');
        }
      }
    } catch (err) {
      console.error(err);
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/events/${id}/results`, {
        headers: { 'Authorization': `Bearer ${safeStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDetailedVotes = async () => {
    try {
      const res = await fetch(`/api/events/${id}/detailed-votes`, {
        headers: { 'Authorization': `Bearer ${safeStorage.getItem('adminToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDetailedVotes(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBandName.trim()) return;

    const res = await fetch(`/api/events/${id}/bands`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${safeStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ name: newBandName }),
    });
    
    if (res.ok) {
      setNewBandName('');
      fetchEventData();
      fetchResults();
      fetchDetailedVotes();
    }
  };

  const handleDeleteBand = async (bandId: string) => {
    const res = await fetch(`/api/bands/${bandId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${safeStorage.getItem('adminToken')}` }
    });
    
    if (res.ok) {
      setConfirmDeleteBand(null);
      fetchEventData();
      fetchResults();
      fetchDetailedVotes();
    }
  };

  const handleStatusChange = async (status: string) => {
    const res = await fetch(`/api/events/${id}/status`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${safeStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ status }),
    });
    
    if (res.ok) {
      fetchEventData();
    }
  };

  const handleDeleteEvent = async () => {
    const res = await fetch(`/api/events/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${safeStorage.getItem('adminToken')}` }
    });
    
    if (res.ok) {
      navigate('/admin');
    }
  };

  const baseUrl = window.location.origin;
  
  const judgeUrl = `${baseUrl}/login?role=judge`;
  const adminUrl = `${baseUrl}/login?role=admin`;
  if (!event) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden pb-20">
      {/* Stage Lighting Effects */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -translate-y-1/2 mix-blend-screen pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[120px] translate-y-1/2 mix-blend-screen pointer-events-none" />

      {/* Floating Instrument Icons */}
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
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin')}
              className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-zinc-100 truncate max-w-[200px] sm:max-w-md tracking-wide">
              {event.name}
            </h1>
            <span className={`px-2.5 py-0.5 text-xs rounded-full font-bold ${
              event.status === 'open' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              event.status === 'closed' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}>
              {event.status === 'open' ? '受付中' : event.status === 'closed' ? '締切' : '終了'}
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Status Controls */}
        <div className="bg-zinc-900/60 p-6 rounded-2xl shadow-lg border border-zinc-800 backdrop-blur-md">
          <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2 tracking-wide">
            <Settings className="w-5 h-5 text-fuchsia-400" />
            イベント設定
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleStatusChange('open')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                event.status === 'open' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
            >
              受付開始
            </button>
            <button
              onClick={() => handleStatusChange('closed')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                event.status === 'closed' 
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20' 
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
            >
              受付締切
            </button>
            <button
              onClick={() => handleStatusChange('finished')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                event.status === 'finished' 
                  ? 'bg-zinc-700 text-white shadow-lg shadow-zinc-500/20' 
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
            >
              終了
            </button>
            <div className="flex-1"></div>
            <button
              onClick={() => setShowQR(!showQR)}
              className="px-4 py-2 rounded-xl font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              QRコード
            </button>
            <button
              onClick={() => setConfirmDeleteEvent(true)}
              className="px-4 py-2 rounded-xl font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              イベント削除
            </button>
          </div>
          
          {showQR && (
            <div className="mt-6 p-6 bg-zinc-950/50 rounded-xl border border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center justify-center gap-4">
                <h3 className="font-bold text-zinc-100 tracking-wide">審査員用ログインURL</h3>
                <div className="bg-white p-4 rounded-xl shadow-lg">
                  <QRCodeSVG value={judgeUrl} size={160} />
                </div>
                <div className="flex items-center gap-2 w-full">
                  <input 
                    type="text" 
                    readOnly 
                    value={judgeUrl} 
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(judgeUrl);
                    }}
                    className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
                    title="URLをコピー"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-500 text-center font-medium">
                  ※審査員にはこのQRコードを読み取ってもらうか、URLを共有してください。
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-4">
                <h3 className="font-bold text-zinc-100 tracking-wide">管理者用ログインURL</h3>
                <div className="bg-white p-4 rounded-xl shadow-lg">
                  <QRCodeSVG value={adminUrl} size={160} />
                </div>
                <div className="flex items-center gap-2 w-full">
                  <input 
                    type="text" 
                    readOnly 
                    value={adminUrl} 
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(adminUrl);
                    }}
                    className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
                    title="URLをコピー"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-500 text-center font-medium">
                  ※他の管理者に委託する場合はこのQRコードを共有してください。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Band Management */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 tracking-wide">
              <Users className="w-5 h-5 text-indigo-400" />
              バンド管理 ({bands.length})
            </h2>
            
            <div className="bg-zinc-900/60 p-6 rounded-2xl shadow-lg border border-zinc-800 backdrop-blur-md">
              <form onSubmit={handleAddBand} className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newBandName}
                  onChange={(e) => setNewBandName(e.target.value)}
                  placeholder="バンド名を追加"
                  className="flex-1 px-4 py-2 rounded-xl border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-zinc-950/50 text-zinc-100 placeholder-zinc-600"
                  disabled={event.status !== 'open'}
                />
                <button
                  type="submit"
                  disabled={!newBandName.trim() || event.status !== 'open'}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                  <Plus className="w-4 h-4" />
                  追加
                </button>
              </form>

              {bands.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm font-medium">
                  バンドが登録されていません
                </div>
              ) : (
                <ul className="space-y-2">
                  {bands.map((band) => (
                    <li key={band.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800/50 border border-transparent hover:border-zinc-700 transition-all group">
                      <span className="font-bold text-zinc-100">{band.name}</span>
                      <button
                        onClick={() => setConfirmDeleteBand(band.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 tracking-wide">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              集計結果
              {event.status === 'open' && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-full ml-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span>
                  リアルタイム更新中
                </span>
              )}
            </h2>
            
            <div className="bg-zinc-900/60 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden backdrop-blur-md">
              {results.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm font-medium">
                  まだ投票データがありません
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/50 border-b border-zinc-800">
                      <th className="py-3 px-4 font-bold text-sm text-zinc-400 w-16 text-center">順位</th>
                      <th className="py-3 px-4 font-bold text-sm text-zinc-400">バンド名</th>
                      <th className="py-3 px-4 font-bold text-sm text-zinc-400">内訳</th>
                      <th className="py-3 px-4 font-bold text-sm text-zinc-400 w-24 text-right">総得点</th>
                      <th className="py-3 px-4 font-bold text-sm text-zinc-400">講評</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr 
                        key={result.band_id} 
                        className={`border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors ${
                          result.rank === 1 ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            result.rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            result.rank === 2 ? 'bg-zinc-700 text-zinc-300 border border-zinc-600' :
                            result.rank === 3 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                            'text-zinc-500'
                          }`}>
                            {result.rank}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-zinc-100">
                          {result.band_name}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-zinc-300 mb-1">
                            {Array.from({ length: result.num_bands }, (_, i) => i + 1)
                              .map(rank => `${rank}位${result.rank_counts[rank] || 0}人`)
                              .join('、')}
                          </div>
                          <div className="text-xs text-zinc-500 font-mono">
                            {Array.from({ length: result.num_bands }, (_, i) => i + 1)
                              .map(rank => `${result.num_bands - rank + 1}×${result.rank_counts[rank] || 0}`)
                              .join(' + ')} = {result.total_score}点
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-zinc-400">
                          {result.total_score}
                        </td>
                        <td className="py-3 px-4">
                          {result.comments && result.comments.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-500 flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {result.comments.length}件の講評
                                </span>
                                <button
                                  onClick={() => {
                                    const text = `${result.band_name}への講評:\n\n${result.comments.map((c: string, i: number) => `審査員${i+1}:\n${c}`).join('\n\n')}`;
                                    navigator.clipboard.writeText(text);
                                    alert('講評をクリップボードにコピーしました');
                                  }}
                                  className="text-xs font-bold flex items-center gap-1 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-md transition-colors border border-indigo-500/20"
                                >
                                  <Copy className="w-3 h-3" />
                                  コピー
                                </button>
                              </div>
                              <div className="max-h-32 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                {result.comments.map((comment: string, i: number) => (
                                  <div key={i} className="bg-zinc-950/50 p-2 rounded text-sm text-zinc-300 border border-zinc-800">
                                    {comment}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-zinc-600">講評なし</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="bg-indigo-900/30 border border-indigo-500/30 text-indigo-200 p-4 rounded-xl text-sm flex gap-3 items-start backdrop-blur-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400" />
              <div>
                <p className="font-bold mb-1 text-indigo-300">集計ルールについて</p>
                <p>総得点（1位＝候補数点、2位＝候補数-1点...）が<strong>大きい</strong>バンドが上位となります。同点の場合は同順位として扱われます。</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Voting Records */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 tracking-wide">
            <ClipboardList className="w-5 h-5 text-fuchsia-400" />
            審査員ごとの投票詳細
          </h2>
          
          <div className="bg-zinc-900/60 p-6 rounded-2xl shadow-lg border border-zinc-800 backdrop-blur-md">
            {detailedVotes.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm font-medium">
                まだ投票データがありません
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {detailedVotes.map((voteGroup, index) => (
                  <div key={index} className="bg-zinc-950/50 rounded-xl border border-zinc-800 overflow-hidden">
                    <div className="bg-zinc-800/50 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                      <span className="font-bold text-zinc-100 flex items-center gap-2">
                        <Users className="w-4 h-4 text-zinc-400" />
                        {voteGroup.label || `審査員 ${index + 1}`}
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      {voteGroup.votes.map((vote: any, vIndex: number) => (
                        <div key={vIndex} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-zinc-300">{vote.band_name}</span>
                            <span className="text-xs font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                              {vote.rank}位
                            </span>
                          </div>
                          {vote.comment && (
                            <p className="text-xs text-zinc-500 bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
                              {vote.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Event Modal */}
      {confirmDeleteEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-100 mb-2">イベントの削除</h3>
            <p className="text-zinc-400 mb-6 font-medium">イベントを削除すると、すべてのバンドと投票データが失われます。本当に削除しますか？</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteEvent(false)}
                className="px-4 py-2 rounded-xl font-bold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteEvent}
                className="px-4 py-2 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Band Modal */}
      {confirmDeleteBand !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-100 mb-2">バンドの削除</h3>
            <p className="text-zinc-400 mb-6 font-medium">このバンドを削除しますか？関連する投票データも削除されます。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteBand(null)}
                className="px-4 py-2 rounded-xl font-bold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDeleteBand(confirmDeleteBand)}
                className="px-4 py-2 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
