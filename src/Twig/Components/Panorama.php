<?php

declare(strict_types=1);

namespace Survos\PanoramaBundle\Twig\Components;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent('survos:panorama', template: '@SurvosPanorama/components/panorama.html.twig')]
final class Panorama
{
    /** Viewer-independent scene documents; see README for the contract. */
    public array $scenes;
    public string $startId;
    public string $label = 'Panorama tour';
}
