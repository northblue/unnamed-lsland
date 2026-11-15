// Run from code/. CC0 sources and provenance: doc/references/animal-models.md.
import fs from 'node:fs';
import sharp from 'sharp';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
};
globalThis.ProgressEvent = class { constructor(type, values) { this.type = type; Object.assign(this, values); } };
const base = 'assets/source/mesh2motion-birds/';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const animations = [];
for (const name of ['flap', 'glide', 'idle']) {
  const file = fs.readFileSync(`${base}${name}.glb`);
  animations.push(...(await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).animations);
}
for (const name of ['seagull', 'bird']) {
  const file = fs.readFileSync(`${base}${name}.glb`);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength));
  const binary = file.subarray(28 + jsonLength);
  const imageView = json.bufferViews[json.images[0].bufferView];
  const image = binary.subarray(imageView.byteOffset, imageView.byteOffset + imageView.byteLength);
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Bake the original nearest-filtered palette into vertex colors. The runtime
  // GLB retains the colors but needs neither image decoding nor a texture fetch.
  for (const material of json.materials) delete material.pbrMetallicRoughness?.baseColorTexture;
  delete json.images; delete json.textures; delete json.samplers;
  json.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
  const gltf = await loader.parseAsync(JSON.stringify(json), '');
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    const uv = object.geometry.attributes.uv, colors = [];
    for (let i = 0; i < uv.count; i++) {
      const x = THREE.MathUtils.clamp(Math.floor(uv.getX(i) * info.width), 0, info.width - 1);
      const y = THREE.MathUtils.clamp(Math.floor(uv.getY(i) * info.height), 0, info.height - 1);
      const offset = (y * info.width + x) * 4;
      const color = new THREE.Color().setRGB(data[offset] / 255, data[offset + 1] / 255, data[offset + 2] / 255, THREE.SRGBColorSpace);
      // Warm feather variant for the smaller island birds; keep eyes/beak intact.
      if (name === 'bird' && Math.abs(data[offset] - data[offset + 1]) < 22 && Math.abs(data[offset + 1] - data[offset + 2]) < 22) {
        if (data[offset] > 175) color.set('#d6b58a');
        else if (data[offset] > 50) color.set('#806b52');
      }
      colors.push(color.r, color.g, color.b);
    }
    object.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    object.material.vertexColors = true; object.material.roughness = 0.82;
  });
  const glb = await new GLTFExporter().parseAsync(gltf.scene, { binary: true, animations });
  fs.writeFileSync(`public/models/mesh2motion-birds/${name}.glb`, Buffer.from(glb));
  console.log(`${name}: ${glb.byteLength} bytes; ${animations.map(a => a.name).join(', ')}`);
}
