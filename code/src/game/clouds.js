import * as THREE from 'three';
import { SKY_VOLUME } from './skyVolume.js';

// Camera-facing wisps: one draw per cloud, no hard sphere surfaces or external texture.
export function createClouds(scene) {
  const root=new THREE.Group();root.name='sea-breeze-clouds';root.userData.skipWaterReflection=true;scene.add(root);
  const positions=[],corners=[],sizes=[],seeds=[];
  const lobes=[[-1.4,0,0,1.25],[-0.55,0.25,0.2,1.65],[0.35,0.5,0,1.8],[1.3,0.05,0.15,1.35],[0,-0.2,0.4,1.5],[-1.9,-0.18,0.1,0.85],[1.9,-0.2,0,0.9]];
  for(const [i,[x,y,z,size]] of lobes.entries())for(const corner of [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]]) {
    positions.push(x,y,z);corners.push(...corner);sizes.push(size);seeds.push(i*3.17);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('corner',new THREE.Float32BufferAttribute(corners,2));
  geometry.setAttribute('puffSize',new THREE.Float32BufferAttribute(sizes,1));
  geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1));
  const uniforms={time:{value:0},daylight:{value:1},twilight:{value:0},sphere:{value:new THREE.Vector3(SKY_VOLUME.radius,SKY_VOLUME.y,SKY_VOLUME.fade)}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,
    vertexShader:`attribute vec2 corner;attribute float puffSize,seed;
      varying vec2 puffUv;varying float puffSeed;varying vec3 skyWorld;
      void main(){puffUv=corner;puffSeed=seed;
        vec4 p=modelViewMatrix*vec4(position,1.0);
        float scale=length(modelMatrix[0].xyz);
        vec3 viewOffset=vec3(corner.x*puffSize*scale,corner.y*puffSize*scale*0.68,0.0);
        p.xyz+=viewOffset;
        skyWorld=(modelMatrix*vec4(position,1.0)).xyz+(vec4(viewOffset,0.0)*viewMatrix).xyz;
        gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform float time,daylight,twilight;uniform vec3 sphere;
      varying vec2 puffUv;varying float puffSeed;varying vec3 skyWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 uv=puffUv;float n=noise(uv*3.4+vec2(puffSeed+time*0.025,0.0))*0.6+noise(uv*7.0+puffSeed-time*0.018)*0.4;
        float density=pow(max(0.0,1.0-dot(uv,uv)),1.7)*smoothstep(0.05,0.75,n);
        float boundary=1.0-smoothstep(sphere.x-sphere.z,sphere.x,length(skyWorld-vec3(0.0,sphere.y,0.0)));
        float light=smoothstep(-1.0,0.9,uv.y)*0.13;
        vec3 color=mix(vec3(0.35,0.43,0.62),vec3(0.88,0.93,0.94)+light,daylight);
        color=mix(color,vec3(1.0,0.78,0.65),twilight*0.3);
        float alpha=density*boundary*(0.38+daylight*0.12);
        if(alpha<0.002)discard;gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`,
  });
  const clouds=Array.from({length:7},(_,i)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`cumulus:${i}`;
    mesh.scale.setScalar(0.95+(i%3)*0.24);mesh.frustumCulled=false;root.add(mesh);return mesh;
  });
  function update(time,daylight,reduceMotion=false,twilight=0) {
    const t=reduceMotion?0:time;
    uniforms.time.value=t;uniforms.daylight.value=daylight;uniforms.twilight.value=twilight;
    clouds.forEach((mesh,i)=>{
      const progress=((t/(145+i*7)+i*0.151)%1+1)%1;
      mesh.position.set((progress*2-1)*43,10+(i%3)*2.2+Math.sin(t*0.12+i)*0.3,-22+i*7.2+Math.sin(t*0.025+i)*1.2);
      mesh.visible=mesh.position.length()<SKY_VOLUME.radius+7;
    });
  }
  update(0,1);
  return {root,update,dispose(){root.removeFromParent();geometry.dispose();material.dispose();}};
}
