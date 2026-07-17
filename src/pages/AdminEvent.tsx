import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, Reorder } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Users, BarChart3, Settings, AlertCircle, MessageSquare, Copy, QrCode, Music, Speaker, ClipboardList, RefreshCw, Check, GripVertical } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { safeStorage } from '../utils/storage';

export function AdminEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [bands, setBands] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [detailedVotes, setDetailedVotes] = useState<any[]>([]);
  const [presence, setPresence] = useState<{ submitted: number; in_progress: number; total: number } | null>(null);
  const [newBandName, setNewBandName] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false);
  const [confirmDeleteBand, setConfirmDeleteBand] = useState<string | null>(null);
  const [copiedResults, setCopiedResults] = useState(false);
  const [reloading, setReloading] = useState(false);

  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    fetchEventData();
    fetchResults();
    fetchDetailedVotes();
    fetchPresence();
  }, [id]);

  useEffect(() => {
    eventStatusRef.current = event?.status;
  }, [event?.status]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (eventStatusRef.current === 'open') {
        fetchResults();
        fetchDetailedVotes();
        fetchPresence();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const getToken = () => safeStorage.getItem('adminToken') || '';

  const fetchEventData = async () => {
    try {
      const res = await fetch(`/api/events/${id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
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
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) setResults(Array.isArray(await res.json()) ? await res.clone().json() : []);
    } catch (err) { console.error(err); }
  };

  const fetchDetailedVotes = async () => {
    try {
      const res = await fetch(`/api/events/${id}/detailed-votes`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDetailedVotes(Array.isArray(data) ? data : []);
      }
    } catch (err) { console.error(err); }
  };

  const fetchPresence = async () => {
    try {
      const res = await fetch(`/api/events/${id}/presence`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) setPresence(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleManualReload = async () => {
    setReloading(true);
    await Promise.all([
      fetch(`/api/events/${id}/results`, { headers: { 'Authorization': `Bearer ${getToken()}` } }).then(r => r.ok ? r.json() : null).then(d => d && setResults(Array.isArray(d) ? d : [])),
      fetch(`/api/events/${id}/detailed-votes`, { headers: { 'Authorization': `Bearer ${getToken()}` } }).then(r => r.ok ? r.json() : null).then(d => d && setDetailedVotes(Array.isArray(d) ? d : [])),
      fetch(`/api/events/${id}/presence`, { headers: { 'Authorization': `Bearer ${getToken()}` } }).then(r => r.ok ? r.json() : null).then(d => d && setPresence(d)),
    ]);
    setReloading(false);
  };

  const handleAddBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBandName.trim()) return;
    const res = await fetch(`/api/events/${id}/bands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
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
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.ok) {
      setConfirmDeleteBand(null);
      fetchEventData();
      fetchResults();
      fetchDetailedVotes();
    }
  };

  const handleBandReorder = (newOrder: any[]) => {
    setBands(newOrder);
    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = setTimeout(async () => {
      await fetch(`/api/events/${id}/bands/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ bandIds: newOrder.map(b => b.id) })
      });
    }, 800);
  };

  const handleStatusChange = async (status: string) => {
    const res = await fetch(`/api/events/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) fetchEventData();
  };

  const handleDeleteEvent = async () => {
    const res = await fetch(`/api/events/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.ok) navigate('/admin');
  };

  const handleCopyComments = (result: any) => {
    const lines: string[] = [];
    detailedVotes.forEach((voteGroup, index) => {
      const vote = voteGroup.votes.find((v: any) => v.band_name === result.band_name);
      if (vote && vote.comment) {
        lines.push(`審査員${index + 1}　${vote.rank}位：${vote.comment}`);
      }
    });
    if (lines.length === 0) { alert('講評がありません'); return; }
    navigator.clipboard.writeText(`${result.band_name}への講評:\n\n${lines.join('\n\n')}`);
    alert('講評をクリップボードにコピーしました');
  };

  const handleCopyAllResults = () => {
    if (results.length === 0) return;
    const text = results.map(r => `${r.rank}位　${r.band_name}　${r.total_score}点`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedResults(true);
    setTimeout(() => setCopiedResults(false), 2000);
  };

  const baseUrl = window.location.origin;
  const judgeUrl = `${baseUrl}/login?role=judge`;
  const adminUrl = `${baseUrl}/login?role=admin`;

  if (loading || !event) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden pb-20">
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -translate-y-1/2 mix-blend-screen pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[120px] translate-y-1/2 mix-blend-screen pointer-events-none" />
      <motion.div animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="fixed top-1/4 left-[5%] text-zinc-800/30 hidden lg:block pointer-events-none"><Music className="w-32 h-32" /></motion.div>
      <motion.div animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="fixed bottom-1/4 right-[5%] text-zinc-800/30 hidden lg:block pointer-events-none"><Speaker className="w-40 h-40" /></motion.div>

      <header className="bg-zinc-900/80 border-b border-zinc-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold text-zinc-100 truncate max-w-[200px] sm:max-w-md tracking-wide">{event.name}</h1>
            <span className={`px-2.5 py-0.5 text-xs rounded-full font-bold ${event.status === 'open' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : event.status === 'closed' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
              {event.status === 'open' ? '受付中' : event.status === 'closed' ? '締切' : '終了'}
            </span>
          </div>
          <button onClick={handleManualReload} disabled={reloading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">更新</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* 参加者状況 */}
        {presence !== null && (
          <div className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800 backdrop-blur-md">
            <h2 className="text-sm font-bold text-zinc-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              参加者状況
              {event.status === 'open' && <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>自動更新中</span>}
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-zinc-100">{presence.total}</div>
                <div className="text-xs text-zinc-500 mt-1">参加中</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-emerald-400">{presence.submitted}</div>
                <div className="text-xs text-zinc-500 mt-1">投票済み</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-indigo-400">{presence.in_progress}</div>
                <div className="text-xs text-zinc-500 mt-1">記入中</div>
              </div>
            </div>
          </div>
        )}

        {/* イベント設定 */}
        <div className="bg-zinc-900/60 p-6 rounded-2xl shadow-lg border border-zinc-800 backdrop-blur-md">
          <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2 tracking-wide"><Settings className="w-5 h-5 text-fuchsia-400" />イベント設定</h2>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => handleStatusChange('open')} className={`px-4 py-2 rounded-xl font-bold transition-all ${event.status === 'open' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'}`}>受付開始</button>
            <button onClick={() => handleStatusChange('closed')} className={`px-4 py-2 rounded-xl font-bold transition-all ${event.status === 'closed' ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'}`}>受付締切</button>
            <button onClick={() => handleStatusChange('finished')} className={`px-4 py-2 rounded-xl font-bold transition-all ${event.status === 'finished' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'}`}>終了</button>
            <div className="flex-1"></div>
            <button onClick={() => setShowQR(!showQR)} className="px-4 py-2 rounded-xl font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all flex items-center gap-2"><QrCode className="w-4 h-4" />QRコード</button>
            <button onClick={() => setConfirmDeleteEvent(true)} className="px-4 py-2 rounded-xl font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center gap-2"><Trash2 className="w-4 h-4" />イベント削除</button>
          </div>
          {showQR && (
            <div className="mt-6 p-6 bg-zinc-950/50 rounded-xl border border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center gap-4">
                <h3 className="font-bold text-zinc-100">審査員用ログインURL</h3>
                <div className="bg-white p-4 rounded-xl"><QRCodeSVG value={judgeUrl} size={160} /></div>
                <div className="flex items-center gap-2 w-full">
                  <input type="text" readOnly value={judgeUrl} className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none" />
                  <button onClick={() => navigator.clipboard.writeText(judgeUrl)} className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex flex-col items-center gap-4">
                <h3 className="font-bold text-zinc-100">管理者用ログインURL</h3>
                <div className="bg-white p-4 rounded-xl"><QRCodeSVG value={adminUrl} size={160} /></div>
                <div className="flex items-center gap-2 w-full">
                  <input type="text" readOnly value={adminUrl} className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none" />
                  <button onClick={() => navigator.clipboard.writeText(adminUrl)} className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* バンド管理 */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 tracking-wide"><Users className="w-5 h-5 text-indigo-400" />バンド管理 ({bands.length})</h2>
            <div className="bg-zinc-900/60 p-6 rounded-2xl shadow-lg border border-zinc-800 backdrop-blur-md">
              <form onSubmit={handleAddBand} className="flex gap-2 mb-6">
                <input type="text" value={newBandName} onChange={(e) => setNewBandName(e.target.value)} placeholder="バンド名を追加" className="flex-1 px-4 py-2 rounded-xl border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-zinc-950/50 text-zinc-100 placeholder-zinc-600" />
                <button type="submit" disabled={!newBandName.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"><Plus className="w-4 h-4" />追加</button>
              </form>
              {bands.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm font-medium">バンドが登録されていません</div>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 mb-3 flex items-center gap-1"><GripVertical className="w-3 h-3" />ドラッグまたは長押しで並び替えできます</p>
                  <Reorder.Group as="ul" axis="y" values={bands} onReorder={handleBandReorder} className="space-y-2">
                    {bands.map((band) => (
                      <Reorder.Item
                        key={band.id}
                        value={band}
                        className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-zinc-700 cursor-grab active:cursor-grabbing select-none touch-none"
                        whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 10 }}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                          <span className="font-bold text-zinc-100">{band.name}</span>
                        </div>
                        <button onClick={() => setConfirmDeleteBand(band.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </>
              )}
            </div>
          </div>

          {/* 集計結果 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 tracking-wide">
                <BarChart3 className="w-5 h-5 text-emerald-400" />集計結果
                {event.status === 'open' && <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>自動更新中</span>}
              </h2>
              {results.length > 0 && (
                <button onClick={handleCopyAllResults} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg border transition-colors bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300">
                  {copiedResults ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedResults ? 'コピーしました' : '全順位コピー'}
                </button>
              )}
            </div>
            <div className="bg-zinc-900/60 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden backdrop-blur-md">
              {results.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm font-medium">まだ投票データがありません</div>
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
                    {results.map((result) => (
                      <tr key={result.band_id} className={`border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors ${result.rank === 1 ? 'bg-amber-500/5' : ''}`}>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${result.rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : result.rank === 2 ? 'bg-zinc-700 text-zinc-300 border border-zinc-600' : result.rank === 3 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-zinc-500'}`}>{result.rank}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-zinc-100">{result.band_name}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-zinc-300 mb-1">{Array.from({ length: result.num_bands }, (_, i) => i + 1).map(rank => `${rank}位${result.rank_counts[rank] || 0}人`).join('、')}</div>
                          <div className="text-xs text-zinc-500 font-mono">{Array.from({ length: result.num_bands }, (_, i) => i + 1).map(rank => `${result.num_bands - rank + 1}×${result.rank_counts[rank] || 0}`).join(' + ')} = {result.total_score}点</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-zinc-400">{result.total_score}</td>
                        <td className="py-3 px-4">
                          {(() => {
                            const commentVotes = detailedVotes.filter(vg => vg.votes.some((v: any) => v.band_name === result.band_name && v.comment));
                            return commentVotes.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-zinc-500 flex items-center gap-1"><MessageSquare className="w-3 h-3" />{commentVotes.length}件の講評</span>
                                  <button onClick={() => handleCopyComments(result)} className="text-xs font-bold flex items-center gap-1 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-md transition-colors border border-indigo-500/20"><Copy className="w-3 h-3" />コピー</button>
                                </div>
                                <div className="max-h-40 overflow-y-auto pr-1 space-y-2">
                                  {detailedVotes.map((voteGroup, index) => {
                                    const vote = voteGroup.votes.find((v: any) => v.band_name === result.band_name);
                                    if (!vote || !vote.comment) return null;
                                    return (
                                      <div key={index} className="bg-zinc-950/50 p-2 rounded border border-zinc-800">
                                        <span className="text-xs font-bold text-zinc-500">審査員{index + 1}　{vote.rank}位</span>
                                        <p className="text-sm text-zinc-300 mt-1">{vote.comment}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : <span className="text-sm font-medium text-zinc-600">講評なし</span>;
                          })()}
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

        {/* 審査員ごとの投票詳細 */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 tracking-wide"><ClipboardList className="w-5 h-5 text-fuchsia-400" />審査員ごとの投票詳細</h2>
          <div className="bg-zinc-900/60 p-6 rounded-2xl shadow-lg border border-zinc-800 backdrop-blur-md">
            {detailedVotes.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm font-medium">まだ投票データがありません</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {detailedVotes.map((voteGroup, index) => (
                  <div key={index} className="bg-zinc-950/50 rounded-xl border border-zinc-800 overflow-hidden">
                    <div className="bg-zinc-800/50 px-4 py-3 border-b border-zinc-800 flex items-center">
                      <span className="font-bold text-zinc-100 flex items-center gap-2"><Users className="w-4 h-4 text-zinc-400" />{voteGroup.label || `審査員 ${index + 1}`}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {voteGroup.votes.map((vote: any, vIndex: number) => (
                        <div key={vIndex} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-zinc-300">{vote.band_name}</span>
                            <span className="text-xs font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{vote.rank}位</span>
                          </div>
                          {vote.comment && <p className="text-xs text-zinc-500 bg-zinc-900/50 p-2 rounded border border-zinc-800/50">{vote.comment}</p>}
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

      {confirmDeleteEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-100 mb-2">イベントの削除</h3>
            <p className="text-zinc-400 mb-6 font-medium">イベントを削除すると、すべてのバンドと投票データが失われます。本当に削除しますか？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteEvent(false)} className="px-4 py-2 rounded-xl font-bold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors">キャンセル</button>
              <button onClick={handleDeleteEvent} className="px-4 py-2 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-colors">削除する</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteBand !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-100 mb-2">バンドの削除</h3>
            <p className="text-zinc-400 mb-6 font-medium">このバンドを削除しますか？関連する投票データも削除されます。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteBand(null)} className="px-4 py-2 rounded-xl font-bold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors">キャンセル</button>
              <button onClick={() => handleDeleteBand(confirmDeleteBand)} className="px-4 py-2 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-colors">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
