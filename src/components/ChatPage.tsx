import { useState, useEffect, useRef, useCallback } from 'react';
import { api, User, Message, fileToBase64 } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface ChatPageProps {
  user: User;
  onOpenProfile: () => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function Avatar({ user, size = 40 }: { user: { display_name: string; avatar_url?: string | null; is_verified?: boolean }; size?: number }) {
  const initials = user.display_name.slice(0, 2).toUpperCase();
  const colors = ['#7C3AED', '#6D28D9', '#5B21B6', '#8B5CF6', '#A78BFA'];
  const color = colors[user.display_name.charCodeAt(0) % colors.length];

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.display_name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold" style={{ background: color, fontSize: size * 0.35 }}>
          {initials}
        </div>
      )}
      {user.is_verified && (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-background">
          <Icon name="Check" size={8} className="text-white" />
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, isOwn, isAdmin, onDelete }: { msg: Message; isOwn: boolean; isAdmin: boolean; onDelete: (id: number) => void }) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`flex gap-2 mb-2 group animate-fade-in ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isOwn && <Avatar user={msg.user} size={32} />}

      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {!isOwn && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs font-semibold text-foreground">{msg.user.display_name}</span>
            {msg.user.is_verified && <Icon name="BadgeCheck" size={12} className="text-blue-500" />}
          </div>
        )}

        <div className={`px-4 py-2.5 relative ${isOwn ? 'message-bubble-own' : 'message-bubble-other'}`}>
          {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>}

          {msg.file_url && msg.file_type === 'image' && (
            <img
              src={msg.file_url}
              alt="Изображение"
              className="max-w-full rounded-xl mt-1 cursor-pointer hover:opacity-90 transition-opacity"
              style={{ maxHeight: 300 }}
              onClick={() => window.open(msg.file_url!, '_blank')}
            />
          )}

          {msg.file_url && msg.file_type === 'video' && (
            <video src={msg.file_url} controls className="max-w-full rounded-xl mt-1" style={{ maxHeight: 300 }} />
          )}

          {msg.file_url && msg.file_type === 'audio' && (
            <audio src={msg.file_url} controls className="mt-1 w-full" />
          )}

          {msg.file_url && msg.file_type === 'file' && (
            <a href={msg.file_url} target="_blank" rel="noreferrer" download={msg.file_name}
              className="flex items-center gap-2 mt-1 text-sm hover:opacity-80 transition-opacity">
              <Icon name="Download" size={16} />
              <span className="underline">{msg.file_name || 'Файл'}</span>
            </a>
          )}

          <span className={`text-[10px] mt-1 block ${isOwn ? 'text-white/60' : 'text-muted-foreground'}`}>
            {formatTime(msg.created_at)}
          </span>
        </div>

        {isAdmin && showActions && (
          <button
            onClick={() => onDelete(msg.id)}
            className="text-[10px] text-destructive hover:text-destructive/80 px-1 transition-colors animate-fade-in"
          >
            Удалить
          </button>
        )}
      </div>
    </div>
  );
}

export default function ChatPage({ user, onOpenProfile, onLogout, isDark, onToggleTheme }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgIdRef = useRef<number>(0);
  const notifPermRef = useRef(false);

  const loadMessages = useCallback(async (initial = false) => {
    const res = await api.messages.list(60);
    if (res.ok) {
      const msgs: Message[] = res.data.messages;
      setMessages(msgs);

      if (msgs.length > 0) {
        const newLastId = msgs[msgs.length - 1].id;
        if (!initial && lastMsgIdRef.current > 0 && newLastId > lastMsgIdRef.current) {
          const newMsgs = msgs.filter(m => m.id > lastMsgIdRef.current && m.user.id !== user.id);
          newMsgs.forEach(m => {
            if (notifPermRef.current && typeof Notification !== 'undefined') {
              new Notification(`${m.user.display_name}`, { body: m.content || '📎 Файл', icon: m.user.avatar_url || undefined });
            }
          });
        }
        lastMsgIdRef.current = newLastId;
      }
    }
  }, [user.id]);

  const loadUsers = useCallback(async () => {
    const res = await api.profile.users();
    if (res.ok) {
      const online = res.data.users.filter((u: { is_online: boolean }) => u.is_online).length;
      setOnlineCount(online);
    }
  }, []);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        notifPermRef.current = true;
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => { notifPermRef.current = p === 'granted'; });
      }
    }

    loadMessages(true);
    loadUsers();

    pollRef.current = setInterval(() => {
      loadMessages();
      loadUsers();
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages, loadUsers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText('');
    const res = await api.messages.send(content);
    if (res.ok) {
      setMessages(prev => [...prev, res.data.message]);
      lastMsgIdRef.current = res.data.message.id;
    }
    setSending(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const uploadRes = await api.upload.file(b64, file.type, file.name);
      if (uploadRes.ok) {
        const { file_url, file_type, file_name } = uploadRes.data;
        const msgRes = await api.messages.send('', file_url, file_type, file_name);
        if (msgRes.ok) {
          setMessages(prev => [...prev, msgRes.data.message]);
          lastMsgIdRef.current = msgRes.data.message.id;
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(id: number) {
    await api.messages.delete(id);
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    const date = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      grouped.push({ date, messages: [msg] });
    }
  });

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--purple))] flex items-center justify-center flex-shrink-0">
            <span className="text-sm text-white">✦</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-base tracking-tight leading-none">Chill Zone</h1>
            <p className="text-[11px] text-muted-foreground">
              {onlineCount > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse-dot" />
                  {onlineCount} онлайн
                </span>
              ) : 'Общий чат'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Icon name={isDark ? 'Sun' : 'Moon'} size={18} />
          </button>

          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
          >
            <Avatar user={user} size={28} />
            <span className="text-sm font-semibold max-w-[100px] truncate">{user.display_name}</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
            <div className="text-5xl">✦</div>
            <p className="text-sm text-muted-foreground">Пока тихо.<br />Напиши первым!</p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">{group.date}</span>
            </div>
            {group.messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.user.id === user.id}
                isAdmin={user.is_admin}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-md">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-[hsl(var(--purple))] disabled:opacity-50"
          >
            {uploading ? <Icon name="Loader2" size={18} className="animate-spin" /> : <Icon name="Paperclip" size={18} />}
          </button>

          <div className="flex-1 relative">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent); } }}
              placeholder="Написать сообщение..."
              rows={1}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-transparent focus:border-[hsl(var(--purple))] focus:ring-2 focus:ring-[hsl(var(--purple)/0.15)] outline-none text-foreground placeholder:text-muted-foreground resize-none transition-all text-sm leading-relaxed"
              style={{ minHeight: 40, maxHeight: 120 }}
            />
          </div>

          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-[hsl(var(--purple))] hover:bg-[hsl(var(--purple-dark))] flex items-center justify-center transition-all glow-purple disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending
              ? <Icon name="Loader2" size={18} className="animate-spin text-white" />
              : <Icon name="Send" size={16} className="text-white" />
            }
          </button>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );
}