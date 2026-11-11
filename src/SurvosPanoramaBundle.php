<?php

declare(strict_types=1);

namespace Survos\PanoramaBundle;

use Survos\Kit\AbstractUxBundle;
use Survos\Kit\SurvosKitBundle;
use Survos\PanoramaBundle\Folio\FolioPanoramaScenes;
use Survos\PanoramaBundle\Folio\PanoramaImageStreamer;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Kernel\RequiredBundle;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;

#[RequiredBundle(SurvosKitBundle::class)]
// Symfony\Component\HttpKernel\Bundle\Bundle <-- Flex auto-registration marker (see Survos\Kit\AbstractSurvosBundle)
final class SurvosPanoramaBundle extends AbstractUxBundle
{
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        parent::loadExtension($config, $container, $builder);
        $container->services()->set(FolioPanoramaScenes::class);
        $container->services()->set(PanoramaImageStreamer::class)->autowire();
    }
}
