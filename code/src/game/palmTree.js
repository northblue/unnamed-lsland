import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original coconut palm; three canopy tiers retain independent wind motion.
export function addPalmTree(root, index, bark, leafMaterial, coconutMaterial) {
  const geometries = [], fronds = [];
  const height = 3.6 + (index % 4) * 0.23, bend = 0.35 + index % 3 * 0.16;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3(0.04,height*0.4,0.04),new THREE.Vector3(bend*0.45,height*0.75,0.08),new THREE.Vector3(bend,height,0.04)]);
  function remember(g){geometries.push(g);return g;}
  function colored(g,low,high){
    const a=new THREE.Color(low),b=new THREE.Color(high),p=g.attributes.position,c=[];
    for(let i=0;i<p.count;i++){
      const grain=0.5+0.25*Math.sin(p.getY(i)*58)+0.12*Math.sin(p.getX(i)*65+p.getY(i)*15);
      const color=a.clone().lerp(b,grain);c.push(color.r,color.g,color.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));return g;
  }
  const trunkGeometry = new THREE.TubeGeometry(curve,48,0.205,14,false);
  const positions=trunkGeometry.attributes.position;
  for(let i=0;i<=48;i++) {
    const center=curve.getPointAt(i/48), taper=(1-i/48*0.6)*(1+0.025*Math.sin(i*1.9));
    for(let j=0;j<=14;j++) {
      const k=i*15+j;
      positions.setXYZ(k,center.x+(positions.getX(k)-center.x)*taper,center.y+(positions.getY(k)-center.y)*taper,center.z+(positions.getZ(k)-center.z)*taper);
    }
  }
  trunkGeometry.computeVertexNormals();remember(colored(trunkGeometry,'#75614b','#bda07a'));
  const trunk=new THREE.Mesh(trunkGeometry,bark);trunk.castShadow=trunk.receiveShadow=true;root.add(trunk);
  const rings=[];
  for(let i=1;i<33;i++) {
    const t=i/35,ring=new THREE.TorusGeometry(0.205*(1-t*0.6),0.009+(i%3)*0.0015,4,16);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),curve.getTangentAt(t));
    ring.applyQuaternion(q);ring.translate(...curve.getPointAt(t).toArray());rings.push(ring);
  }
  const ringGeometry=remember(mergeGeometries(rings));rings.forEach(g=>g.dispose());root.add(new THREE.Mesh(ringGeometry,coconutMaterial));
  const crown=new THREE.Group();crown.position.set(bend,height,0.04);root.add(crown);
  for(let tier=0;tier<3;tier++) {
    const pivot=new THREE.Group();pivot.name=`palm-fronds:${tier}`;crown.add(pivot);
    const vertices=[],colors=[];
    function triangle(a,b,c,color){vertices.push(...a.toArray(),...b.toArray(),...c.toArray());for(let k=0;k<3;k++)colors.push(color.r,color.g,color.b);}
    const leafCount=tier===2?3:6;
    for(let j=0;j<leafCount;j++) {
      const angle=j/leafCount*Math.PI*2+index*0.8+tier*0.56;
      const length=(tier===0?2.05:tier===1?1.8:1.24)+(j%3)*0.13;
      const droop=tier===0?1.08:tier===1?0.62:0.08;
      const lift=tier===2?0.85:0.5;
      const transform=p=>p.applyAxisAngle(new THREE.Vector3(0,1,0),angle);
      const spine=t=>new THREE.Vector3(length*t,lift*Math.sin(Math.PI*t*0.85)-droop*t*t+tier*0.065,0.045*Math.sin(t*4+j));
      const green=new THREE.Color(['#376e38','#4e863a','#6b9843'][tier]);
      for(let k=0;k<23;k++) {
        const t=0.07+k/24*0.9,p=spine(t),next=spine(Math.min(1,t+0.025));
        const span=(tier===2?0.28:0.48)*Math.pow(Math.sin(Math.PI*t),0.72);
        for(const side of [-1,1]) {
          const tip=p.clone().add(new THREE.Vector3(0.19+0.1*t,-0.11-0.12*t,side*span*(1+0.07*Math.sin(k*2.7+j))));
          const ridge=p.clone().lerp(tip,0.48);ridge.y+=0.045;
          const mid=tip.clone().lerp(next,0.3);mid.y-=0.018;
          const light=green.clone().multiplyScalar(1.02+0.15*Math.sin(k*1.8+j));
          const dark=green.clone().multiplyScalar(0.82);
          triangle(transform(p.clone()),transform(ridge.clone()),transform(next.clone()),light);
          triangle(transform(next.clone()),transform(ridge.clone()),transform(mid.clone()),green);
          triangle(transform(mid.clone()),transform(ridge.clone()),transform(tip.clone()),dark);
        }
      }
      // Narrow tapering leaf axis with a lighter ridge, batched with the leaflets.
      const gold=green.clone().lerp(new THREE.Color('#bac571'),0.4);
      for(let k=0;k<24;k++) {
        const t=k/24,a=spine(t),b=spine((k+1)/24),w=0.018*(1-t)+0.002;
        const p=a.clone().add(new THREE.Vector3(0,0,-w)),q=a.clone().add(new THREE.Vector3(0,0,w));
        const r=b.clone().add(new THREE.Vector3(0,0,-w)),s=b.clone().add(new THREE.Vector3(0,0,w));
        triangle(transform(p),transform(q.clone()),transform(r.clone()),gold);triangle(transform(r),transform(q),transform(s),gold);
      }
    }
    const g=remember(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const leaves=new THREE.Mesh(g,leafMaterial);leaves.castShadow=leaves.receiveShadow=true;pivot.add(leaves);
    fronds.push({pivot,phase:index+tier*1.9,amplitude:tier===2?0.035:0.055});
  }
  const shaftGeometry=remember(colored(new THREE.CylinderGeometry(0.105,0.15,0.46,12),'#6b7c36','#a7aa5a'));
  const shaft=new THREE.Mesh(shaftGeometry,bark);shaft.position.y=-0.02;crown.add(shaft);
  const nuts=[];
  for(let j=0;j<5;j++) {
    const g=new THREE.SphereGeometry(0.155+(j%2)*0.015,14,10);
    g.scale(0.9,1.22,0.95);g.rotateZ(Math.cos(j*2.4)*0.45);
    g.translate(Math.cos(j*2.4)*0.23,-0.27-(j%2)*0.09,Math.sin(j*2.4)*0.23);nuts.push(g);
  }
  const nutGeometry=remember(mergeGeometries(nuts));nuts.forEach(g=>g.dispose());const fruit=new THREE.Mesh(nutGeometry,coconutMaterial);fruit.name='coconut-cluster';fruit.castShadow=true;crown.add(fruit);
  root.userData.perch={x:bend+0.3,y:height-0.07,z:0.08};
  return {crown,geometries,fronds};
}
