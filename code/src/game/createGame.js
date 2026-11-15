import * as THREE from 'three';
import { ISLAND, SPAWN, movePlayer, terrainHeight, activeObstacles, SCENERY_TREES } from './world';
import { buildHut, HUT, placementError, findBuildSpot, hutMaterialsMissing } from './building.js';
import { createCameraControls } from './cameraControls.js';
import { createBuildSelection } from './buildSelection.js';
import { isTap } from './waterInteraction.js';
import { createIslandState, validateIslandState } from './islandState.js';
import { createWater } from './water.js';
import { createDayClock, localHour } from './dayCycle.js';
import { createSky } from './sky.js';
import { createClouds } from './clouds.js';
import { createSkyVolume } from './skyVolume.js';
import { createFishingState, startCast, stepFishing, landFish, isNearShore, CAST_RANGE } from './fishing.js';
import { createFishingView } from './fishingView.js';
import { createTerrain } from './terrain.js';
import { createLighthouse } from './lighthouse.js';
import { createCoastalLife } from './coastalLife.js';
import { createExplorerModel } from './explorerModel.js';
import { createVegetation } from './vegetation.js';
import { createBirds } from './birds.js';
import { createShoreWaves } from './shoreWaves.js';
import { createDriftwood, stepDriftwood, nearbyDriftwood, collectDriftwood } from './driftwood.js';
import { createDriftwoodView } from './driftwoodView.js';
import { createPondView } from './pondView.js';
import { transferPondFish } from './pond.js';
import { createAmbience } from './ambience.js';
import { createGatheringState, findNearbyResource, gatherResource, stepTreeGrowth, resourceSnapshot, treeCovered, TREE_GROW_SECONDS } from './gathering.js';

