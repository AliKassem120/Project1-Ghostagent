const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteAllUsers() {
  console.log('Fetching users...');
  
  try {
    // Note: listUsers() paginates, but for a dev environment wiping it usually gets enough.
    // If there are more than 50 users, we can loop, but let's just grab up to 1000.
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    
    if (listError) {
      throw listError;
    }
    
    console.log(`Found ${users.length} users. Starting deletion...`);
    
    let deletedCount = 0;
    for (const user of users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`Failed to delete user ${user.id}:`, deleteError.message);
      } else {
        console.log(`Deleted user: ${user.email || user.id}`);
        deletedCount++;
      }
    }
    
    console.log(`\nSuccessfully deleted ${deletedCount} users.`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

deleteAllUsers();
