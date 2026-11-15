import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWaterReflection } from './waterReflection.js';

test('water mirrors the camera across its surface and restores excluded screen-space scenery', () => {
  const scene=new THREE.Scene(), texture=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
  const water=createWaterReflection(new THREE.PlaneGeometry(20,20),texture);
  water.surface.rotation.x=-Math.PI/2;water.surface.position.y=-0.12;scene.add(water.surface);
  const sky=new THREE.Object3D();sky.userData.skipWaterReflection=true;scene.add(sky);
  const camera=new THREE.OrthographicCamera(-10,10,10,-10,0.1,100);camera.position.set(10,15,20);camera.lookAt(0,0,0);
  camera.updateMatrixWorld();scene.updateMatrixWorld(true);let rendered=false;
  const original=new THREE.Color('#abcdef');scene.background=original;
  const renderer={xr:{enabled:false},shadowMap:{autoUpdate:true},autoClear:true,
    getRenderTarget:()=>null,setRenderTarget:()=>{},state:{buffers:{depth:{setMask:()=>{}}}},
    render(s,mirror){rendered=true;assert.equal(sky.visible,false);assert.ok(Math.abs(mirror.position.y+15.24)<0.0001);
      assert.ok(mirror.projectionMatrix.elements.every(Number.isFinite));assert.notEqual(s.background,original);},
  };
  water.surface.onBeforeRender(renderer,scene,camera);
  assert.ok(rendered);assert.equal(sky.visible,true);assert.equal(scene.background,original);
  water.dispose();water.surface.geometry.dispose();texture.dispose();
});
