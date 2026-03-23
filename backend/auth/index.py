"""
Аутентификация: регистрация, вход, выход, получение текущего пользователя
"""
import json
import os
import hashlib
import secrets
import psycopg2
from datetime import datetime, timezone

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

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
        # POST /register
        if method == 'POST' and path.endswith('/register'):
            username = body.get('username', '').strip().lower()
            password = body.get('password', '')
            display_name = body.get('display_name', username).strip()

            if not username or not password:
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Укажите логин и пароль'})}

            if len(username) < 3:
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Логин минимум 3 символа'})}

            cur.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cur.fetchone():
                return {'statusCode': 409, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Такой логин уже занят'})}

            pw_hash = hash_password(password)
            cur.execute(
                "INSERT INTO users (username, password_hash, display_name) VALUES (%s, %s, %s) RETURNING id",
                (username, pw_hash, display_name)
            )
            user_id = cur.fetchone()[0]

            token = secrets.token_hex(32)
            cur.execute(
                "INSERT INTO sessions (id, user_id) VALUES (%s, %s)",
                (token, user_id)
            )
            conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'session_id': token, 'user': {'id': user_id, 'username': username, 'display_name': display_name, 'is_verified': False, 'is_admin': False, 'avatar_url': None}})
            }

        # POST /login
        if method == 'POST' and path.endswith('/login'):
            username = body.get('username', '').strip().lower()
            password = body.get('password', '')

            cur.execute("SELECT id, password_hash, display_name, is_verified, is_admin, avatar_url FROM users WHERE username = %s", (username,))
            row = cur.fetchone()
            if not row or row[1] != hash_password(password):
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Неверный логин или пароль'})}

            user_id, _, display_name, is_verified, is_admin, avatar_url = row
            token = secrets.token_hex(32)
            cur.execute("INSERT INTO sessions (id, user_id) VALUES (%s, %s)", (token, user_id))
            cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (user_id,))
            conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'session_id': token, 'user': {'id': user_id, 'username': username, 'display_name': display_name, 'is_verified': is_verified, 'is_admin': is_admin, 'avatar_url': avatar_url}})
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