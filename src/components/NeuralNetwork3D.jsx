/**
 * NeuralNetwork3D.jsx — Stunning 3D neural network visualization using Three.js
 * A rotating, glowing brain-like neural network with pulsing nodes and connections.
 */
import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, ContactShadows, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

/* ── Generates a mathematical point cloud shaped like a human brain ── */
function generateBrainPoints(count = 4000) {
  const pts = [];
  while (pts.length < count) {
    const x = (Math.random() - 0.5) * 2;
    const y = (Math.random() - 0.5) * 2;
    const z = (Math.random() - 0.5) * 2;

    const d = Math.sqrt(x * x + y * y + z * z);
    if (d > 1) continue;

    let r = 0.9;
    // Longitudinal fissure (gap between left and right hemispheres)
    r -= Math.exp(-Math.pow(x * 6, 2)) * 0.3;
    
    // Flatten the bottom (temporallobes / cerebellum base)
    if (y < -0.2) r -= Math.abs(y + 0.2) * 0.6;
    
    // Elongate the occipital lobe (back)
    if (z < -0.2) r += Math.abs(z + 0.2) * 0.3;
    
    // Frontal lobe shaping
    if (z > 0.4) r -= Math.abs(z - 0.4) * 0.2;

    if (d < r) {
      pts.push(
        x * 2.5, 
        y * 2.5 + 0.5, // shift up slightly
        z * 2.5
      );
    }
  }
  return new Float32Array(pts);
}

/* ── Synaptic Flashes (Simulating AI / Neural Activity) ── */
function SynapticFlashes({ points, count = 20, color }) {
  const flashes = useMemo(() => {
    const arr = [];
    const pointsCount = points.length / 3;
    for (let i = 0; i < count; i++) {
        // Pick a random point from the brain as the center of the flash
        const idx = Math.floor(Math.random() * pointsCount) * 3;
        arr.push({
           x: points[idx], y: points[idx+1], z: points[idx+2],
           speed: 0.5 + Math.random() * 1.5,
           offset: Math.random() * Math.PI * 2,
           size: Math.random() * 0.4 + 0.2
        });
    }
    return arr;
  }, [points, count]);

  const groupRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!groupRef.current) return;
    
    groupRef.current.children.forEach((mesh, i) => {
       const flash = flashes[i];
       const opacity = (Math.sin(t * flash.speed + flash.offset) + 1) / 2;
       mesh.material.opacity = opacity * 0.8;
       mesh.scale.setScalar(opacity * flash.size + 0.1);
    });
  });

  return (
    <group ref={groupRef}>
      {flashes.map((f, i) => (
        <mesh key={i} position={[f.x, f.y, f.z]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Main Brain Scene ──────────────────────────────────── */
function BrainScene({ isDark }) {
  const groupRef = useRef();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const brainPoints = useMemo(() => generateBrainPoints(3000), []);

  const pointColor = isDark ? '#34d399' : '#5B8A72'; // Primary Green
  const flashColor = isDark ? '#2DD4BF' : '#4EA88E'; // Tech Cyan

  useEffect(() => {
    const handler = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      });
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    // Gentle cinematic rotation + slight mouse follow
    groupRef.current.rotation.y = t * 0.1 + mousePos.x * 0.15;
    groupRef.current.rotation.x = Math.sin(t * 0.1) * 0.05 + mousePos.y * 0.1;
  });

  return (
    <>
      <fog attach="fog" args={[isDark ? '#0f172a' : '#fafaf8', 4, 10]} />
      <ambientLight intensity={isDark ? 0.2 : 0.5} />

      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5}>
        <group ref={groupRef}>
          {/* Dense Brain Point Cloud */}
          <Points positions={brainPoints}>
            <PointMaterial
              transparent
              depthWrite={false}
              size={0.04}
              color={pointColor}
              opacity={isDark ? 0.5 : 0.4}
              sizeAttenuation
              blending={THREE.AdditiveBlending}
            />
          </Points>
          
          {/* Activity bursts inside the lobes */}
          <SynapticFlashes points={brainPoints} color={flashColor} count={25} />
          <SynapticFlashes points={brainPoints} color={isDark ? '#60a5fa' : '#5B7FA6'} count={15} /> 
        </group>
      </Float>

      <ContactShadows
        opacity={isDark ? 0.3 : 0.15}
        scale={12}
        blur={2.5}
        far={10}
        resolution={256}
        color={isDark ? '#000000' : '#8a8178'}
        position={[0, -2.5, 0]}
      />
    </>
  );
}

/* ── Exported Canvas Component ─────────────────────────── */
export default function NeuralNetwork3D({ isDark = false, style = {} }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      ...style,
    }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        shadows
      >
        <BrainScene isDark={isDark} />
      </Canvas>
      {/* Gradient overlay for blending - using exact background colors */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: isDark
          ? 'radial-gradient(ellipse at center, transparent 30%, #0f172a 100%)'
          : 'radial-gradient(ellipse at center, transparent 30%, #FAFAF8 100%)',
      }} />
    </div>
  );
}
