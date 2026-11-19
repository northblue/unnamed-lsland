import * as THREE from 'three';
import { surfTrackRadius } from './surfing.js';
import { SWELL_GLSL } from './surfSwell.js';

// A raised water shoulder plus a separate rolling lip, rather than a flat foam decal.
export function createOrbitWaves(scene) {
  const root = new THREE.Group(); root.name = 'circling-island-swell'; root.userData.skipWaterReflection = true; scene.add(root);
  const uniforms = { time: { value: 0 }, daylight: { value: 1 }, motion: { value: 1 } };
  function geometry(lip) {
    const positions = [], uv = [], indices = [], segments = 384, rows = lip ? 12 : 48;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2, lane = lip ? 2.9 : -1.5 + j / rows * 7;
      const r = surfTrackRadius(angle) + lane;
      positions.push(Math.cos(angle) * r, -0.1, Math.sin(angle) * r); uv.push(i / segments, j / rows);
      if (j < rows && i < segments) { const a = j * (segments + 1) + i, b = a + segments + 1; indices.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); return g;
  }
  function material(lip) {
    return new THREE.ShaderMaterial({ transparent: true, depthWrite: !lip, side: THREE.DoubleSide, uniforms,
      vertexShader: `uniform float time,motion;varying vec2 waveUv;varying vec3 waveWorld;varying float height,packet;${SWELL_GLSL}
      void main(){waveUv=uv;vec3 p=position;float a=uv.x*6.2831853;packet=wavePacket(a,time);float lane=${lip ? '2.9' : '-1.5+uv.y*7.'};height=motion*swellHeight(a,lane,time);
      ${lip ? 'float curl=uv.y*1.8;p.xz-=normalize(p.xz)*sin(curl)*.85*packet*motion;height+=motion*packet*(.3*sin(curl)-.7*(1.-cos(curl)));' : ''}
      p.y+=height;waveWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(waveWorld,1.);}`,
      fragmentShader: `uniform float time,daylight,motion;varying vec2 waveUv;varying vec3 waveWorld;varying float height,packet;
      vec2 hash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
      float lace(vec2 p){vec2 g=floor(p),f=fract(p);float d1=9.,d2=9.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 r=o+hash(g+o)-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else d2=min(d2,d);}return 1.-smoothstep(.015,.095,d2-d1);}
      void main(){float a=waveUv.x*6.2831853;float lane=${lip ? '2.9' : '-1.5+waveUv.y*7.'};
      float edge=${lip ? 'smoothstep(.15,.6,packet)*motion' : 'smoothstep(-1.5,-.6,lane)*(1.-smoothstep(4.5,5.5,lane))'};
      if(edge<.003)discard;
      vec3 n=normalize(cross(dFdx(waveWorld),dFdy(waveWorld)));if(n.y<0.)n=-n;
      float lighting=.63+.37*max(0.,dot(n,normalize(vec3(-.4,.9,.3))));
      vec2 cells=vec2(a*48.,lane*3.4+sin(a*14.-time*.65)*.17-time*.2);
      float web=lace(cells);float crest=exp(-pow((lane-2.75)/.34,2.))*(.18+.82*packet);
      float foam=${lip ? '(.45+.4*web+.45*smoothstep(.35,.8,waveUv.y))*smoothstep(.05,.45,packet)' : 'web*crest*1.3+pow(web,3.)*packet*exp(-pow((lane-1.3)/1.2,2.))*.15'};
      vec3 tint=mix(vec3(.012,.16,.19),vec3(.025,.36,.34),clamp(height*.42,0.,1.));
      tint*=mix(.27,1.,daylight)*lighting;
      vec3 eye=normalize(cameraPosition-waveWorld);float sheen=pow(max(0.,dot(reflect(normalize(vec3(.4,-.9,-.3)),n),eye)),45.)*.22*daylight;
      vec3 white=mix(vec3(.32,.53,.62),vec3(.93,.99,.97),daylight);
      gl_FragColor=vec4(mix(tint+sheen,white,clamp(foam,0.,1.)),edge*${lip ? '(.5+foam*.45)' : '(.76+foam*.22)'});
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    });
  }
  const mesh = new THREE.Mesh(geometry(false), material(false)), lip = new THREE.Mesh(geometry(true), material(true));
  mesh.name = 'swell-water-face'; lip.name = 'breaking-wave-lip';
  for (const m of [mesh, lip]) { m.frustumCulled = false; m.renderOrder = m === mesh ? 3 : 4; root.add(m); }
  return { mesh, root, update(time, daylight, reduceMotion) { uniforms.time.value = reduceMotion ? 0 : time; uniforms.motion.value = reduceMotion ? 0 : 1; uniforms.daylight.value = daylight; },
    dispose() { root.removeFromParent(); for (const m of [mesh, lip]) { m.geometry.dispose(); m.material.dispose(); } },
  };
}
