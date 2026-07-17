import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pfunnnhxfosvglhragak.supabase.co';
const supabaseKey = 'sb_publishable_AfVZUVprF95qITdhG0V8cg_NRkQYve1';

export const supabase = createClient(supabaseUrl, supabaseKey);
