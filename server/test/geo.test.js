import { describe, it, expect } from 'vitest'
import { latLngToH3, neighborCells } from '../lib/geo.js'

// Known H3 cell for NYC Times Square (approx 40.7580, -73.9855) at resolution 7
const NYC_LAT = 40.7580
const NYC_LNG = -73.9855

describe('latLngToH3', () => {
  it('returns a non-empty string', () => {
    const cell = latLngToH3(NYC_LAT, NYC_LNG)
    expect(typeof cell).toBe('string')
    expect(cell.length).toBeGreaterThan(0)
  })

  it('returns the same cell for the same coordinates', () => {
    expect(latLngToH3(NYC_LAT, NYC_LNG)).toBe(latLngToH3(NYC_LAT, NYC_LNG))
  })

  it('returns different cells for coordinates far apart', () => {
    const nyc = latLngToH3(40.7580, -73.9855)
    const la = latLngToH3(34.0522, -118.2437)
    expect(nyc).not.toBe(la)
  })

  it('returns the same cell for coordinates very close together (sub-km)', () => {
    // ~50m apart — should land in same resolution-7 hex (~1.2km diameter)
    const a = latLngToH3(40.7580, -73.9855)
    const b = latLngToH3(40.7584, -73.9850)
    expect(a).toBe(b)
  })

  it('handles the equator and prime meridian', () => {
    expect(() => latLngToH3(0, 0)).not.toThrow()
  })

  it('handles extreme latitudes', () => {
    expect(() => latLngToH3(89.9, 0)).not.toThrow()
    expect(() => latLngToH3(-89.9, 0)).not.toThrow()
  })
})

describe('neighborCells', () => {
  it('returns 7 cells for k=1 (center + 6 neighbors)', () => {
    const cells = neighborCells(NYC_LAT, NYC_LNG, 1)
    expect(cells).toHaveLength(7)
  })

  it('returns 19 cells for k=2', () => {
    const cells = neighborCells(NYC_LAT, NYC_LNG, 2)
    expect(cells).toHaveLength(19)
  })

  it('includes the center cell at k=0', () => {
    const center = latLngToH3(NYC_LAT, NYC_LNG)
    const cells = neighborCells(NYC_LAT, NYC_LNG, 0)
    expect(cells).toContain(center)
  })

  it('default k=1 returns 7 cells', () => {
    const cells = neighborCells(NYC_LAT, NYC_LNG)
    expect(cells).toHaveLength(7)
  })

  it('all returned values are non-empty strings', () => {
    neighborCells(NYC_LAT, NYC_LNG, 1).forEach(cell => {
      expect(typeof cell).toBe('string')
      expect(cell.length).toBeGreaterThan(0)
    })
  })
})
