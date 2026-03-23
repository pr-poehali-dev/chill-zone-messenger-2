"""
Аутентификация: вход/регистрация по имени и трёхзначному коду
"""
import json
import os
import hashlib
import secrets
import psycopg2

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    path = event.get('path', '/')
    method = event.get('httpMethod', 'GET')
    body = json.loads(event.get('body') or '{}')
    session_id = event.get('headers', {}).get('x-session-id', '')

    conn = get_conn()
    cur = conn.cursor()

    try:
        # POST /enter — вход или авторегистрация по имени + коду
        if method == 'POST' and (path.endswith('/enter') or path.endswith('/login') or path.endswith('/register')):
            display_name = body.get('display_name', '').strip()
            code = str(body.get('code', '')).strip()

            if not display_name:
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Введи своё имя'})}
            if len(code) != 3 or not code.isdigit():
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Код должен быть трёхзначным числом'})}

            # username = имя_нижний_регистр + код, уникальный идентификатор
            username = display_name.lower().replace(' ', '_') + '_' + code

            cur.execute("SELECT id, display_name, is_verified, is_admin, avatar_url FROM users WHERE username = %s", (username,))
            row = cur.fetchone()

            if row:
                user_id, dn, is_verified, is_admin, avatar_url = row
            else:
                # Новый пользователь — создаём
                cur.execute(
                    "INSERT INTO users (username, password_hash, display_name) VALUES (%s, %s, %s) RETURNING id",
                    (username, '', display_name)
                )
                user_id = cur.fetchone()[0]
                is_verified, is_admin, avatar_url = False, False, None
                dn = display_name

            token = secrets.token_hex(32)
            cur.execute("INSERT INTO sessions (id, user_id) VALUES (%s, %s)", (token, user_id))
            cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (user_id,))
            conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'session_id': token, 'user': {'id': user_id, 'username': username, 'display_name': dn, 'is_verified': is_verified, 'is_admin': is_admin, 'avatar_url': avatar_url}})
            }

        # POST /logout
        if method == 'POST' and path.endswith('/logout'):
            if session_id:
                cur.execute("UPDATE sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
                conn.commit()
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True})}

        # GET / or /me
        if method == 'GET' and (path.endswith('/me') or path == '/'):
            if not session_id:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}

            cur.execute("""
                SELECT u.id, u.username, u.display_name, u.is_verified, u.is_admin, u.avatar_url
                FROM sessions s JOIN users u ON s.user_id = u.id
                WHERE s.id = %s AND s.expires_at > NOW()
            """, (session_id,))
            row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}

            cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (row[0],))
            conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'user': {'id': row[0], 'username': row[1], 'display_name': row[2], 'is_verified': row[3], 'is_admin': row[4], 'avatar_url': row[5]}})
            }

        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}

    finally:
        cur.close()
        conn.close()