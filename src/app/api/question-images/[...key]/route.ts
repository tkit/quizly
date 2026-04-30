import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';

type Params = {
  key: string[];
};

function inferContentTypeFromKey(key: string) {
  const lowerKey = key.toLowerCase();
  if (lowerKey.endsWith('.svg')) return 'image/svg+xml';
  if (lowerKey.endsWith('.png')) return 'image/png';
  if (lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerKey.endsWith('.webp')) return 'image/webp';
  if (lowerKey.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

function normalizeObjectKey(parts: string[]) {
  const objectKey = parts.join('/').replace(/^\/+/, '');
  if (!objectKey || objectKey.includes('..')) return null;
  return objectKey;
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { key } = await params;
  const objectKey = normalizeObjectKey(key);
  if (!objectKey) {
    return NextResponse.json({ error: 'Missing object key' }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const bucket = (env as CloudflareEnv).QUESTION_IMAGES;
  if (!bucket) {
    return NextResponse.json({ error: 'Missing R2 binding QUESTION_IMAGES' }, { status: 500 });
  }

  const object = await bucket.get(objectKey);
  if (!object) {
    return NextResponse.json({ error: 'Question image not found' }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  if (!headers.has('content-type')) {
    headers.set('content-type', inferContentTypeFromKey(objectKey));
  }
  headers.set('cache-control', 'public, max-age=3600');

  return new NextResponse(object.body, { headers });
}
