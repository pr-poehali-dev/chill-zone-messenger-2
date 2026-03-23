"""
Сообщения: получение истории, отправка, удаление (для администратора)
"""
import json
import os
import psycopg2

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def get_user_from_session(cur, session_id):
    if not session_id:
        return None
    cur.execute("""
        SELECT u.id, u.username, u.display_name, u.is_verified, u.is_admin, u.avatar_url
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.id = %s AND s.expires_at > NOW()
    """, (session_id,))
    row = cur.fetchone()
    if not row:
        return None
    return {'id': row[0], 'username': row[1], 'display_name': row[2], 'is_verified': row[3], 'is_admin': row[4], 'avatar_url': row[5]}

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    session_id = event.get('headers', {}).get('x-session-id', '')
    body = json.loads(event.get('body') or '{}')
    params = event.get('queryStringParameters') or {}

    conn = get_conn()
    cur = conn.cursor()

    try:
        user = get_user_from_session(cur, session_id)

        # GET / — история сообщений
        if method == 'GET':
            limit = int(params.get('limit', 50))
            before_id = params.get('before_id')

            if before_id:
                cur.execute("""
                    SELECT m.id, m.content, m.file_url, m.file_type, m.file_name, m.created_at,
                           u.id, u.username, u.display_name, u.is_verified, u.avatar_url
                    FROM messages m JOIN users u ON m.user_id = u.id
                    WHERE m.id < %s
                    ORDER BY m.created_at DESC LIMIT %s
                """, (before_id, limit))
            else:
                cur.execute("""
                    SELECT m.id, m.content, m.file_url, m.file_type, m.file_name, m.created_at,
                           u.id, u.username, u.display_name, u.is_verified, u.avatar_url
                    FROM messages m JOIN users u ON m.user_id = u.id
                    ORDER BY m.created_at DESC LIMIT %s
                """, (limit,))

            rows = cur.fetchall()
            messages = []
            for r in rows:
                messages.append({
                    'id': r[0],
                    'content': r[1],
                    'file_url': r[2],
                    'file_type': r[3],
                    'file_name': r[4],
                    'created_at': r[5].isoformat() if r[5] else None,
                    'user': {
                        'id': r[6],
                        'username': r[7],
                        'display_name': r[8],
                        'is_verified': r[9],
                        'avatar_url': r[10]
                    }
                })
            messages.reverse()

            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'messages': messages})}

        # POST / — отправить сообщение
        if method == 'POST' and not path.endswith('/delete'):
            if not user:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}

            content = body.get('content', '').strip()
            file_url = body.get('file_url')
            file_type = body.get('file_type')
            file_name = body.get('file_name')

            if not content and not file_url:
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Пустое сообщение'})}

            cur.execute(
                "INSERT INTO messages (user_id, content, file_url, file_type, file_name) VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at",
                (user['id'], content or None, file_url, file_type, file_name)
            )
            msg_id, created_at = cur.fetchone()
            conn.commit()

            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'message': {
                        'id': msg_id,
                        'content': content,
                        'file_url': file_url,
                        'file_type': file_type,
                        'file_name': file_name,
                        'created_at': created_at.isoformat(),
                        'user': {
                            'id': user['id'],
                            'username': user['username'],
                            'display_name': user['display_name'],
                            'is_verified': user['is_verified'],
                            'avatar_url': user['avatar_url']
                        }
                    }
                })
            }

        # POST /delete — удалить сообщение (только admin)
        if method == 'POST' and path.endswith('/delete'):
            if not user or not user['is_admin']:
                return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Нет прав'})}

            msg_id = body.get('message_id')
            cur.execute("UPDATE messages SET content = NULL, file_url = NULL WHERE id = %s", (msg_id,))
            conn.commit()
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True})}

        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}

    finally:
        cur.close()
        conn.close()
