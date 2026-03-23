import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  deleteRedisKey,
  expireRedisKey,
  getRedisString,
  getRedisTtl,
  incrementRedisKey,
  isUpstashConfigured,
  setRedisString,
} from '@/lib/cache/upstash';

const SESSION_TTL_SECONDS = 15 * 60;
const ATTEMPT_WINDOW_SECONDS = 10 * 60;
const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 5 * 60;

function buildSessionKey(guardianId: string) {
  return `quizly:parent_reauth:session:${guardianId}`;
}

function buildGuardianAttemptKey(guardianId: string) {
  return `quizly:parent_reauth:attempts:guardian:${guardianId}`;
}

function buildIpAttemptKey(ipHash: string) {
  return `quizly:parent_reauth:attempts:ip:${ipHash}`;
}

function buildCooldownKey(guardianId: string) {
  return `quizly:parent_reauth:cooldown:${guardianId}`;
}

function hashIpAddress(ipAddress: string) {
  return createHash('sha256').update(ipAddress).digest('hex').slice(0, 16);
}

function extractClientIp(rawIp: string | null) {
  if (!rawIp) return null;
  return rawIp.split(',')[0]?.trim() ?? null;
}

async function writeSessionToDatabase(supabase: SupabaseClient, guardianId: string, expiresAt: string) {
  const { error } = await supabase.from('parent_reauth_challenges').insert({
    guardian_id: guardianId,
    expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }
}

async function clearSessionFromDatabase(supabase: SupabaseClient, guardianId: string) {
  const { error } = await supabase.from('parent_reauth_challenges').delete().eq('guardian_id', guardianId);

  if (error) {
    throw error;
  }
}

async function readSessionFromDatabase(supabase: SupabaseClient, guardianId: string) {
  const { data, error } = await supabase
    .from('parent_reauth_challenges')
    .select('expires_at')
    .eq('guardian_id', guardianId)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.expires_at ?? null;
}

export async function createParentReauthSession(supabase: SupabaseClient, guardianId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  if (isUpstashConfigured()) {
    try {
      await setRedisString(buildSessionKey(guardianId), expiresAt, SESSION_TTL_SECONDS);
      return expiresAt;
    } catch (error) {
      console.warn('Failed to create parent reauth session in Redis. Falling back to database.', error);
    }
  }

  await writeSessionToDatabase(supabase, guardianId, expiresAt);
  return expiresAt;
}

export async function clearParentReauthSession(supabase: SupabaseClient, guardianId: string) {
  if (isUpstashConfigured()) {
    try {
      await deleteRedisKey(buildSessionKey(guardianId));
      return;
    } catch (error) {
      console.warn('Failed to clear parent reauth session in Redis. Falling back to database.', error);
    }
  }

  await clearSessionFromDatabase(supabase, guardianId);
}

export async function getParentReauthSessionExpiresAt(supabase: SupabaseClient, guardianId: string) {
  if (isUpstashConfigured()) {
    try {
      const expiresAt = await getRedisString(buildSessionKey(guardianId));
      return expiresAt;
    } catch (error) {
      console.warn('Failed to read parent reauth session in Redis. Falling back to database.', error);
    }
  }

  return readSessionFromDatabase(supabase, guardianId);
}

export async function isParentReauthUnlocked(supabase: SupabaseClient, guardianId: string) {
  const expiresAt = await getParentReauthSessionExpiresAt(supabase, guardianId);
  return Boolean(expiresAt);
}

export async function getParentPinCooldownSeconds(guardianId: string) {
  if (!isUpstashConfigured()) {
    return 0;
  }

  try {
    const ttl = await getRedisTtl(buildCooldownKey(guardianId));
    if (typeof ttl !== 'number' || ttl < 0) {
      return 0;
    }

    return ttl;
  } catch (error) {
    console.warn('Failed to get parent PIN cooldown from Redis. Ignoring cooldown.', error);
    return 0;
  }
}

export async function clearParentPinAttemptState(guardianId: string, rawIp: string | null) {
  if (!isUpstashConfigured()) {
    return;
  }

  try {
    const clientIp = extractClientIp(rawIp);
    const keys = [buildGuardianAttemptKey(guardianId), buildCooldownKey(guardianId)];

    if (clientIp) {
      keys.push(buildIpAttemptKey(hashIpAddress(clientIp)));
    }

    await Promise.all(keys.map((key) => deleteRedisKey(key)));
  } catch (error) {
    console.warn('Failed to clear parent PIN attempt state in Redis.', error);
  }
}

export async function registerParentPinFailure(guardianId: string, rawIp: string | null) {
  if (!isUpstashConfigured()) {
    return { locked: false, retryAfterSeconds: 0 };
  }

  try {
    const clientIp = extractClientIp(rawIp);
    const guardianKey = buildGuardianAttemptKey(guardianId);
    const cooldownKey = buildCooldownKey(guardianId);

    const guardianAttempts = await incrementRedisKey(guardianKey);
    if (guardianAttempts === 1) {
      await expireRedisKey(guardianKey, ATTEMPT_WINDOW_SECONDS);
    }

    let ipAttempts = 0;
    if (clientIp) {
      const ipKey = buildIpAttemptKey(hashIpAddress(clientIp));
      ipAttempts = await incrementRedisKey(ipKey);
      if (ipAttempts === 1) {
        await expireRedisKey(ipKey, ATTEMPT_WINDOW_SECONDS);
      }
    }

    const shouldCooldown = guardianAttempts >= MAX_FAILED_ATTEMPTS || ipAttempts >= MAX_FAILED_ATTEMPTS;

    if (!shouldCooldown) {
      return { locked: false, retryAfterSeconds: 0 };
    }

    await setRedisString(cooldownKey, '1', COOLDOWN_SECONDS);
    return { locked: true, retryAfterSeconds: COOLDOWN_SECONDS };
  } catch (error) {
    console.warn('Failed to register parent PIN failure in Redis. Skipping rate limit update.', error);
    return { locked: false, retryAfterSeconds: 0 };
  }
}
