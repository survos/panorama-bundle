import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageCorners, correction } from '../assets/src/geometry.js';

// Independent original Three.js mesh equations, including lookAt basis.
function originalCorners(photo, heading) {
    const theta = (photo.inclination - 90) * Math.PI / 180;
    const phi = (photo.azimuth + heading) * Math.PI / 180;
    const d = photo.distance / 2000;
    const p = [Math.sin(phi) * Math.sin(theta) * d, Math.cos(theta) * d, Math.cos(phi) * Math.sin(theta) * d];
    const z = p.map(v => -v / d);
    const n = Math.hypot(z[2], z[0]);
    const x = [z[2] / n, 0, -z[0] / n];
    const y = [z[1]*x[2], z[2]*x[0]-z[0]*x[2], -z[1]*x[0]];
    return [[-1,1],[1,1],[1,-1],[-1,-1]].map(([a,b]) => {
        const v = p.map((v,i) => v + x[i]*a*photo.width/4000 + y[i]*b*photo.height/4000);
        return {yaw:Math.atan2(-v[0],v[2]),pitch:Math.asin(v[1]/Math.hypot(...v))};
    });
}

test('imageLayer corners match KronoFoto meshes across headings, inclinations and aspect ratios', () => {
    for (const heading of [0, 90, 235, 359]) for (const inclination of [-65, 0, 43]) for (const width of [350, 1100]) {
        const photo = {azimuth: 32, inclination, distance: 875, width, height: 700};
        const expected = originalCorners(photo, heading), actual = imageCorners(photo, heading);
        actual.forEach((p,i) => { assert.ok(Math.abs(p.yaw-expected[i].yaw)<1e-12); assert.ok(Math.abs(p.pitch-expected[i].pitch)<1e-12); });
    }
});
test('both source angle orders produce the same heading-only rotation without global state', () => {
    for (const heading of [0, 90, 120, 360]) assert.deepEqual(correction(heading, false), correction(heading, true));
    assert.throws(() => correction(90, undefined));
});
test('invalid placement data fails loudly', () => {
    assert.throws(() => imageCorners({azimuth:0,inclination:0,distance:0,width:700,height:500}, 0));
});
