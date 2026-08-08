import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ParticleNetwork() {
  const groupRef = useRef<THREE.Group>(null);

  const { points, linePositions } = useMemo(() => {
    const count = 60;
    const radius = 4;
    const pts: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * radius * 2;
      const y = (Math.random() - 0.5) * radius * 2;
      const z = (Math.random() - 0.5) * radius * 2;
      pts.push(new THREE.Vector3(x, y, z));
    }

    const maxDistance = 1.8;
    const linePos: number[] = [];

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const distance = pts[i].distanceTo(pts[j]);
        if (distance < maxDistance) {
          linePos.push(pts[i].x, pts[i].y, pts[i].z);
          linePos.push(pts[j].x, pts[j].y, pts[j].z);
        }
      }
    }

    return { points: pts, linePositions: new Float32Array(linePos) };
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
      groupRef.current.rotation.x += delta * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      {points.map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      ))}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.25} />
      </lineSegments>
    </group>
  );
}

export default function Hero3D() {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
        <ParticleNetwork />
      </Canvas>
    </div>
  );
}
