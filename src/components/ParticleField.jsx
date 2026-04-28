/**
 * ParticleField.jsx — Ambient floating particles background using Three.js.
 * Lightweight, doesn't interfere with interactivity.
 */
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Particles({ count = 120, isDark }) {
  const meshRef = useRef();

  const { positions, sizes, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const sp = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      sz[i] = Math.random() * 3 + 1;
      sp[i] = Math.random() * 0.5 + 0.1;
    }
    return { positions: pos, sizes: sz, speeds: sp };
  }, [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const posArr = meshRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 1] += Math.sin(t * speeds[i] + i) * 0.002;
      posArr[i * 3] += Math.cos(t * speeds[i] * 0.5 + i) * 0.001;
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={isDark ? '#6ee7b7' : '#7C9A85'}
        transparent
        opacity={isDark ? 0.5 : 0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export default function ParticleField({ isDark = false, style = {} }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 0,
      ...style,
    }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={1}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: false }}
      >
        <Particles isDark={isDark} />
      </Canvas>
    </div>
  );
}
