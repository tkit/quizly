const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isUpstashConfigured() {
  return Boolean(upstashUrl && upstashToken);
}

type UpstashResponse<T> = {
  result?: T;
  error?: string;
};

async function executeUpstashCommand<T>(command: Array<string | number>): Promise<T | null> {
  if (!upstashUrl || !upstashToken) {
    return null;
  }

  const response = await fetch(upstashUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Upstash command failed: ${response.status}`);
  }

  const json = (await response.json()) as UpstashResponse<T>;
  if (json.error) {
    throw new Error(json.error);
  }

  return json.result ?? null;
}

export async function getRedisString(key: string) {
  const result = await executeUpstashCommand<string>(['GET', key]);
  return result;
}

export async function setRedisString(key: string, value: string, ttlSeconds: number) {
  const result = await executeUpstashCommand<string>(['SET', key, value, 'EX', ttlSeconds]);
  return result;
}

export async function setRedisStringIfNotExists(key: string, value: string, ttlSeconds: number) {
  const result = await executeUpstashCommand<string>(['SET', key, value, 'EX', ttlSeconds, 'NX']);
  return result === 'OK';
}

export async function deleteRedisKey(key: string) {
  const result = await executeUpstashCommand<number>(['DEL', key]);
  return result ?? 0;
}

export async function incrementRedisKey(key: string) {
  const result = await executeUpstashCommand<number>(['INCR', key]);
  return result ?? 0;
}

export async function expireRedisKey(key: string, ttlSeconds: number) {
  const result = await executeUpstashCommand<number>(['EXPIRE', key, ttlSeconds]);
  return result ?? 0;
}

export async function getRedisTtl(key: string) {
  const result = await executeUpstashCommand<number>(['TTL', key]);
  return result;
}
