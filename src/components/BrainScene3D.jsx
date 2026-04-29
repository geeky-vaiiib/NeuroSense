/**
 * BrainScene3D.jsx — Highly Interactive "Neural Swarm" Connectome
 * Built with Three.js + R3F.
 *
 * Features:
 *  - 4000+ volumetric particles shaped into a dual-hemisphere brain via noise displacement.
 *  - Dynamic cursor repulsion/attraction field (magnetic effect).
 *  - Glowing synaptic connections forming dynamically near the cursor.
 *  - Raycasted interactive regions with 3D floating glass-morphic labels.
 *  - Real-time particle state updates (color/scale shifting on interaction).
 */
import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Html, useCursor } from '@react-three/drei';
import * as THREE from 'three';

/* ── Utilities ───────────────────────────────────────────── */
function pseudoNoise3D(x, y, z) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

function fbm(x, y, z, octaves = 4) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * pseudoNoise3D(x * freq, y * freq, z * freq);
    amp *= 0.5;
    freq *= 2.1;
  }
  return val;
}

/* ── Palette ─────────────────────────────────────────────── */
const PALETTE = {
  idle: new THREE.Color('#0ECFC8'),
  active: new THREE.Color('#0BA89F'),
  highlight: new THREE.Color('#EDF2F7'),
};

/* ── Generate Brain Point Cloud ──────────────────────────── */
const PARTICLE_COUNT = 3500;
const RADIUS = 1.6;

function generateBrainPoints() {
  const points = [];
  let i = 0;
  while (i < PARTICLE_COUNT) {
    // Generate random point in sphere
    const r = RADIUS * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    
    let x = r * Math.sin(phi) * Math.cos(theta);
    let y = r * Math.sin(phi) * Math.sin(theta);
    let z = r * Math.cos(phi);

    // Shape into brain bounding box (elongate Z, squash Y slightly)
    z *= 1.2; 
    y *= 0.9;

    // Longitudinal fissure (split hemispheres)
    if (Math.abs(x) < 0.15 && y > -0.5) continue; // Hollow out the middle

    // Apply cortical folds (gyri/sulci) using noise
    const noise = fbm(x * 2.5, y * 2.5, z * 2.5, 4);
    if (noise < -0.2) continue; // Carve out sulci

    // Push points outward to form folds
    const foldExtrusion = Math.max(0, noise) * 0.2;
    const len = Math.hypot(x, y, z);
    if (len > 0) {
      x += (x / len) * foldExtrusion;
      y += (y / len) * foldExtrusion;
      z += (z / len) * foldExtrusion;
    }

    points.push(new THREE.Vector3(x, y, z));
    i++;
  }
  return points;
}

