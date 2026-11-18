// Run from code/. Pinned originals and individual licenses live beside the sources.
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(v => { this.result = v; this.onloadend?.(); }); } };
globalThis.ProgressEvent = class { constructor(type, values) { this.type = type; Object.assign(this, values); } };
const source = 'assets/source/mesh2motion-pets/', output = 'public/models/mesh2motion-pets/';
fs.mkdirSync(output, { recursive: true });
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const buffer = file => { const b = fs.readFileSync(source + file); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const clips = [];
for (const name of ['idle', 'walk', 'run', 'play-bow', 'sit', 'sleep']) {
  const gltf = await loader.parseAsync(buffer(name + '.glb'), ''); clips.push(gltf);
}
function unpack(b) { const length = b.readUInt32LE(12); return { json: JSON.parse(b.subarray(20, 20 + length)), binary: b.subarray(28 + length) }; }
function pack(json, binary) {
  const encoded = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32); encoded.copy(padded);
  const bin = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(bin);
  const result = Buffer.alloc(28 + padded.length + bin.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20);
  result.writeUInt32LE(bin.length, 20 + padded.length); result.writeUInt32LE(0x004e4942, 24 + padded.length); bin.copy(result, 28 + padded.length); return result;
}
for (const kind of ['cat', 'dog']) {
  const original = unpack(fs.readFileSync(source + kind + '.glb'));
  const imageView = original.json.bufferViews[original.json.images[0].bufferView];
  const png = original.binary.subarray(imageView.byteOffset, imageView.byteOffset + imageView.byteLength);
  for (const material of original.json.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  delete original.json.images; delete original.json.textures; delete original.json.samplers;
  original.json.buffers[0].uri = 'data:application/octet-stream;base64,' + original.binary.toString('base64');
  const model = await loader.parseAsync(JSON.stringify(original.json), '');
  // Local rest-pose deltas keep each animal's own face, proportions and bind pose.
  const animations = clips.flatMap(gltf => gltf.animations.map(clip => {
    const tracks = [];
    for (const sourceTrack of clip.tracks) {
      const split = sourceTrack.name.lastIndexOf('.'), name = sourceTrack.name.slice(0, split), property = sourceTrack.name.slice(split + 1);
      const from = gltf.scene.getObjectByName(name), to = model.scene.getObjectByName(name); if (!from || !to) continue;
      const track = sourceTrack.clone(), size = track.getValueSize();
      for (let i = 0; i < track.values.length; i += size) {
        if (property === 'quaternion') {
          const q = new THREE.Quaternion().fromArray(track.values, i);
          q.premultiply(from.quaternion.clone().invert()).premultiply(to.quaternion).normalize().toArray(track.values, i);
        } else if (property === 'position') {
          for (let j = 0; j < 3; j++) track.values[i + j] += to.position.getComponent(j) - from.position.getComponent(j);
        }
      }
      tracks.push(track);
    }
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }));
  model.scene.traverse(o => { if (o.isMesh) { o.material.roughness = 0.85; o.material.metalness = 0; } });
  const exported = unpack(Buffer.from(await new GLTFExporter().parseAsync(model.scene, { binary: true, animations })));
  const offset = exported.binary.length;
  exported.json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: png.length });
  exported.json.images = [{ bufferView: exported.json.bufferViews.length - 1, mimeType: 'image/png' }];
  exported.json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  exported.json.textures = [{ source: 0, sampler: 0 }];
  for (const material of exported.json.materials) material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
  const binary = Buffer.concat([exported.binary, png]); exported.json.buffers[0].byteLength = binary.length;
  const result = pack(exported.json, binary); fs.writeFileSync(output + kind + '.glb', result);
  console.log(kind, result.length, animations.map(a => a.name).join(', '));
}
