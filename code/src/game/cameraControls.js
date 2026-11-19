import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { surfCameraTarget, surfCameraZoom, smoothCameraAngle } from './surfCamera.js';
import { SURF_STATION } from './surfing.js';
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
  let following = false, dragging = false, lastHeading = 0, relativeYaw = 0.55, followAngle = 0, followPolar = 1.12, followDistance = 36;
  const target = new THREE.Vector3(), offset = new THREE.Vector3(), spherical = new THREE.Spherical();
  function dragStart() { dragging = true; }
  function rememberOrbit() {
    if (following) {
      spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
      relativeYaw = spherical.theta - lastHeading; followAngle = spherical.theta; followPolar = spherical.phi; followDistance = spherical.radius;
    }
  }
  function dragEnd() { dragging = false; rememberOrbit(); }
  controls.addEventListener('start', dragStart); controls.addEventListener('end', dragEnd);

  function command(action) {
    if (action === 'surf-front' && following) { relativeYaw = 0.55; followPolar = 1.12; return; }
    if (action === 'reset') { controls.reset(); return; }
    const landmark = { surf: { ...SURF_STATION, zoom: 3.2, lift: 0.5 }, lighthouse: { ...LIGHTHOUSE, zoom: 2.8, lift: 2.7 }, court: { ...COURT, zoom: 2.9, lift: 0.8 }, garden: { x: SUNFLOWER.x + 3, z: SUNFLOWER.z, zoom: 3.8, lift: 1.5 } }[action];
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
    if (['left', 'right', 'top', 'angled', 'side'].includes(action)) rememberOrbit();
  }
  return {
    update: () => controls.update(),
    resize: () => { if (following) { camera.zoom = surfCameraZoom(camera.top); camera.updateProjectionMatrix(); } },
    setSurfFollow(enabled, position, heading = 0) {
      following = enabled; controls.maxZoom = enabled ? 20 : 4.8;
      if (!enabled) { command('reset'); return; }
      relativeYaw = 0.55; followAngle = heading + relativeYaw; followPolar = 1.12; followDistance = 36; lastHeading = heading;
      camera.zoom = surfCameraZoom(camera.top); camera.updateProjectionMatrix();
      target.copy(surfCameraTarget(position, heading)); controls.target.copy(target);
      camera.position.copy(target).add(offset.setFromSpherical(spherical.set(followDistance, followPolar, followAngle))); controls.update();
    },
    follow(position, heading, dt) {
      if (!following) return;
      lastHeading = heading; target.copy(surfCameraTarget(position, heading));
      // Translate with the rider, but smooth the vertical swell so the view does not bounce sharply.
      target.y = THREE.MathUtils.lerp(controls.target.y, target.y, 1 - Math.exp(-dt * 4));
      if (dragging) camera.position.add(offset.copy(target).sub(controls.target));
      else {
        followAngle = smoothCameraAngle(followAngle, heading + relativeYaw, dt);
        camera.position.copy(target).add(offset.setFromSpherical(spherical.set(followDistance, followPolar, followAngle)));
      }
      controls.target.copy(target); controls.update();
    },
    setBuilding: (enabled) => { controls.mouseButtons.LEFT = enabled ? null : THREE.MOUSE.ROTATE; },
    command,
    dispose: () => { controls.removeEventListener('start', dragStart); controls.removeEventListener('end', dragEnd); controls.dispose(); },
  };
}
