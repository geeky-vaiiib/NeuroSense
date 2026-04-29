/**
 * NeuralScene3D.jsx — Interactive, visually stunning 3D neural network scene.
 * Procedurally generated. No external model files. Performance-safe.
 * Lazy-loaded by caller via React.lazy().
 *
 * Features:
 *  - 80 nodes with 3 tiers (core, secondary, ambient) + pulsing glow
 *  - Dynamic neural signal particles traveling along edges
 *  - Interactive: mouse proximity highlights nearby nodes & edges
 *  - Responsive to pointer position via raycasting
 *  - Organic drift + breathing animation on nodes
 *  - Multiple concentric orbital rings with varied orientations
 *  - DNA-helix inspired double-spiral accent structure
 *  - Reduced-motion aware
 */
import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';

export const SCENE_SUPPORTED = typeof window !== 'undefined' && !!window.WebGLRenderingContext;

/* ── Utility: generate random positions within a sphere ──── */
function randomInSphere(count, radius) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * Math.cbrt(Math.random());
    positions.push([
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ]);
  }
  return positions;
}

/* ── Find K nearest neighbors by index ───────────────────── */
function kNearest(positions, idx, k) {
  const target = positions[idx];
  const distances = positions
    .map((p, i) => ({
      i,
      d: i === idx ? Infinity : Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]),
    }))
    .sort((a, b) => a.d - b.d);
  return distances.slice(0, k).map((d) => d.i);
}

/* ── Color palette ───────────────────────────────────────── */
const COLORS = {
  core:       new THREE.Color('#0ECFC8'),
  coreGlow:   new THREE.Color('#0BA89F'),
  secondary:  new THREE.Color('#7B61FF'),
  ambient:    new THREE.Color('#8B9DB5'),
  edge:       new THREE.Color('#1E2733'),
  edgeActive: new THREE.Color('#0ECFC8'),
  signal:     new THREE.Color('#0ECFC8'),
  ring:       new THREE.Color('#1E2733'),
  helix:      new THREE.Color('#0ECFC8'),
};

