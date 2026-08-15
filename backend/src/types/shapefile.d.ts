// The "shapefile" package ships no types and has no @types package on npm.
// Minimal ambient declaration covering the subset used by the ISTAT and
// sub-municipal importers (streaming .shp/.dbf reader).
declare module 'shapefile' {
  export interface ShapefileFeature {
    type: 'Feature'
    properties: Record<string, unknown>
    geometry: { type: string; coordinates: unknown }
  }

  export interface ShapefileSource {
    read(): Promise<{ done: boolean; value: ShapefileFeature }>
  }

  export function open(
    shp: string,
    dbf?: string,
    options?: { encoding?: string }
  ): Promise<ShapefileSource>
}
