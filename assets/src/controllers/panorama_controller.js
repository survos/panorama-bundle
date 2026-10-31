import { Controller } from '@hotwired/stimulus';
import { Viewer, EquirectangularAdapter } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import { tourNode } from '../geometry.js';

export default class extends Controller {
    static targets = ['canvas', 'status', 'fallback', 'locations'];
    static values = { scenes: Array, startId: String };

    connect() {
        this.visible = true;
        this.alpha = 1;
        try {
            const nodes = this.scenesValue.map(scene => tourNode(scene, this.scenesValue));
            const start = this.scenesValue.find(scene => scene.id === this.startIdValue);
            const lookAt = scene => scene.placements.length ? {
                yaw: (180 - scene.placements[0].azimuth - scene.heading) * Math.PI / 180,
                pitch: scene.placements[0].inclination * Math.PI / 180,
            } : { yaw: 0, pitch: 0 };
            const position = lookAt(start);
            this.viewer = new Viewer({
                defaultYaw: position.yaw, defaultPitch: position.pitch,
                container: this.canvasTarget,
                adapter: [EquirectangularAdapter, { useXmpData: false }],
                navbar: ['zoom', 'move', 'fullscreen'],
                plugins: [MarkersPlugin, [VirtualTourPlugin, {
                    dataMode: 'client', positionMode: 'manual', renderMode: '3d',
                    nodes, startNodeId: this.startIdValue, preload: false,
                    transitionOptions: node => ({ rotateTo: lookAt(this.scenesValue.find(scene => scene.id === node.id)), rotation: true }),
                }]],
            });
            this.viewer.addEventListener('panorama-loaded', () => { this.statusTarget.textContent = ''; });
            this.viewer.addEventListener('panorama-error', () => this.failed());
            this.viewer.getPlugin(VirtualTourPlugin).addEventListener('node-changed', ({ node }) => {
                this.locationsTarget.value = node.id;
                this.applyOverlays();
                this.dispatch('location', { detail: { id: node.id } });
            });
        } catch (error) {
            this.failed(error);
        }
    }

    failed(error) {
        this.statusTarget.textContent = 'The interactive panorama could not load. Use the image links below.';
        this.fallbackTarget.open = true;
        this.dispatch('error', { detail: { message: error?.message ?? 'Panorama loading failed' } });
    }

    async navigate(event) {
        if (!this.viewer) return;
        try { await this.viewer.getPlugin(VirtualTourPlugin).setCurrentNode(event.target.value); }
        catch (error) { this.failed(error); }
    }

    visibility(event) { this.visible = event.target.checked; this.applyOverlays(); }
    opacity(event) { this.alpha = Number(event.target.value); this.applyOverlays(); }
    applyOverlays() {
        if (!this.viewer) return;
        const markers = this.viewer.getPlugin(MarkersPlugin);
        for (const marker of markers.getMarkers()) {
            markers.updateMarker({ id: marker.id, visible: this.visible, opacity: this.alpha });
        }
    }

    disconnect() {
        this.viewer?.destroy();
        this.viewer = null;
        this.canvasTarget.replaceChildren();
    }
}
