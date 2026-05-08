import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'aware_auth_v4'
  }
});

export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error signing in with Google', error);
    throw error;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  table: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export async function handleDatabaseError(error: any, operationType: OperationType, table: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  const errInfo: DatabaseErrorInfo = {
    error: error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error)),
    authInfo: {
      userId: user?.id,
      email: user?.email,
    },
    operationType,
    table
  }
  const serialized = JSON.stringify(errInfo);
  console.error('Database Error: ', serialized);
  throw new Error(serialized);
}
