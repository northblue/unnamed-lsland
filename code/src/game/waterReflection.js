import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// One transparent surface, one correctly mirrored camera. No screen-space
// refraction pass that redraws fish or stretches above-water objects underwater.
export function createWaterReflection(geometry, normalMap) {
  const shader = {
    uniforms: {
      color: { value: new THREE.Color('#2d9fab') }, tDiffuse: { value: null }, textureMatrix: { value: null },
      normalMap: { value: normalMap }, time: { value: 0 }, orthographic: { value: 1 },
    },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 mirrorUv;
      varying vec2 waterUv; varying vec3 viewPosition; varying vec3 viewNormal;
      void main(){ mirrorUv=textureMatrix*vec4(position,1.0); waterUv=uv;
        vec4 p=modelViewMatrix*vec4(position,1.0); viewPosition=p.xyz;
        viewNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*p; }`,
    fragmentShader: `uniform sampler2D tDiffuse,normalMap; uniform vec3 color;
      uniform float time,orthographic; varying vec4 mirrorUv; varying vec2 waterUv;
      varying vec3 viewPosition,viewNormal;
      void main(){
        vec2 ripple=texture2D(normalMap,waterUv*3.0+vec2(time*0.006,time*0.003)).rg*2.0-1.0;
        vec2 uv=mirrorUv.xy/mirrorUv.w+ripple*0.0012;
        vec2 pixel=vec2(1.0/512.0);
        vec3 reflected=texture2D(tDiffuse,uv).rgb*0.4;
        reflected+=(texture2D(tDiffuse,uv+vec2(pixel.x,0.0)).rgb+texture2D(tDiffuse,uv-vec2(pixel.x,0.0)).rgb
          +texture2D(tDiffuse,uv+vec2(0.0,pixel.y)).rgb+texture2D(tDiffuse,uv-vec2(0.0,pixel.y)).rgb)*0.15;
        vec3 eye=normalize(mix(-viewPosition,vec3(0.0,0.0,1.0),orthographic));
        float facing=clamp(dot(normalize(viewNormal),eye),0.0,1.0);
        float fresnel=0.02+0.45*pow(1.0-facing,5.0);
        float alpha=0.16+fresnel*0.84;
        gl_FragColor=vec4(mix(color,reflected,fresnel/alpha),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const surface = new Reflector(geometry, { shader, textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: 0.003 });
  surface.name = 'single-water-reflection';
  surface.material.transparent = true; surface.material.depthWrite = false;
  const mirrorRender = surface.onBeforeRender;
  const reflectionSky = new THREE.Color('#bdd8dc');
  const daySky = reflectionSky.clone(), nightSky = new THREE.Color('#102a40');
  const tintDay = new THREE.Color('#2d9fab'), tintNight = new THREE.Color('#123c52');
  surface.onBeforeRender = function(renderer, scene, camera) {
    surface.material.uniforms.orthographic.value = camera.isOrthographicCamera ? 1 : 0;
    const hidden = [];
    scene.traverse(o => { if (o.visible && o.userData.skipWaterReflection) { hidden.push(o); o.visible = false; } });
    const background = scene.background; scene.background = reflectionSky;
    try { mirrorRender.call(surface, renderer, scene, camera); }
    finally { scene.background = background; hidden.forEach(o => { o.visible = true; }); }
  };
  return {
    surface,
    update(time, daylight) {
      surface.material.uniforms.time.value = time;
      surface.material.uniforms.color.value.copy(tintNight).lerp(tintDay, daylight);
      reflectionSky.copy(nightSky).lerp(daySky, daylight);
    },
    dispose() { surface.dispose(); },
  };
}
