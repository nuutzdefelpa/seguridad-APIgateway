import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const options = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
};

export const publicClient = createClient(env.supabaseUrl, env.supabaseAnonKey, options);
export const adminClient = createClient(env.supabaseUrl, env.supabaseSecretKey, options);

export async function getCurrentUserFromAccessToken(accessToken: string) {
  const { data, error } = await publicClient.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    throw new Error('Invalid or expired token');
  }

  const email = data.user.email.toLowerCase();
  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found');
  }

  return {
    authUserId: data.user.id,
    email,
    profile,
  };
}

export async function hasPermission(userId: string, permissionCode: string, groupId?: string | null) {
  const { data, error } = await adminClient.rpc('user_has_permission', {
    p_user_id: userId,
    p_permission_code: permissionCode,
    p_group_id: groupId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function getTicketGroupId(ticketId: string) {
  const { data, error } = await adminClient.from('tickets').select('group_id').eq('id', ticketId).single();
  if (error || !data) {
    throw new Error('Ticket not found');
  }

  return data.group_id as string;
}
