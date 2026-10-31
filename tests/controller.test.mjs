import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Exercise the actual controller with deterministic lifecycle doubles, no WebGL needed.
const mocks = {
    '@hotwired/stimulus': `export class Controller { dispatch(name, options) { this.dispatched = {name, options}; } }`,
    '@photo-sphere-viewer/core': `export class EquirectangularAdapter {};
      export class Viewer {
        constructor(options) { this.options=options; this.listeners={}; this.markers={getMarkers:()=>[{id:'photo'}],updateMarker: m=>this.marker=m}; this.tour={addEventListener:(n,fn)=>this.changed=fn,setCurrentNode:async id=>{this.node=id}}; }
        addEventListener(name, fn) { this.listeners[name]=fn; }
        getPlugin(plugin) { return plugin.name==='MarkersPlugin'?this.markers:this.tour; }
        destroy() { this.destroyed=true; }
      }`,
    '@photo-sphere-viewer/markers-plugin': `export class MarkersPlugin {}`,
    '@photo-sphere-viewer/virtual-tour-plugin': `export class VirtualTourPlugin {}`,
};
registerHooks({ resolve(specifier, context, next) { if (specifier in mocks) return {url:'data:text/javascript,'+encodeURIComponent(mocks[specifier]),shortCircuit:true}; return next(specifier,context); } });
const { default: Panorama } = await import('../assets/src/controllers/panorama_controller.js');
function fixture() {
    const c=new Panorama();
    c.scenesValue=[{id:'one',title:'First',largeImageUrl:'/image',heading:0,useNewAngles:false,coordinates:null,connections:[],placements:[]}];
    c.startIdValue='one';c.canvasTarget={replaceChildren(){this.cleared=true}};
    c.statusTarget={};c.fallbackTarget={open:false};c.locationsTarget={};
    return c;
}
test('disconnect destroys the viewer and reconnect creates one fresh instance',()=>{
    const c=fixture();c.connect();const first=c.viewer;c.disconnect();
    assert.equal(first.destroyed,true);assert.equal(c.viewer,null);assert.equal(c.canvasTarget.cleared,true);
    c.connect();assert.notEqual(c.viewer,first);c.disconnect();
});
test('overlay settings survive navigation and load errors expose fallback',async()=>{
    const c=fixture();c.connect();c.opacity({target:{value:'0.4'}});c.visibility({target:{checked:false}});
    c.viewer.changed({node:{id:'one'}});
    assert.deepEqual(c.viewer.marker,{id:'photo',visible:false,opacity:0.4});
    await c.navigate({target:{value:'one'}});assert.equal(c.viewer.node,'one');
    c.viewer.listeners['panorama-error']();assert.equal(c.fallbackTarget.open,true);
    assert.match(c.statusTarget.textContent,/could not load/);c.disconnect();
});
