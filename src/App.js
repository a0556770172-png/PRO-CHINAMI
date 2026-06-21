import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import PostPage from './pages/PostPage';
import CategoryPage from './pages/CategoryPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import UserProfilePage from './pages/UserProfilePage';
import AuthPage from './pages/AuthPage';
import WriterPage from './pages/WriterPage';
import ChatPage, { ChatsListPage } from './pages/ChatPage';
import './App.css';

// דף השבתה — מוצג לכל המשתמשים כשהאתר מושבת
function SiteDisabledPage({ message }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      textAlign: 'center',
      padding: '2rem',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)'
    }}>
      <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>🔧</div>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 700 }}>האתר מושבת זמנית</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: 480, lineHeight: 1.7, fontSize: '1.05rem', marginBottom: '2rem' }}>
        {message}
      </p>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        👑 מנהל?{' '}
        <a href="/admin" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
          כנס דרך פאנל הניהול עם קוד הגישה
        </a>
      </div>
    </div>
  );
}

// עטיפה שבודקת השבתה לפני הצגת תוכן
function AppContent() {
  const { siteDisabled, disabledMessage, isSuperAdmin, loading } = useAuth();
  const location = useLocation();

  // תמיד מאפשרים גישה לפאנל הניהול (כדי שהמנהל יוכל להחזיר)
  const isAdminRoute = location.pathname === '/admin' || location.pathname === '/auth';

  // המנהל הראשי עובר תמיד, גם כשהאתר מושבת
  if (!loading && siteDisabled && !isSuperAdmin && !isAdminRoute) {
    return <SiteDisabledPage message={disabledMessage} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="post/:slug" element={<PostPage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="user/:userId" element={<UserProfilePage />} />
        <Route path="chats" element={<ChatsListPage />} />
        <Route path="chat/:chatId" element={<ChatPage />} />
        <Route path="writer" element={<WriterPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
