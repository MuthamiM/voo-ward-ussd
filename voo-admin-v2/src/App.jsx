
import React, { useState } from 'react';
import Login from './components/Login';
import FloatingAI from './components/FloatingAI';
import Dashboard from './components/Dashboard';
import Issues from './components/Issues';
import Bursary from './components/Bursary';
import Announcements from './components/Announcements';
import Analytics from './components/Analytics';
import UsersComponent from './components/Users';
import useAuth from './hooks/useAuth';
import useAI from './hooks/useAI';
import useDashboard from './hooks/useDashboard';
import useIssues from './hooks/useIssues';
import useBursary from './hooks/useBursary';
import useAnnouncements from './hooks/useAnnouncements';
import useUsers from './hooks/useUsers';
import './styles/glass.css';

const sectionTitles = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  users: 'Users',
  issues: 'Issues',
  bursary: 'Bursary',
  announcements: 'Announcements',
};

export default function App() {
  const [section, setSection] = useState('dashboard');
  const { user, isLoading: authLoading, error: authError, login, logout } = useAuth();
  const ai = useAI();
  const dashboard = useDashboard();
  const issues = useIssues();
  const bursary = useBursary();
  const announcements = useAnnouncements();
  const users = useUsers();

  if (!user) {
    return <Login onLogin={login} isLoading={authLoading} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 relative">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 bg-white/30 backdrop-blur border-b border-white/20 shadow-lg sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-blue-900">VOO Ward Admin</span>
          <span className="text-xs text-blue-500 bg-white/40 rounded px-2 py-1 ml-2">Kitui County</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-blue-900 font-medium">{user?.email}</span>
          <button onClick={logout} className="bg-pink-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-pink-600 transition-colors">Logout</button>
        </div>
      </header>
      {/* Navigation */}
      <nav className="flex gap-4 px-8 py-4 bg-white/20 backdrop-blur border-b border-white/10 sticky top-[68px] z-20">
        {Object.entries(sectionTitles).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`px-4 py-2 rounded-2xl font-semibold transition-all ${section === key ? 'bg-blue-500 text-white shadow' : 'bg-white/40 text-blue-900 hover:bg-blue-100'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {/* Main Content */}
      <main className="max-w-5xl mx-auto py-8 px-4">
        {section === 'dashboard' && <Dashboard stats={dashboard.stats} onSection={setSection} />}
        {section === 'analytics' && <Analytics data={dashboard.stats} />}
        {section === 'users' && <UsersComponent {...users} />}
        {section === 'issues' && <Issues {...issues} />}
        {section === 'bursary' && <Bursary {...bursary} />}
        {section === 'announcements' && <Announcements {...announcements} />}
      </main>
      {/* Floating AI Assistant */}
      <FloatingAI onSend={ai.sendMessage} isLoading={ai.isLoading} messages={ai.messages} error={ai.error} />
    </div>
  );
}
