import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createServerSupabaseClientWithToken(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function getUserFromBearerHeader(authorization: string | null) {
  if (!authorization?.startsWith('Bearer ')) {
    return { user: null, accessToken: null };
  }

  const accessToken = authorization.slice('Bearer '.length).trim();
  if (!accessToken) {
    return { user: null, accessToken: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return { user: null, accessToken: null };
  }

  return { user: data.user, accessToken };
}
