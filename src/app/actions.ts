'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function updateUserAvatar(userId: string, iconUrl: string) {
  const { error } = await supabase
    .from('users')
    .update({ icon_url: iconUrl })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user avatar:', error);
    return { success: false, error: error.message };
  }

  // Revalidate the home page so the new avatar shows up immediately
  revalidatePath('/');
  return { success: true };
}
