// Reproduce the web asset from the unmodified CC0 source; run from code/.
import fs from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// No images in this model: the exporter only needs FileReader for binary buffers.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
};
for (const name of ['Fish1', 'Fish2', 'Fish3', 'Whale', 'Dolphin']) {
  const input = fs.readFileSync(`assets/source/quaternius-fish/${name}.fbx`);
  const scene = new FBXLoader().parse(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '');
  const materials = new Map();
  scene.traverse(object => {
    if (!object.isMesh) return;
    if (name === 'Whale' || name === 'Dolphin') {
      object.geometry.deleteAttribute('normal');
      object.geometry = mergeVertices(object.geometry, 0.00001);
      object.geometry.computeVertexNormals();
    }
    // FBX alternates material groups for individual faces. Batch them so each
    // material becomes one draw call rather than dozens of tiny GLTF primitives.
    const geometry = object.geometry, sections = new Map();
    for (const group of geometry.groups) {
      if (!sections.has(group.materialIndex)) sections.set(group.materialIndex, []);
      const indices = sections.get(group.materialIndex);
      for (let i = group.start; i < group.start + group.count; i++) indices.push(geometry.index ? geometry.index.getX(i) : i);
    }
    if (sections.size) {
      const indices = []; geometry.clearGroups();
      for (const [materialIndex, section] of sections) {
        geometry.addGroup(indices.length, section.length, materialIndex); indices.push(...section);
      }
      geometry.setIndex(indices);
    }
    const convert = original => {
      if (!materials.has(original)) materials.set(original, new THREE.MeshStandardMaterial({
        name: original.name, color: original.color.clone(), roughness: 0.65, side: original.side,
      }));
      return materials.get(original);
    };
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
  });
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, animations: scene.animations });
  fs.writeFileSync(`public/models/quaternius-fish/${name}.glb`, Buffer.from(glb));
  console.log(`${name}.glb: ${glb.byteLength} bytes, ${scene.animations.length} animation(s)`);

}
