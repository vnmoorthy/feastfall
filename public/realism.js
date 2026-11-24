// FEASTFALL realism layer: physically-based sky + image-based lighting, reflective water,
// ground-truth ambient occlusion, bloom, vignette, wind-swept instanced grass, falling leaves and embers.
// Everything degrades gracefully: "low" quality skips post-processing and reflections.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const rand = (a, b) => a + Math.random() * (b - a);

function waterNormalTexture(size = 256) {
  // tileable sum-of-waves height field → normal map
  const waves = Array.from({ length: 9 }, () => ({ fx: Math.round(rand(-6, 6)) || 1, fy: Math.round(rand(-6, 6)) || 2, a: rand(0.3, 1), ph: rand(0, 6.28) }));
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) {
      const arg = ((w.fx * x + w.fy * y) / size) * Math.PI * 2 + w.ph;
      const c = Math.cos(arg) * w.a;
      dx += c * w.fx; dy += c * w.fy;
    }
    const n = new THREE.Vector3(-dx * 0.08, -dy * 0.08, 1).normalize();
    const i = (y * size + x) * 4;
    data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
  return tex;
}

function makeGrass(count, avoid) {
  const blade = new THREE.PlaneGeometry(0.09, 0.9, 1, 4);
  blade.translate(0, 0.42, 0);
  const pos = blade.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i); const k = Math.max(0, y) / 0.9;
    pos.setX(i, pos.getX(i) * (1 - k * 0.85)); // taper to a tip
    const c = new THREE.Color().setHSL(0.24 - k * 0.04, 0.55, 0.16 + k * 0.32);
    colors.push(c.r, c.g, c.b);
  }
  blade.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  blade.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
  const uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float k = clamp(position.y / 0.9, 0.0, 1.0);
      float sway = sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.25) * 0.18 + sin(uTime * 3.1 + wp.x * 1.3) * 0.05;
      transformed.x += sway * k * k;
      transformed.z += sway * 0.6 * k * k;`);
  };
  const mesh = new THREE.InstancedMesh(blade, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 4; tries++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 41;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (avoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
    p.set(x, -0.08, z); e.set(rand(-0.15, 0.15), rand(0, Math.PI), rand(-0.15, 0.15)); q.setFromEuler(e);
    const h = rand(0.55, 1.25); s.set(rand(0.8, 1.4), h, 1);
    m.compose(p, q, s); mesh.setMatrixAt(n++, m);
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true; mesh.castShadow = false;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

function makeLeaves(count) {
  const geo = new THREE.PlaneGeometry(0.28, 0.2);
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7, vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const palette = [0xc92a2a, 0xe8590c, 0xf08c00, 0xd9a066, 0xb5651d];
  const leaves = [];
  for (let i = 0; i < count; i++) {
    leaves.push({ x: rand(-40, 40), y: rand(0, 16), z: rand(-40, 40), vy: rand(0.4, 0.9), ph: rand(0, 6.28), spin: rand(1, 3) });
    mesh.setColorAt(i, new THREE.Color(palette[i % palette.length]));
  }
  mesh.castShadow = true; mesh.frustumCulled = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  return {
    mesh,
    update(dt, t) {
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        l.y -= l.vy * dt; l.x += Math.sin(t * 0.7 + l.ph) * dt * 0.9 + dt * 0.5; l.z += Math.cos(t * 0.5 + l.ph) * dt * 0.6;
        if (l.y < 0.02) { l.y = 0.02; l.vy = 0; l.rest = (l.rest || 0) + dt; if (l.rest > 6) { l.x = rand(-40, 40); l.z = rand(-40, 40); l.y = rand(12, 18); l.vy = rand(0.4, 0.9); l.rest = 0; } }
        e.set(l.vy ? t * l.spin + l.ph : -Math.PI / 2, l.vy ? t * l.spin * 0.7 : l.ph, l.vy ? Math.sin(t + l.ph) : 0);
        q.setFromEuler(e); p.set(l.x, l.y, l.z); m.compose(p, q, s); mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function makeEmbers(center, count = 140) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3); const seeds = [];
  for (let i = 0; i < count; i++) seeds.push({ a: rand(0, 6.28), r: rand(0, 0.8), y: rand(0, 6), v: rand(0.8, 2.2) });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffa64d, size: 0.16, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  return {
    points: pts,
    update(dt, t) {
      for (let i = 0; i < count; i++) {
        const s = seeds[i]; s.y += s.v * dt; if (s.y > 7) { s.y = 0; s.r = rand(0, 0.8); }
        pos[i * 3] = center.x + Math.cos(s.a + t * 0.6) * (s.r + s.y * 0.12); pos[i * 3 + 1] = 0.8 + s.y; pos[i * 3 + 2] = center.z + Math.sin(s.a + t * 0.6) * (s.r + s.y * 0.12);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.9 }, warmth: { value: 0.04 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform float warmth; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d) * amount);
      c.rgb *= mix(0.62, 1.0, v); c.r += warmth * 0.6; c.b -= warmth * 0.4; gl_FragColor = c; }`,
};

