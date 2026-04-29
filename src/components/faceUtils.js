/**
 * faceUtils.js — Procedural face geometry + landmark utilities.
 * Used by HeroFace3D to generate a stylized digital human face.
 */
import * as THREE from 'three';

/* ── Math helpers ────────────────────────────────────────── */
export const gaussian = (x, mu, sigma) =>
  Math.exp(-0.5 * ((x - mu) / sigma) ** 2);

export const gaussian2D = (x, y, mx, my, sx, sy) =>
  gaussian(x, mx, sx) * gaussian(y, my, sy || sx);

export const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* ── Color palette ───────────────────────────────────────── */
export const FACE_COLORS = {
  primary:   new THREE.Color('#00D4FF'),
  secondary: new THREE.Color('#7A5CFF'),
  base:      new THREE.Color('#0a0e1a'),
  node:      new THREE.Color('#00D4FF'),
  nodeSec:   new THREE.Color('#7A5CFF'),
  wire:      new THREE.Color('#00D4FF'),
  scan:      new THREE.Color('#00D4FF'),
  particle:  new THREE.Color('#7A5CFF'),
};

/* ── Facial landmark positions (on deformed surface) ─────── */
export const LANDMARKS = [
  { id: 'eyeL',    pos: [-0.27, 0.14, 0.72], label: 'Gaze Tracking',       group: 'eye' },
  { id: 'eyeR',    pos: [ 0.27, 0.14, 0.72], label: 'Gaze Tracking',       group: 'eye' },
  { id: 'browL',   pos: [-0.24, 0.27, 0.74], label: 'Expression Analysis',  group: 'brow' },
  { id: 'browR',   pos: [ 0.24, 0.27, 0.74], label: 'Expression Analysis',  group: 'brow' },
  { id: 'mouthC',  pos: [ 0.00,-0.26, 0.72], label: 'Speech / Emotion',     group: 'mouth' },
  { id: 'mouthL',  pos: [-0.10,-0.24, 0.69], label: 'Speech / Emotion',     group: 'mouth' },
  { id: 'mouthR',  pos: [ 0.10,-0.24, 0.69], label: 'Speech / Emotion',     group: 'mouth' },
  { id: 'foreC',   pos: [ 0.00, 0.48, 0.62], label: 'Cognitive Inference',  group: 'forehead' },
  { id: 'foreL',   pos: [-0.18, 0.42, 0.64], label: 'Cognitive Inference',  group: 'forehead' },
  { id: 'foreR',   pos: [ 0.18, 0.42, 0.64], label: 'Cognitive Inference',  group: 'forehead' },
  { id: 'nose',    pos: [ 0.00,-0.06, 0.88], label: 'Facial Mapping',       group: 'nose' },
  { id: 'cheekL',  pos: [-0.36, 0.00, 0.62], label: 'Structural Analysis',  group: 'cheek' },
  { id: 'cheekR',  pos: [ 0.36, 0.00, 0.62], label: 'Structural Analysis',  group: 'cheek' },
  { id: 'chin',    pos: [ 0.00,-0.52, 0.48], label: 'Facial Mapping',       group: 'chin' },
];

/* ── Neural connections between landmarks ────────────────── */
export const CONNECTIONS = [
  ['eyeL','browL'], ['eyeR','browR'],
  ['eyeL','nose'],  ['eyeR','nose'],
  ['eyeL','cheekL'],['eyeR','cheekR'],
  ['browL','foreL'],['browR','foreR'],
  ['foreL','foreC'], ['foreR','foreC'],
  ['browL','browR'],
  ['nose','mouthC'],
  ['mouthL','mouthC'],['mouthR','mouthC'],
  ['mouthL','cheekL'],['mouthR','cheekR'],
  ['mouthC','chin'],
  ['cheekL','browL'],['cheekR','browR'],
  ['eyeL','eyeR'],
];

