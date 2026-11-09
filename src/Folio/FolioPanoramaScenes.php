<?php

declare(strict_types=1);

namespace Survos\PanoramaBundle\Folio;

use Survos\DataContracts\Vocabulary\Core;
use Survos\DataContracts\Vocabulary\ItemField as F;
use Survos\DataContracts\Vocabulary\Narrative;
use Survos\DataContracts\Vocabulary\Panorama as P;

/**
 * Reads panorama scenes out of a dfolio (DuckDB) over the shared item/link/page tables.
 *
 * A tour is a `tour` item with `has_stop` links to `obj` items; photospheres carry
 * mediaKind=equirectangular; neighbouring stops are `connects_to` links and historical
 * photographs are `depicts` links whose extras hold the placement. Read-only: no source acquisition
 * or dataset mutation. Any PDO handle on the dfolio (DuckDB) or folio (SQLite) tables will do.
 */
final class FolioPanoramaScenes
{
    /** @return list<array{id: string, title: string, stops: int}> */
    public function tours(\PDO $db): array
    {
        $rows = $db->query("SELECT i.local_id AS id, i.label AS title, (SELECT count(*) FROM link l JOIN link_type t ON t.id=l.link_type_id WHERE l.left_core='tour' AND l.left_id=i.local_id AND t.code='has_stop') AS stops FROM item i WHERE i.dto_type='tour' ORDER BY i.label, i.local_id")->fetchAll(\PDO::FETCH_ASSOC);

        return array_map(static fn (array $r): array => ['id' => (string) $r['id'], 'title' => (string) $r['title'], 'stops' => (int) $r['stops']], $rows);
    }

    /** @return list<array{id: string, title: string}> */
    public function spheres(\PDO $db, int $limit = 48): array
    {
        $q = $db->prepare("SELECT local_id AS id, label AS title FROM item WHERE json_extract_string(extras, '$.mediaKind')='equirectangular' ORDER BY label, local_id LIMIT ".$limit);
        $q->execute();

        return array_map(static fn (array $r): array => ['id' => (string) $r['id'], 'title' => (string) $r['title']], $q->fetchAll(\PDO::FETCH_ASSOC));
    }

    public static function imageUrl(\PDO $db, string $rowId): string
    {
        $query = $db->prepare('SELECT url FROM page WHERE row_id=? ORDER BY seq, id LIMIT 1');
        $query->execute([$rowId]);
        $url = $query->fetchColumn();
        if (!is_string($url) || '' === $url) {
            throw new \UnexpectedValueException('Missing image page for '.$rowId);
        }

        return $url;
    }

