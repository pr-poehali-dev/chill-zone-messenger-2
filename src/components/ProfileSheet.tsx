import { useState, useRef } from 'react';
import { api, User, fileToBase64 } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface ProfileSheetProps {
  user: User;
  onClose: () => void;
  onUserUpdate: (u: User) => void;
  onLogout: () => void;
}

function Avatar({ user, size = 80 }: { user: User; size?: number }) {
  const initials = user.display_name.slice(0, 2).toUpperCase();
  const colors = ['#7C3AED', '#6D28D9', '#5B21B6', '#8B5CF6', '#A78BFA'];
  const color = colors[user.display_name.charCodeAt(0) % colors.length];

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.display_name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ background: color }}>
          {initials}
        </div>
      )}
      {user.is_verified && (
        <div className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-background">
          <Icon name="Check" size={12} className="text-white" />
        </div>
      )}
    </div>
  );
}

export default function ProfileSheet({ user, onClose, onUserUpdate, onLogout }: ProfileSheetProps) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [adminCode, setAdminCode] = useState('');
  const [adminError, setAdminError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'profile' | 'admin'>('profile');
  const [users, setUsers] = useState<(User & { is_online: boolean })[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!displayName.trim() || saving) return;
    setSaving(true);
    const res = await api.profile.update(displayName.trim());
    if (res.ok) {
      onUserUpdate({ ...user, display_name: displayName.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await api.profile.uploadAvatar(b64, file.type);
      if (res.ok) {
        onUserUpdate({ ...user, avatar_url: res.data.avatar_url });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleAdminCode() {
    if (adminCode === '2356') {
      setTab('admin');
      setAdminError('');
      loadUsers();
    } else {
      setAdminError('Неверный код');
    }
    setAdminCode('');
  }

  async function loadUsers() {
    setLoadingUsers(true);
    const res = await api.profile.users();
    if (res.ok) setUsers(res.data.users);
    setLoadingUsers(false);
  }

  async function toggleVerify(uid: number, current: boolean) {
    await api.profile.verify(uid, !current);
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, is_verified: !current } : u));
  }

  async function toggleAdmin(uid: number, current: boolean) {
    await api.profile.makeAdmin(uid, !current);
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, is_admin: !current } : u));
  }

  const isAdminMode = user.is_admin || tab === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-black text-lg">Профиль</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar user={user} size={72} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-foreground">{user.display_name}</span>
                {user.is_verified && <Icon name="BadgeCheck" size={16} className="text-blue-500" />}
                {user.is_admin && <span className="text-[10px] bg-[hsl(var(--purple)/0.15)] text-[hsl(var(--purple))] px-2 py-0.5 rounded-full font-semibold">Админ</span>}
              </div>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mt-2 text-xs text-[hsl(var(--purple))] hover:text-[hsl(var(--purple-dark))] font-semibold flex items-center gap-1 transition-colors"
              >
                {uploading ? <><Icon name="Loader2" size={12} className="animate-spin" /> Загрузка...</> : <><Icon name="Camera" size={12} /> Сменить фото</>}
              </button>
            </div>
          </div>

          {/* Edit name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Имя в чате</label>
            <div className="flex gap-2">
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl bg-muted border border-transparent focus:border-[hsl(var(--purple))] outline-none text-foreground text-sm transition-all"
              />
              <button
                onClick={handleSave}
                disabled={saving || displayName === user.display_name}
                className="px-4 py-2.5 rounded-xl bg-[hsl(var(--purple))] hover:bg-[hsl(var(--purple-dark))] text-white text-sm font-semibold transition-all disabled:opacity-40"
              >
                {saving ? <Icon name="Loader2" size={14} className="animate-spin" /> : saved ? '✓' : 'Сохранить'}
              </button>
            </div>
          </div>

          {/* Admin code (если не admin) */}
          {!isAdminMode && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Код администратора</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={adminCode}
                  onChange={e => setAdminCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminCode()}
                  placeholder="••••"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-muted border border-transparent focus:border-[hsl(var(--purple))] outline-none text-foreground text-sm transition-all"
                />
                <button
                  onClick={handleAdminCode}
                  className="px-4 py-2.5 rounded-xl bg-muted hover:bg-[hsl(var(--purple)/0.1)] text-foreground text-sm font-semibold transition-all border border-border"
                >
                  Войти
                </button>
              </div>
              {adminError && <p className="text-xs text-destructive mt-1">{adminError}</p>}
            </div>
          )}

          {/* Admin panel */}
          {isAdminMode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="ShieldCheck" size={16} className="text-[hsl(var(--purple))]" />
                <span className="font-bold text-sm">Панель администратора</span>
              </div>
              {loadingUsers
                ? <div className="flex justify-center py-4"><Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" /></div>
                : users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{u.display_name}</span>
                        {u.is_verified && <Icon name="BadgeCheck" size={12} className="text-blue-500 flex-shrink-0" />}
                        {u.is_online && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleVerify(u.id, u.is_verified)}
                        title={u.is_verified ? 'Снять верификацию' : 'Выдать верификацию'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${u.is_verified ? 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30' : 'bg-muted text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10'}`}
                      >
                        <Icon name="BadgeCheck" size={14} />
                      </button>
                      {u.id !== user.id && (
                        <button
                          onClick={() => toggleAdmin(u.id, u.is_admin)}
                          title={u.is_admin ? 'Снять права' : 'Сделать админом'}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${u.is_admin ? 'bg-[hsl(var(--purple)/0.2)] text-[hsl(var(--purple))] hover:bg-[hsl(var(--purple)/0.3)]' : 'bg-muted text-muted-foreground hover:text-[hsl(var(--purple))] hover:bg-[hsl(var(--purple)/0.1)]'}`}
                        >
                          <Icon name="Shield" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full py-3 rounded-xl border border-border hover:bg-destructive/10 hover:border-destructive/30 text-destructive text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            <Icon name="LogOut" size={16} />
            Выйти из аккаунта
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      </div>
    </div>
  );
}
