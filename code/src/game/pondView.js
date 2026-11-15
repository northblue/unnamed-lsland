import * as THREE from 'three';
import { POND } from './world.js';
import { FISH_KINDS } from './fishing.js';
import { loadFishCollection } from './fishModel.js';

export function createPondView(scene, { modelLoader = typeof window === 'undefined' ? null : loadFishCollection } = {}) {
  let disposed = false, template;
  const root = new THREE.Group(); root.name = 'seaside-fish-pond';
  root.position.set(POND.x, 0, POND.z); scene.add(root);
  const stone = new THREE.MeshStandardMaterial({ color: '#a6aaa0', roughness: 0.95 });
  const sand = new THREE.MeshStandardMaterial({ color: '#9eafa0', roughness: 1 });
  const waterMaterial = new THREE.MeshPhysicalMaterial({ color: '#318fa3', transparent: true, opacity: 0.28, roughness: 0.16, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const bed = new THREE.Mesh(new THREE.CircleGeometry(1.95, 64), sand);
  bed.rotation.x = -Math.PI/2; bed.position.y = 0.19; root.add(bed);
  for (let i=0; i<24; i++) {
    const a=i/24*Math.PI*2;
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(0.33, 0), stone);
    rock.position.set(Math.cos(a)*POND.radius, 0.57, Math.sin(a)*POND.radius);
    rock.scale.set(1.1, 0.8+(i%3)*0.12, 0.9); rock.rotation.y=a;
    rock.castShadow=rock.receiveShadow=true; root.add(rock);
  }
  const surface=new THREE.Mesh(new THREE.CircleGeometry(1.99, 64), waterMaterial);
  surface.rotation.x=-Math.PI/2; surface.position.y=POND.waterY; surface.renderOrder=3; root.add(surface);
  const fishMaterials=['#da921f', '#286f9d', '#c85848', '#739e92'].map(color=>new THREE.MeshStandardMaterial({color, roughness:0.55}));
  const bodyGeometry=new THREE.SphereGeometry(0.2, 10, 6), tailGeometry=new THREE.ConeGeometry(0.16, 0.22, 3);
  const eyeMaterial=new THREE.MeshBasicMaterial({color:'#253c38'});
  const eyeGeometry=new THREE.SphereGeometry(0.035,6,4);
  const fish=[];
  for (let i=0;i<POND.capacity;i++) {
    const group=new THREE.Group(); group.name=`pond-fish:${i}`; group.visible=false; root.add(group);
    const body=new THREE.Mesh(bodyGeometry,fishMaterials[0]); body.scale.set(1.7,0.65,0.8);group.add(body);
    const tail=new THREE.Mesh(tailGeometry,fishMaterials[0]);tail.rotation.z=-Math.PI/2;tail.position.x=-0.36;group.add(tail);
    for(const side of [-1,1]) {
      const eye=new THREE.Mesh(eyeGeometry,eyeMaterial); eye.position.set(0.21,0.07,side*0.1); group.add(eye);
    }
    fish.push({group, body, tail, fallback: [...group.children]});
  }
  let signature='';
  if (modelLoader) Promise.resolve().then(() => modelLoader()).then(value => {
    if (disposed) { value.dispose(); return; }
    template = value; signature = ''; // Rebuild appearances on the next snapshot.
  }).catch(() => { /* Keep pond fish visible when models cannot load. */ });
  return {
    update(pond, time, reduceMotion) {
      const next=JSON.stringify(pond);
      if(next!==signature) {
        signature=next; let index=0;
        FISH_KINDS.forEach((kind,k)=>{for(let n=0;n<pond[kind] && index<fish.length;n++) {
          const view=fish[index++]; view.group.visible=true;view.body.material=view.tail.material=fishMaterials[k];
          if (template && (!view.imported || view.kind !== kind)) {
            view.imported?.dispose(); view.imported = template.create(kind); view.kind = kind;
            view.fallback.forEach(child => { child.visible = !view.imported; });
            if (view.imported) {
              view.imported.root.scale.setScalar(0.43); view.group.add(view.imported.root);
              view.group.userData.model = `quaternius-${kind}`;
            } else delete view.group.userData.model;
          }
        }});
        for(;index<fish.length;index++) fish[index].group.visible=false;
      }
      fish.forEach(({group,tail,imported},i)=>{
        if(!group.visible)return;
        const angle=i*2.399+(reduceMotion?0:time*0.36*(i%2?-1:1));
        const r=0.65+(i%4)*0.26;
        group.position.set(Math.cos(angle)*r,0.36+(i%3)*0.035,Math.sin(angle)*r*0.78);
        group.rotation.y=-angle+(i%2?Math.PI/2:-Math.PI/2);
        tail.rotation.y=reduceMotion?0:Math.sin(time*8+i)*0.3;
        imported?.update(reduceMotion ? 0 : time * (0.7 + i % 4 * 0.13) + i * 0.37);
      });
    },
    dispose(){disposed=true;fish.forEach(view=>view.imported?.dispose());template?.dispose();root.removeFromParent();root.traverse(o=>o.geometry?.dispose());stone.dispose();sand.dispose();waterMaterial.dispose();eyeMaterial.dispose();fishMaterials.forEach(m=>m.dispose());},
  };
}