/* ── LAYER 1: Neural Nodes with interaction ──────────────── */
function NeuralNodes({ nodeData, reducedMotion, pointerWorld }) {
  const instanceRef = useRef();
  const glowRef = useRef();
  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  const driftData = useMemo(() =>
    nodeData.map(() => ({
      speed: 0.08 + Math.random() * 0.12,
      offset: Math.random() * Math.PI * 2,
      axis: [
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08,
      ],
      breathSpeed: 0.3 + Math.random() * 0.4,
      breathOffset: Math.random() * Math.PI * 2,
    })),
    [nodeData],
  );

  // Current animated positions for edge tracking
  const currentPositions = useRef(nodeData.map(n => [...n.pos]));

  useFrame(({ clock }) => {
    if (!instanceRef.current) return;
    const t = clock.getElapsedTime();
    const ptr = pointerWorld.current;

    for (let i = 0; i < nodeData.length; i++) {
      const node = nodeData[i];
      const d = driftData[i];
      let x = node.pos[0], y = node.pos[1], z = node.pos[2];

      if (!reducedMotion) {
        const s = Math.sin(t * d.speed + d.offset);
        x += d.axis[0] * s;
        y += d.axis[1] * s;
        z += d.axis[2] * s;
      }

      currentPositions.current[i][0] = x;
      currentPositions.current[i][1] = y;
      currentPositions.current[i][2] = z;

      // Breathing scale
      const breath = reducedMotion ? 1 : 1 + Math.sin(t * d.breathSpeed + d.breathOffset) * 0.15;
      const baseScale = node.tier === 0 ? 0.07 : node.tier === 1 ? 0.045 : 0.025;

      // Proximity highlight
      let proxScale = 1;
      if (ptr) {
        const dist = Math.hypot(x - ptr.x, y - ptr.y, z - ptr.z);
        if (dist < 2.5) {
          proxScale = 1 + (1 - dist / 2.5) * 0.6;
        }
      }

      const scale = baseScale * breath * proxScale;
      tempObj.position.set(x, y, z);
      tempObj.scale.set(scale, scale, scale);
      tempObj.updateMatrix();
      instanceRef.current.setMatrixAt(i, tempObj.matrix);

      // Color by tier + proximity glow
      if (node.tier === 0) tempColor.copy(COLORS.core);
      else if (node.tier === 1) tempColor.copy(COLORS.secondary);
      else tempColor.copy(COLORS.ambient);

      if (ptr) {
        const dist = Math.hypot(x - ptr.x, y - ptr.y, z - ptr.z);
        if (dist < 2.0) {
          tempColor.lerp(COLORS.coreGlow, (1 - dist / 2.0) * 0.7);
        }
      }
      instanceRef.current.setColorAt(i, tempColor);
    }
    instanceRef.current.instanceMatrix.needsUpdate = true;
    if (instanceRef.current.instanceColor) instanceRef.current.instanceColor.needsUpdate = true;

    // Update glow instances (only for core nodes)
    if (glowRef.current) {
      let gi = 0;
      for (let i = 0; i < nodeData.length; i++) {
        if (nodeData[i].tier !== 0) continue;
        const [x, y, z] = currentPositions.current[i];
        const pulse = reducedMotion ? 0.12 : 0.10 + Math.sin(t * 1.5 + i) * 0.04;
        tempObj.position.set(x, y, z);
        tempObj.scale.set(pulse, pulse, pulse);
        tempObj.updateMatrix();
        glowRef.current.setMatrixAt(gi, tempObj.matrix);
        gi++;
      }
      glowRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const coreCount = nodeData.filter(n => n.tier === 0).length;

  return (
    <group>
      {/* Main node instances */}
      <instancedMesh ref={instanceRef} args={[null, null, nodeData.length]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          toneMapped={false}
          emissive="#0ECFC8"
          emissiveIntensity={0.3}
        />
      </instancedMesh>

      {/* Glow halos for core nodes */}
      <instancedMesh ref={glowRef} args={[null, null, coreCount]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color="#0ECFC8"
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}

/* ── LAYER 2: Neural Edges with glow ─────────────────────── */
function NeuralEdges({ nodeData, edges, pointerWorld }) {
  const lineRef = useRef();
  const positionsArray = useMemo(() => new Float32Array(edges.length * 6), [edges]);
  const colorsArray = useMemo(() => new Float32Array(edges.length * 6), [edges]);

  useFrame(() => {
    if (!lineRef.current) return;
    const geom = lineRef.current.geometry;
    const ptr = pointerWorld.current;

    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i];
      const posA = nodeData[a]._currPos || nodeData[a].pos;
      const posB = nodeData[b]._currPos || nodeData[b].pos;

      positionsArray[i * 6 + 0] = posA[0];
      positionsArray[i * 6 + 1] = posA[1];
      positionsArray[i * 6 + 2] = posA[2];
      positionsArray[i * 6 + 3] = posB[0];
      positionsArray[i * 6 + 4] = posB[1];
      positionsArray[i * 6 + 5] = posB[2];

      // Color based on pointer proximity
      let intensity = 0.18;
      if (ptr) {
        const midX = (posA[0] + posB[0]) * 0.5;
        const midY = (posA[1] + posB[1]) * 0.5;
        const midZ = (posA[2] + posB[2]) * 0.5;
        const dist = Math.hypot(midX - ptr.x, midY - ptr.y, midZ - ptr.z);
        if (dist < 3) intensity = 0.18 + (1 - dist / 3) * 0.5;
      }

      const r = 0.6 * intensity + 0.1;
      const g = 0.82 * intensity + 0.15;
      const b2 = 0.8 * intensity + 0.12;
      colorsArray[i * 6 + 0] = r;
      colorsArray[i * 6 + 1] = g;
      colorsArray[i * 6 + 2] = b2;
      colorsArray[i * 6 + 3] = r;
      colorsArray[i * 6 + 4] = g;
      colorsArray[i * 6 + 5] = b2;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
  });

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positionsArray}
          count={edges.length * 2}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colorsArray}
          count={edges.length * 2}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.6} />
    </lineSegments>
  );
}

/* ── LAYER 3: Neural Signal Particles ────────────────────── */
function SignalParticles({ edges, nodeData, reducedMotion }) {
  const PARTICLE_COUNT = 30;
  const meshRef = useRef();
  const tempObj = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      edgeIdx: Math.floor(Math.random() * edges.length),
      t: Math.random(),
      speed: 0.3 + Math.random() * 0.5,
      size: 0.02 + Math.random() * 0.02,
    }));
  }, [edges]);

  useFrame(({ clock }) => {
    if (!meshRef.current || reducedMotion) return;
    const dt = clock.getDelta();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      p.t += dt * p.speed;
      if (p.t > 1) {
        p.t -= 1;
        p.edgeIdx = Math.floor(Math.random() * edges.length);
      }

      const [a, b] = edges[p.edgeIdx];
      const posA = nodeData[a].pos;
      const posB = nodeData[b].pos;
      const x = posA[0] + (posB[0] - posA[0]) * p.t;
      const y = posA[1] + (posB[1] - posA[1]) * p.t;
      const z = posA[2] + (posB[2] - posA[2]) * p.t;

      tempObj.position.set(x, y, z);
      const s = p.size * (1 + Math.sin(p.t * Math.PI) * 0.5);
      tempObj.scale.set(s, s, s);
      tempObj.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObj.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (reducedMotion) return null;

  return (
    <instancedMesh ref={meshRef} args={[null, null, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color="#0ECFC8"
        transparent
        opacity={0.85}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/* ── LAYER 4: Orbital Rings (5 rings with varied orientations) ── */
function OrbitalRings({ reducedMotion }) {
  const groupRef = useRef();

  const rings = useMemo(() => [
    { radius: 3.0, thickness: 0.006, opacity: 0.12, rotation: [0.4, 0.2, 0], speed: 0.08 },
    { radius: 3.8, thickness: 0.005, opacity: 0.08, rotation: [1.2, 0.6, 0.3], speed: -0.06 },
    { radius: 4.5, thickness: 0.007, opacity: 0.10, rotation: [0.8, 1.4, 0.5], speed: 0.04 },
    { radius: 5.2, thickness: 0.004, opacity: 0.06, rotation: [1.8, 0.3, 1.2], speed: -0.03 },
    { radius: 5.8, thickness: 0.005, opacity: 0.05, rotation: [0.5, 1.0, 0.8], speed: 0.02 },
  ], []);

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.015;
  });

  return (
    <group ref={groupRef}>
      {rings.map((r, i) => (
        <mesh key={i} rotation={r.rotation}>
          <torusGeometry args={[r.radius, r.thickness, 6, 128]} />
          <meshBasicMaterial color="#1E2733" transparent opacity={r.opacity} />
        </mesh>
      ))}
    </group>
  );
}

/* ── LAYER 5: DNA Helix Accent ───────────────────────────── */
function HelixAccent({ reducedMotion }) {
  const groupRef = useRef();

  const { geometry, colors } = useMemo(() => {
    const points = [];
    const cols = [];
    const segments = 200;
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 4;
      const y = (i / segments - 0.5) * 10;
      const r = 1.8;
      // Strand 1
      points.push(Math.cos(t) * r, y, Math.sin(t) * r);
      // Color gradient
      const c = new THREE.Color().lerpColors(COLORS.core, COLORS.coreGlow, i / segments);
      cols.push(c.r, c.g, c.b);
    }
    return {
      geometry: new Float32Array(points),
      colors: new Float32Array(cols),
    };
  }, []);

  const { geometry: geometry2, colors: colors2 } = useMemo(() => {
    const points = [];
    const cols = [];
    const segments = 200;
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 4 + Math.PI;
      const y = (i / segments - 0.5) * 10;
      const r = 1.8;
      points.push(Math.cos(t) * r, y, Math.sin(t) * r);
      const c = new THREE.Color().lerpColors(COLORS.coreGlow, COLORS.core, i / segments);
      cols.push(c.r, c.g, c.b);
    }
    return {
      geometry: new Float32Array(points),
      colors: new Float32Array(cols),
    };
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.1;
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={geometry} count={200} itemSize={3} />
          <bufferAttribute attach="attributes-color" array={colors} count={200} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.15} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={geometry2} count={200} itemSize={3} />
          <bufferAttribute attach="attributes-color" array={colors2} count={200} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.15} />
      </line>
    </group>
  );
}

