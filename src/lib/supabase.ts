import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials missing. Check your .env.local file.');
}

const isValidUrl = supabaseUrl && supabaseUrl.startsWith('http');

export const supabase = createClient(
    isValidUrl ? supabaseUrl : 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
);
