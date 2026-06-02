import { latLngToCell, gridDisk } from 'h3-js'

const H3_RESOLUTION = 7 // ~1.2 km hex diameter

export function latLngToH3(lat, lng) {
  return latLngToCell(lat, lng, H3_RESOLUTION)
}

// Returns center cell + k rings of neighbors (k=1 → 7 cells, ~3.6 km coverage)
export function neighborCells(lat, lng, k = 1) {
  return gridDisk(latLngToH3(lat, lng), k)
}
