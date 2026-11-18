import * as THREE from 'three';
import { coastRadius } from './world.js';
import { beachHeight } from './beach.js';

// A thin swash sheet follows the beach lip; gameplay terrain remains unchanged.
export function createShoreWaves(scene) {
  const positions=[],indices=[],ratios=[],segments=256,rows=28;
  for(let row=0;row<=rows;row++)for(let col=0;col<=segments;col++) {
    const r=0.952+row/rows*0.23,angle=col/segments*Math.PI*2;
    const radius=coastRadius(angle), x=Math.cos(angle)*radius*r,z=Math.sin(angle)*radius*r;
    ratios.push(r);
    positions.push(x,Math.max(-0.09,beachHeight(x,z)+0.018),z);
    if(row<rows&&col<segments){const a=row*(segments+1)+col,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  geometry.setAttribute('shoreRatio',new THREE.Float32BufferAttribute(ratios,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0},daylight:{value:1}},
    vertexShader:`attribute float shoreRatio;varying float ratio;varying vec2 shore;void main(){ratio=shoreRatio;shore=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 shore;varying float ratio;uniform float time,daylight;
      void main(){float r=ratio;float angle=atan(shore.y,shore.x);
        float phase=fract(time/8.5+sin(angle*3.0)*0.075);
        float advance=smoothstep(0.0,1.0,phase);
        float irregular=sin(angle*15.0+time*0.22)*0.002+sin(angle*31.0)*0.0015;
        float front=mix(1.15,0.965,advance)+irregular;
        float crest=exp(-pow((r-front)/0.007,2.0));
        float trailing=exp(-pow((r-front-0.015)/0.013,2.0))*0.15;
        float life=sin(phase*3.14159265);
        float nextPhase=fract(phase+0.5);
        float nextFront=mix(1.15,0.965,smoothstep(0.0,1.0,nextPhase))+irregular;
        float nextCrest=exp(-pow((r-nextFront)/0.0055,2.0))*sin(nextPhase*3.14159265)*0.38;
        float broken=0.52+0.48*smoothstep(-0.6,0.7,sin(angle*21.0+sin(angle*7.0)*2.0+time*0.4));
        float grains=0.75+0.25*sin(angle*180.0+r*380.0+time*1.2);
        float lace=exp(-pow((r-1.003-irregular-sin(time*0.75+angle)*0.005)/0.005,2.0))*(0.12+0.09*sin(time*0.9+angle*2.0));
        float foam=((crest+trailing)*life+nextCrest+lace)*broken*grains;
        float wash=smoothstep(front-0.004,front+0.018,r)*(1.0-smoothstep(1.0,1.025,r))*life*0.09;
        vec3 water=mix(vec3(0.22,0.36,0.48),vec3(0.5,0.77,0.77),daylight);
        vec3 white=mix(vec3(0.48,0.62,0.72),vec3(0.96,0.99,0.93),daylight);
        float alpha=foam*0.64+wash;
        if(alpha<0.002)discard;
        gl_FragColor=vec4(mix(water,white,foam/max(0.001,foam+wash)),alpha);
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='beach-swash';mesh.renderOrder=2;mesh.userData.skipWaterReflection=true;scene.add(mesh);
  return {
    update(time,daylight,reduceMotion){material.uniforms.time.value=reduceMotion?3:time;material.uniforms.daylight.value=daylight;},
    dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();},
  };
}
