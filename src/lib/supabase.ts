import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (window as any).VITE_SUPABASE_URL && (window as any).VITE_SUPABASE_URL !== "__VITE_SUPABASE_URL__"
    ? (window as any).VITE_SUPABASE_URL
    : import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey = (window as any).VITE_SUPABASE_ANON_KEY && (window as any).VITE_SUPABASE_ANON_KEY !== "__VITE_SUPABASE_ANON_KEY__"
    ? (window as any).VITE_SUPABASE_ANON_KEY
    : import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
} else {
    console.log('Supabase initialized with URL:', supabaseUrl.substring(0, 15) + '...');
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);
