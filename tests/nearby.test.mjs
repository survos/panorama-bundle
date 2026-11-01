import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearbyScenes, distanceMeters, validCoordinates } from '../assets/src/nearby.js';

test('nearby navigation excludes current and invalid locations and sorts by distance', () => {
    const scenes = [
        {id:'here',coordinates:[19,47]}, {id:'far',coordinates:[19.01,47]},
        {id:'near',coordinates:[19.0001,47]}, {id:'missing',coordinates:null},
        {id:'invalid',coordinates:[0,91]}, {id:'same',coordinates:[19,47]},
    ];
    assert.deepEqual(nearbyScenes(scenes,'here',2).map(v=>v.scene.id), ['same','near']);
    assert.deepEqual(nearbyScenes(scenes,'missing'), []);
    assert.deepEqual(nearbyScenes(scenes,'unknown'), []);
    assert.deepEqual(nearbyScenes(scenes,'here',0), []);
});
test('distance handles coincident points and crossing the date line', () => {
    assert.equal(distanceMeters([0,0],[0,0]),0);
    assert.ok(Math.abs(distanceMeters([179.999,0],[-179.999,0])-222.39)<0.1);
    assert.equal(validCoordinates([NaN,0]),false);
    assert.equal(validCoordinates(['19',47]),false);
});
