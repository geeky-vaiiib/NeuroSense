/**
 * NeuralNetwork3D.jsx — Stunning 3D neural network visualization using Three.js
 * A rotating, glowing brain-like neural network with pulsing nodes and connections.
 */
import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

/* ── Generate brain-like node positions ────────────────── */
function generateBrainNodes(count = 80) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Mix of sphere + random displacement for organic look
    const r = 1.8 + (Math.random() - 0.5) * 0.8;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta) * 0.75; // flatten slightly
    const z = r * Math.cos(phi);
    nodes.push(new THREE.Vector3(x, y, z));
  }
  return nodes;
}

/* ── Generate connections between nearby nodes ─────────── */
function generateConnections(nodes, maxDist = 1.2) {
  const connections = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = nodes[i].distanceTo(nodes[j]);
      if (dist < maxDist) {
        connections.push([i, j, dist]);
      }
    }
  }
  return connections;
}

/* ── Neural Node (glowing sphere) ──────────────────────── */
function NeuralNode({ position, color, pulseSpeed, baseSize }) {
  const meshRef = useRef();
  const glowRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * pulseSpeed;
    const scale = baseSize + Math.sin(t) * 0.03;
    if (meshRef.current) {
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.15 + Math.sin(t + 1) * 0.1;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowRef} scale={3}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ── Neural Connections (glowing lines) ────────────────── */
function NeuralConnections({ nodes, connections, color }) {
  const lineRef = useRef();

  const { positions, opacities } = useMemo(() => {
    const pos = [];
    const ops = [];
    connections.forEach(([i, j, dist]) => {
      pos.push(nodes[i].x, nodes[i].y, nodes[i].z);
      pos.push(nodes[j].x, nodes[j].y, nodes[j].z);
      const op = 1 - dist / 1.2;
      ops.push(op, op);
    });
    return {
      positions: new Float32Array(pos),
      opacities: new Float32Array(ops),
    };
  }, [nodes, connections]);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const t = clock.getElapsedTime();
    const attr = lineRef.current.geometry.getAttribute('opacity');
    if (!attr) return;
    for (let i = 0; i < attr.count; i++) {
      const base = opacities[i];
      attr.array[i] = base * (0.3 + Math.sin(t * 0.5 + i * 0.1) * 0.3);
    }
    attr.needsUpdate = true;
  });

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={opacities.length}
          array={opacities}
          itemSize={1}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.25}
        depthWrite={false}
      />
    </lineSegments>
  );
}

/* ── Floating Signal Pulses ────────────────────────────── */
function SignalPulses({ nodes, connections, color }) {
  const count = Math.min(connections.length, 20);
  const pulsesRef = useRef([]);

  const pulseData = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
      const [startIdx, endIdx] = connections[i % connections.length];
      data.push({
        start: nodes[startIdx],
        end: nodes[endIdx],
        speed: 0.3 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
      });
    }
    return data;
  }, [nodes, connections, count]);

  return (
    <>
      {pulseData.map((pulse, i) => (
        <PulseParticle key={i} pulse={pulse} color={color} ref={el => { pulsesRef.current[i] = el; }} />
      ))}
    </>
  );
}

const PulseParticle = ({ pulse, color }) => {
  const meshRef = useRef();

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = ((clock.getElapsedTime() * pulse.speed + pulse.offset) % 1);
    meshRef.current.position.lerpVectors(pulse.start, pulse.end, t);
    meshRef.current.material.opacity = Math.sin(t * Math.PI) * 0.9;
    meshRef.current.scale.setScalar(0.8 + Math.sin(t * Math.PI) * 0.4);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.025, 8, 8]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </mesh>
  );
};

/* ── Main 3D Scene ─────────────────────────────────────── */
function BrainScene({ isDark }) {
  const groupRef = useRef();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { nodes, connections } = useMemo(() => {
    const n = generateBrainNodes(85);
    const c = generateConnections(n, 1.1);
    return { nodes: n, connections: c };
  }, []);

  const nodeColor = isDark ? '#6ee7b7' : '#5B8A72';
  const lineColor = isDark ? '#34d399' : '#7BA695';
  const pulseColor = isDark ? '#a7f3d0' : '#3E6B54';

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
    groupRef.current.rotation.y = t * 0.08 + mousePos.x * 0.3;
    groupRef.current.rotation.x = Math.sin(t * 0.05) * 0.1 + mousePos.y * 0.15;
  });

  return (
    <>
      <ambientLight intensity={isDark ? 0.3 : 0.5} />
      <pointLight position={[5, 5, 5]} intensity={isDark ? 0.8 : 0.6} color={isDark ? '#6ee7b7' : '#7C9A85'} />
      <pointLight position={[-5, -3, 3]} intensity={0.4} color={isDark ? '#818cf8' : '#8B6BAE'} />
      <pointLight position={[0, -5, -3]} intensity={0.3} color={isDark ? '#f0abfc' : '#C4854C'} />

      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <group ref={groupRef}>
          {nodes.map((pos, i) => (
            <NeuralNode
              key={i}
              position={[pos.x, pos.y, pos.z]}
              color={nodeColor}
              pulseSpeed={0.5 + Math.random() * 2}
              baseSize={0.8 + Math.random() * 0.4}
            />
          ))}
          <NeuralConnections nodes={nodes} connections={connections} color={lineColor} />
          <SignalPulses nodes={nodes} connections={connections} color={pulseColor} />
        </group>
      </Float>

      <Sparkles
        count={60}
        scale={6}
        size={isDark ? 2.5 : 1.5}
        speed={0.3}
        opacity={isDark ? 0.4 : 0.2}
        color={isDark ? '#6ee7b7' : '#7C9A85'}
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
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <BrainScene isDark={isDark} />
      </Canvas>
      {/* Gradient overlay for blending */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: isDark
          ? 'radial-gradient(ellipse at center, transparent 30%, rgba(15,23,42,0.6) 100%)'
          : 'radial-gradient(ellipse at center, transparent 30%, rgba(250,250,248,0.5) 100%)',
      }} />
    </div>
  );
}
