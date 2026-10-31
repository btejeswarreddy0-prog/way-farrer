(() => {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Supabase JavaScript did not load. Check your internet connection and reload.');
  }

  const projectUrl = 'https://qthlhzlchapzvcqobata.supabase.co';
  const publishableKey = 'sb_publishable_hVgZrGHQjZQoHwfP4t0h8A_6AFEQr9n';

  window.wayfarerSupabase = window.supabase.createClient(projectUrl, publishableKey);
})();