/* ── LAYER 6: Floating particle cloud ────────────────────── */
function AmbientDust({ reducedMotion }) {
  const DUST_COUNT = 120;
  const meshRef = useRef();
  const tempObj = useMemo(() => new THREE.Object3D(), []);

  const dustData = useMemo(() =>
    Array.from({ length: DUST_COUNT }, () => ({
      pos: [
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
      ],
      speed: 0.02 + Math.random() * 0.04,
      phase: Math.random() * Math.PI * 2,
      size: 0.008 + Math.random() * 0.012,
    })),
    [],
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < DUST_COUNT; i++) {
      const d = dustData[i];
      const y = reducedMotion ? d.pos[1] : d.pos[1] + Math.sin(t * d.speed + d.phase) * 0.3;
      tempObj.position.set(d.pos[0], y, d.pos[2]);
      tempObj.scale.setScalar(d.size);
      tempObj.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObj.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, DUST_COUNT]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial
        color="#8B9DB5"
        transparent
        opacity={0.25}
      />
    </instancedMesh>
  );
}

/* ── Pointer tracker (projects mouse into 3D space) ──────── */
function PointerTracker({ pointerWorld }) {
  const { camera } = useThree();

  const onPointerMove = useCallback((e) => {
    // Convert from normalized to world space at z=0 plane
    const ndc = new THREE.Vector3(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
      0.5,
    );
    ndc.unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    const world = camera.position.clone().add(dir.multiplyScalar(dist));
    pointerWorld.current = world;
  }, [camera]);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [onPointerMove]);

  return null;
}

