import * as THREE from 'three';

// Original procedural model: continuous tapered torso, earless head, paired
// rear flippers and whiskered muzzle distinguish a seal from the cetaceans.
export function createSealModel(configureMaterial = () => {}) {
  const root = new THREE.Group(); root.name = 'harbour-seal';
  const geometries = new Set(), materials = new Set();
  function material(color, roughness = 0.48) {
    const m = new THREE.MeshStandardMaterial({ color, roughness }); configureMaterial(m); materials.add(m); return m;
  }
  const skin = material('#8c9797'), fins = material('#626f73'), muzzle = material('#c5c5b7'), eyes = material('#132a32', 0.15);
  function oval(parent, m, x, y, z, sx, sy, sz) {
    const g = new THREE.SphereGeometry(1, 20, 12); geometries.add(g);
    const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }
  // Lathed about local X with softly varying cross sections, closed at both tips.
  const profile = [[-1.12,0.02],[-0.92,0.12],[-0.65,0.24],[-0.3,0.36],[0.1,0.39],[0.45,0.34],[0.72,0.27],[0.94,0.22],[1.02,0.02]];
  const curve = new THREE.CatmullRomCurve3(profile.map(([x,r]) => new THREE.Vector3(r,x,0)));
  const points = curve.getPoints(48).map(p => new THREE.Vector2(Math.max(0.015,p.x),p.y));
  const bodyGeometry = new THREE.LatheGeometry(points, 28); bodyGeometry.rotateZ(-Math.PI/2); geometries.add(bodyGeometry);
  const body = new THREE.Mesh(bodyGeometry, skin); root.add(body);
  oval(root, skin, 0.88,0.17,0,0.37,0.31,0.3);
  for (const side of [-1,1]) {
    oval(root,muzzle,1.15,0.09,side*0.1,0.22,0.13,0.14);
    oval(root,eyes,1.03,0.29,side*0.236,0.042,0.045,0.023);
    oval(root,eyes,1.32,0.16,side*0.032,0.045,0.027,0.028);
  }
  const flippers = [], rear = [];
  for (const side of [-1,1]) {
    const fin = new THREE.Group(); fin.position.set(0.35,-0.19,side*0.25); root.add(fin);
    const blade = oval(fin,fins,-0.12,-0.06,side*0.23,0.35,0.065,0.21); blade.rotation.y=side*0.55; flippers.push(fin);
    const tail = new THREE.Group(); tail.position.set(-1.02,-0.03,side*0.06); root.add(tail);
    const foot = oval(tail,fins,-0.2,0,side*0.1,0.29,0.055,0.15); foot.rotation.y=side*0.35; rear.push(tail);
  }
  // Sparse mottling lies on the back instead of separate floating spheres.
  const positions = bodyGeometry.attributes.position, colors = [];
  for (let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const spot=Math.sin(x*28+Math.sin(z*23))*Math.cos(z*30+Math.sin(y*27));
    const c=new THREE.Color('#8c9797').multiplyScalar(spot>0.67 && y>0 ? 0.65 : 1);
    colors.push(c.r,c.g,c.b);
  }
  bodyGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const bodyMaterial=material('#ffffff');bodyMaterial.vertexColors=true;body.material=bodyMaterial;
  const whiskerMaterial = new THREE.LineBasicMaterial({color:'#e0ddd0'}); configureMaterial(whiskerMaterial); materials.add(whiskerMaterial);
  for (const side of [-1,1]) for (let i=0;i<4;i++) {
    const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.2,0.1,side*0.16),new THREE.Vector3(1.35+i*0.025,0.08+(i-1.5)*0.035,side*(0.35+i*0.025))]);
    geometries.add(g);root.add(new THREE.Line(g,whiskerMaterial));
  }
  return { root, update(time, reduceMotion=false) {
    flippers.forEach((f,i)=>{f.rotation.x=reduceMotion?0:Math.sin(time*3+i*0.3)*0.3;f.rotation.y=(i?1:-1)*(0.1+(reduceMotion?0:Math.sin(time*3)*0.15));});
    rear.forEach((f,i)=>{f.rotation.y=reduceMotion?0:Math.sin(time*3.2+i*0.4)*0.22;});
  }, dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());} };
}
