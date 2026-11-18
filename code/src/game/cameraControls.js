import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LIGHTHOUSE, COURT, SUNFLOWER, terrainHeight } from './world.js';

export function createCameraControls(camera, canvas) {
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minPolarAngle = 0.28;
  // Allow eye-level and slightly below the waterline, without going under the plinth.
  controls.maxPolarAngle = 1.61;
  controls.minZoom = 0.7;
  controls.maxZoom = 4.8;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.8;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.saveState();

  function command(action) {
    if (action === 'reset') { controls.reset(); return; }
    const landmark = { lighthouse: { ...LIGHTHOUSE, zoom: 2.8, lift: 2.7 }, court: { ...COURT, zoom: 2.9, lift: 0.8 }, garden: { x: SUNFLOWER.x + 3, z: SUNFLOWER.z, zoom: 3.8, lift: 1.5 } }[action];
    if (landmark) {
      controls.target.set(landmark.x, terrainHeight(landmark.x, landmark.z) + landmark.lift, landmark.z);
      camera.position.copy(controls.target).add(new THREE.Vector3(23, 28, 31)); camera.zoom = landmark.zoom;
      camera.updateProjectionMatrix(); controls.update(); return;
    }
    if (action === 'in' || action === 'out') {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * (action === 'in' ? 1.25 : 0.8), controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
    } else {
      const offset = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if (action === 'left') offset.theta -= Math.PI / 6;
      if (action === 'right') offset.theta += Math.PI / 6;
      if (action === 'top') offset.phi = 0.28;
      if (action === 'angled') offset.phi = 0.94;
      if (action === 'side') offset.phi = 1.56;
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(offset));
    }
    controls.update();
  }
  return {
    update: () => controls.update(),
    setBuilding: (enabled) => { controls.mouseButtons.LEFT = enabled ? null : THREE.MOUSE.ROTATE; },
    command,
    dispose: () => controls.dispose(),
  };
}