export function createGame(container, onHudChange = () => {}, initialState = createIslandState(), onSnapshot = () => {}) {
  const initial = validateIslandState(initialState);
  let islandName = initial.name;
  let paused = false;
  let nextSnapshotAt = 0;
  let lastSnapshotSignature = JSON.stringify(initial);
  const buildingViews = new Map();
  const gathering = createGatheringState();
  let catches = { ...initial.catches };
  let pond = { ...initial.pond };
  const fishing = createFishingState();
  const construction = { buildings: [] };
  let buildingMode = false;
  let buildNoticeUntil = 0;
  const scene = new THREE.Scene();
  const ambience = createAmbience();
  scene.background = null;
  const sky = createSky(scene);
  const clouds = createClouds(scene);
  const skyVolume = createSkyVolume(scene);
  const dayClock = createDayClock();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor('#b8cecd');
  renderer.transmissionResolutionScale = 0.75;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-19, 19, 15, -15, 0.1, 150);
  camera.position.set(23, 28, 31);
  camera.lookAt(0, 0, 0);
  const cameraControls = createCameraControls(camera, renderer.domElement);
  const ambient = new THREE.HemisphereLight('#f8ffff', '#75977b', 2.5);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff1d2', 3);
  sun.position.set(-12, 24, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28 });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const moonlight = new THREE.DirectionalLight('#9dbbff', 0.45);
  scene.add(moonlight);
  const fishingView = createFishingView(scene);
  const daySky = new THREE.Color('#f8ffff');
  const nightSky = new THREE.Color('#8eafff');
  const dayGround = new THREE.Color('#75977b');
  const nightGround = new THREE.Color('#33445c');
  const middaySun = new THREE.Color('#fff1d2');
  const sunsetSun = new THREE.Color('#ffad7c');

  const materials = new Map();
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
    return materials.get(color);
  }
  function mesh(geometry, color, x, y, z, parent = scene) {
    const object = new THREE.Mesh(geometry, material(color));
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function createHut(x, z) {
    const hut = new THREE.Group();
    hut.position.set(x, terrainHeight(x, z), z);
    scene.add(hut);
    mesh(new THREE.BoxGeometry(2.6, 0.2, 2.2), '#b7ac91', 0, -0.04, 0, hut);
    mesh(new THREE.BoxGeometry(2.2, 1.6, 1.8), '#d9bc80', 0, 0.85, 0, hut);
    const roof = mesh(new THREE.ConeGeometry(1.8, 1.05, 4), '#a26951', 0, 2.12, 0, hut);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.8;
    mesh(new THREE.BoxGeometry(0.48, 1.05, 0.06), '#795743', 0, 0.6, 0.93, hut);
    for (const x of [-0.73, 0.73]) mesh(new THREE.BoxGeometry(0.36, 0.38, 0.06), '#8ab8bf', x, 1.05, 0.93, hut);
    return hut;
  }
  const ghost = createHut(0, 0);
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#75bd86', transparent: true, opacity: 0.5, depthWrite: false });
  ghost.traverse((object) => {
    if (object.isMesh) { object.material = ghostMaterial; object.castShadow = false; }
  });
  const footprint = new THREE.Mesh(new THREE.PlaneGeometry(HUT.halfX * 2, HUT.halfZ * 2), ghostMaterial);
  footprint.rotation.x = -Math.PI / 2;
  footprint.position.y = 0.02;
  ghost.add(footprint);
  ghost.visible = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerOnCanvas = false;
  let pointerDown = null;
  let placement = null;
  const buildSelection = createBuildSelection();
  let dragPoint = null;
  let placementReason = 'choose';
  function trackPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    pointerOnCanvas = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }
  function updateGhost() {
    let candidate = null;
    if (buildingMode && pointerOnCanvas) {
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(terrain.surface, false)[0];
      if (hit) candidate = { x: hit.point.x, z: hit.point.z };
    }
    placement = buildSelection.update(candidate);
    placementReason = placementError(construction, gathering, placement, player.position);
    ghost.visible = buildingMode && Boolean(placement);
    if (ghost.visible) {
      ghost.position.set(placement.x, terrainHeight(placement.x, placement.z), placement.z);
      ghostMaterial.color.set(placementReason ? '#d97970' : '#75bd86');
    }
  }
  function setBuilding(enabled) {
    if (enabled) cancelFishing();
    const missing = hutMaterialsMissing(gathering);
    // Never trap a player in placement mode before they can afford the recipe.
    if (enabled && (missing.wood || missing.stone)) enabled = false;
    buildingMode = enabled;
    if (enabled) buildSelection.recommend(findBuildSpot(construction, gathering, player.position));
    else buildSelection.reset();
    placement = buildSelection.position;
    cameraControls.setBuilding(enabled);
    clear();
    pointerDown = null;
    ghost.visible = false;
    container.focus({ preventScroll: true });
  }
  function cancelFishing() { Object.assign(fishing, createFishingState()); }
  function toggleFishing() {
    if (paused) return;
    if (fishing.phase !== 'idle') cancelFishing();
    else { setBuilding(false); fishing.phase = 'aim'; }
    clear(); container.focus({ preventScroll: true });
  }
  function castFishing(point) {
    if (!startCast(fishing, player.position, point)) return;
    clear(); water.splashAt(point.x, point.z);
    player.rotation.y = Math.atan2(player.position.x - point.x, player.position.z - point.z);
  }
  function castNearbyFish() {
    if (paused || ['waiting', 'caught'].includes(fishing.phase)) return;
    if (fishing.phase === 'idle') toggleFishing();
    if (!isNearShore(player.position)) { fishing.error = 'shore'; return; }
    const nearby = water.getFish().filter((fish) => Math.hypot(fish.x - player.position.x, fish.z - player.position.z) <= CAST_RANGE);
    if (!nearby.length) { fishing.error = 'noFish'; return; }
    castFishing(nearby[Math.floor(Math.random() * nearby.length)]);
  }
  function pointerdown(event) {
    if (paused) return;
    trackPointer(event);
    dragPoint = { x: event.clientX, y: event.clientY };
    container.focus({ preventScroll: true });
    if (event.button === 0) {
      if (buildingMode) buildSelection.beginManual();
      pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
    }
  }
  function pointerup(event) {
    if (paused) return;
    dragPoint = null;
    const down = pointerDown;
    pointerDown = null;
    if (!isTap(down, event)) return;
    trackPointer(event);
    if (!pointerOnCanvas) return;
    if (buildingMode) {
      updateGhost();
      confirmBuild();
    } else {
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      if (fishing.phase !== 'idle') {
        if (fishing.phase === 'waiting' || fishing.phase === 'caught') return;
        const point = water.hitPoint(raycaster);
        castFishing(point);
      } else {
        const driftId = driftView.hit(raycaster);
        if(driftId!==null)salvage(driftId); else water.splash(raycaster);
      }
    }
  }
  function confirmBuild() {
    if (!buildingMode) return;
    updateGhost();
    const result = buildHut(construction, gathering, placement, player.position);
    if (result.building) {
      buildingViews.set(result.building.id, createHut(result.building.x, result.building.z));
      nextSnapshotAt = 0;
      for (const resource of gathering.resources) {
        if (resource.remaining === 0 && Math.abs(resource.x - result.building.x) <= HUT.halfX + resource.radius && Math.abs(resource.z - result.building.z) <= HUT.halfZ + resource.radius) {
          resourceViews.get(resource.id).depleted.visible = false;
        }
      }
      buildNoticeUntil = performance.now() + 3000;
      setBuilding(false);
    }
  }
  function pointermove(event) {
    if (paused) return;
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) pointerDown.moved = true;
    if (event.buttons && dragPoint) {
      water.kick(event.clientX - dragPoint.x, event.clientY - dragPoint.y);
      dragPoint = { x: event.clientX, y: event.clientY };
    } else {
      dragPoint = null;
      // Keep the recommended spot pinned until an intentional click on the island.
    }
    trackPointer(event);
  }
  function pointerleave() { pointerOnCanvas = false; }
  function pointercancel() { pointerDown = null; dragPoint = null; }
  renderer.domElement.addEventListener('pointermove', pointermove);
  renderer.domElement.addEventListener('pointerdown', pointerdown);
  renderer.domElement.addEventListener('pointerup', pointerup);
  renderer.domElement.addEventListener('pointerleave', pointerleave);
  renderer.domElement.addEventListener('pointercancel', pointercancel);
  const water = createWater(scene, renderer);
  const terrain = createTerrain(scene);
  const lighthouse = createLighthouse(scene);
  const coastalLife = createCoastalLife(scene);
  const pondView = createPondView(scene);
  const drifting = createDriftwood();
  const driftView = createDriftwoodView(scene, drifting);
  let salvageNotice = null, salvageNoticeUntil = 0;
  function salvage(id = nearbyDriftwood(drifting, player.position)?.id) {
    if(paused || buildingMode || fishing.phase!=='idle')return;
    const reward=collectDriftwood(drifting,gathering,player.position,id);
    if(reward){salvageNotice=reward;salvageNoticeUntil=performance.now()+2200;nextSnapshotAt=0;}
  }
  const vegetation = createVegetation(scene, [...gathering.resources, ...SCENERY_TREES]);
  const birds = createBirds(scene, () => [...terrain.perches, ...vegetation.perches()]);
  const shoreWaves = createShoreWaves(scene);
  const resourceViews = new Map();
  for (const tree of gathering.resources.filter((resource) => resource.type === 'wood')) {
    const { x, z } = tree;
    const standing = vegetation.views.get(tree.id);
    const stump = mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.35, 8), '#947256', x, 0.65, z);
    mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.025, 8), '#e9c490', 0, 0.18, 0, stump);
    stump.visible = false;
    resourceViews.set(tree.id, { standing, depleted: stump, hitAt: -Infinity });
  }
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.83, 32),
    new THREE.MeshBasicMaterial({ color: '#fff3ae', side: THREE.DoubleSide, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);
  for (const resource of gathering.resources.filter((node) => node.type === 'stone')) {
    const { x, z, radius } = resource;
    const standing = new THREE.Group();
    standing.position.set(x, 0.52, z);
    scene.add(standing);
    const rock = mesh(new THREE.DodecahedronGeometry(radius, 0), '#9baaaa', 0, radius * 0.4, 0, standing);
    rock.scale.y = 0.8;
    rock.rotation.set(0.2, x, 0.1);
    const rubble = new THREE.Group();
    rubble.position.set(x, 0.52, z);
    scene.add(rubble);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const piece = mesh(new THREE.DodecahedronGeometry(radius * 0.27), '#9baaaa',
        Math.cos(angle) * radius * 0.45, 0.03, Math.sin(angle) * radius * 0.45, rubble);
      piece.scale.y = 0.5;
    }
    rubble.visible = false;
    resourceViews.set(resource.id, { standing, depleted: rubble, hitAt: -Infinity });
  }
  // Decorative beach pebbles do not block movement.
  for (let i = 0; i < 24; i++) {
    const angle = i * 2.399;
    const x = Math.cos(angle) * (ISLAND.x - 1.1);
    const z = Math.sin(angle) * (ISLAND.z - 1.1);
    mesh(new THREE.DodecahedronGeometry(0.09 + (i % 3) * 0.04), '#e9d19e', x, terrainHeight(x, z), z);
  }

  const playerModel = createExplorerModel();
  const player = playerModel.root;
  player.position.set(SPAWN.x, 0.52, SPAWN.z);
  scene.add(player);

  function getSnapshot() {
    return { version: 1, name: islandName, wood: gathering.wood, stone: gathering.stone, catches: { ...catches }, pond: { ...pond },
      player: { x: player.position.x, z: player.position.z },
      resources: resourceSnapshot(gathering.resources),
      buildings: construction.buildings.map(({ id, x, z }) => ({ id, type: 'hut', x, z })) };
  }
  function applyState(input) {
    const state = validateIslandState(input);
    islandName = state.name;
    gathering.wood = state.wood; gathering.stone = state.stone;
    catches = { ...state.catches }; pond = { ...state.pond }; cancelFishing();
    for (const resource of gathering.resources) {
      const savedResource=state.resources.find((node)=>node.id===resource.id);
      resource.remaining = savedResource.remaining;
      if(resource.type==='wood') resource.growth=savedResource.growth;
      const view = resourceViews.get(resource.id);
      view.standing.visible = resource.remaining > 0;
      view.depleted.visible = resource.remaining === 0;
    }
    for (const view of buildingViews.values()) {
      view.removeFromParent(); view.traverse((object) => object.geometry?.dispose());
    }
    buildingViews.clear();
    construction.buildings = state.buildings.map((building) => ({ ...building, halfX: HUT.halfX, halfZ: HUT.halfZ }));
    for (const building of construction.buildings) {
      buildingViews.set(building.id, createHut(building.x, building.z));
      for (const resource of gathering.resources) {
        if (resource.remaining === 0 && Math.abs(resource.x - building.x) <= HUT.halfX + resource.radius && Math.abs(resource.z - building.z) <= HUT.halfZ + resource.radius) resourceViews.get(resource.id).depleted.visible = false;
      }
    }
    player.position.set(state.player.x, terrainHeight(state.player.x, state.player.z), state.player.z);
    setBuilding(false);
    lastSnapshotSignature = JSON.stringify(getSnapshot());
  }
  const keys = new Set();
  let pendingInteractions = 0;
  let feedbackUntil = 0;
  let collectedType = null;
  let feedbackSequence = 0;
  let lastHud = '';
  const accepted = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  function keydown(e) {
    if (paused) return;
    if (e.code === 'Escape' && buildingMode) { e.preventDefault(); setBuilding(false); return; }
    if (e.target?.closest?.('input, textarea, select, button, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Escape' && fishing.phase !== 'idle') { e.preventDefault(); cancelFishing(); return; }
    if (e.code === 'KeyF' && !e.repeat) { e.preventDefault(); toggleFishing(); return; }
    if (fishing.phase === 'waiting' || fishing.phase === 'caught') return;
    if (buildingMode) return;
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (!e.repeat && !keys.has(e.code)) pendingInteractions += 1;
      keys.add(e.code);
    } else if (accepted.has(e.code)) { e.preventDefault(); keys.add(e.code); }
  }
  function keyup(e) { keys.delete(e.code); }
  function clear() { keys.clear(); pendingInteractions = 0; pointercancel(); }
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clear);
  function visibilitychange() { clear(); previous = performance.now(); ambience.setHidden(document.hidden); }
  document.addEventListener('visibilitychange', visibilitychange);
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    const aspect = width / Math.max(height, 1);
    const halfHeight = Math.max(31.5, 36 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  let previous = performance.now();
  let elapsed = 0;
  let waterTime = 0;
  applyState(initial);
  renderer.setAnimationLoop((now) => {
    const frameSeconds = Math.max(0, (now - previous) / 1000);
    const dt = Math.min(frameSeconds, 0.04);
    previous = now;
    if (!document.hidden) {
      // The clock uses real elapsed seconds even when movement clamps a slow frame.
      const cycle = dayClock.update(frameSeconds, localHour());
      sky.update(cycle, waterTime, renderer.domElement.clientWidth / Math.max(renderer.domElement.clientHeight, 1), reduceMotion.matches, renderer.domElement.clientHeight,renderer.getPixelRatio());
      ambient.intensity = 0.7 + cycle.daylight * 1.8;
      ambient.color.copy(nightSky).lerp(daySky, cycle.daylight);
      ambient.groundColor.copy(nightGround).lerp(dayGround, cycle.daylight);
      sun.intensity = cycle.daylight * 3;
      sun.color.copy(middaySun).lerp(sunsetSun, cycle.twilight);
      sun.position.set(-Math.cos(cycle.angle) * 26, Math.max(4, cycle.altitude * 28), 10);
      moonlight.intensity = (1 - cycle.daylight) * 0.65;
      moonlight.position.set(Math.cos(cycle.angle) * 22, Math.max(6, -cycle.altitude * 24), -12);
      water.setDaylight(cycle.daylight);
      clouds.update(waterTime, cycle.daylight, reduceMotion.matches, cycle.twilight);
      skyVolume.update(cycle.daylight);
      lighthouse.update(waterTime, cycle.daylight, reduceMotion.matches);
      coastalLife.update(waterTime, reduceMotion.matches);
      waterTime += dt;
      water.update(waterTime, dt);
      vegetation.update(waterTime, reduceMotion.matches);
      birds.update(waterTime, cycle.daylight, reduceMotion.matches);
      shoreWaves.update(waterTime, cycle.daylight, reduceMotion.matches);
      ambience.update(waterTime, cycle.daylight);
      pondView.update(pond, waterTime, reduceMotion.matches);
      if (!paused) {
        stepDriftwood(drifting,dt);
        stepTreeGrowth(gathering,frameSeconds,construction.buildings,player.position);
        const fish = stepFishing(fishing, dt, fishing.phase === 'waiting' ? water.getFish() : []);
        if (fish && catches[fish.kind] < 1000000) {
          const caught = water.takeFish(fish.id);
          if (caught && landFish(fishing, caught)) {
            catches[caught.kind] += 1;
            nextSnapshotAt = 0;
            water.splashAt(fishing.point.x, fishing.point.z);
          }
        }
      }
      driftView.update(waterTime,water.surfaceHeight,reduceMotion.matches);
      for(const tree of gathering.resources.filter(r=>r.type==='wood')) {
        const view=resourceViews.get(tree.id), covered=treeCovered(tree,construction.buildings);
        const growing=tree.remaining===0 && (tree.growth??0)>6;
        view.standing.visible=!covered && (tree.remaining>0 || growing);
        view.standing.scale.setScalar(tree.remaining>0 ? 1 : 0.12+0.88*Math.min(1,(tree.growth??0)/TREE_GROW_SECONDS));
        view.depleted.visible=!covered && tree.remaining===0 && !growing;
      }
      cameraControls.update();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.crossVectors(forward, camera.up).normalize();
      const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const z = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const length = Math.hypot(x, z);
      const walking = length && !buildingMode && !paused && !['waiting', 'caught'].includes(fishing.phase);
      if (walking) {
        const dx = (right.x * x + forward.x * z) / length;
        const dz = (right.z * x + forward.z * z) / length;
        movePlayer(player.position, dx * dt * 4, dz * dt * 4, construction.buildings, activeObstacles(gathering.resources));
        player.rotation.y = Math.atan2(-dx, -dz);
        elapsed += dt;
        player.position.y = terrainHeight(player.position.x, player.position.z) + Math.sin(elapsed * 16) * 0.035;
      } else player.position.y = terrainHeight(player.position.x, player.position.z);
      playerModel.update(waterTime,{moving:Boolean(walking),fishing:fishing.phase!=='idle',reduceMotion:reduceMotion.matches});
      fishingView.update(fishing, player.position, waterTime, water.surfaceHeight, reduceMotion.matches, playerModel.gripPosition());
      while (pendingInteractions > 0) {
        pendingInteractions -= 1;
        const drift=nearbyDriftwood(drifting,player.position);
        if(drift){salvage(drift.id);continue;}
        const result = gatherResource(gathering, player.position);
        if (result) {
          nextSnapshotAt = 0;
          const view = resourceViews.get(result.resourceId);
          view.hitAt = now;
          view.standing.visible = !result.depleted;
          view.depleted.visible = result.depleted;
          feedbackUntil = now + 1400;
          collectedType = result.type;
          feedbackSequence += 1;
        }
      }
      const target = findNearbyResource(gathering, player.position);
      marker.visible = !buildingMode && fishing.phase === 'idle' && Boolean(target);
      if (target) {
        marker.position.set(target.x, terrainHeight(target.x, target.z) + 0.015, target.z);
        marker.material.color.set(target.remaining ? '#fff3ae' : '#b1a68d');
        marker.scale.setScalar((target.radius + 0.3) / 0.83);
      }
      for (const view of resourceViews.values()) {
        const age = (now - view.hitAt) / 1000;
        view.standing.rotation.z = age < 0.4 ? Math.sin(age * 40) * 0.06 * (1 - age / 0.4) : 0;
      }
      updateGhost();
      const hud = {
        supplies: { nearby: nearbyDriftwood(drifting,player.position)?.kind ?? null,
          notice: now<salvageNoticeUntil ? salvageNotice : null,
          growing: gathering.resources.filter(r=>r.type==='wood' && r.remaining===0 && !treeCovered(r,construction.buildings)).length },
        islandName, pond: { ...pond },
        time: { minutes: cycle.minutes, phase: cycle.phase, preview: cycle.preview, dayMinutes: cycle.dayMinutes, night: cycle.daylight < 0.3 },
        fishing: { phase: fishing.phase, nearShore: isNearShore(player.position), error: fishing.error, result: fishing.result, catches: { ...catches } },
        buildingMode,
        placementReason,
        buildings: construction.buildings.length,
        built: now < buildNoticeUntil,
        wood: gathering.wood,
        stone: gathering.stone,
        target: !buildingMode && target ? { id: target.id, type: target.type, remaining: target.remaining } : null,
        collected: now < feedbackUntil ? collectedType : null,
        feedbackSequence,
        allDepleted: gathering.resources.every((resource) => resource.remaining === 0),
      };
      if (!paused && now >= nextSnapshotAt) {
        nextSnapshotAt = now + 1000;
        const snapshot = getSnapshot();
        const snapshotSignature = JSON.stringify(snapshot);
        if (snapshotSignature !== lastSnapshotSignature) {
          lastSnapshotSignature = snapshotSignature;
          onSnapshot(snapshot);
        }
      }
      const signature = JSON.stringify(hud);
      // React only receives changes, never an update for every rendered frame.
      if (signature !== lastHud) { lastHud = signature; onHudChange(hud); }
    }
    renderer.render(scene, camera);
  });

  return {
    setAmbience: (enabled) => ambience.setEnabled(enabled),
    setLanguage:language=>sky.setLanguage(language),
    setTimePreview: (hour) => dayClock.setPreview(hour),
    setDayLength: (minutes) => dayClock.setDayLength(minutes, localHour()),
    toggleFishing,
    collectSupplies: () => salvage(),
    transferFish: (kind, direction) => {
      if (paused || !transferPondFish(catches, pond, kind, direction)) return false;
      nextSnapshotAt = 0;
      return true;
    },
    castNearbyFish,
    getSnapshot,
    applyState,
    setPaused: (value) => { paused = value; clear(); if (value) { setBuilding(false); cancelFishing(); } },
    setBuilding,
    confirmBuild,
    suggestBuild: () => { buildSelection.recommend(findBuildSpot(construction, gathering, player.position)); container.focus({ preventScroll: true }); },
    cameraCommand: (action) => { cameraControls.command(action); container.focus({ preventScroll: true }); },
    dispose() {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    cameraControls.dispose();
    water.dispose();
    terrain.dispose();
    lighthouse.dispose();
    coastalLife.dispose();
    pondView.dispose();
    driftView.dispose();
    vegetation.dispose();
    birds.dispose();
    shoreWaves.dispose();
    ambience.dispose();
    fishingView.dispose();
    clouds.dispose();
    skyVolume.dispose();
    sky.dispose();
    playerModel.dispose();
    sun.shadow.dispose();
    renderer.domElement.removeEventListener('pointermove', pointermove);
    renderer.domElement.removeEventListener('pointerdown', pointerdown);
    renderer.domElement.removeEventListener('pointerup', pointerup);
    renderer.domElement.removeEventListener('pointerleave', pointerleave);
    renderer.domElement.removeEventListener('pointercancel', pointercancel);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', visibilitychange);
    scene.traverse((object) => object.geometry?.dispose());
    marker.material.dispose();
    ghostMaterial.dispose();
    materials.forEach((value) => value.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  } };
}