/* ── Scene contents ──────────────────────────────────────── */
function SceneContents({ reducedMotion, interactive }) {
  const pointerWorld = useRef(null);

  const { nodeData, edges } = useMemo(() => {
    // 3 tiers: 15 core, 25 secondary, 40 ambient = 80 nodes
    const corePositions = randomInSphere(15, 2.5);
    const secPositions = randomInSphere(25, 3.8);
    const ambPositions = randomInSphere(40, 5.5);

    const allPositions = [...corePositions, ...secPositions, ...ambPositions];
    const nodes = allPositions.map((pos, i) => ({
      pos,
      tier: i < 15 ? 0 : i < 40 ? 1 : 2,
    }));

    // Build edges: connect core→core (k=3), core→secondary (k=2)
    const coreIndices = nodes.map((n, i) => n.tier === 0 ? i : -1).filter(i => i >= 0);
    const secIndices = nodes.map((n, i) => n.tier === 1 ? i : -1).filter(i => i >= 0);
    const edgeSet = new Set();
    const edgeList = [];

    // Core-core connections
    for (const idx of coreIndices) {
      const nearest = kNearest(
        coreIndices.map(ci => allPositions[ci]),
        coreIndices.indexOf(idx),
        3,
      );
      for (const ni of nearest) {
        const targetIdx = coreIndices[ni];
        const key = [Math.min(idx, targetIdx), Math.max(idx, targetIdx)].join('-');
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edgeList.push([idx, targetIdx]);
        }
      }
    }

    // Core-secondary connections
    for (const idx of coreIndices) {
      const nearest = kNearest(
        secIndices.map(si => allPositions[si]),
        0, // just find closest to this core node
        2,
      );
      for (const ni of nearest) {
        const targetIdx = secIndices[ni];
        const key = [Math.min(idx, targetIdx), Math.max(idx, targetIdx)].join('-');
        if (!edgeSet.has(key) && edgeList.length < 60) {
          edgeSet.add(key);
          edgeList.push([idx, targetIdx]);
        }
      }
    }

    // Some secondary-secondary connections
    for (let i = 0; i < secIndices.length && edgeList.length < 70; i++) {
      const idx = secIndices[i];
      const nearest = kNearest(
        secIndices.map(si => allPositions[si]),
        i,
        1,
      );
      for (const ni of nearest) {
        const targetIdx = secIndices[ni];
        const key = [Math.min(idx, targetIdx), Math.max(idx, targetIdx)].join('-');
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edgeList.push([idx, targetIdx]);
        }
      }
    }

    return { nodeData: nodes, edges: edgeList };
  }, []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={0.7} color="#ffffff" />
      <pointLight position={[-4, -3, -3]} intensity={0.4} color="#1E2733" />
      <pointLight position={[3, 5, -4]} intensity={0.2} color="#0ECFC8" />

      {interactive && <PointerTracker pointerWorld={pointerWorld} />}

      <Float speed={reducedMotion ? 0 : 0.8} rotationIntensity={reducedMotion ? 0 : 0.1} floatIntensity={reducedMotion ? 0 : 0.3}>
        <NeuralNodes nodeData={nodeData} reducedMotion={reducedMotion} pointerWorld={pointerWorld} />
        <NeuralEdges nodeData={nodeData} edges={edges} pointerWorld={pointerWorld} />
        <SignalParticles edges={edges} nodeData={nodeData} reducedMotion={reducedMotion} />
      </Float>

      <OrbitalRings reducedMotion={reducedMotion} />
      <HelixAccent reducedMotion={reducedMotion} />
      <AmbientDust reducedMotion={reducedMotion} />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.3}
        maxPolarAngle={Math.PI * 0.7}
        minPolarAngle={Math.PI * 0.3}
        dampingFactor={0.05}
        enableDamping
      />
    </>
  );
}

/* ── Main export ─────────────────────────────────────────── */
export default function NeuralScene3D({ interactive = true }) {
  const [supported, setSupported] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!window.WebGLRenderingContext) {
      setSupported(false);
    }
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  if (!supported) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
        pointerEvents: interactive ? 'auto' : 'none',
        overflow: 'hidden',
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 42, position: [0, 0, 14], near: 0.1, far: 50 }}
        style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
      >
        <SceneContents reducedMotion={reducedMotion} interactive={interactive} />
      </Canvas>
    </div>
  );
}
