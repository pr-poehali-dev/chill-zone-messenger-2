"""
Загрузка файлов (фото, видео, музыка, документы) в S3
"""
import json
import os
import base64
import uuid
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
        SELECT u.id, u.username FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.id = %s AND s.expires_at > NOW()
    """, (session_id,))
    row = cur.fetchone()
    return {'id': row[0], 'username': row[1]} if row else None

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    session_id = event.get('headers', {}).get('x-session-id', '')
    body = json.loads(event.get('body') or '{}')

    conn = get_conn()
    cur = conn.cursor()

    try:
        user = get_user_from_session(cur, session_id)
        if not user:
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}

        file_data = body.get('file_data', '')
        content_type = body.get('content_type', 'application/octet-stream')
        file_name = body.get('file_name', 'file')

        file_bytes = base64.b64decode(file_data)
        file_id = str(uuid.uuid4())

        if 'image' in content_type:
            folder = 'images'
            file_type = 'image'
        elif 'video' in content_type:
            folder = 'videos'
            file_type = 'video'
        elif 'audio' in content_type:
            folder = 'audio'
            file_type = 'audio'
        else:
            folder = 'files'
            file_type = 'file'

        ext = file_name.rsplit('.', 1)[-1] if '.' in file_name else 'bin'
        file_key = f"chat/{folder}/{file_id}.{ext}"

        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
        )
        s3.put_object(Bucket='files', Key=file_key, Body=file_bytes, ContentType=content_type)
        file_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{file_key}"

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'file_url': file_url, 'file_type': file_type, 'file_name': file_name})
        }

    finally:
        cur.close()
        conn.close()
