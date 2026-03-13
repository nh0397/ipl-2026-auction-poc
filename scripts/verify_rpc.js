const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://iujqohkwnoqvmpxhbzec.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1anFvaGt3bm9xdm1weGhiemVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzAxOTIsImV4cCI6MjA4ODY0NjE5Mn0.aVlTAHWOXlui65bvsSWqoLGuUmE8d2IJ9pnupi0y2QE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
    console.log('Checking place_bid RPC...');
    const { data, error } = await supabase.rpc('place_bid', {
        p_player_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        p_bidder_id: '00000000-0000-0000-0000-000000000000',
        p_bidder_name: 'TEST',
        p_amount: 0
    });

    if (error) {
        if (error.message.includes('Could not find')) {
            console.error('❌ RPC NOT FOUND:', error.message);
        } else {
            // Player mismatch is expected for dummy data, so any error OTHER than "not found" means it exists
            console.log('✅ RPC EXISTS (Received expected error):', error.message);
        }
    } else {
        console.log('✅ RPC SUCCESS:', data);
    }
}

checkRpc();
