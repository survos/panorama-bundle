// KronoFoto's server adds heading - 90 to azimuth. Its mesh then faces the origin.
// Project all four corners: imageLayer's default vertical billboard is NOT equivalent
// when inclination is nonzero. Equal corner radii preserve the planar aspect ratio.
export function imageCorners({ azimuth, inclination, distance, width, height }, heading) {
    for (const value of [azimuth, inclination, distance, width, height, heading]) {
        if (!Number.isFinite(value)) throw new Error('Placement values must be finite numbers');
    }
    if (distance <= 0 || width <= 0 || height <= 0) throw new Error('Placement dimensions and distance must be positive');
    const yaw = (180 - azimuth - heading) * Math.PI / 180;
    const pitch = inclination * Math.PI / 180;
    const s = Math.sin(yaw), c = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    const center = [-s * cp * distance, sp * distance, c * cp * distance];
    const right = [-c, 0, -s], up = [s * sp, cp, -c * sp];
    return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => {
        const v = center.map((n, i) => n + x * right[i] * width / 2 + y * up[i] * height / 2);
        return { yaw: Math.atan2(-v[0], v[2]), pitch: Math.asin(v[1] / Math.hypot(...v)) };
    });
}

export function correction(heading, useNewAngles) {
    if (!Number.isFinite(heading) || typeof useNewAngles !== 'boolean') throw new Error('Heading and source angle mode are required');
    // Source exports heading only. YXZ and ZXY are identical for this single Y
    // rotation in PSV 5.10.1. Explicit zero pose also prevents XMP introducing
    // additional Euler angles. No process-global Viewer.useNewAnglesOrder mutation.
    return { pan: (heading - 90) / 180 * 3.1416, tilt: 0, roll: 0 };
}

export function tourNode(scene) {
    return {
        id: scene.id,
        panorama: scene.largeImageUrl,
        name: scene.title,
        sphereCorrection: correction(scene.heading, scene.useNewAngles),
        panoData: { poseHeading: 0, posePitch: 0, poseRoll: 0 },
        gps: scene.coordinates,
        links: scene.connections.map(id => ({ nodeId: id })),
        markers: scene.placements.map(photo => ({
            id: photo.id,
            imageLayer: photo.largeImageUrl,
            position: imageCorners(photo, scene.heading),
            opacity: 1,
        })),
    };
}
