"""
Аутентификация: гостевой вход, выход, получение текущего пользователя
"""
import json
import os
import secrets
import random
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

    method = event.get('httpMethod', 'GET')
    body = json.loads(event.get('body') or '{}')
    session_id = event.get('headers', {}).get('x-session-id', '')
    action = body.get('action', '')

    conn = get_conn()
    cur = conn.cursor()

    try:
        # GET / — текущий пользователь
        if method == 'GET':
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
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'user': {'id': row[0], 'username': row[1], 'display_name': row[2], 'is_verified': row[3], 'is_admin': row[4], 'avatar_url': row[5]}})}

        # POST / — гостевой вход или выход
        if method == 'POST':
            # Выход
            if action == 'logout':
                if session_id:
                    cur.execute("UPDATE sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
                    conn.commit()
                return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True})}

            # Гостевой вход (guest: true или нет action)
            num = random.randint(1000, 9999)
            display_name = f'Гость{num}'
            username = f'guest_{num}_{secrets.token_hex(4)}'

            cur.execute(
                "INSERT INTO users (username, password_hash, display_name) VALUES (%s, %s, %s) RETURNING id",
                (username, '', display_name)
            )
            user_id = cur.fetchone()[0]
            token = secrets.token_hex(32)
            cur.execute("INSERT INTO sessions (id, user_id) VALUES (%s, %s)", (token, user_id))
            cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (user_id,))
            conn.commit()

            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({
                'session_id': token,
                'user': {'id': user_id, 'username': username, 'display_name': display_name, 'is_verified': False, 'is_admin': False, 'avatar_url': None}
            })}

        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}

    finally:
        cur.close()
        conn.close()
