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
