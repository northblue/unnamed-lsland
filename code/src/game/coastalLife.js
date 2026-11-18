import * as THREE from 'three';
import { ISLAND, POND, terrainHeight } from './world.js';

export function createShellModel(variant=0) {
  const root=new THREE.Group();root.name='spiral-conch';
  const positions=[],colors=[],indices=[],rows=80,sides=48;
  const cream=new THREE.Color(['#e6cfaa','#e8bba6','#ddd8ba'][variant%3]);
  // A closed whorled body, rather than a tube wound into an open spring.
  for(let i=0;i<=rows;i++) {
    const t=i/rows;
    const radius=(0.008+0.34*Math.pow(t,1.2))*(1-0.92*THREE.MathUtils.smoothstep(t,0.78,1));
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2,helix=a-t*Math.PI*7;
      const r=radius*(0.9+0.1*Math.cos(helix));
      positions.push(Math.cos(a)*r,0.7*(1-t),Math.sin(a)*r);
      const c=cream.clone().multiplyScalar(0.93+Math.cos(helix)*0.045+Math.sin(a*36)*0.012);colors.push(c.r,c.g,c.b);
      if(i<rows&&j<sides){const k=i*(sides+1)+j,n=k+sides+1;indices.push(k,n,k+1,k+1,n,n+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const shellMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.65,side:THREE.DoubleSide});
  const shell=new THREE.Mesh(geometry,shellMaterial);shell.castShadow=shell.receiveShadow=true;root.add(shell);
  const lipMaterial=new THREE.MeshStandardMaterial({color:'#f7d6b4',roughness:0.6});
  const lipGeometry=new THREE.TorusGeometry(0.145,0.017,8,40);
  const lip=new THREE.Mesh(lipGeometry,lipMaterial);lip.position.set(0.025,0.18,0.245);lip.scale.set(0.7,1.3,1);root.add(lip);
  const mouthMaterial=new THREE.MeshStandardMaterial({color:'#8d6550',roughness:0.9,side:THREE.DoubleSide});
  const mouthGeometry=new THREE.CircleGeometry(0.14,40),mouth=new THREE.Mesh(mouthGeometry,mouthMaterial);
  mouth.position.copy(lip.position);mouth.position.z-=0.008;mouth.scale.copy(lip.scale);root.add(mouth);
  const canalGeometry=new THREE.ConeGeometry(0.036,0.2,16),canal=new THREE.Mesh(canalGeometry,lipMaterial);
  canal.rotation.x=Math.PI;canal.position.set(0.025,-0.045,0.23);root.add(canal);
  return {root,dispose(){root.removeFromParent();[geometry,lipGeometry,mouthGeometry,canalGeometry].forEach(g=>g.dispose());[shellMaterial,lipMaterial,mouthMaterial].forEach(m=>m.dispose());}};
}

export function createCrabModel() {
  const root=new THREE.Group();root.name='shore-crab';const geometries=[],materials=[];
  const shell=new THREE.MeshStandardMaterial({color:'#ba6549',roughness:0.57}),legMaterial=new THREE.MeshStandardMaterial({color:'#a65a43',roughness:0.7}),eyeMaterial=new THREE.MeshStandardMaterial({color:'#173232',roughness:0.25});materials.push(shell,legMaterial,eyeMaterial);
  function oval(parent,material,x,y,z,sx,sy,sz){const g=new THREE.SphereGeometry(1,12,8);geometries.push(g);const m=new THREE.Mesh(g,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  function segment(parent,a,b,r){const g=new THREE.CylinderGeometry(r*0.7,r,a.distanceTo(b),7);geometries.push(g);const m=new THREE.Mesh(g,legMaterial);m.position.copy(a).add(b).multiplyScalar(0.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());parent.add(m);}
  oval(root,shell,0,0.13,0,0.22,0.105,0.29);const legs=[],claws=[];
  for(const side of [-1,1]){
    for(let i=0;i<4;i++){
      const pivot=new THREE.Group();pivot.position.set((i-1.5)*0.105,0.1,side*0.19);root.add(pivot);
      const knee=new THREE.Vector3((i-1.5)*0.06,0.035,side*0.19),tip=new THREE.Vector3((i-1.5)*0.12,-0.095,side*0.3);
      segment(pivot,new THREE.Vector3(),knee,0.025);segment(pivot,knee,tip,0.019);legs.push({pivot,phase:i+(side+1)*1.5});
    }
    const claw=new THREE.Group();claw.position.set(0.2,0.15,side*0.22);root.add(claw);
    segment(claw,new THREE.Vector3(),new THREE.Vector3(0.16,0.035,side*0.08),0.035);
    oval(claw,shell,0.22,0.05,side*0.09,0.1,0.065,0.07);
    const pincer=new THREE.Group();pincer.position.set(0.27,0.05,side*0.09);claw.add(pincer);
    oval(pincer,shell,0.055,0.02,side*0.035,0.085,0.025,0.026);
    oval(claw,shell,0.32,0.02,side*0.065,0.085,0.023,0.027);claws.push(pincer);
    segment(root,new THREE.Vector3(0.16,0.18,side*0.13),new THREE.Vector3(0.2,0.29,side*0.14),0.016);
    oval(root,eyeMaterial,0.2,0.295,side*0.14,0.032,0.035,0.032);
  }
  return {root,update(time,reduceMotion=false){
    legs.forEach(({pivot,phase})=>{pivot.rotation.x=reduceMotion?0:Math.sin(time*10+phase)*0.16;pivot.rotation.y=reduceMotion?0:Math.cos(time*10+phase)*0.08;});
    claws.forEach((c,i)=>{c.rotation.y=reduceMotion?0:Math.sin(time*1.7+i)*0.18;});
  },dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}

export function createCoastalLife(scene){
  const root=new THREE.Group();root.name='beach-wildlife';root.userData.skipWaterReflection=true;scene.add(root);const shells=[],crabs=[];
  for(let i=0;i<9;i++){
    const a=0.18+i*0.31,r=0.93+(i%2)*0.018,x=Math.cos(a)*ISLAND.x*r,z=Math.sin(a)*ISLAND.z*r;
    if(Math.hypot(x-POND.x,z-POND.z)<POND.radius+0.6)continue;
    const shell=createShellModel(i);shell.root.position.set(x,terrainHeight(x,z)+0.12,z);shell.root.rotation.set(0.9,i*1.9,0.25);shell.root.scale.setScalar(0.45+(i%3)*0.1);root.add(shell.root);shells.push(shell);
  }
  for(let i=0;i<4;i++){const crab=createCrabModel();crab.root.scale.setScalar(0.45);root.add(crab.root);crabs.push({...crab,angle:0.85+i*0.48});}
  return {update(time,reduceMotion=false){crabs.forEach((crab,i)=>{
    const a=crab.angle+(reduceMotion?0:Math.sin(time*0.14+i)*0.065),r=0.9;
    const x=Math.cos(a)*ISLAND.x*r,z=Math.sin(a)*ISLAND.z*r;
    crab.root.position.set(x,terrainHeight(x,z)+0.015,z);crab.root.rotation.y=-a;crab.update(time+i,reduceMotion);
  });},dispose(){root.removeFromParent();shells.forEach(s=>s.dispose());crabs.forEach(c=>c.dispose());}};
}
