/**
 * HeroFace3D.jsx — Futuristic holographic face for the NeuroSense hero section.
 * Procedurally generated. No external model files. WebGL-optimized.
 *
 * Features:
 *  - Procedural face geometry with anatomical deformations
 *  - Holographic glass-metal shader with Fresnel rim glow
 *  - Wireframe mesh overlay with AI analysis nodes
 *  - HUD scanning reticles around both eyes
 *  - Animated scan beam sweeping across the face
 *  - Neural mapping connections between facial landmarks
 *  - Floating micro data particles
 *  - Cinematic three-point lighting with bloom
 *
 * Color: Primary cyan (#00D4FF), Secondary violet (#7A5CFF)
 */
import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  createFaceGeometry, LANDMARKS, CONNECTIONS, FACE_COLORS,
  holoVertexShader, holoFragmentShader,
} from './faceUtils';

/* ═══════════════════════════════════════════════════════════
   LAYER 1: Holographic Face Mesh
   ═══════════════════════════════════════════════════════════ */
function HolographicFace() {
  const matRef = useRef();
  const faceGeo = useMemo(() => createFaceGeometry(1.0), []);

  const uniforms = useMemo(() => ({
    uTime:      { value: 0 },
    uPrimary:   { value: new THREE.Color('#00D4FF') },
    uSecondary: { value: new THREE.Color('#7A5CFF') },
  }), []);

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh geometry={faceGeo}>
      <shaderMaterial
        ref={matRef}
        vertexShader={holoVertexShader}
        fragmentShader={holoFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════
   LAYER 2: Wireframe Overlay
   ═══════════════════════════════════════════════════════════ */
function WireframeOverlay() {
  const faceGeo = useMemo(() => createFaceGeometry(1.002), []);
  return (
    <mesh geometry={faceGeo}>
      <meshBasicMaterial
        color="#00D4FF"
        wireframe
        transparent
        opacity={0.06}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════
   LAYER 3: Facial Landmark Nodes (glowing analysis points)
   ═══════════════════════════════════════════════════════════ */
function LandmarkNodes({ reducedMotion }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const tempObj = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < LANDMARKS.length; i++) {
      const lm = LANDMARKS[i];
      const pulse = reducedMotion ? 1 : 1 + Math.sin(t * 2 + i * 1.3) * 0.35;
      const s = 0.024 * pulse;
      tempObj.position.set(...lm.pos);
      tempObj.scale.set(s, s, s);
      tempObj.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObj.matrix);

      // Color by group
      const c = lm.group === 'eye' || lm.group === 'forehead'
        ? FACE_COLORS.node : FACE_COLORS.nodeSec;
      meshRef.current.setColorAt(i, c);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    // Glow halos
    if (glowRef.current) {
      for (let i = 0; i < LANDMARKS.length; i++) {
        const lm = LANDMARKS[i];
        const gs = reducedMotion ? 0.055 : 0.05 + Math.sin(t * 1.5 + i) * 0.015;
        tempObj.position.set(...lm.pos);
        tempObj.scale.set(gs, gs, gs);
        tempObj.updateMatrix();
        glowRef.current.setMatrixAt(i, tempObj.matrix);
      }
      glowRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[null, null, LANDMARKS.length]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[null, null, LANDMARKS.length]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color="#00D4FF"
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   LAYER 4: Neural Mapping Connections
   ═══════════════════════════════════════════════════════════ */
function NeuralConnections({ reducedMotion }) {
  const lineRef = useRef();

  const { positions, colors } = useMemo(() => {
    const lmMap = {};
    LANDMARKS.forEach(l => { lmMap[l.id] = l.pos; });

    const posArr = new Float32Array(CONNECTIONS.length * 6);
    const colArr = new Float32Array(CONNECTIONS.length * 6);

    for (let i = 0; i < CONNECTIONS.length; i++) {
      const [a, b] = CONNECTIONS[i];
      const pA = lmMap[a], pB = lmMap[b];
      posArr.set(pA, i * 6);
      posArr.set(pB, i * 6 + 3);
      // Gradient from cyan to violet
      const t = i / CONNECTIONS.length;
      const c1 = FACE_COLORS.node.clone().lerp(FACE_COLORS.nodeSec, t);
      colArr.set([c1.r, c1.g, c1.b], i * 6);
      colArr.set([c1.r, c1.g, c1.b], i * 6 + 3);
    }
    return { positions: posArr, colors: colArr };
  }, []);

  // Animate opacity
  const matRef = useRef();
  useFrame(({ clock }) => {
    if (matRef.current && !reducedMotion) {
      matRef.current.opacity = 0.2 + Math.sin(clock.getElapsedTime() * 0.8) * 0.08;
    }
  });

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={CONNECTIONS.length * 2} itemSize={3} />
        <bufferAttribute attach="attributes-color" array={colors} count={CONNECTIONS.length * 2} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial
        ref={matRef}
        vertexColors
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/* ═══════════════════════════════════════════════════════════
   LAYER 5: HUD Scanning Reticles (around both eyes)
   ═══════════════════════════════════════════════════════════ */
function EyeHUD({ reducedMotion }) {
  const leftRef = useRef();
  const rightRef = useRef();

  const eyeL = LANDMARKS.find(l => l.id === 'eyeL').pos;
  const eyeR = LANDMARKS.find(l => l.id === 'eyeR').pos;

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    if (leftRef.current)  leftRef.current.rotation.z = t * 0.5;
    if (rightRef.current) rightRef.current.rotation.z = -t * 0.5;
  });

  const Ring = ({ pos, innerRef, radiusOuter }) => (
    <group position={pos}>
      {/* Outer ring */}
      <mesh ref={innerRef} rotation={[0, 0, 0]}>
        <torusGeometry args={[radiusOuter, 0.004, 8, 64]} />
        <meshBasicMaterial color="#00D4FF" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Inner ring */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[radiusOuter * 0.7, 0.002, 8, 32]} />
        <meshBasicMaterial color="#7A5CFF" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Crosshair lines (4 dashes) */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => {
        const r = radiusOuter;
        const cx = Math.cos(angle) * r * 0.5;
        const cy = Math.sin(angle) * r * 0.5;
        const ex = Math.cos(angle) * r * 0.85;
        const ey = Math.sin(angle) * r * 0.85;
        const pts = new Float32Array([cx, cy, 0.01, ex, ey, 0.01]);
        return (
          <lineSegments key={i}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" array={pts} count={2} itemSize={3} />
            </bufferGeometry>
            <lineBasicMaterial color="#00D4FF" transparent opacity={0.3} depthWrite={false} />
          </lineSegments>
        );
      })}
    </group>
  );

  return (
    <group>
      <Ring pos={eyeL} innerRef={leftRef} radiusOuter={0.09} />
      <Ring pos={eyeR} innerRef={rightRef} radiusOuter={0.09} />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   LAYER 6: Scan Beam (animated horizontal sweep)
   ═══════════════════════════════════════════════════════════ */
function ScanBeam({ reducedMotion }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    const y = Math.sin(clock.getElapsedTime() * 0.4) * 1.1;
    ref.current.position.y = y;
    ref.current.material.opacity = 0.12 + Math.sin(clock.getElapsedTime() * 2) * 0.04;
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2.5, 0.015]} />
      <meshBasicMaterial
        color="#00D4FF"
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════
   LAYER 7: Floating Data Particles
   ═══════════════════════════════════════════════════════════ */
const PARTICLE_COUNT = 80;

function DataParticles({ reducedMotion }) {
  const meshRef = useRef();
  const tempObj = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, () => ({
      pos: [
        (Math.random() - 0.5) * 3.5,
        (Math.random() - 0.5) * 3.5,
        (Math.random() - 0.5) * 2.5,
      ],
      speed: 0.015 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
      size: 0.004 + Math.random() * 0.006,
    })), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      const y = reducedMotion ? p.pos[1] : p.pos[1] + Math.sin(t * p.speed + p.phase) * 0.15;
      const x = reducedMotion ? p.pos[0] : p.pos[0] + Math.cos(t * p.speed * 0.7 + p.phase) * 0.08;
      tempObj.position.set(x, y, p.pos[2]);
      tempObj.scale.setScalar(p.size);
      tempObj.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObj.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial
        color="#7A5CFF"
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

/* ═══════════════════════════════════════════════════════════
   LAYER 8: Outer Orbital Rings
   ═══════════════════════════════════════════════════════════ */
function OrbitalRings({ reducedMotion }) {
  const groupRef = useRef();

  const rings = useMemo(() => [
    { r: 1.6, thick: 0.003, opacity: 0.08, rot: [0.3, 0.1, 0], speed:  0.12 },
    { r: 2.0, thick: 0.002, opacity: 0.05, rot: [1.0, 0.5, 0.2], speed: -0.08 },
    { r: 2.4, thick: 0.003, opacity: 0.04, rot: [0.6, 1.2, 0.4], speed:  0.05 },
  ], []);

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.02;
  });

  return (
    <group ref={groupRef}>
      {rings.map((r, i) => (
        <mesh key={i} rotation={r.rot}>
          <torusGeometry args={[r.r, r.thick, 6, 128]} />
          <meshBasicMaterial
            color="#00D4FF"
            transparent
            opacity={r.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   Scene Assembly
   ═══════════════════════════════════════════════════════════ */
function SceneContents({ reducedMotion }) {
  const faceGroup = useRef();

  // Slow idle rotation (Y-axis oscillation around ~20° offset)
  useFrame(({ clock }) => {
    if (!faceGroup.current || reducedMotion) return;
    const t = clock.getElapsedTime();
    faceGroup.current.rotation.y = 0.35 + Math.sin(t * 0.15) * 0.08;
    faceGroup.current.rotation.x = Math.sin(t * 0.1) * 0.03;
  });

  return (
    <>
      {/* Cinematic Lighting */}
      <ambientLight intensity={0.15} color="#0a0e2a" />
      {/* Key light — front soft */}
      <directionalLight position={[0, 2, 5]} intensity={0.6} color="#e0f0ff" />
      {/* Rim light — cool outline */}
      <pointLight position={[-3, 1, -2]} intensity={0.8} color="#00D4FF" distance={10} />
      <pointLight position={[3, 1, -2]} intensity={0.4} color="#7A5CFF" distance={10} />
      {/* Back glow */}
      <pointLight position={[0, -1, -4]} intensity={0.3} color="#00D4FF" distance={8} />

      <Float
        speed={reducedMotion ? 0 : 0.6}
        rotationIntensity={reducedMotion ? 0 : 0.04}
        floatIntensity={reducedMotion ? 0 : 0.15}
      >
        <group ref={faceGroup} rotation={[0, 0.35, 0]}>
          <HolographicFace />
          <WireframeOverlay />
          <LandmarkNodes reducedMotion={reducedMotion} />
          <NeuralConnections reducedMotion={reducedMotion} />
          <EyeHUD reducedMotion={reducedMotion} />
          <ScanBeam reducedMotion={reducedMotion} />
        </group>
      </Float>

      <DataParticles reducedMotion={reducedMotion} />
      <OrbitalRings reducedMotion={reducedMotion} />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        maxPolarAngle={Math.PI * 0.65}
        minPolarAngle={Math.PI * 0.35}
        dampingFactor={0.05}
        enableDamping
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Export
   ═══════════════════════════════════════════════════════════ */
export default function HeroFace3D({ interactive = true }) {
  const [supported, setSupported] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!window.WebGLRenderingContext) setSupported(false);
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  if (!supported) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: interactive ? 'auto' : 'none',
        overflow: 'hidden',
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        camera={{ fov: 38, position: [0, 0, 3.2], near: 0.1, far: 20 }}
        style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
      >
        <SceneContents reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
