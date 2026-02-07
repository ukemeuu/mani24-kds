import { createClient } from '@supabase/supabase-js';
// Removed dotenv, use process.env from shell or --env-file

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing URL or Key');
    process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
    console.log(`Connecting to ${url}...`);
    const { data, error } = await supabase.from('orders').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('Error connecting:', error);
    } else {
        console.log('Connection successful!');
        console.log('Orders table exists. Row count:', data); // data is null for head: true mostly, use count
    }
}

test();
