import * as THREE from 'three';

// Original spotted stingray: continuous rounded disc, pale belly, paired gills and whip tail.
export function createStingrayModel(configureMaterial = () => {}) {
  const root = new THREE.Group(); root.name = 'spotted-stingray';
  const geometries = new Set(), materials = new Set();
  function material(color, roughness = 0.55) { const m = new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide }); configureMaterial(m); materials.add(m); return m; }
  const skin = material('#607c86'), belly = material('#d4ded8'), dark = material('#203c44'), spot = material('#b4d6d4'), eye = material('#0b1d25', 0.12);
  const sphere = new THREE.SphereGeometry(1, 18, 12); geometries.add(sphere);
  function oval(parent, mat, x, y, z, sx, sy, sz) { const m = new THREE.Mesh(sphere, mat); m.position.set(x,y,z);m.scale.set(sx,sy,sz); parent.add(m);return m; }
  const discs = [];
  for (const underside of [false, true]) {
    const positions = [], indices = [], segments = 96, rings = 22;
    for (let j=0;j<=rings;j++) for(let i=0;i<=segments;i++) {
      const r=j/rings,a=i/segments*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      const x=r*c*(c>0?1.22:0.93),z=r*s*1.75*(0.76+0.24*Math.abs(s));
      const dome=Math.sqrt(Math.max(0,1-r*r));
      positions.push(x,(underside?-0.085:0.17)*dome,z);
      if(j<rings&&i<segments){const k=j*(segments+1)+i,b=k+segments+1;indices.push(k,k+1,b,k+1,b+1,b);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();geometries.add(g);
    const m=new THREE.Mesh(g,underside?belly:skin);m.name=underside?'ray-belly':'ray-disc';root.add(m);discs.push({g,base:g.attributes.position.array.slice()});
  }
  for(const side of [-1,1]) {
    oval(root,skin,0.62,0.16,side*0.22,0.18,0.085,0.105);
    oval(root,eye,0.7,0.21,side*0.26,0.055,0.045,0.035);
    oval(root,spot,0.714,0.224,side*0.269,0.013,0.012,0.012);
    oval(root,dark,0.39,0.166,side*0.25,0.10,0.014,0.05).rotation.y=side*0.2;
    for(let i=0;i<5;i++) { const slit=oval(root,dark,0.43-i*0.14,-0.078,side*(0.26+i*0.022),0.045,0.008,0.10);slit.rotation.y=side*0.3; }
  }
  const mouthCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.68,-.073,-.12),new THREE.Vector3(.62,-.095,0),new THREE.Vector3(.68,-.073,.12)]);
  const mouthGeometry=new THREE.TubeGeometry(mouthCurve,16,.012,6,false);geometries.add(mouthGeometry);root.add(new THREE.Mesh(mouthGeometry,dark));
  const spots=[];
  for(let i=0;i<88;i++) {
    const r=Math.sqrt((i+.5)/88)*.93,a=i*2.399963,c=Math.cos(a),s=Math.sin(a);
    spots.push({x:r*c*(c>0?1.22:.93),y:.17*Math.sqrt(1-r*r)+.009,z:r*s*1.75*(.76+.24*Math.abs(s))});
  }
  const spotGeometry=new THREE.SphereGeometry(1,8,5);geometries.add(spotGeometry);
  const speckles=new THREE.InstancedMesh(spotGeometry,spot,spots.length);speckles.name='ray-dorsal-spots';root.add(speckles);
  const tailGeometry=new THREE.BufferGeometry(),tailPositions=[],tailIndices=[];
  for(let j=0;j<=40;j++)for(let i=0;i<=8;i++){tailPositions.push(0,0,0);if(j<40&&i<8){const a=j*9+i,b=a+9;tailIndices.push(a,b,a+1,a+1,b,b+1);}}
  tailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(tailPositions,3));tailGeometry.setIndex(tailIndices);geometries.add(tailGeometry);
  const tail=new THREE.Mesh(tailGeometry,skin);tail.name='ray-whip-tail';root.add(tail);
  // Small spine at the base of the tail; the animal remains a non-interactive visitor.
  oval(root,dark,-1.22,.035,0,.22,.025,.035);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),scale=new THREE.Vector3();
  function flap(x,z,t){const span=Math.abs(z)/1.75;return Math.pow(span,1.7)*Math.sin(t*2.7-x*1.4-span*.9)*.32;}
  function update(time, reduceMotion=false) {
    const t=reduceMotion?0:time;
    for(const {g,base} of discs) {
      const p=g.attributes.position;
      for(let i=0;i<p.count;i++)p.setY(i,base[i*3+1]+flap(base[i*3],base[i*3+2],t));
      p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
    }
    spots.forEach((p,i)=>{v.set(p.x,p.y+flap(p.x,p.z,t),p.z);scale.set(.024+(i%3)*.005,.007,.024+(i%3)*.005);matrix.compose(v,q,scale);speckles.setMatrixAt(i,matrix);});speckles.instanceMatrix.needsUpdate=true;
    const p=tailGeometry.attributes.position;
    for(let j=0;j<=40;j++)for(let i=0;i<=8;i++) {
      const u=j/40,a=i/8*Math.PI*2,r=.055*Math.pow(1-u,1.2)+.003;
      p.setXYZ(j*9+i,-.83-u*3.0,-.025+Math.cos(a)*r+Math.sin(u*4-t*1.7)*u*.04,Math.sin(a)*r+Math.sin(u*5-t*1.8)*u*u*.20);
    }
    p.needsUpdate=true;tailGeometry.computeVertexNormals();tailGeometry.computeBoundingSphere();
  }
  update(0);root.scale.setScalar(.8);
  return {root,update,dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
