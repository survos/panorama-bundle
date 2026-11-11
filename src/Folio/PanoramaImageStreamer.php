<?php

declare(strict_types=1);

namespace Survos\PanoramaBundle\Folio;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\BadGatewayHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Streams a panorama image same-origin, because the archives that host them (Fortepan, ...) send no
 * CORS headers and Photo Sphere Viewer needs the pixels in a WebGL texture.
 *
 * The URL must come from the folio (FolioPanoramaScenes::imageUrl), never from the request; this class
 * additionally refuses anything but https on an allowlisted host, follows no redirects, and only passes
 * through jpeg/png/webp.
 */
final class PanoramaImageStreamer
{
    private const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    public function __construct(private readonly HttpClientInterface $http)
    {
    }

    /** @param list<string> $allowedHosts exact host names the app has enabled */
    public function stream(string $url, array $allowedHosts, string $cacheControl = 'public, max-age=86400'): Response
    {
        if ('https' !== parse_url($url, PHP_URL_SCHEME) || !in_array(parse_url($url, PHP_URL_HOST), $allowedHosts, true)) {
            throw new NotFoundHttpException('This image source is not enabled for panoramas.');
        }
        $upstream = $this->http->request('GET', $url, ['max_redirects' => 0, 'timeout' => 30, 'max_duration' => 90]);
        $headers = $upstream->getHeaders(false);
        $type = explode(';', $headers['content-type'][0] ?? '')[0];
        if (200 !== $upstream->getStatusCode() || !in_array($type, self::TYPES, true)) {
            $upstream->cancel();
            throw new BadGatewayHttpException('The source image is unavailable.');
        }
        $http = $this->http;

        return new StreamedResponse(static function () use ($http, $upstream): void {
            foreach ($http->stream($upstream) as $chunk) {
                echo $chunk->getContent();
                flush();
            }
        }, headers: ['Content-Type' => $type, 'Cache-Control' => $cacheControl, 'X-Content-Type-Options' => 'nosniff']);
    }
}
