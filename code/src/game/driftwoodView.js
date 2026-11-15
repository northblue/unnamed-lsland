import * as THREE from 'three';

export function createDriftwoodView(scene, items) {
  const root = new THREE.Group(); root.name = 'drifting-supplies'; scene.add(root);
  const wood = new THREE.MeshStandardMaterial({color:'#aa673a',roughness:0.9});
  const rope = new THREE.MeshStandardMaterial({color:'#ead7a4',roughness:1});
  const views = items.map(item => {
    const group = new THREE.Group(); group.userData.driftId = item.id; root.add(group);
    const plank = new THREE.Group(), crate = new THREE.Group(); group.add(plank,crate);
    for (let i=0;i<3;i++) {
      const board=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.13,0.23),wood);
      board.position.z=(i-1)*0.28;board.rotation.y=i*0.06;plank.add(board);
    }
    const box=new THREE.Mesh(new THREE.BoxGeometry(0.85,0.65,0.8),wood);box.position.y=0.18;crate.add(box);
    for (const x of [-0.25,0.25]) {
      const band=new THREE.Mesh(new THREE.BoxGeometry(0.065,0.69,0.84),rope);band.position.set(x,0.18,0);crate.add(band);
    }
    return {group,plank,crate};
  });
  return {
    update(time,surfaceHeight,reduceMotion) {
      items.forEach((item,i)=>{
        const {group,plank,crate}=views[i];group.visible=item.visible;
        group.position.set(item.x,surfaceHeight(item.x,item.z)+0.08+(reduceMotion?0:Math.sin(time*1.8+i)*0.05),item.z);
        group.rotation.set(reduceMotion?0:Math.sin(time+i)*0.06,item.angle+0.4,reduceMotion?0:Math.cos(time*1.2+i)*0.05);
        plank.visible=item.kind==='plank';crate.visible=item.kind==='crate';
      });
    },
    hit(raycaster) {
      const hit=raycaster.intersectObjects(views.filter(v=>v.group.visible).map(v=>v.group),true)[0];
      let node=hit?.object;
      while(node && node.userData.driftId===undefined)node=node.parent;
      return node?.userData.driftId ?? null;
    },
    dispose(){root.removeFromParent();root.traverse(o=>o.geometry?.dispose());wood.dispose();rope.dispose();},
  };
}
