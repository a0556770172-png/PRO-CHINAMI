import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}
