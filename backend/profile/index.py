"""
Профиль: список пользователей, обновление имени, загрузка аватара, верификация (admin)
"""
import json
import os
import base64
import boto3
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
    session_id = event.get('headers', {}).get('x-session-id', '')
    body = json.loads(event.get('body') or '{}')
    action = body.get('action', '')

    conn = get_conn()
    cur = conn.cursor()

    try:
        user = get_user_from_session(cur, session_id)

        # GET / — список всех пользователей
        if method == 'GET':
            cur.execute("SELECT id, username, display_name, is_verified, is_admin, avatar_url, last_seen FROM users ORDER BY last_seen DESC")
            rows = cur.fetchall()
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            users = []
            for r in rows:
                last_seen = r[6]
                if last_seen and last_seen.tzinfo is None:
                    last_seen = last_seen.replace(tzinfo=timezone.utc)
                is_online = last_seen and (now - last_seen).total_seconds() < 120
                users.append({
                    'id': r[0], 'username': r[1], 'display_name': r[2], 'is_verified': r[3], 'is_admin': r[4],
                    'avatar_url': r[5], 'last_seen': last_seen.isoformat() if last_seen else None, 'is_online': is_online
                })
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'users': users})}

        if method == 'POST':
            if not user:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}

            # Обновить имя
            if action == 'update':
                display_name = body.get('display_name', '').strip()
                if display_name:
                    cur.execute("UPDATE users SET display_name = %s WHERE id = %s", (display_name, user['id']))
                    conn.commit()
                cur.execute("SELECT id, username, display_name, is_verified, is_admin, avatar_url FROM users WHERE id = %s", (user['id'],))
                r = cur.fetchone()
                return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'user': {'id': r[0], 'username': r[1], 'display_name': r[2], 'is_verified': r[3], 'is_admin': r[4], 'avatar_url': r[5]}})}

            # Загрузить аватар
            if action == 'avatar':
                image_data = body.get('image_data', '')
                content_type = body.get('content_type', 'image/jpeg')
                image_bytes = base64.b64decode(image_data)
                ext = 'jpg' if 'jpeg' in content_type else 'png'
                file_key = f"avatars/user_{user['id']}.{ext}"
                s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
                s3.put_object(Bucket='files', Key=file_key, Body=image_bytes, ContentType=content_type)
                avatar_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{file_key}"
                cur.execute("UPDATE users SET avatar_url = %s WHERE id = %s", (avatar_url, user['id']))
                conn.commit()
                return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'avatar_url': avatar_url})}

            # Верификация (только admin)
            if action == 'verify':
                if not user['is_admin']:
                    return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Нет прав'})}
                target_id = body.get('user_id')
                verified = body.get('verified', True)
                cur.execute("UPDATE users SET is_verified = %s WHERE id = %s", (verified, target_id))
                conn.commit()
                return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True})}

            # Назначить/снять админа
            if action == 'make-admin':
                if not user['is_admin']:
                    return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Нет прав'})}
                target_id = body.get('user_id')
                is_admin = body.get('is_admin', True)
                cur.execute("UPDATE users SET is_admin = %s WHERE id = %s", (is_admin, target_id))
                conn.commit()
                return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True})}

        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}

    finally:
        cur.close()
        conn.close()
