import { useState, useEffect } from 'react';
import { api, User } from '@/lib/api';
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
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('cz_session');

    if (session) {
      api.auth.me().then(res => {
        if (res.ok) {
          setUser(res.data.user);
          setLoading(false);
        } else {
          localStorage.removeItem('cz_session');
          createGuest();
        }
      });
    } else {
      createGuest();
    }
  }, []);

  async function createGuest() {
    const res = await api.auth.guest();
    if (res.ok) {
      localStorage.setItem('cz_session', res.data.session_id);
      setUser(res.data.user);
    }
    setLoading(false);
  }

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('cz_theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  }

  function handleLogout() {
    api.auth.logout();
    localStorage.removeItem('cz_session');
    setUser(null);
    setProfileOpen(false);
    createGuest();
  }

  if (loading || !user) {
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
