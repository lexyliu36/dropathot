// Reverse-geocode lat/lng → "Neighborhood, City" using Mapbox
export async function reverseGeocode(lat, lng) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token || lat == null || lng == null) return null
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=neighborhood,place&limit=1&access_token=${token}`
    const res = await fetch(url)
    const data = await res.json()
    const features = data.features ?? []
    if (!features.length) return null

    const neighborhood = features.find(f => f.place_type?.includes('neighborhood'))
    const place = features.find(f => f.place_type?.includes('place'))
    const neighborhoodName = neighborhood?.text ?? null
    const placeName =
      place?.text ??
      features[0]?.context?.find(c => c.id?.startsWith('place'))?.text ??
      null

    if (neighborhoodName && placeName) return `${neighborhoodName}, ${placeName}`
    if (placeName) return placeName
    if (neighborhoodName) return neighborhoodName
    return features[0]?.place_name?.split(',').slice(0, 2).join(',').trim() ?? null
  } catch {
    return null
  }
}
