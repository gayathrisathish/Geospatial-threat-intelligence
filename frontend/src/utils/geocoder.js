const cache = {};

export async function getPlaceName(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (cache[key]) return cache[key];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const name =
      data.address?.state || data.address?.county || data.address?.country || 'Unknown Region';
    const country = data.address?.country || '';
    const result = country ? `${name}, ${country}` : name;
    cache[key] = result;
    return result;
  } catch {
    return 'Unknown Region';
  }
}
