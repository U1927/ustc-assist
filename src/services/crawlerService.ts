
// Crawler service has been removed.
// We are now using Supabase Cloud Sync.
export const fetchAllData = async () => {
  console.warn("Crawler is disabled.");
  return [];
};