    /**
     * @param (callable(string $localId): string)|null $imageRoute maps an object's local id to the URL the browser
     *                                                             should load (e.g. a same-origin proxy); null uses the source URL recorded in the `page` table
     *
     * @return list<array<string, mixed>>
     */
    public function scenes(\PDO $db, string $folioCode, string $core, string $id, ?callable $imageRoute = null): array
    {
        if (!in_array($core, [Core::OBJECT, Core::TOUR], true)) {
            return [];
        }
        $item = $this->item($db, $folioCode, $core, $id);
        if (null === $item) {
            return [];
        }
        $extras = json_decode((string) $item['extras'], true, flags: JSON_THROW_ON_ERROR);
        if (Core::OBJECT === $core && ($extras[P::MEDIA_KIND] ?? null) !== P::EQUIRECTANGULAR) {
            return [];
        }
        // A sphere opens its first parent tour when it has one; tour stops stay links.
        $tour = Core::TOUR === $core ? $id : null;
        if (null === $tour) {
            $q = $db->prepare('SELECT l.left_id FROM link l JOIN link_type t ON t.id=l.link_type_id WHERE l.left_core=? AND l.right_core=? AND l.right_id=? AND t.code=? ORDER BY l.left_id LIMIT 1');
            $q->execute([Core::TOUR, Core::OBJECT, $id, Narrative::HAS_STOP]);
            $parent = $q->fetchColumn();
            if (false !== $parent) {
                $tour = $parent;
            }
        }
        if (null === $tour) {
            $items = [$item];
        } else {
            $q = $db->prepare('SELECT i.local_id, i.label, i.dto_data, i.extras FROM link l JOIN link_type t ON t.id=l.link_type_id JOIN item i ON i.id=? || l.right_core || \':\' || l.right_id WHERE l.left_core=? AND l.left_id=? AND t.code=? ORDER BY i.local_id');
            $q->execute([$folioCode.':', Core::TOUR, $tour, Narrative::HAS_STOP]);
            $items = $q->fetchAll(\PDO::FETCH_ASSOC);
        }

        $imageRoute ??= static fn (string $localId): string => self::imageUrl($db, $folioCode.':'.Core::OBJECT.':'.$localId);
        $scenes = [];
        foreach ($items as $stop) {
            $extra = json_decode((string) $stop['extras'], true, flags: JSON_THROW_ON_ERROR);
            if (($extra[P::MEDIA_KIND] ?? null) !== P::EQUIRECTANGULAR) {
                continue; // Tours may also hold ordinary photographs.
            }
            $location = $extra['sourceProperties']['location'] ?? null;
            $scene = [
                F::ID => (string) $stop['local_id'],
                F::TITLE => (string) $stop['label'],
                F::LARGE_IMAGE_URL => $imageRoute((string) $stop['local_id']),
                P::HEADING => (float) ($extra[P::HEADING] ?? 0),
                P::SOURCE_ANGLE_MODE => $extra[P::SOURCE_ANGLE_MODE] ?? false,
                'coordinates' => null === $location ? null : $location['coordinates'],
                'placements' => [],
                'connections' => [],
            ];
            $q = $db->prepare('SELECT l.right_id, l.extras AS placement, t.code, i.label, i.extras FROM link l JOIN link_type t ON t.id=l.link_type_id JOIN item i ON i.id=? || l.right_core || \':\' || l.right_id WHERE l.left_core=? AND l.left_id=? AND l.right_core=? AND t.code IN (?, ?) ORDER BY l.id');
            $q->execute([$folioCode.':', Core::OBJECT, $stop['local_id'], Core::OBJECT, P::DEPICTS, P::CONNECTS_TO]);
            foreach ($q->fetchAll(\PDO::FETCH_ASSOC) as $edge) {
                if (P::CONNECTS_TO === $edge['code']) {
                    $scene['connections'][] = (string) $edge['right_id'];
                    continue;
                }
                $source = json_decode((string) $edge['extras'], true, flags: JSON_THROW_ON_ERROR)['sourceProperties'];
                $placement = json_decode((string) $edge['placement'], true, flags: JSON_THROW_ON_ERROR);
                if (($source['original_width'] ?? 0) <= 0 || ($source['original_height'] ?? 0) <= 0) {
                    continue; // No usable dimensions: skip the overlay rather than fail the whole tour.
                }
                $scene['placements'][] = [
                    F::ID => (string) $edge['right_id'],
                    F::TITLE => (string) $edge['label'],
                    F::LARGE_IMAGE_URL => $imageRoute((string) $edge['right_id']),
                    P::AZIMUTH => (float) $placement[P::AZIMUTH],
                    P::INCLINATION => (float) $placement[P::INCLINATION],
                    P::DISTANCE => (float) $placement[P::DISTANCE],
                    'width' => (int) round($source['original_width'] * 700 / $source['original_height']),
                    'height' => 700,
                ];
            }
            $scenes[$scene[F::ID]] = $scene;
        }
        foreach ($scenes as &$scene) {
            // (0,0) and shared locations cannot give a meaningful arrow; those stops stay in the selector.
            $scene['connections'] = array_values(array_filter($scene['connections'], static fn (string $target): bool => isset($scenes[$target])
                && null !== $scene['coordinates'] && null !== $scenes[$target]['coordinates']
                && $scene['coordinates'] !== [0, 0] && $scenes[$target]['coordinates'] !== [0, 0]
                && $scene['coordinates'] !== $scenes[$target]['coordinates']));
        }
        unset($scene);

        return array_values($scenes);
    }

    /** @return array<string, mixed>|null */
    private function item(\PDO $db, string $folioCode, string $core, string $id): ?array
    {
        $query = $db->prepare('SELECT local_id, label, dto_data, extras FROM item WHERE id=?');
        $query->execute([$folioCode.':'.$core.':'.$id]);
        $item = $query->fetch(\PDO::FETCH_ASSOC);

        return false === $item ? null : $item;
    }
}
