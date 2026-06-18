import { latLngToCell, gridDisk } from 'h3-js'

const H3_RESOLUTION = 7 // ~1.2 km hex diameter

export function latLngToH3(lat, lng) {
  return latLngToCell(lat, lng, H3_RESOLUTION)
}

// Returns center cell + k rings of neighbors (k=1 → 7 cells, ~3.6 km coverage)
export function neighborCells(lat, lng, k = 1) {
  return gridDisk(latLngToH3(lat, lng), k)
}

// US bounding boxes (approximate — covers CONUS, Alaska, Hawaii, Puerto Rico, USVI)
const US_REGIONS = [
  { name: 'CONUS',        latMin: 24.52, latMax: 49.38, lngMin: -124.77, lngMax: -66.95 },
  { name: 'Alaska',       latMin: 54.68, latMax: 71.34, lngMin: -169.65, lngMax: -129.99 },
  { name: 'Hawaii',       latMin: 18.91, latMax: 28.40, lngMin: -178.33, lngMax: -154.81 },
  { name: 'Puerto Rico',  latMin: 17.88, latMax: 18.52, lngMin:  -67.27, lngMax:  -65.22 },
  { name: 'USVI',         latMin: 17.68, latMax: 18.43, lngMin:  -65.08, lngMax:  -64.56 },
]

export function isInUsa(lat, lng) {
  return US_REGIONS.some(r =>
    lat >= r.latMin && lat <= r.latMax &&
    lng >= r.lngMin && lng <= r.lngMax
  )
}
