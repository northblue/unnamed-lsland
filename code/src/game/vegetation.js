import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight } from './world.js';
import { addPalmTree } from './palmTree.js';

export function createVegetation(scene, resources) {
  const group = new THREE.Group(); scene.add(group);
  const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
  const bark = new THREE.MeshStandardMaterial({ color: '#896348', roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true });
  const palmLeaves = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
  const palmBark = new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1});
  const coconut = new THREE.MeshStandardMaterial({ color: '#68513b', roughness: 1 });
  const palmFronds=[];
  const views = new Map(), crowns = [], geometries = [];
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const direction = new THREE.Vector3(), middle = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const palette = ['#62976b', '#83b474', '#4e8d64', '#a1c77a'];
  for (const [i, tree] of resources.filter((resource) => resource.type === 'wood').entries()) {
    const root = new THREE.Group(); root.position.set(tree.x, terrainHeight(tree.x, tree.z), tree.z); group.add(root);
    root.name=`tree:${tree.id}`;
    if(i%3===0) {
      const palm=addPalmTree(root,i,palmBark,palmLeaves,coconut);
      geometries.push(...palm.geometries);palmFronds.push(...palm.fronds);
      views.set(tree.id,root);root.userData.treeKind='coconut-palm';crowns.push({crown:palm.crown,phase:i*1.7});continue;
    }
    root.userData.treeKind=i%3===1?'broadleaf':'umbrella';
    const parts = [];
    function branch(a, b, radius) {
      const geometry = new THREE.CylinderGeometry(radius * 0.65, radius, 1, 9);
      direction.copy(b).sub(a); middle.copy(a).add(b).multiplyScalar(0.5);
      dummy.position.copy(middle); dummy.scale.set(1, direction.length(), 1);
      dummy.quaternion.setFromUnitVectors(up, direction.normalize()); dummy.updateMatrix();
      geometry.applyMatrix4(dummy.matrix); parts.push(geometry);
    }
    branch(new THREE.Vector3(), new THREE.Vector3(0.08, 2.7, 0), 0.2);
    branch(new THREE.Vector3(0, 1.3, 0), new THREE.Vector3(0.95, 1.6, 0.2), 0.09);
    branch(new THREE.Vector3(0.03, 1.8, 0), new THREE.Vector3(-0.65, 2.6, -0.2), 0.1);
    const trunkGeometry = mergeGeometries(parts); parts.forEach((part) => part.dispose()); geometries.push(trunkGeometry);
    const trunk = new THREE.Mesh(trunkGeometry, bark); trunk.castShadow = trunk.receiveShadow = true; root.add(trunk);
    const crown = new THREE.Group(); crown.position.y = 1.8; root.add(crown);
    const clusters = new THREE.InstancedMesh(leafGeometry, leaves, 7);
    for (let j = 0; j < 7; j++) {
      const angle = j * 2.4 + i;
      dummy.position.set(Math.cos(angle) * (j === 6 ? 0 : 0.62), (j === 6 ? 1.6 : 0.75 + j % 3 * 0.22), Math.sin(angle) * 0.52);
      dummy.rotation.set(0.15 * j, angle, 0); dummy.scale.set(i%3===2?1.08:0.8+j%2*0.15,i%3===2?0.46:0.8,i%3===2?1:0.75); dummy.updateMatrix();
      clusters.setMatrixAt(j, dummy.matrix); color.set(palette[(i + j) % palette.length]); clusters.setColorAt(j, color);
    }
    clusters.castShadow = clusters.receiveShadow = true; crown.add(clusters);
    views.set(tree.id, root); crowns.push({ crown, phase: i * 1.7 });
  }
  return {
    views,
    perches() { return [...views].filter(([, root]) => root.visible && root.scale.y>0.95).map(([id, root]) => {
      const p=root.userData.perch??{x:0.95,y:1.63,z:0.2};return {id,x:root.position.x+p.x,y:root.position.y+p.y,z:root.position.z+p.z};
    }); },
    update(time, reduceMotion) {
      for (const { crown, phase } of crowns) {
        crown.rotation.z = reduceMotion ? 0 : Math.sin(time * 1.2 + phase) * 0.025 + Math.sin(time * 0.31) * 0.012;
        crown.rotation.x = reduceMotion ? 0 : Math.cos(time * 0.8 + phase) * 0.018;
      }
      for(const {pivot,phase,amplitude} of palmFronds) {
        pivot.rotation.z=reduceMotion?0:Math.sin(time*1.1+phase)*amplitude;
        pivot.rotation.x=reduceMotion?0:Math.cos(time*0.83+phase)*amplitude*0.5;
      }
    },
    dispose() { group.removeFromParent(); geometries.forEach((geometry) => geometry.dispose()); leafGeometry.dispose(); bark.dispose(); leaves.dispose();palmLeaves.dispose();palmBark.dispose();coconut.dispose(); },
  };
}
