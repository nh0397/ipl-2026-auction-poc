const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: config } = await supabase.from('auction_config').select('*').single();
  console.log('Auction Config:', config);
  const { data: profiles } = await supabase.from('profiles').select('id, team_name, budget').limit(5);
  console.log('Profiles:', profiles);
  const { data: players } = await supabase.from('players').select('player_name, sold_to, sold_price').not('sold_to', 'is', null).limit(10);
  console.log('Sold Players:', players);
}
check();