export function setupRealism({ renderer, scene, camera, sun, hemi, oldSky, oldWater, campfirePos }) {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 900;
  let quality = localStorage.getItem('ff_quality') || (mobile ? 'low' : 'high');
  camera.far = 2000; camera.updateProjectionMatrix();
  renderer.shadowMap.type = THREE.VSMShadowMap;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4; sun.shadow.blurSamples = 8; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }

  // --- physically-based sky + IBL ---
  const sky = new Sky(); sky.scale.setScalar(1500); scene.add(sky);
  const su = sky.material.uniforms;
  su.turbidity.value = 5.5; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.86;
  if (oldSky) oldSky.visible = false;
  scene.fog = new THREE.FogExp2(0xd9a77a, 0.0032);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  let envRT = null, lastEnvSun = new THREE.Vector3(), lastEnvAt = -99;
  const sunDir = new THREE.Vector3();
  // calibrated neutral IBL (the raw physical sky is far too hot to use as an env map)
  envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture; scene.environmentIntensity = 0.32;
  function rebuildEnv() { lastEnvSun.copy(sunDir); }

  // --- water: PBR surface with scrolling normal maps (reflects the IBL; no extra scene render) ---
  const nTex = waterNormalTexture(); nTex.repeat.set(60, 60);
  const nTex2 = nTex.clone(); nTex2.repeat.set(23, 23); nTex2.needsUpdate = true;
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x06384f, roughness: 0.1, metalness: 0.0, normalMap: nTex, normalScale: new THREE.Vector2(0.55, 0.55), clearcoat: 1, clearcoatRoughness: 0.12, clearcoatNormalMap: nTex2, clearcoatNormalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 0.75, transparent: true, opacity: 0.95 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = -0.62; water.receiveShadow = true;
  scene.add(water);
  if (oldWater) oldWater.visible = false;

  // --- life: grass, leaves, embers ---
  const avoid = [{ x: 0, z: 0, r: 7.5 }, { x: campfirePos.x, z: campfirePos.z, r: 7 }, { x: 0, z: 18, r: 4.5 }];
  let grass = makeGrass(quality === 'high' ? 18000 : 6000, avoid); scene.add(grass.mesh);
  const leaves = makeLeaves(quality === 'high' ? 260 : 90); scene.add(leaves.mesh);
  const embers = makeEmbers(campfirePos); scene.add(embers.points);

  // --- post-processing ---
  let composer = null, gtao = null, bloom = null;
  function buildComposer() {
    composer?.dispose?.();
    composer = null;
    if (quality !== 'high') return;
    const w = innerWidth, h = innerHeight;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    try {
      gtao = new GTAOPass(scene, camera, w, h);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.blendIntensity = 0.85;
      gtao.updateGtaoMaterial?.({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 8 });
      composer.addPass(gtao);
    } catch (e) { console.warn('GTAO unavailable', e); }
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.55, 0.86);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(VignetteShader));
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.0 : 1.0));
  buildComposer();

  let exposure = 1, lastPhase = null, fpsAcc = 0, fpsN = 0, fpsSince = 0, governed = false;
  const api = {
    get quality() { return quality; },
    get gtao() { return gtao; },
    get composer() { return composer; },
    setQuality(q) {
      quality = q; localStorage.setItem('ff_quality', q);
      scene.remove(grass.mesh); grass.mesh.geometry.dispose(); grass = makeGrass(q === 'high' ? 18000 : 6000, avoid); scene.add(grass.mesh);
      renderer.setPixelRatio(1.0);
      buildComposer(); api.resize();
    },
    sunMoved() {
      sunDir.copy(sun.position).normalize();
      su.sunPosition.value.copy(sunDir);
      const now = performance.now() / 1000;
      if (!envRT || (lastEnvSun.distanceTo(sunDir) > 0.04 && now - lastEnvAt > 4)) { lastEnvAt = now; rebuildEnv(); }
      // horizon-matched fog
      const elev = Math.max(0, sunDir.y);
      scene.fog.color.setHSL(0.07, 0.5, 0.42 + elev * 0.22);
    },
    render(dt, t, phase) {
      grass.uniforms.uTime.value = t;
      nTex.offset.x += dt * 0.012; nTex.offset.y += dt * 0.007; nTex2.offset.x -= dt * 0.009; nTex2.offset.y += dt * 0.011;
      leaves.update(dt, t); embers.update(dt, t);
      const target = phase === 'council' ? 0.5 : phase === 'end' ? 0.75 : 0.95;
      exposure += (target - exposure) * Math.min(1, dt * 1.5);
      renderer.toneMappingExposure = exposure;
      if (bloom) bloom.strength = phase === 'council' ? 0.85 : 0.42;
      embers.points.material.size = phase === 'council' ? 0.24 : 0.16;
      if (phase !== lastPhase) { lastPhase = phase; }
      // fps governor: keep the live demo smooth on any laptop
      fpsSince += dt; fpsAcc += dt; fpsN++;
      if (!governed && fpsSince > 4 && fpsAcc > 2) {
        const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
        if (fps < 28 && gtao && gtao.enabled) { gtao.enabled = false; console.log('[feastfall] fps', fps.toFixed(0), '→ ambient occlusion off'); }
        else if (fps < 24 && bloom && bloom.enabled) { governed = true; quality = 'low'; buildComposer(); console.log('[feastfall] fps', fps.toFixed(0), '→ post-processing off'); }
      }
      if (composer) composer.render(dt); else renderer.render(scene, camera);
    },
    resize() {
      const w = innerWidth, h = innerHeight;
      composer?.setSize(w, h); gtao?.setSize?.(w, h); bloom?.setSize?.(w, h);
    },
  };
  api.sunMoved();
  return api;
}
