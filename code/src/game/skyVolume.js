import * as THREE from 'three';
import { OCEAN_RADIUS } from './world.js';

// A visual volume only: no collision, weather simulation or persisted state.
export const SKY_VOLUME = { radius: OCEAN_RADIUS, y: -0.12, fade: 4 };
export function skyVisibility({x,y,z}) {
  const d = Math.hypot(x,y-SKY_VOLUME.y,z);
  return 1-THREE.MathUtils.smoothstep(d,SKY_VOLUME.radius-SKY_VOLUME.fade,SKY_VOLUME.radius);
}

// Fade individual animated bird fragments, including skinned feather tips.
// Shared materials remain shared; world position gives every bird its own fade.
export function fadeAtSkyBoundary(material) {
  if(material.userData.skyBoundary) return;
  material.userData.skyBoundary = true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = function(shader,renderer) {
    previous.call(this,shader,renderer);
    shader.uniforms.skySphere={value:new THREE.Vector3(SKY_VOLUME.radius,SKY_VOLUME.y,SKY_VOLUME.fade)};
    shader.vertexShader = 'varying vec3 skyWorldPosition;\n'+shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nskyWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 skyWorldPosition;uniform vec3 skySphere;\n'+shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>',
      `float skyDistance=length(skyWorldPosition-vec3(0.0,skySphere.y,0.0));
       diffuseColor.a*=1.0-smoothstep(skySphere.x-skySphere.z,skySphere.x,skyDistance);
       if(diffuseColor.a<0.005) discard;
       #include <alphatest_fragment>`);
  };
  material.customProgramCacheKey=()=> 'sky-sphere-fade-v1';
  material.transparent=true;material.depthWrite=false;material.needsUpdate=true;
}

export function createSkyVolume(scene) {
  const geometry=new THREE.SphereGeometry(SKY_VOLUME.radius,96,48,0,Math.PI*2,0,Math.PI/2);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.FrontSide,
    uniforms:{daylight:{value:1}},
    vertexShader:`varying vec3 viewNormal;varying float height;
      void main(){viewNormal=normalize(normalMatrix*normal);height=position.y;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float daylight;varying vec3 viewNormal;varying float height;
      void main(){float rim=pow(1.0-abs(normalize(viewNormal).z),5.0);
        float base=1.0-smoothstep(0.0,0.65,height);
        vec3 color=mix(vec3(0.38,0.52,0.78),vec3(0.79,0.94,0.96),daylight);
        gl_FragColor=vec4(color,(0.004+rim*0.17+base*0.035)*(0.6+0.4*daylight));
        #include <colorspace_fragment>
      }`,
  });
  const dome=new THREE.Mesh(geometry,material);dome.name='island-sky-sphere';
  dome.position.y=SKY_VOLUME.y;dome.renderOrder=4;dome.userData.skipWaterReflection=true;scene.add(dome);
  return {root:dome,update(daylight){material.uniforms.daylight.value=daylight;},dispose(){dome.removeFromParent();geometry.dispose();material.dispose();}};
}
