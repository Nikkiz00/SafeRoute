/**
 * Overpass QL query construction for the two OSM fallback tiers described in
 * docs/step-4-4-national-zone-strategy.md:
 *
 *   1. "admin"  — real administrative sub-municipal boundaries (relations/ways
 *      tagged boundary=administrative, admin_level 9-11: Italian quartieri,
 *      circoscrizioni, municipalità are mapped at these levels).
 *   2. "place"  — place=suburb/quarter/neighbourhood boundaries, restricted to
 *      way/relation elements ONLY (never node — a node has no polygon and turning
 *      it into one would mean inventing a boundary, which goal 5 forbids).
 *
 * Both tiers require ["name"] so untagged boundary fragments (segments shared
 * between real quartieri, sliver relations, etc. — confirmed to exist in real data
 * while building this pipeline, e.g. unnamed admin_level=10 ways inside Bologna)
 * never get treated as a candidate zone.
 */

function escapeOverpassString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function buildAdminBoundaryQuery(cityName: string): string {
  const name = escapeOverpassString(cityName)
  return `[out:json][timeout:120];
area["name"="${name}"]["boundary"="administrative"]["admin_level"="8"]->.comune;
(
  relation(area.comune)["boundary"="administrative"]["admin_level"~"^(9|10|11)$"]["name"];
  way(area.comune)["boundary"="administrative"]["admin_level"~"^(9|10|11)$"]["name"];
);
out geom;`
}

export function buildPlaceBoundaryQuery(cityName: string): string {
  const name = escapeOverpassString(cityName)
  return `[out:json][timeout:120];
area["name"="${name}"]["boundary"="administrative"]["admin_level"="8"]->.comune;
(
  way(area.comune)["place"~"^(suburb|quarter|neighbourhood)$"]["name"];
  relation(area.comune)["place"~"^(suburb|quarter|neighbourhood)$"]["name"]["type"="multipolygon"];
);
out geom;`
}
