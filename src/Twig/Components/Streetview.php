<?php

declare(strict_types=1);

namespace Survos\PanoramaBundle\Twig\Components;

use Symfony\UX\Map\Map;
use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent('survos:streetview', template: '@SurvosPanorama/components/streetview.html.twig')]
final class Streetview
{
    public array $scenes;
    public string $startId;
    public Map $map;
    public string $label = 'Street panorama explorer';
    public int $nearbyLimit = 8;
}