/* ── Create procedural face geometry ─────────────────────── */
export function createFaceGeometry(scale = 1.0) {
  const geo = new THREE.SphereGeometry(scale, 64, 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const len = v.length();
    if (len === 0) continue;
    const nx = v.x / len, ny = v.y / len, nz = v.z / len;

    // 1. Oval head shape
    v.x *= 0.78;
    v.y *= 1.10;
    v.z *= 0.88;

    // 2. Jaw tapering
    if (v.y < -0.1 * scale) {
      const t = Math.min(1, (-v.y / scale - 0.1) / 0.8);
      v.x *= 1.0 - t * t * 0.55;
      if (v.z > 0) v.z += gaussian(v.y / scale, -0.60, 0.18) * 0.10 * scale * smoothstep(0, 0.5, nz);
    }

    const front = smoothstep(0, 0.5, nz);
    if (front > 0.01) {
      const fx = v.x / scale, fy = v.y / scale;

      // 3. Eye sockets
      const eL = gaussian2D(fx, fy, -0.28, 0.15, 0.11, 0.08);
      const eR = gaussian2D(fx, fy,  0.28, 0.15, 0.11, 0.08);
      v.z -= (eL + eR) * 0.10 * scale * front;

      // 4. Brow ridge
      const bL = gaussian2D(fx, fy, -0.24, 0.28, 0.14, 0.05);
      const bR = gaussian2D(fx, fy,  0.24, 0.28, 0.14, 0.05);
      v.z += (bL + bR) * 0.06 * scale * front;

      // 5. Nose ridge
      const nRidge = gaussian(fx, 0, 0.055) *
        smoothstep(-0.12, 0.18, fy) * smoothstep(0.18, -0.12, fy - 0.08);
      v.z += nRidge * 0.16 * scale * front;

      // 6. Nose tip
      v.z += gaussian2D(fx, fy, 0, -0.06, 0.06, 0.05) * 0.12 * scale * front;

      // 7. Cheekbones
      const cL = gaussian2D(fx, fy, -0.36, 0.0, 0.11, 0.09);
      const cR = gaussian2D(fx, fy,  0.36, 0.0, 0.11, 0.09);
      v.z += (cL + cR) * 0.055 * scale * front;

      // 8. Mouth depression
      v.z -= gaussian2D(fx, fy, 0, -0.26, 0.12, 0.04) * 0.04 * scale * front;

      // 9. Upper lip
      v.z += gaussian2D(fx, fy, 0, -0.20, 0.09, 0.025) * 0.015 * scale * front;

      // 10. Forehead flatten
      if (fy > 0.35) {
        v.z -= smoothstep(0.35, 0.7, fy) * 0.025 * scale * front;
      }

      // 11. Temple indent
      const tL = gaussian2D(fx, fy, -0.48, 0.22, 0.09, 0.10);
      const tR = gaussian2D(fx, fy,  0.48, 0.22, 0.09, 0.10);
      v.z -= (tL + tR) * 0.025 * scale * front;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/* ── Holographic face shaders ────────────────────────────── */
export const holoVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vFresnel;
varying vec2 vUv;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;

  vec3 viewDir = normalize(cameraPosition - wp.xyz);
  vFresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.5);

  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const holoFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uPrimary;
uniform vec3 uSecondary;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vFresnel;
varying vec2 vUv;

void main() {
  // Dark base
  vec3 base = vec3(0.03, 0.04, 0.08);

  // Rim glow: cyan → purple gradient
  vec3 rim = mix(uPrimary, uSecondary, vFresnel * 0.6 + 0.2);
  vec3 col = mix(base, rim, vFresnel * 0.85);

  // Horizontal scan line
  float scanY = sin(uTime * 0.4) * 1.1;
  float scan = 1.0 - smoothstep(0.0, 0.04, abs(vWorldPos.y - scanY));
  col += uPrimary * scan * 0.6;

  // Subtle grid pattern
  float grid = step(0.97, fract(vWorldPos.y * 18.0)) + step(0.97, fract(vWorldPos.x * 18.0));
  col += uPrimary * grid * 0.05 * vFresnel;

  // Alpha: semi-transparent base, opaque at edges
  float alpha = 0.25 + vFresnel * 0.65 + scan * 0.15;

  gl_FragColor = vec4(col, alpha);
}
`;
