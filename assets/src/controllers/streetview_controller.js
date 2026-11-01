import { Controller } from '@hotwired/stimulus';
import { nearbyScenes, validCoordinates } from '../nearby.js';

// Host-side composition of Symfony UX Map and the existing panorama component.
export default class extends Controller {
    static targets = ['panorama', 'selected', 'nearby'];
    static values = { scenes: Array, startId: String, nearbyLimit: { type: Number, default: 8 } };

    connect() { this.highlight(this.currentId || this.startIdValue); }

    mapReady({ detail: { map, L } }) {
        this.layer?.remove();
        this.map = map;
        this.markers = new Map();
        this.layer = L.layerGroup().addTo(map);
        this.scenesValue.forEach((scene, index) => {
            if (!validCoordinates(scene.coordinates)) return;
            const [longitude, latitude] = scene.coordinates;
            const marker = L.marker([latitude, longitude], {
                title: scene.title,
                icon: L.divIcon({ className: '', html: `<span aria-hidden="true" style="display:block;text-align:center;line-height:26px;border:2px solid white;border-radius:50%;width:30px;height:30px;background:#206bc4;color:white;box-shadow:0 1px 4px #555">${index + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
            }).addTo(this.layer);
            const tooltip = document.createElement('span');
            tooltip.textContent = scene.title;
            marker.bindTooltip(tooltip);
            marker.getElement()?.setAttribute('aria-label', `Open capture ${index + 1}`);
            marker.getElement()?.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopImmediatePropagation();
                this.navigate(scene.id);
            });
            marker.on('click', () => this.navigate(scene.id));
            this.markers.set(scene.id, marker);
        });
        this.bounds = L.latLngBounds(this.scenesValue.filter(scene => validCoordinates(scene.coordinates)).map(scene => [scene.coordinates[1], scene.coordinates[0]]));
        this.showAll();
        this.highlight(this.currentId || this.startIdValue);
    }

    navigate(id) {
        // Use the component's existing accessible navigation input, no private viewer API.
        this.panoramaTarget.firstElementChild.dispatchEvent(new CustomEvent('panorama:navigate', { detail: { id } }));
    }

    locationChanged({ detail: { id } }) { this.currentId = id; this.highlight(id); }

    highlight(id) {
        const scene = this.scenesValue.find(scene => scene.id === id);
        if (!scene) return;
        this.currentId = id;
        this.selectedTarget.textContent = scene.title;
        this.nearbyTarget.replaceChildren();
        const neighbors = nearbyScenes(this.scenesValue, id, this.nearbyLimitValue);
        for (const { scene: neighbor, distance } of neighbors) {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-outline-secondary text-start w-100 mb-2';
            button.textContent = `${neighbor.title} — ${Math.round(distance)} m away`;
            button.addEventListener('click', () => this.navigate(neighbor.id));
            item.append(button);
            this.nearbyTarget.append(item);
        }
        if (!neighbors.length) this.nearbyTarget.textContent = 'No nearby panoramas with coordinates.';
        if (!this.markers) return;
        for (const [key, marker] of this.markers) {
            const button = marker.getElement()?.querySelector('span');
            if (button) {
                button.style.background = key === id ? '#b64b00' : '#206bc4';
                marker.getElement().setAttribute('aria-pressed', String(key === id));
            }
            marker.setZIndexOffset(key === id ? 1000 : 0);
        }
    }

    showAll() { if (this.map && this.bounds?.isValid()) this.map.fitBounds(this.bounds, { padding: [35, 35], maxZoom: 19 }); }

    disconnect() {
        this.layer?.remove();
        this.markers?.clear();
        this.map = null;
    }
}
