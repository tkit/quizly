import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getOptionalD1Database(): Promise<D1Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.DB ?? null;
  } catch {
    return null;
  }
}
