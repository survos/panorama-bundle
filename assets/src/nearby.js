export function validCoordinates(value) {
    return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
        && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

export function distanceMeters(a, b) {
    const radians = degrees => degrees * Math.PI / 180;
    const dLat = radians(b[1] - a[1]), dLon = radians(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function nearbyScenes(scenes, id, limit = 8) {
    const current = scenes.find(scene => scene.id === id);
    if (!validCoordinates(current?.coordinates)) return [];
    return scenes.filter(scene => scene.id !== id && validCoordinates(scene.coordinates))
        .map(scene => ({ scene, distance: distanceMeters(current.coordinates, scene.coordinates) }))
        .sort((a, b) => a.distance - b.distance || a.scene.id.localeCompare(b.scene.id))
        .slice(0, Math.max(0, limit));
}
