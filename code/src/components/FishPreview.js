'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadFishCollection } from '../game/fishModel';
import { loadBirdModels } from '../game/birdModel';
import { loadMarineModels } from '../game/marineModels';
import { createStingrayModel } from '../game/stingrayModel';
import { createSealModel } from '../game/sealModel';
import { createShellModel, createCrabModel } from '../game/coastalLife';
import { createExplorerModel } from '../game/explorerModel';
import { messages } from '../game/messages';

const animals = ['coral', 'blue', 'gold', 'silver', 'bird', 'seagull', 'whale', 'dolphin', 'seal', 'stingray', 'shell', 'crab', 'explorer'];
export default function FishPreview() {
  const container = useRef(null), viewRef = useRef(null);
  const [language, setLanguage] = useState('zh');
  const [availability, setAvailability] = useState({});
  const [selected, setSelected] = useState('coral');
  const [walking, setWalking] = useState(false);
  const [modern, setModern] = useState(true), [resting, setResting] = useState(false);
  const text = messages[language].fishPreview;
  const isExplorer = selected === 'explorer';
  const isFish = animals.slice(0,4).includes(selected);
  const isMarine = ['whale','dolphin','seal','stingray'].includes(selected);
  const isBird = selected === 'bird' || selected === 'seagull';
  useEffect(() => {
    try { if (localStorage.getItem('unnamed-island-language') === 'en') setLanguage('en'); } catch { /* Optional preference. */ }
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#bed6d6');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 30); camera.position.set(1.5, 0.8, 3.2);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false;
    controls.target.y = 0.2; controls.minDistance = 1.4; controls.maxDistance = 5;
    scene.add(new THREE.HemisphereLight('#ffffff', '#648c8d', 2.4));
    const light = new THREE.DirectionalLight('#fff0d0', 2.5); light.position.set(2, 4, 3); scene.add(light);
    container.current.appendChild(renderer.domElement);
    const original = new THREE.Group(); original.visible = false; scene.add(original);
    const originalMaterial = new THREE.MeshStandardMaterial({ color: '#df867c', roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), originalMaterial);
    body.scale.set(0.46, 0.17, 0.2); original.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 3), originalMaterial);
    tail.scale.set(0.23, 0.35, 0.23); tail.rotation.z = -Math.PI / 2; tail.position.x = -0.5; original.add(tail);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#173746' });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMaterial);
      eye.position.set(0.28, 0.06, side * 0.18); original.add(eye);
    }
    let disposed = false;
    const templates = [], models = {};
    const state = { selected: 'coral', modern: true, resting: false, walking:false, models, original }; viewRef.current = state;
    async function load(loader, kinds, create) {
      try {
        const template = await loader();
        if (disposed) { template.dispose(); return; }
        templates.push(template);
        const statuses = {};
        for (const kind of kinds) {
          const model = create(template, kind);
          statuses[kind] = model ? 'ready' : 'error';
          if (model) {
            if (kind === 'whale') model.root.scale.setScalar(0.28);
            if (kind === 'dolphin') model.root.scale.setScalar(0.5);
            if (kind === 'stingray') { model.root.scale.setScalar(0.55); model.root.position.x = 0.65; }
            if (kind === 'seal') model.root.scale.setScalar(0.65);
            if (kind === 'shell') model.root.scale.setScalar(1.8);
            if (kind === 'crab') model.root.scale.setScalar(1.25);
            if (kind === 'explorer') { model.root.scale.setScalar(0.8); model.root.position.y=-0.45; }
            models[kind] = model; model.root.visible = false; scene.add(model.root); }
        }
        setAvailability(previous => ({ ...previous, ...statuses }));
      } catch { if (!disposed) setAvailability(previous => ({ ...previous, ...Object.fromEntries(kinds.map(k => [k, 'error'])) })); }
    }
    load(loadFishCollection, animals.slice(0, 4), (template, kind) => template.create(kind));
    load(loadBirdModels, ['bird', 'seagull'], (template, kind) => template.create(kind === 'seagull'));
    load(loadMarineModels, ['whale', 'dolphin'], (template, kind) => template.create(kind));
    load(async () => {
      const ray = createStingrayModel();
      return { create: () => ({ root: ray.root, update: (time, options) => ray.update(time, options.reduceMotion) }), dispose: () => ray.dispose() };
    }, ['stingray'], template => template.create());
    load(async () => {
      const seal = createSealModel();
      return { create: () => ({ root: seal.root, update: (time, options) => seal.update(time, options.reduceMotion) }), dispose: () => seal.dispose() };
    }, ['seal'], template => template.create());
    load(async () => {
      const models={shell:createShellModel(),crab:createCrabModel()};
      return {create:kind=>({root:models[kind].root,update:(time,options)=>models[kind].update?.(time,options.reduceMotion)}),dispose:()=>Object.values(models).forEach(model=>model.dispose())};
    }, ['shell','crab'], (template,kind)=>template.create(kind));
    load(async () => {const model=createExplorerModel();return {create:()=>model,dispose:()=>model.dispose()};}, ['explorer'],template=>template.create());
    let lastFit = 1;
    const resize = () => {
      const { width, height } = container.current.getBoundingClientRect();
      const fit = Math.max(1, 1.1 * height / Math.max(1, width));
      camera.position.sub(controls.target).multiplyScalar(fit / lastFit).add(controls.target);
      controls.minDistance = 1.4 * fit; controls.maxDistance = 5 * fit; lastFit = fit;
      camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(container.current); resize();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    renderer.setAnimationLoop(time => {
      if (document.hidden) return;
      original.visible = !state.modern;
      for (const [kind, model] of Object.entries(models)) {
        model.root.visible = state.modern && kind === state.selected;
        if (!model.root.visible) continue;
        model.update(reduceMotion.matches ? 0 : time / 1000, { moving:state.walking, resting: state.resting, gliding: false, reduceMotion: reduceMotion.matches });
      }
      tail.rotation.y = reduceMotion.matches ? 0 : Math.sin(time / 1000 * 9) * 0.5;
      controls.update(); renderer.render(scene, camera);
    });
    return () => {
      disposed = true; viewRef.current = null; observer.disconnect(); renderer.setAnimationLoop(null);
      controls.dispose(); templates.forEach(template => template.dispose());
      original.traverse(object => object.geometry?.dispose()); originalMaterial.dispose(); eyeMaterial.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  function selectAnimal(kind) {
    setSelected(kind); setModern(true);
    if (viewRef.current) { viewRef.current.selected = kind; viewRef.current.modern = true; }
  }
  function selectWalking(value) {setWalking(value);if(viewRef.current)viewRef.current.walking=value;}
  function selectModel(value) { setModern(value); if (viewRef.current) viewRef.current.modern = value; }
  function selectPose(value) { setResting(value); if (viewRef.current) viewRef.current.resting = value; }
  return <main className="fish-preview">
    <header><a href="/">{text.back}</a><button type="button" onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>{language === 'zh' ? 'English' : '中文'}</button></header>
    <h1>{text.title}</h1><p>{text.help}</p>
    <div className="fish-model-options" aria-label={text.choose}>
      {animals.map(kind => <button type="button" key={kind} aria-pressed={selected === kind} onClick={() => selectAnimal(kind)}>{text.animals[kind]}</button>)}
    </div>
    <div className="fish-model-options">
      {isBird ? <>
        <button type="button" aria-pressed={!resting} onClick={() => selectPose(false)}>{text.flying}</button>
        <button type="button" aria-pressed={resting} onClick={() => selectPose(true)}>{text.perched}</button>
      </> : isExplorer ? <>
        <button type="button" aria-pressed={!walking} onClick={()=>selectWalking(false)}>{text.idle}</button>
        <button type="button" aria-pressed={walking} onClick={()=>selectWalking(true)}>{text.walking}</button>
      </> : isFish ? <>
        <button type="button" aria-pressed={modern} onClick={() => selectModel(true)}>{text.newModel}</button>
        <button type="button" aria-pressed={!modern} onClick={() => selectModel(false)}>{text.oldModel}</button>
      </> : <span>{isMarine ? text.swimming : text.beach}</span>}
    </div>
    <div className="fish-model-stage" ref={container} aria-label={text.scene} />
    <p role="status">{text[availability[selected] || 'loading']}</p><p>{selected === 'stingray' ? text.stingrayNote : text.note}</p>
    <p><a href="https://quaternius.com/packs/animatedfish.html">Quaternius · CC0</a> · <a href="https://github.com/Mesh2Motion/mesh2motion-app">Mesh2Motion · CC0</a></p>
  </main>;
}
