let EP2024 = null;

export async function loadEP2024() {
  if (EP2024) return EP2024;

  try {
    // Use relative path (no leading slash) so Live Server / relative roots resolve correctly
    const resp = await fetch('data/ep2024_processed.json', { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
    }
    EP2024 = await resp.json();
    return EP2024;
  } catch (err) {
    console.error('[DATA-LOADER] failed to load ep2024_processed.json', err);
    EP2024 = {};
    return EP2024;
  }
}