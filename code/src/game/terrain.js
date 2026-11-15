import * as THREE from 'three';
import { ISLAND, SCENERY_ROCKS, terrainHeight } from './world.js';

export function createTerrain(scene) {
  const group = new THREE.Group(); scene.add(group);
  const positions = [], colors = [], indices = [];
  const segments = 160, rings = 72;
  const sand = new THREE.Color('#f7e4b5'), grass = new THREE.Color('#85b876'), stone = new THREE.Color('#9a9d89');
  const upland = new THREE.Color('#a4b683');
  const color = new THREE.Color();
  for (let row = 0; row <= rings; row++) {
    const r = row / rings;
    for (let col = 0; col <= segments; col++) {
      const angle = col / segments * Math.PI * 2;
      const x = Math.cos(angle) * ISLAND.x * r, z = Math.sin(angle) * ISLAND.z * r;
      const y = terrainHeight(x, z);
      positions.push(x, y, z);
      const edge = 0.78 + Math.sin(angle * 5) * 0.025 + Math.sin(angle * 9) * 0.015;
      const green = 1 - THREE.MathUtils.smoothstep(r, edge - 0.07, edge + 0.04);
      const slope = Math.hypot(terrainHeight(x+0.2,z)-terrainHeight(x-0.2,z), terrainHeight(x,z+0.2)-terrainHeight(x,z-0.2))/0.4;
      const exposed = THREE.MathUtils.smoothstep(slope, 0.7, 2.3) * THREE.MathUtils.smoothstep(y, 1, 2.2);
      color.copy(sand).lerp(grass, green);
      color.lerp(upland, green * THREE.MathUtils.smoothstep(y, 1.5, 5) * 0.35);
      color.lerp(stone, exposed * 0.8);
      // Broad, weathered variation follows the rock instead of hard dark bands.
      color.multiplyScalar(1 - exposed * (0.035 + 0.035 * Math.sin(y * 1.7 + Math.sin(x * 0.6 + z * 0.4))));
      color.multiplyScalar(0.97 + Math.sin(x * 2.4) * Math.cos(z * 1.9) * 0.025);
      colors.push(color.r, color.g, color.b);
      if (row < rings && col < segments) {
        const a = row * (segments + 1) + col, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  // The two copies at the polar seam must share a normal for continuous light.
  const normals = geometry.attributes.normal;
  const normal = new THREE.Vector3();
  for (let row = 0; row <= rings; row++) {
    const first = row * (segments + 1), last = first + segments;
    normal.set(normals.getX(first) + normals.getX(last), normals.getY(first) + normals.getY(last), normals.getZ(first) + normals.getZ(last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z); normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  const surface = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  surface.castShadow = true; surface.receiveShadow = true; group.add(surface);
  const side = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.025, 0.8, 128, 1, true), new THREE.MeshStandardMaterial({ color: '#e9d5a9', roughness: 1 }));
  side.scale.set(ISLAND.x, 1, ISLAND.z); side.position.y = 0.12; side.receiveShadow = true; group.add(side);
  // Irregular rock ledges hug the height field; their tops never rise above
  // walkable ground. Grass caps and stone bands reveal the terraced silhouette.
  const cliffMaterial = new THREE.MeshStandardMaterial({color:'#969b89',roughness:1});
  const ledgeGeometry = new THREE.IcosahedronGeometry(1, 1);
  for(let i=0;i<19;i++) {
    const angle=2.45+i*0.19;
    const x=-14.9+Math.cos(angle)*3.3, z=-2+Math.sin(angle)*5.4;
    const y=terrainHeight(x,z);
    if(y<1.4)continue;
    const column=new THREE.Mesh(ledgeGeometry,cliffMaterial);
    column.scale.set(0.65 + (i % 3) * 0.14, (y - 0.52) * 0.52, 0.75 + (i % 4) * 0.12);
    column.position.set(x,(y+0.52)/2-0.28,z);column.rotation.y=i*0.7;
    column.castShadow=column.receiveShadow=true;group.add(column);
  }
  const stairMaterial=new THREE.MeshStandardMaterial({color:'#c9bb95',roughness:1});
  for(let i=0;i<24;i++) {
    const x=-13.8-i*0.095,z=4.5-i*0.3,y=terrainHeight(x,z);
    const step=new THREE.Mesh(new THREE.BoxGeometry(1.05,0.13,0.36),stairMaterial);
    step.position.set(x,y-0.025,z);step.rotation.y=-0.3;step.receiveShadow=true;group.add(step);
  }
  const perches = [];
  for (const [index, rock] of SCENERY_ROCKS.entries()) {
    const view = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: index % 2 ? '#9ea99c' : '#b6b9a3', roughness: 1, flatShading: true }));
    view.scale.set(rock.radius, rock.height / 2, rock.radius * 0.85);
    view.position.set(rock.x, terrainHeight(rock.x, rock.z) + rock.height / 2, rock.z);
    view.castShadow = view.receiveShadow = true; group.add(view);
    perches.push({ id: `rock:${index}`, x: rock.x, z: rock.z, y: view.position.y + rock.height * 0.46 });
  }
  return {
    surface, perches,
    dispose() { group.removeFromParent(); group.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); }); },
  };
}
