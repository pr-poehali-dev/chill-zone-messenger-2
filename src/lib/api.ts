const URLS = {
  auth: 'https://functions.poehali.dev/38b29a68-00a8-4e8b-8e76-79b6cf841daa',
  messages: 'https://functions.poehali.dev/80d8cda3-68b1-49d7-9976-df6b1a8242a3',
  profile: 'https://functions.poehali.dev/061016b3-0c66-4263-b9dc-c54f1bd78fcd',
  upload: 'https://functions.poehali.dev/1c0da02d-d53b-4e55-8fc9-44b45600bfd0',
};

function getSession(): string {
  return localStorage.getItem('cz_session') || '';
}

async function req(url: string, method = 'GET', body?: object) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': getSession(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: res.ok, status: res.status, data: { error: text } };
  }
}

export const api = {
  auth: {
    guest: () => req(`${URLS.auth}/`, 'POST', { guest: true }),
    enter: (display_name: string, code: string) =>
      req(`${URLS.auth}/enter`, 'POST', { display_name, code }),
    logout: () => req(`${URLS.auth}/logout`, 'POST'),
    me: () => req(`${URLS.auth}/me`, 'GET'),
  },
  messages: {
    list: (limit = 50, before_id?: number) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (before_id) params.set('before_id', String(before_id));
      return req(`${URLS.messages}/?${params}`);
    },
    send: (content: string, file_url?: string, file_type?: string, file_name?: string) =>
      req(`${URLS.messages}/`, 'POST', { content, file_url, file_type, file_name }),
    delete: (message_id: number) =>
      req(`${URLS.messages}/delete`, 'POST', { message_id }),
  },
  profile: {
    users: () => req(`${URLS.profile}/users`),
    update: (display_name: string) =>
      req(`${URLS.profile}/update`, 'PUT', { display_name }),
    uploadAvatar: (image_data: string, content_type: string) =>
      req(`${URLS.profile}/avatar`, 'POST', { image_data, content_type }),
    verify: (user_id: number, verified: boolean) =>
      req(`${URLS.profile}/verify`, 'POST', { user_id, verified }),
    makeAdmin: (user_id: number, is_admin: boolean) =>
      req(`${URLS.profile}/make-admin`, 'POST', { user_id, is_admin }),
  },
  upload: {
    file: (file_data: string, content_type: string, file_name: string) =>
      req(`${URLS.upload}/`, 'POST', { file_data, content_type, file_name }),
  },
};

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export type User = {
  id: number;
  username: string;
  display_name: string;
  is_verified: boolean;
  is_admin: boolean;
  avatar_url: string | null;
  last_seen?: string;
  is_online?: boolean;
};

export type Message = {
  id: number;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
  created_at: string;
  user: Omit<User, 'last_seen' | 'is_online'>;
};