/* ── Interactive Neural Swarm Mesh ───────────────────────── */
function NeuralSwarm({ reducedMotion }) {
  const meshRef = useRef();
  const { mouse, camera, size } = useThree();
  
  // State for particles
  const basePoints = useMemo(() => generateBrainPoints(), []);
  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const targetPos = useMemo(() => new THREE.Vector3(), []);

  // Connection lines
  const linesRef = useRef();
  const MAX_LINES = 100;
  const linePositions = useMemo(() => new Float32Array(MAX_LINES * 6), []);
  
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    // 1. Raycast mouse to invisible plane to get 3D interaction point
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, targetPos);

    let lineIndex = 0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const bp = basePoints[i];
      
      // Idle animation (breathing/floating)
      let x = bp.x;
      let y = bp.y + (reducedMotion ? 0 : Math.sin(t * 1.5 + bp.x * 2) * 0.03);
      let z = bp.z + (reducedMotion ? 0 : Math.cos(t * 1.2 + bp.y * 2) * 0.03);

      // Mouse Interaction Field
      let scale = 0.015;
      let colorIntensity = 0;

      if (!reducedMotion) {
        // Distance to pointer in 3D
        const dx = targetPos.x - x;
        const dy = targetPos.y - y;
        // Assume pointer is slightly in front of the brain
        const dz = (targetPos.z + 1.0) - z; 
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        const INFLUENCE_RADIUS = 1.2;
        
        if (dist < INFLUENCE_RADIUS) {
          const force = (INFLUENCE_RADIUS - dist) / INFLUENCE_RADIUS;
          
          // Repulsion
          x -= dx * force * 0.15;
          y -= dy * force * 0.15;
          z -= dz * force * 0.15;
          
          // Scale & color boost
          scale += force * 0.03;
          colorIntensity = force;

          // Draw dynamic synaptic lines between cursor and active nodes
          if (lineIndex < MAX_LINES && Math.random() > 0.5) {
            linePositions[lineIndex * 6 + 0] = targetPos.x;
            linePositions[lineIndex * 6 + 1] = targetPos.y;
            linePositions[lineIndex * 6 + 2] = targetPos.z;
            linePositions[lineIndex * 6 + 3] = x;
            linePositions[lineIndex * 6 + 4] = y;
            linePositions[lineIndex * 6 + 5] = z;
            lineIndex++;
          }
        }
      }

      tempObj.position.set(x, y, z);
      tempObj.scale.setScalar(scale);
      tempObj.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObj.matrix);
      
      // Dynamic coloring per instance
      const c = PALETTE.idle.clone().lerp(PALETTE.active, colorIntensity);
      if (colorIntensity > 0.8) c.lerp(PALETTE.highlight, (colorIntensity - 0.8) * 5);
      meshRef.current.setColorAt(i, c);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    // Update lines
    if (linesRef.current && !reducedMotion) {
      // Zero out unused lines
      for (let i = lineIndex; i < MAX_LINES; i++) {
        linePositions[i * 6 + 0] = 0; linePositions[i * 6 + 1] = 0; linePositions[i * 6 + 2] = 0;
        linePositions[i * 6 + 3] = 0; linePositions[i * 6 + 4] = 0; linePositions[i * 6 + 5] = 0;
      }
      linesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Neural Nodes */}
      <instancedMesh ref={meshRef} args={[null, null, PARTICLE_COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial 
          toneMapped={false}
          transparent
          opacity={0.8}
        />
      </instancedMesh>

      {/* Dynamic Synapses to cursor */}
      {!reducedMotion && (
        <lineSegments ref={linesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={MAX_LINES * 2}
              array={linePositions}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#0ECFC8" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      )}
    </group>
  );
}

/* ── Interactive Hotspots ────────────────────────────────── */
const REGIONS = [
  { id: 'dlpfc', pos: [0.8, 0.8, 0.8], label: 'DLPFC', desc: 'Executive Function & Attention' },
  { id: 'amygdala', pos: [-0.6, -0.4, 0.5], label: 'Amygdala', desc: 'Emotional Regulation' },
  { id: 'wernicke', pos: [-1.2, 0.2, 0.0], label: "Wernicke's Area", desc: 'Language Comprehension' },
  { id: 'motor', pos: [0.4, 1.2, 0.2], label: 'Motor Cortex', desc: 'Voluntary Movement' },
];

function RegionHotspots() {
  const [hovered, setHovered] = useState(null);
  useCursor(hovered !== null);

  return (
    <group>
      {REGIONS.map((region) => (
        <group key={region.id} position={region.pos}>
          {/* Invisible interactive hit area */}
          <mesh 
            onPointerOver={(e) => { e.stopPropagation(); setHovered(region.id); }}
            onPointerOut={(e) => { setHovered(null); }}
            visible={false}
          >
            <sphereGeometry args={[0.3, 16, 16]} />
          </mesh>
          
          {/* Glowing dot */}
          <mesh>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color={hovered === region.id ? '#EDF2F7' : '#0ECFC8'} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial color="#0ECFC8" transparent opacity={hovered === region.id ? 0.4 : 0.1} blending={THREE.AdditiveBlending} />
          </mesh>

          {/* Glassmorphic UI Label */}
          <Html 
            position={[0.1, 0.1, 0]} 
            style={{ 
              opacity: hovered === region.id ? 1 : 0, 
              transform: hovered === region.id ? 'scale(1) translate3d(0,0,0)' : 'scale(0.9) translate3d(0,10px,0)',
              transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
              pointerEvents: 'none'
            }}
          >
            <div style={{
              background: 'rgba(10, 15, 15, 0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(14,207,200,0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              width: 'max-content',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(14,207,200,0.1)'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#EDF2F7', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {region.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#0ECFC8', marginTop: '4px', fontWeight: 500 }}>
                {region.desc}
              </div>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

/* ── Scene Wrapper ───────────────────────────────────────── */
function SceneContents({ reducedMotion }) {
  const groupRef = useRef();

  useFrame(({ clock, mouse }) => {
    if (!groupRef.current || reducedMotion) return;
    const t = clock.getElapsedTime();
    // Base gentle rotation
    groupRef.current.rotation.y = t * 0.05;
    groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.05;
    
    // Parallax on mouse move
    groupRef.current.rotation.y += mouse.x * 0.2;
    groupRef.current.rotation.x += -mouse.y * 0.2;
  });

  return (
    <group>
      <ambientLight intensity={0.5} />
      <Float
        speed={reducedMotion ? 0 : 1}
        rotationIntensity={reducedMotion ? 0 : 0.1}
        floatIntensity={reducedMotion ? 0 : 0.2}
      >
        <group ref={groupRef} position={[0, -0.2, 0]}>
          <NeuralSwarm reducedMotion={reducedMotion} />
          <RegionHotspots />
        </group>
      </Float>
    </group>
  );
}

/* ── Main Export ─────────────────────────────────────────── */
export default function BrainScene3D() {
  const [supported, setSupported] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!window.WebGLRenderingContext) setSupported(false);
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  if (!supported) return null;

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 35, position: [0, 0, 6], near: 0.1, far: 50 }}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <SceneContents reducedMotion={reducedMotion} />
    </Canvas>
  );
}
