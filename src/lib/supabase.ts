import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slmyyqbjfdxejwhwtmup.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbXl5cWJqZmR4ZWp3aHd0bXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NTY3ODMsImV4cCI6MjEwNTIzMjc4M30.3GXjqstFPIh-Ec0dKmTXb_8wMRhPYE4_m4ymBL-Dt2A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
