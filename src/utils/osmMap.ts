// ============================================================================
// Mapa OpenStreetMap dla materiałów `mapEmbed` (geografia).
//
// Do 28.09.2026 osadzaliśmy stronę openstreetmap.org/export/embed.html. Jej
// pole atrybucji („© OpenStreetMap contributors. Zgłoś błąd…”) jest duże i nie
// da się go ostylować (inna domena) — na wąskim ekranie łamało się na kilka
// linii i zasłaniało dół mapy. Teraz rysujemy mapę sami (Leaflet z cdnjs,
// kafelki tile.openstreetmap.org) z małą, jednoliniową atrybucją w prawym
// dolnym rogu. Wymagany napis „© OpenStreetMap contributors” zostaje.
// Gdyby Leaflet się nie wczytał, strona przechodzi na dawny embed OSM.
//
// Kopia web frontend/src/lib/osm-map.ts (tam iframe srcdoc, tu WebView).
// ============================================================================

export type Bbox = [number, number, number, number]; // lonMin, latMin, lonMax, latMax

/** `…Imgp_2.html?gpmap=gp0&pos=20.4350,49.4200,13` → lon, lat, zoom geoportalu. */
export function parseGeoportalPos(url: string): { lon: number; lat: number; zoom: number } | null {
  const m = (url || "").match(/pos=([-\d.]+),([-\d.]+),(\d+)/);
  if (!m) return null;
  const lon = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  const zoom = parseInt(m[3], 10);
  if (!isFinite(lon) || !isFinite(lat) || !isFinite(zoom)) return null;
  return { lon, lat, zoom };
}

export function osmEmbedUrl(bbox: Bbox, marker: { lat: number; lon: number }): string {
  return (
    "https://www.openstreetmap.org/export/embed.html?bbox=" +
    bbox.map((v) => v.toFixed(4)).join(",") +
    `&layer=mapnik&marker=${marker.lat},${marker.lon}`
  );
}

export function osmMapHtml(bbox: Bbox, marker: { lat: number; lon: number }): string {
  const fallback = osmEmbedUrl(bbox, marker);
  const b = JSON.stringify([
    [bbox[1], bbox[0]],
    [bbox[3], bbox[2]],
  ]);
  const mk = JSON.stringify([marker.lat, marker.lon]);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>html,body,#m{margin:0;padding:0;height:100%;width:100%}
.leaflet-container .leaflet-control-attribution{font:9px/1.4 system-ui,sans-serif;padding:0 4px;background:rgba(255,255,255,.72);color:#555;white-space:nowrap;border-top-left-radius:4px}
.leaflet-control-attribution a{color:#555;text-decoration:none}</style></head>
<body><div id="m"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
if(!window.L){location.replace(${JSON.stringify(fallback)});}else{
var map=L.map('m',{zoomSnap:0.5});
map.attributionControl.setPrefix(false);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
map.fitBounds(${b});
L.circleMarker(${mk},{radius:7,color:'#fff',weight:2,fillColor:'#e11d48',fillOpacity:1}).addTo(map);
}
</script></body></html>`;
}
