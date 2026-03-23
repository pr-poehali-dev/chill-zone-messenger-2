import { useState, useRef } from 'react';
import { api, User } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface AuthPageProps {
  onLogin: (user: User, sessionId: string) => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState(['', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const codeRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  function handleCodeChange(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = digit;
    setCode(next);
    if (digit && i < 2) codeRefs[i + 1].current?.focus();
  }

  function handleCodeKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      codeRefs[i - 1].current?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const fullCode = code.join('');
    if (!displayName.trim()) { setError('Введи своё имя'); return; }
    if (fullCode.length !== 3) { setError('Введи трёхзначный код'); return; }

    setLoading(true);
    try {
      const res = await api.auth.enter(displayName.trim(), fullCode);
      if (res.ok) {
        localStorage.setItem('cz_session', res.data.session_id);
        onLogin(res.data.user, res.data.session_id);
      } else {
        setError(res.data.error || 'Что-то пошло не так');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[hsl(var(--purple)/0.08)] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[hsl(var(--purple)/0.06)] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm px-6 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--purple))] glow-purple mb-4">
            <span className="text-3xl text-white">✦</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Chill Zone</h1>
          <p className="text-muted-foreground mt-2 text-sm">Общий чат — войди за секунду</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Твоё имя</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Алекс, Маша, Сева..."
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl bg-card border border-border focus:border-[hsl(var(--purple))] focus:ring-2 focus:ring-[hsl(var(--purple)/0.2)] outline-none text-foreground placeholder:text-muted-foreground transition-all text-base"
            />
          </div>

          {/* Code */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Трёхзначный код</label>
            <p className="text-[11px] text-muted-foreground mb-3">Это твой личный код — запомни его, он защищает аккаунт</p>
            <div className="flex gap-3 justify-center">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={codeRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleCodeChange(i, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(i, e)}
                  className="w-16 h-16 text-center text-2xl font-black rounded-2xl bg-card border-2 border-border focus:border-[hsl(var(--purple))] focus:ring-2 focus:ring-[hsl(var(--purple)/0.2)] outline-none text-foreground transition-all"
                />
              ))}
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
            className="w-full py-4 rounded-xl bg-[hsl(var(--purple))] hover:bg-[hsl(var(--purple-dark))] text-white font-bold text-base transition-all duration-200 glow-purple disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? <><Icon name="Loader2" size={18} className="animate-spin" /> Входим...</>
              : <>Войти в чат <Icon name="ArrowRight" size={18} /></>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
