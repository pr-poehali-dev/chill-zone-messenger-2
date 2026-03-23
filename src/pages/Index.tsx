import { useState, useEffect } from 'react';
import { api, User } from '@/lib/api';
import AuthPage from '@/components/AuthPage';
import ChatPage from '@/components/ChatPage';
import ProfileSheet from '@/components/ProfileSheet';

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('cz_theme');
    const dark = saved !== null ? saved === 'dark' : true;
    setIsDark(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('cz_session');
    if (!session) { setLoading(false); return; }

    api.auth.me().then(res => {
      if (res.ok) setUser(res.data.user);
      else localStorage.removeItem('cz_session');
      setLoading(false);
    });
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('cz_theme', next ? 'dark' : 'light');
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }

  function handleLogin(u: User, _sessionId: string) {
    setUser(u);
  }

  function handleLogout() {
    api.auth.logout();
    localStorage.removeItem('cz_session');
    setUser(null);
    setProfileOpen(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--purple))] flex items-center justify-center animate-pulse">
            <span className="text-2xl text-white">✦</span>
          </div>
          <p className="text-muted-foreground text-sm font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <>
      <ChatPage
        user={user}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
      {profileOpen && (
        <ProfileSheet
          user={user}
          onClose={() => setProfileOpen(false)}
          onUserUpdate={u => setUser(u)}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
