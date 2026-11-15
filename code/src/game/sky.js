import * as THREE from 'three';
import { createConstellationView } from './constellationView.js';

// A screen-space painted sky keeps celestial bodies visible with the diorama's
// orthographic, freely orbiting camera. These are decorative, not an ephemeris.
export function createSky(scene) {
  const constellations=createConstellationView(scene);
  let disposed = false;
  const placeholder = new THREE.DataTexture(new Uint8Array([8, 18, 45, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const uniforms = {
    sunMap: { value: placeholder }, sunReady: { value: 0 },
    oilMap: { value: placeholder }, oilReady: { value: 0 }, oilAspect: { value: 16 / 9 }, oilTexel: { value: new THREE.Vector2(1/1672,1/941) }, viewHeight: { value:720 },
    topColor: { value: new THREE.Color() }, bottomColor: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() }, sunPosition: { value: new THREE.Vector2() },
    moonPosition: { value: new THREE.Vector2() }, sunVisible: { value: 1 },
    moonVisible: { value: 0 }, stars: { value: 0 }, time: { value: 0 }, aspect: { value: 1 },
  };
  const oilTexture = new THREE.TextureLoader().load('/textures/oil-night-small-stars-v2.png', (texture) => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    uniforms.oilMap.value = texture;
    uniforms.oilAspect.value = texture.image.width / texture.image.height;
    uniforms.oilTexel.value.set(1/texture.image.width,1/texture.image.height);
    uniforms.oilReady.value = 1;
  }, undefined, () => { /* Keep the procedural sky if the optional asset fails. */ });
  const sunTexture = new THREE.TextureLoader().load('/textures/oil-sun-v1.png', (texture) => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    uniforms.sunMap.value = texture;
    uniforms.sunReady.value = 1;
  }, undefined, () => { /* Retain the procedural sun if loading fails. */ });
  const material = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 topColor, bottomColor, sunColor;
      uniform vec2 sunPosition, moonPosition;
      uniform float sunVisible, moonVisible, stars, time, aspect;
      uniform sampler2D oilMap, sunMap;
      uniform float sunReady;
      uniform float oilReady, oilAspect, viewHeight;
      uniform vec2 oilTexel;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      float swirl(vec2 p, vec2 center, float twist) {
        vec2 q=(p-center)*vec2(aspect,1.0);
        q += vec2(sin(q.y*14.0),cos(q.x*11.0))*0.012;
        float r=length(q), a=atan(q.y,q.x);
        float field=r*62.0+a*twist+noise(p*12.0)*2.0-time*0.025;
        float stroke=smoothstep(-0.3,0.7,sin(field));
        float bristles=0.7+0.3*sin(field*5.0+noise(p*150.0)*2.0);
        float dashes=0.45+0.55*noise(vec2(a*22.0,r*110.0));
        return stroke*bristles*dashes*exp(-r*r*6.0);
      }
      void main() {
        vec2 uv = vUv;
        vec3 color = mix(bottomColor, topColor, smoothstep(0.0, 1.0, uv.y));
        vec2 paintedUv=uv+vec2(noise(uv*5.0),noise(uv*5.0+8.0))*0.05;
        float left=swirl(paintedUv,vec2(0.37,0.72),3.0);
        float right=swirl(paintedUv,vec2(0.78,0.62),-2.0);
        float blend=smoothstep(0.48,0.72,uv.x);
        float paint=mix(left,right,blend);
        float flowing=uv.y*26.0+sin(uv.x*9.0+sin(uv.y*5.0))*3.5+noise(uv*7.0)*2.0;
        float clouds=smoothstep(0.15,0.9,sin(flowing))*0.24;
        float canvas=noise(uv*vec2(700.0*aspect,550.0));
        float skyMask=smoothstep(0.25,0.65,uv.y);
        vec3 base=mix(vec3(0.012,0.025,0.075),vec3(0.025,0.075,0.18),uv.y);
        vec3 paintedNight=mix(base,vec3(0.12,0.27,0.42),clamp(paint*1.4+clouds,0.0,1.0)*skyMask);
        paintedNight *= 0.88+canvas*0.24;
        color=mix(color,paintedNight,stars);
        vec2 oilUv=uv-0.5;
        if (aspect < oilAspect) oilUv.x *= aspect/oilAspect;
        else oilUv.y *= oilAspect/aspect;
        vec2 sampleUv=oilUv+0.5;
        vec3 oilPaint=texture2D(oilMap,sampleUv).rgb*0.6;
        oilPaint+=(texture2D(oilMap,sampleUv+vec2(oilTexel.x,0.0)*1.3).rgb
          +texture2D(oilMap,sampleUv-vec2(oilTexel.x,0.0)*1.3).rgb
          +texture2D(oilMap,sampleUv+vec2(0.0,oilTexel.y)*1.3).rgb
          +texture2D(oilMap,sampleUv-vec2(0.0,oilTexel.y)*1.3).rgb)*0.1;
        color=mix(color,oilPaint,stars*oilReady);
        // Small, pixel-sized stars stay independent of the painted backdrop.
        vec2 grid=vec2(56.0*aspect,56.0);
        vec2 cell=floor(uv*grid);
        float seed=hash(cell+31.0);
        vec2 center=vec2(0.15)+vec2(hash(cell+7.0),hash(cell+13.0))*0.7;
        float sparkleStar=step(0.994,seed);
        center=mix(center,vec2(0.5),sparkleStar);
        vec2 starPixel=(fract(uv*grid)-center)/56.0*viewHeight;
        float dPx=length(starPixel);
        float radius=0.48+hash(cell+19.0)*0.48;
        float core=exp(-pow(dPx/radius,2.0));
        float glow=exp(-pow(dPx/(radius*2.8),2.0))*0.14;
        float twinkle=0.58+0.42*pow(0.5+0.5*sin(time*(0.55+seed*0.7)+seed*91.0),2.0);
        float moonClear=smoothstep(0.038,0.065,length((uv-moonPosition)*vec2(aspect,1.0)));
        vec3 starlight=mix(vec3(0.62,0.75,1.0),vec3(1.0,0.86,0.59),hash(cell+4.0));
        color+=starlight*(core+glow)*twinkle*stars*step(0.947,seed)*smoothstep(0.3,0.65,uv.y)*moonClear;
        // A few tiny four-point glints and a companion speck suggest ✨.
        float pulse=pow(0.5+0.5*sin(time*(0.6+hash(cell+27.0)*0.7)+hash(cell+23.0)*6.28318),5.0);
        float rayX=exp(-abs(starPixel.x)/2.1-pow(starPixel.y/0.45,2.0));
        float rayY=exp(-abs(starPixel.y)/2.8-pow(starPixel.x/0.45,2.0));
        float tips=1.0-smoothstep(3.5,5.5,max(abs(starPixel.x),abs(starPixel.y)));
        float companion=exp(-pow(length(starPixel-vec2(3.1,2.7))/0.55,2.0));
        float sparkle=((rayX+rayY)*tips*(0.2+0.8*pulse)+companion*pulse*0.35);
        color+=vec3(1.0,0.86,0.53)*sparkle*0.55*sparkleStar*stars*smoothstep(0.35,0.65,uv.y)*moonClear;
        vec2 sunDelta = (uv - sunPosition) * vec2(aspect, 1.0);
        float sunDistance = length(sunDelta);
        float halo = exp(-sunDistance * sunDistance / 0.008) * 0.3;
        color += sunColor * halo * sunVisible;
        if (sunReady > 0.5) {
          // A square, alpha-cut painted solar disc follows the same solar arc.
          // Aspect correction keeps the sun round on wide and narrow screens.
          vec2 solarUv = sunDelta / 0.17 + 0.5;
          if (all(greaterThanEqual(solarUv, vec2(0.0))) && all(lessThanEqual(solarUv, vec2(1.0)))) {
            vec4 solarPaint = texture2D(sunMap, solarUv);
            vec3 warmSunPaint = solarPaint.rgb * mix(vec3(1.0), vec3(1.0,0.72,0.48), 1.0-sunColor.b);
            // Feather only the sprite border to suppress sampling seams.
            vec2 border = min(solarUv, 1.0-solarUv);
            float edgeAlpha = smoothstep(0.0, 0.025, min(border.x, border.y));
            color = mix(color, warmSunPaint, solarPaint.a * edgeAlpha * sunVisible);
          }
        } else {
        float discMask = 1.0-smoothstep(0.049,0.052,sunDistance);
        float pigment = noise(sunDelta*180.0)*0.2+noise(sunDelta*500.0)*0.08;
        vec3 paintedSun = mix(vec3(0.95,0.46,0.035),sunColor,0.55+pigment);
        color = mix(color, paintedSun, discMask*sunVisible);
        }
        vec2 moonDelta = (uv - moonPosition) * vec2(aspect, 1.0);
        float moonDistance = length(moonDelta);
        float moonRings = smoothstep(0.0,0.9,sin(moonDistance*360.0 + noise(moonDelta*150.0)*3.0));
        color += vec3(0.55,0.39,0.12) * (0.6 + moonRings * 0.22) * exp(-moonDistance * moonDistance / 0.0017) * moonVisible;
        float disc = (1.0 - smoothstep(0.022, 0.024, moonDistance)) * moonVisible;
        vec2 m = moonDelta / 0.023;
        float craters = (1.0 - smoothstep(0.16, 0.24, length(m - vec2(-0.3, 0.2)))) * 0.15
          + (1.0 - smoothstep(0.22, 0.32, length(m - vec2(0.3, -0.3)))) * 0.13;
        vec3 moon = vec3(1.0, 0.88, 0.59) * (1.0 - craters - max(0.0, m.x) * 0.2);
        color = mix(color, moon, disc);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.userData.skipWaterReflection = true; // Screen-space painting is not world geometry.
  mesh.renderOrder = -1000;
  scene.add(mesh);
  const nightTop = new THREE.Color('#0c1534');
  const dayTop = new THREE.Color('#8ec7dd');
  const nightBottom = new THREE.Color('#243c53');
  const dayBottom = new THREE.Color('#dce6d1');
  const warmTop = new THREE.Color('#9d91b5');
  const warmBottom = new THREE.Color('#f4b38a');
  const warmSun = new THREE.Color('#ffa770');
  return {
    setLanguage:language=>constellations.setLanguage(language),
    update(cycle, time, aspect, reduceMotion, viewHeight=720,pixelRatio=1) {
      uniforms.topColor.value.copy(nightTop).lerp(dayTop, cycle.daylight).lerp(warmTop, cycle.twilight * 0.65);
      uniforms.bottomColor.value.copy(nightBottom).lerp(dayBottom, cycle.daylight).lerp(warmBottom, cycle.twilight * 0.82);
      uniforms.sunColor.value.set('#fff0b3').lerp(warmSun, cycle.twilight);
      const horizon = aspect < 1 ? 0.63 : 0.72;
      const arcHeight = aspect < 1 ? 0.03 : 0.12;
      // Leave room above the sea silhouette and beside long island titles.
      const sunArcHeight = aspect < 1 ? arcHeight : 0.17;
      uniforms.sunPosition.value.set(0.58 - Math.cos(cycle.angle) * 0.24, horizon + Math.max(0, cycle.altitude) * sunArcHeight);
      uniforms.moonPosition.value.set(0.5 + Math.cos(cycle.angle) * 0.28, horizon + Math.max(0, -cycle.altitude) * arcHeight);
      uniforms.sunVisible.value = THREE.MathUtils.smoothstep(cycle.altitude, -0.06, 0.08);
      uniforms.moonVisible.value = THREE.MathUtils.smoothstep(-cycle.altitude, 0, 0.2);
      uniforms.stars.value = cycle.stars;
      uniforms.time.value = reduceMotion ? 0 : time;
      uniforms.aspect.value = aspect;
      uniforms.viewHeight.value = Math.max(1,viewHeight);
      constellations.update(uniforms.time.value,cycle.stars,aspect,Math.max(1,viewHeight),uniforms.moonPosition.value,pixelRatio);
    },
    dispose() { disposed = true; constellations.dispose(); mesh.removeFromParent(); mesh.geometry.dispose(); material.dispose(); placeholder.dispose(); oilTexture.dispose(); sunTexture.dispose(); },
  };
}
