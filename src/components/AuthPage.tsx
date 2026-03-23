import { useState } from 'react';
import { api, User } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface AuthPageProps {
  onLogin: (user: User, sessionId: string) => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await api.auth.login(username, password)
        : await api.auth.register(username, password, displayName || username);

      if (res.ok) {
        localStorage.setItem('cz_session', res.data.session_id);
        onLogin(res.data.user, res.data.session_id);
      } else {
        setError(res.data.error || 'Ошибка');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[hsl(var(--purple)/0.08)] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[hsl(var(--purple)/0.06)] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md px-6 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--purple))] glow-purple mb-4">
            <span className="text-3xl">✦</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Chill Zone</h1>
          <p className="text-muted-foreground mt-2 text-sm">Общий чат без лишнего шума</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-muted rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              mode === 'login'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Войти
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              mode === 'register'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="animate-fade-in">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Имя в чате</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Как тебя называть?"
                className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:border-[hsl(var(--purple))] focus:ring-2 focus:ring-[hsl(var(--purple)/0.2)] outline-none text-foreground placeholder:text-muted-foreground transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Логин</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              required
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:border-[hsl(var(--purple))] focus:ring-2 focus:ring-[hsl(var(--purple)/0.2)] outline-none text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Пароль</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-card border border-border focus:border-[hsl(var(--purple))] focus:ring-2 focus:ring-[hsl(var(--purple)/0.2)] outline-none text-foreground placeholder:text-muted-foreground transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name={showPass ? 'EyeOff' : 'Eye'} size={18} />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-xl animate-fade-in">
              <Icon name="AlertCircle" size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[hsl(var(--purple))] hover:bg-[hsl(var(--purple-dark))] text-white font-bold text-base transition-all duration-200 glow-purple disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? <><Icon name="Loader2" size={18} className="animate-spin" /> Загрузка...</>
              : mode === 'login' ? 'Войти' : 'Создать аккаунт'
            }
          </button>
        </form>
      </div>
    </div>
  );
}