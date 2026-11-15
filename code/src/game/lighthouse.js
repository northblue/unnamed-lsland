import * as THREE from 'three';
import { LIGHTHOUSE } from './world.js';

// A fixed coastal landmark. Its reef sits beyond buildable/walkable land.
export function createLighthouse(scene) {
  const root = new THREE.Group(); root.name = 'coastal-lighthouse';
  root.position.set(LIGHTHOUSE.x, 0, LIGHTHOUSE.z); scene.add(root);
  const geometries = new Set(), materials = new Set();
  function material(color, options = {}) {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...options });
    materials.add(value); return value;
  }
  const ivory = material('#f0e7cc'), red = material('#b65e4b'), metal = material('#456365', { roughness: 0.48 });
  const stone = material('#9b9c87'), dark = material('#28454a');
  const glass = material('#b7ddd3', { transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.2, side: THREE.DoubleSide });
  const lamp = material('#fff1bc', { emissive: '#ffcd75', emissiveIntensity: 0 });
  function mesh(geometry, mat, x, y, z, parent = root) {
    geometries.add(geometry);
    const view = new THREE.Mesh(geometry, mat); view.position.set(x, y, z);
    view.castShadow = view.receiveShadow = !mat.transparent; parent.add(view); return view;
  }
  const reef = mesh(new THREE.IcosahedronGeometry(1, 2), stone, 0, -0.05, 0);
  reef.scale.set(LIGHTHOUSE.radius, 0.85, 1.65); reef.rotation.y = 0.4;
  mesh(new THREE.CylinderGeometry(1.12, 1.35, 0.38, 32), stone, 0, 0.78, 0);
  const height = 4.7, base = 0.97;
  for (let i = 0; i < 5; i++) {
    const bottom = 0.88 - i * 0.065, top = bottom - 0.065;
    mesh(new THREE.CylinderGeometry(top, bottom, height / 5, 32), i % 2 ? red : ivory, 0, base + height / 5 * (i + 0.5), 0);
  }
  // Door and recessed-looking dark window surrounds face the main island.
  const details = new THREE.Group(); details.rotation.y = Math.PI / 2; root.add(details);
  mesh(new THREE.BoxGeometry(0.36, 0.66, 0.07), metal, 0, 1.3, 0.85, details);
  for (const y of [2.65, 4.3]) mesh(new THREE.BoxGeometry(0.22, 0.35, 0.07), dark, 0, y, 0.88 - (y - base) * 0.069, details);
  mesh(new THREE.CylinderGeometry(1.02, 0.96, 0.16, 32), metal, 0, 5.73, 0);
  const railing = mesh(new THREE.TorusGeometry(0.96, 0.025, 6, 40), metal, 0, 6.05, 0); railing.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), metal, Math.cos(angle) * 0.96, 5.9, Math.sin(angle) * 0.96);
  }
  mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.86, 8, 1, true), glass, 0, 6.22, 0);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.9, 6), metal, Math.cos(angle) * 0.66, 6.22, Math.sin(angle) * 0.66);
  }
  mesh(new THREE.ConeGeometry(0.91, 0.55, 16), metal, 0, 6.9, 0);
  mesh(new THREE.SphereGeometry(0.08, 8, 6), metal, 0, 7.23, 0);
  const lantern = mesh(new THREE.SphereGeometry(0.23, 16, 12), lamp, 0, 6.22, 0); lantern.name = 'lighthouse-lantern';
  const glow = new THREE.PointLight('#ffcf83', 0, 7, 2); glow.position.set(0, 6.22, 0); root.add(glow);
  const beacon = new THREE.Group(); beacon.position.y = 6.22; beacon.name = 'lighthouse-beacon'; root.add(beacon);
  const spot = new THREE.SpotLight('#ffe0a2', 0, 32, 0.17, 0.9, 2);
  const target = new THREE.Object3D(); target.position.set(22, -6.34, 0); beacon.add(target, spot); spot.target = target;
  const beamTime={value:0};
  const beamMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    uniforms: { strength: { value: 0 }, time:beamTime, density:{value:0.16} },
    vertexShader: `varying float along;varying vec3 n,v,p;
      void main(){along=clamp(position.x/23.0,0.0,1.0);p=position;n=normalMatrix*normal;
        vec4 q=modelViewMatrix*vec4(position,1.0);v=q.xyz;gl_Position=projectionMatrix*q;}`,
    fragmentShader: `uniform float strength,time,density;varying float along;varying vec3 n,v,p;
      void main(){float edge=pow(abs(dot(normalize(n),normalize(-v))),1.3);
        float mist=0.91+0.09*sin(p.x*3.1+sin(p.y*5.0+p.z*4.0)+time*0.23);
        float fade=pow(1.0-along,2.0)*smoothstep(0.0,0.025,along);
        vec3 warm=mix(vec3(1.0,0.88,0.61),vec3(0.9,0.81,0.61),along);
        gl_FragColor=vec4(warm,strength*density*edge*fade*mist);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  materials.add(beamMaterial);
  const beams=[];
  for(const [i,radius] of [3.9,1.9,0.62].entries()) {
    const g=new THREE.ConeGeometry(radius,23,48,1,true);g.translate(0,-11.5,0);g.rotateZ(Math.PI/2);geometries.add(g);
    const m=i===0?beamMaterial:beamMaterial.clone();
    m.uniforms.strength=beamMaterial.uniforms.strength;m.uniforms.time=beamTime;m.uniforms.density.value=i===0?0.16:i===1?0.12:0.1;materials.add(m);
    const beam=new THREE.Mesh(g,m);beam.rotation.z=-Math.atan2(6.34,22);beacon.add(beam);beams.push(beam);
  }
  const haloMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { strength: beamMaterial.uniforms.strength },
    vertexShader: 'varying vec2 glowUv; void main(){glowUv=uv; vec4 center=modelViewMatrix*vec4(0.0,0.0,0.0,1.0); center.xy+=position.xy; gl_Position=projectionMatrix*center;}',
    fragmentShader: 'uniform float strength; varying vec2 glowUv; void main(){float r=length(glowUv-0.5)*2.0; float a=exp(-r*r*7.0)*(1.0-smoothstep(0.65,1.0,r)); gl_FragColor=vec4(1.0,0.72,0.3,a*strength*0.75);}',
  });
  const haloGeometry = new THREE.PlaneGeometry(2.2, 2.2);
  geometries.add(haloGeometry); materials.add(haloMaterial);
  const halo = new THREE.Mesh(haloGeometry, haloMaterial); halo.position.y = 6.22; root.add(halo);
  return {
    update(time, daylight, reduceMotion = false) {
      const night = 1 - THREE.MathUtils.smoothstep(daylight, 0.12, 0.55);
      lamp.emissiveIntensity = night * 3;
      glow.intensity = night * 9; spot.intensity = night * 260;
      beamMaterial.uniforms.strength.value = night;beams.forEach(b=>{b.visible=night>0.001;});
      beamTime.value=reduceMotion?0:time;
      halo.visible = night > 0.001;
      beacon.rotation.y = reduceMotion ? 0.7 : time * Math.PI / 14;
    },
    dispose() { root.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
