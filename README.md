# Panorama Bundle

Reusable Symfony UX Twig component for equirectangular panoramas, connected tours,
and historical photograph overlays. Photo Sphere Viewer 5.10.1, VirtualTourPlugin,
and MarkersPlugin `imageLayer` provide the renderer. No storage, database, media
service, or geospatial authority dependency.

```sh
composer require survos/panorama-bundle
php bin/console importmap:install
```

Flex registers the bundle and lazy controller. Use AssetMapper and include your
application's normal importmap entrypoint. PHP 8.5, Symfony 8.1+, UX 3 are required.

## Fotostory (or any host)

Build the same plain scene documents from your repository, API, or folio, then:

```twig
<twig:survos:panorama :scenes="scenes" :startId="startId" label="Historic main street" />
```

Example controller data (URLs are supplied by the host, including signed Imagor
URLs if desired; the bundle never discovers or downloads archived originals):

```php
use Survos\DataContracts\Vocabulary\ItemField as F;
use Survos\DataContracts\Vocabulary\Panorama as P;

$scenes = [[
    F::ID => 'sphere:1250',
    F::TITLE => 'Suspension Bridge',
    F::LARGE_IMAGE_URL => 'https://example.org/panorama.jpg',
    P::HEADING => 0,
    P::SOURCE_ANGLE_MODE => true,
    'coordinates' => [-92.68, 43.07], // WGS84 longitude, latitude
    'connections' => [],             // IDs of other scenes in this document
    'placements' => [[
        F::ID => 'photo:28763',
        F::TITLE => 'Bridge in 1949',
        F::LARGE_IMAGE_URL => 'https://example.org/historic.jpg',
        P::AZIMUTH => 91.44,
        P::INCLINATION => -2.52,
        P::DISTANCE => 723.58,
        'width' => 423, 'height' => 700,
    ]],
]];
$startId = 'sphere:1250';
```

All fields shown are required; coordinates may be null when unknown, and empty
connection/placement lists are legitimate. Known coordinates produce geodesic
bearings for standard tour arrows; unknown locations still support the selector.
IDs and titles are plain text. The template escapes them; no trusted HTML input
is needed. Scene documents deliberately use the existing data-contracts field
names, not PSV node/marker options. `coordinates`, `connections`, `placements`,
`width`, and `height` describe the rendering projection, not new catalog records.
Photos and panoramas remain `obj`; tour membership is `Narrative::hasStop()` and
navigation/placements are `Panorama::connectsTo()` / `Panorama::depicts()` links.
The host must include connection targets in `scenes`; omit arrows with unknown
or identical locations, and keep those stops accessible using the selector.

## Orientation and dimensions

The initial geometry convention is the preserved KronoFoto convention: angles
in degrees, distance in source renderer units, never metres. The server's
`azimuth + heading - 90` conversion and original origin-facing Three.js plane
are projected into four spherical corners. Scaling all dimensions and distance
by the same factor changes nothing. Width/height must use the source placement
scale: KronoFoto uses height 700 and rounded aspect-ratio width, not original
image pixels. Hosts adapting another source must convert to this convention.

Both `useNewAngles` modes are accepted and validated. In PSV 5.10.1 the modes
change the Euler order (YXZ vs ZXY); for the exported heading-only correction,
with zero pitch/roll, they are mathematically identical. We explicitly disable
XMP pose inference and supply zero pose, and never mutate the global
`Viewer.useNewAnglesOrder`. Multi-axis source pose is not supported in this
first release. Tests compare the original plane equations across headings,
positive/negative inclinations, and landscape/portrait dimensions. Pinning PSV
makes a future geometry or Euler-order upgrade an explicit compatibility task.

The location selector, arrows, show/hide checkbox, and opacity slider work per
component. Nodes load on demand without tour preloading. Disconnect destroys
the viewer; reconnect creates a fresh instance. Events are `panorama:location`
(with `detail.id`) and `panorama:error` (with `detail.message`). Image links and a
preview remain available without JavaScript; load errors expand the fallback.
Image servers must permit browser CORS for WebGL textures. GPU limits and source
image availability can prevent interactive rendering without breaking links.

## Development

```sh
node --test tests/geometry.test.mjs
composer validate --no-check-lock
```

After installing a published version in a local app, use the existing mono
link command (`php ~/sites/mono/link /path/to/app`, the monolink workflow).
Make persistent tweaks here, not in the app's vendor tree.

## Streetview: synchronized map and nearby panoramas

The opt-in `survos:streetview` component revives the old map-plus-panorama widget
as Stimulus composition, using supplied scene images rather than Google Street View.
Existing `survos:panorama` consumers do not need to change.

Install `symfony/ux-leaflet-map` and configure its default UX Map renderer. Pass a
Symfony `Map` with `LeafletOptions` and the same scene documents used by the viewer:

```twig
<twig:survos:streetview :scenes="scenes" :startId="startId" :map="map" :nearbyLimit="8" />
```

Enable the package's `streetview` controller (eager, so it receives the child map's
connect event). Flex metadata declares this; locally linked applications must update
`assets/controllers.json` as well. No application-specific JavaScript is required.

Map markers and a distance-sorted nearby list select panoramas. The selected marker,
location selector and nearby list update after the viewer confirms navigation. All
points remain available on the map; `nearbyLimit` limits only the list. Invalid or
missing coordinates are omitted from the map/list; those scenes remain selectable
in the panorama viewer. Distances are geodesic straight-line distances, not routes.

The panorama section accepts `panorama:navigate` CustomEvents with `detail: {id}`
and emits bubbling `panorama:location` after successful navigation. The map uses
Symfony UX Map's `ux:map:connect` hook and cleans up its layers on disconnect.
Each component has its own scoped map and viewer.

Kronofoto is the UX reference: locations on a map, selecting a sphere, and curated
connections. This widget does not write tour data or manufacture connections from
proximity. Directional arrows still require explicit scene connections and calibrated
source headings. Map tile licensing, attribution and referrer policy remain the host's
responsibility. Titles are inserted as text, never interpreted as HTML.

### Provider compass headings

Scenes may set optional `compassHeading`: the bearing of the equirectangular image
center in degrees clockwise from north. This overrides the legacy Kronofoto
sphere correction for that scene. The world yaw then uses the same north-zero
frame as geographic link bearings, and transitions preserve the current viewing
direction. Omit it for existing Kronofoto scenes. This mode applies heading only,
not reconstructed roll or pitch. `connections` must contain explicit destination
IDs present in the scene set; the viewer does not infer routes from proximity.

### Reading scenes from a folio

`Survos\PanoramaBundle\Folio\FolioPanoramaScenes` (a service) builds the scene documents above from any
`\PDO` on a folio (SQLite) or dfolio (DuckDB): `tours($db)`, `spheres($db)`, and
`scenes($db, $folioCode, 'tour'|'obj', $id, $imageRoute = null)`. `$imageRoute` maps an object's local id to the
URL the browser loads; omit it to use the source URL from the `page` table.

Archives such as Fortepan send no CORS headers, so route images through your own controller and call
`PanoramaImageStreamer::stream($sourceUrl, ['fortepan.us', ...])`. It refuses non-https and non-allowlisted hosts,
follows no redirects and passes through only jpeg/png/webp. Take the URL from `FolioPanoramaScenes::imageUrl()`,
never from the request.

See the [portable folio panorama tour contract](docs/folio-panorama-tour.md) for field semantics, coordinate conventions, connection rules and reuse limits.
