import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Admin } from './pages/Admin';
import { AdminEvent } from './pages/AdminEvent';
import { Judge } from './pages/Judge';
import { JudgeEvent } from './pages/JudgeEvent';
import { Enter } from './pages/Enter';
import { safeStorage } from './utils/storage';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role: 'admin' | 'judge' }) {
  const token = safeStorage.getItem(`${role}Token`);
  // 審査員ページは管理者トークンでもアクセス可能
  const adminToken = safeStorage.getItem('adminToken');
  if (!token && !(role === 'judge' && adminToken)) {
    return <Navigate to="/login" state={{ role }} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          {/* QRコードから来た審査員の入場ページ。トークンはURLに含まれる */}
          <Route path="/enter/:token" element={<Enter />} />

          <Route path="/admin" element={
            <ProtectedRoute role="admin">
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/admin/event/:id" element={
            <ProtectedRoute role="admin">
              <AdminEvent />
            </ProtectedRoute>
          } />

          <Route path="/judge" element={
            <ProtectedRoute role="judge">
              <Judge />
            </ProtectedRoute>
          } />
          <Route path="/judge/event/:id" element={
            <ProtectedRoute role="judge">
              <JudgeEvent />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
