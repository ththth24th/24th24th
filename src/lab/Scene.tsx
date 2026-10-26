import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Grid,
  Html,
  Line,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import {
  calculate,
  platformOf,
  type Config,
  type Part,
  type Vec3,
} from "./data";
class WebGLBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="canvas-fallback">
        3D недоступно на этом устройстве. Включите WebGL 2 или аппаратное
        ускорение. Каталог, расчёты и проекты продолжают работать.
      </div>
    ) : (
      this.props.children
    );
  }
}
export type ViewMode = "normal" | "xray" | "exploded" | "mass" | "technical";
export type CameraView = "iso" | "top" | "front" | "side";
const carbon = new THREE.DataTexture(
  new Uint8Array(
    Array.from({ length: 16 * 16 * 4 }, (_, i) =>
      i % 4 === 3
        ? 255
        : ((Math.floor(i / 4) % 16) + Math.floor(i / 64)) % 4 < 2
          ? 48
          : 25,
    ),
  ),
  16,
  16,
);
carbon.wrapS = carbon.wrapT = THREE.RepeatWrapping;
carbon.repeat.set(8, 8);
carbon.needsUpdate = true;
function Mat({
  color = "#242D36",
  metal = 0.5,
  rough = 0.35,
  opacity = 1,
  wire = false,
  selected = false,
  map = false,
}: {
  color?: string;
  metal?: number;
  rough?: number;
  opacity?: number;
  wire?: boolean;
  selected?: boolean;
  map?: boolean;
}) {
  return (
    <meshStandardMaterial
      color={selected ? "#C4FF6B" : color}
      metalness={metal}
      roughness={rough}
      transparent={opacity < 1}
      opacity={opacity}
      wireframe={wire}
      emissive={selected ? "#C4FF6B" : "#000000"}
      emissiveIntensity={selected ? 0.25 : 0}
      map={map ? carbon : undefined}
    />
  );
}
function Box({
  size,
  pos = [0, 0, 0],
  color,
  rotation,
  opacity,
  wire,
  selected,
  map,
}: {
  size: Vec3;
  pos?: Vec3;
  color?: string;
  rotation?: Vec3;
  opacity?: number;
  wire?: boolean;
  selected?: boolean;
  map?: boolean;
}) {
  return (
    <mesh position={pos} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <Mat
        color={color}
        opacity={opacity}
        wire={wire}
        selected={selected}
        map={map}
      />
    </mesh>
  );
}
function Cylinder({
  r = 0.1,
  h = 0.1,
  pos = [0, 0, 0],
  color = "#353E48",
  rotation,
  selected = false,
}: {
  r?: number;
  h?: number;
  pos?: Vec3;
  color?: string;
  rotation?: Vec3;
  selected?: boolean;
}) {
  return (
    <mesh position={pos} rotation={rotation} castShadow>
      <cylinderGeometry args={[r, r * 0.94, h, 24]} />
      <Mat color={color} selected={selected} />
    </mesh>
  );
}
function Beam({
  a,
  b,
  r = 0.025,
  color = "#252F39",
}: {
  a: Vec3;
  b: Vec3;
  r?: number;
  color?: string;
}) {
  const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    d.clone().normalize(),
  );
  return (
    <mesh
      position={new THREE.Vector3(...a)
        .add(new THREE.Vector3(...b))
        .multiplyScalar(0.5)}
      quaternion={q}
      castShadow
    >
      <cylinderGeometry args={[r, r, d.length(), 12]} />
      <Mat color={color} map />
    </mesh>
  );
}
function Prop({
  length = 0.7,
  vertical = false,
  selected = false,
}: {
  length?: number;
  vertical?: boolean;
  selected?: boolean;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0.025, -0.018);
    s.bezierCurveTo(
      length * 0.18,
      -length * 0.025,
      length * 0.36,
      -length * 0.07,
      length * 0.49,
      -length * 0.045,
    );
    s.quadraticCurveTo(
      length * 0.52,
      -length * 0.015,
      length * 0.48,
      length * 0.015,
    );
    s.bezierCurveTo(
      length * 0.3,
      length * 0.065,
      length * 0.15,
      length * 0.045,
      0.025,
      0.018,
    );
    s.closePath();
    return s;
  }, [length]);
  return (
    <group rotation={vertical ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <group rotation={[0, 0.25, 0]}>
        {[0, Math.PI].map((a, i) => (
          <group key={i} rotation={[0, a, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
              <extrudeGeometry
                args={[
                  shape,
                  {
                    depth: 0.009,
                    bevelEnabled: true,
                    bevelSize: 0.002,
                    bevelThickness: 0.002,
                    bevelSegments: 1,
                    steps: 1,
                  },
                ]}
              />
              <Mat color="#29343C" rough={0.3} selected={selected} map />
            </mesh>
            <mesh
              position={[length * 0.46, 0.013, 0.008]}
              rotation={[0, 0.1, 0]}
            >
              <boxGeometry args={[length * 0.035, 0.003, length * 0.055]} />
              <Mat color="#C4FF6B" />
            </mesh>
          </group>
        ))}
      </group>
      <Cylinder r={0.045} h={0.045} pos={[0, 0.02, 0]} color="#9CA5AC" />
      <Cylinder r={0.014} h={0.011} pos={[0, 0.047, 0]} color="#26333C" />
    </group>
  );
}
function Wing({
  span,
  color,
  wire,
  opacity,
}: {
  span: number;
  color: string;
  wire: boolean;
  opacity: number;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-span / 2, 0.22);
    s.lineTo(-span / 2, -0.08);
    s.lineTo(-0.3, -0.38);
    s.lineTo(0.3, -0.38);
    s.lineTo(span / 2, -0.08);
    s.lineTo(span / 2, 0.22);
    s.lineTo(0.2, 0.28);
    s.closePath();
    return s;
  }, [span]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
      <extrudeGeometry
        args={[
          shape,
          {
            depth: 0.045,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.025,
            bevelThickness: 0.015,
          },
        ]}
      />
      <Mat color={color} wire={wire} opacity={opacity} />
    </mesh>
  );
}
function PartMesh({
  part,
  c,
  mode,
  selected,
}: {
  part: Part;
  c: Config;
  mode: ViewMode;
  selected: boolean;
}) {
  const p = platformOf(c),
    d = part.component.dimensions,
    plane = c.platform === "wing" || c.platform === "hybrid",
    accent = p.color;
  const color =
    mode === "mass"
      ? {
          structure: "#748B9C",
          motor: "#74D6FF",
          battery: "#C4FF6B",
          payload: "#FFB454",
          camera: "#D7B3FF",
          sensor: "#72CECD",
          module: "#F0B384",
          tank: "#F0B384",
          cargo: "#F0B384",
        }[part.component.category] || "#C7D4DC"
      : undefined;
  const wire = mode === "technical",
    opacity = mode === "xray" ? 0.24 : 1;
  switch (part.visual) {
    case "frame":
      return (
        <group>
          {plane ? (
            <>
              <mesh scale={[0.19, 0.17, p.size[2] * 0.47]} castShadow>
                <sphereGeometry args={[1, 32, 16]} />
                <Mat
                  color={color || "#D8DEE0"}
                  opacity={opacity}
                  wire={wire}
                  selected={selected}
                />
              </mesh>
              <Wing
                span={c.wingSpan}
                color={color || "#BBC8C8"}
                wire={wire}
                opacity={opacity}
              />
              <Box
                size={[0.95, 0.045, 0.25]}
                pos={[0, 0.1, 0.73]}
                color={accent}
              />
              <Box
                size={[0.045, 0.36, 0.3]}
                pos={[0, 0.22, 0.75]}
                color={color || "#B2BFC3"}
              />
              <Box
                size={[0.2, 0.045, 0.46]}
                pos={[0, 0.16, -0.3]}
                color="#1A242C"
              />
              {c.platform === "hybrid" &&
                [-0.8, 0.8].map((x) => (
                  <Beam
                    key={x}
                    a={[x, 0.04, -0.72]}
                    b={[x, 0.04, 0.75]}
                    r={0.032}
                  />
                ))}
            </>
          ) : (
            <>
              {Array.from({ length: p.motors }, (_, i) => {
                const a = Math.PI / 4 + (i * Math.PI * 2) / p.motors;
                const r = p.size[0] * 0.35;
                return (
                  <group key={i}>
                    <Beam
                      a={[Math.cos(a) * 0.19, 0, Math.sin(a) * 0.19]}
                      b={[Math.cos(a) * r, 0.04, Math.sin(a) * r]}
                      r={p.motors > 4 ? 0.045 : 0.035}
                    />
                    <Beam
                      a={[Math.cos(a) * 0.2, -0.055, Math.sin(a) * 0.2]}
                      b={[Math.cos(a) * r, -0.015, Math.sin(a) * r]}
                      r={0.016}
                      color="#58636A"
                    />
                    <Cylinder
                      r={0.047}
                      h={0.04}
                      pos={[
                        Math.cos(a) * r * 0.55,
                        0.035,
                        Math.sin(a) * r * 0.55,
                      ]}
                      color={accent}
                    />
                  </group>
                );
              })}
              <Box
                size={[0.57, 0.12, 0.66]}
                color={color || "#232F38"}
                map
                opacity={opacity}
                selected={selected}
                wire={wire}
              />
              <mesh
                position={[0, 0.1, -0.07]}
                scale={[0.32, 0.13, 0.38]}
                castShadow
              >
                <sphereGeometry args={[1, 8, 8]} />
                <Mat
                  color={
                    color ||
                    (c.platform === "rescue"
                      ? "#B66E35"
                      : c.platform === "eco"
                        ? "#A3BDB0"
                        : "#C8D3D4")
                  }
                  opacity={opacity}
                  selected={selected}
                  wire={wire}
                />
              </mesh>
              <Box
                size={[0.09, 0.018, 0.35]}
                pos={[0, 0.222, -0.08]}
                color={accent}
              />
              {[-1, 1].flatMap((x) =>
                [-1, 1].map((z) => (
                  <Cylinder
                    key={`${x}${z}`}
                    r={0.018}
                    h={0.012}
                    pos={[x * 0.23, 0.069, z * 0.27]}
                    color="#AAB1B4"
                  />
                )),
              )}
              <Box
                size={[0.18, 0.07, 0.05]}
                pos={[0, 0.05, -0.35]}
                color="#111A22"
              />
              <Box
                size={[0.09, 0.018, 0.009]}
                pos={[0, 0.055, -0.38]}
                color={accent}
              />
              {c.platform === "eco" && (
                <Box
                  size={[0.32, 0.14, 0.3]}
                  pos={[0, 0.16, 0.2]}
                  color="#7B9F94"
                />
              )}
            </>
          )}
        </group>
      );
    case "motor":
    case "cruise":
      return (
        <group
          rotation={part.visual === "cruise" ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          <Cylinder
            r={0.088}
            h={0.09}
            color={color || "#303942"}
            selected={selected}
          />
          <Cylinder r={0.092} h={0.018} pos={[0, 0.052, 0]} color={accent} />
          <Cylinder r={0.068} h={0.025} pos={[0, 0.073, 0]} color="#4A535D" />
          {Array.from({ length: 8 }, (_, i) => (
            <Box
              key={i}
              size={[0.015, 0.055, 0.014]}
              pos={[
                Math.cos((i * Math.PI) / 4) * 0.086,
                0,
                Math.sin((i * Math.PI) / 4) * 0.086,
              ]}
              color="#0D141C"
            />
          ))}
        </group>
      );
    case "prop":
      return <Prop length={d[0]} selected={selected} />;
    case "pusher":
      return <Prop length={0.7} vertical selected={selected} />;
    case "battery":
      return (
        <group>
          <Box size={d} color={color || "#202A33"} selected={selected} />
          <Box
            size={[d[0] * 0.65, 0.008, d[2] * 0.7]}
            pos={[0, d[1] / 2 + 0.003, 0]}
            color={accent}
          />
          {[-1, 1].map((x) => (
            <Box
              key={x}
              size={[0.025, d[1] + 0.012, d[2] + 0.01]}
              pos={[x * d[0] * 0.35, 0, 0]}
              color="#10151C"
            />
          ))}
          <Beam
            a={[d[0] / 2, 0.02, 0]}
            b={[d[0] / 2 + 0.08, -0.1, 0.05]}
            r={0.009}
            color="#AB4B31"
          />
        </group>
      );
    case "camera":
    case "thermal":
      return (
        <group>
          <Beam a={[0, 0.16, 0]} b={[0, 0.04, 0]} r={0.018} />
          <Cylinder
            r={0.07}
            h={0.22}
            rotation={[0, 0, Math.PI / 2]}
            color="#46525B"
          />
          <Box size={d} color={color || "#323E48"} selected={selected} />
          <Cylinder
            r={d[0] * 0.35}
            h={0.06}
            pos={[0, 0, -d[2] / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            color="#10161D"
          />
          <mesh
            position={[0, 0, -d[2] / 2 - 0.034]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[d[0] * 0.26, d[0] * 0.26, 0.008, 24]} />
            <meshPhysicalMaterial
              color={part.visual === "thermal" ? "#6E597F" : "#336E89"}
              metalness={0.75}
              roughness={0.05}
              clearcoat={1}
            />
          </mesh>
        </group>
      );
    case "sensor":
      return (
        <group>
          <Beam a={[0, -0.15, 0]} b={[0, 0, 0]} r={0.012} />
          <Cylinder
            r={d[0] / 2}
            h={d[1]}
            color={color || "#D8DFDF"}
            selected={selected}
          />
          <Cylinder
            r={0.025}
            h={0.009}
            pos={[0, d[1] / 2 + 0.003, 0]}
            color={accent}
          />
        </group>
      );
    case "tank":
      return (
        <group>
          <Box
            size={d}
            color={color || "#D7E4DB"}
            opacity={mode === "xray" ? 0.15 : 0.75}
            selected={selected}
          />
          <Cylinder
            r={0.07}
            h={0.035}
            pos={[0, d[1] / 2 + 0.02, 0]}
            color="#293E38"
          />
          <Box
            size={[0.08, 0.015, d[2] * 1.03]}
            pos={[0, d[1] * 0.15, 0]}
            color="#3F524D"
          />
          <Line
            points={[
              [d[0] / 2, 0, 0],
              [d[0] / 2 + 0.1, -0.15, 0],
              [0.4, -0.22, -0.23],
            ]}
            color="#46675B"
            lineWidth={3}
          />
        </group>
      );
    case "water":
      return c.fill > 0 ? (
        <Box
          size={[
            0.3 + c.tank * 0.02,
            ((0.3 + c.tank * 0.02) * c.fill) / 100,
            0.3 + c.tank * 0.02,
          ]}
          pos={[0, (-(0.3 + c.tank * 0.02) * (1 - c.fill / 100)) / 2, 0]}
          color={mode === "mass" ? "#FFB454" : "#74D6FF"}
          opacity={0.5}
        />
      ) : null;
    case "gear": {
      const w = p.size[0] * (heavy(c) ? 0.23 : 0.22);
      return (
        <group>
          {[-w, w].map((x) => (
            <group key={x}>
              <Beam a={[x * 0.5, 0.35, -0.2]} b={[x, -0.15, -0.32]} r={0.018} />
              <Beam a={[x * 0.5, 0.35, 0.2]} b={[x, -0.15, 0.32]} r={0.018} />
              <Beam
                a={[x, -0.15, -0.44]}
                b={[x, -0.15, 0.44]}
                r={0.025}
                color={color || "#404C54"}
              />
            </group>
          ))}
        </group>
      );
    }
    case "cargoMount":
      return (
        <group>
          <Box size={d} color={color || "#4A555F"} selected={selected} map />
          {[-0.35, 0.35].map((x) => (
            <Beam
              key={x}
              a={[x, 0.63, 0]}
              b={[x, 0, 0]}
              r={0.013}
              color="#73818A"
            />
          ))}
        </group>
      );
    case "payload":
      return c.cargo > 0 ? (
        <group>
          <Box
            size={[0.55, 0.15 + c.cargo * 0.018, 0.45]}
            color={color || "#92734F"}
            selected={selected}
          />
          {[-0.17, 0.17].map((x) => (
            <Box
              key={x}
              size={[0.03, 0.18 + c.cargo * 0.018, 0.46]}
              pos={[x, 0, 0]}
              color="#29333C"
            />
          ))}
        </group>
      ) : null;
    case "guards": {
      const r = p.size[0] * 0.35;
      return (
        <group>
          {Array.from({ length: 4 }, (_, i) => {
            const a = Math.PI / 4 + (i * Math.PI) / 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * r, 0, Math.sin(a) * r]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <torusGeometry args={[r * 0.43, 0.012, 8, 40]} />
                <Mat color={color || "#758089"} selected={selected} />
              </mesh>
            );
          })}
        </group>
      );
    }
    case "spot":
      return (
        <group>
          <Box size={d} color={color || "#34424C"} selected={selected} />
          <Cylinder
            r={0.08}
            h={0.02}
            pos={[0, 0, -0.12]}
            rotation={[Math.PI / 2, 0, 0]}
            color="#F5E8B0"
          />
        </group>
      );
    case "nozzle":
      return (
        <group>
          <Cylinder
            r={0.022}
            h={0.08}
            color={color || "#779D78"}
            selected={selected}
          />
          <Beam
            a={[0, 0.04, 0]}
            b={[0.25, 0.04, 0]}
            r={0.012}
            color="#3D5347"
          />
        </group>
      );
    case "lidar":
      return (
        <group>
          <Cylinder
            r={0.1}
            h={0.18}
            color={color || "#233E49"}
            selected={selected}
          />
          <Cylinder r={0.105} h={0.04} pos={[0, 0.05, 0]} color="#74D6FF" />
        </group>
      );
    default:
      return <Box size={d} color={color || "#6C858B"} selected={selected} />;
  }
}
function heavy(c: Config) {
  return c.platform === "agro" || c.platform === "cargo";
}
function AnimatedPart({
  part,
  c,
  mode,
  selected,
  onSelect,
}: {
  part: Part;
  c: Config;
  mode: ViewMode;
  selected: boolean;
  onSelect?: (part: Part) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const p = part.position;
    const explosion = mode === "exploded" ? 1 : 0;
    const direction = part.visual === "frame" ? 0 : 1;
    ref.current.position.lerp(
      new THREE.Vector3(
        p[0] * (1 + explosion * 0.55),
        p[1] + explosion * direction * (p[1] >= 0.05 ? 0.5 : -0.5),
        p[2] * (1 + explosion * 0.55),
      ),
      1 - Math.exp(-dt * 9),
    );
  });
  return (
    <group
      ref={ref}
      position={part.position}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect(part);
            }
          : undefined
      }
      onPointerOver={
        onSelect
          ? (e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }
          : undefined
      }
      onPointerOut={
        onSelect
          ? () => {
              document.body.style.cursor = "auto";
            }
          : undefined
      }
    >
      <PartMesh part={part} c={c} mode={mode} selected={selected} />
    </group>
  );
}
function CameraRig({ view, resetKey }: { view: CameraView; resetKey: number }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const positions: Record<CameraView, Vec3> = {
      iso: [3.9, 2.6, 4.5],
      top: [0, 6, 0.001],
      front: [0, 0.7, -6],
      side: [6, 0.6, 0],
    };
    camera.position.set(...positions[view]);
    camera.lookAt(0, 0, 0);
    invalidate();
  }, [view, resetKey, camera, invalidate]);
  return null;
}
export function Drone({
  config,
  mode = "normal",
  selected = "",
  onSelect,
}: {
  config: Config;
  mode?: ViewMode;
  selected?: string;
  onSelect?: (p: Part) => void;
}) {
  const calc = calculate(config);
  const p = platformOf(config);
  const scale =
    2.5 /
    Math.max(
      p.size[0],
      config.platform === "wing" || config.platform === "hybrid"
        ? config.wingSpan
        : 0,
    );
  return (
    <group scale={scale} rotation={[0, -0.18, 0]}>
      {calc.parts.map((part) => (
        <AnimatedPart
          key={config.platform + part.key}
          part={part}
          c={config}
          mode={mode}
          selected={part.key === selected}
          onSelect={onSelect}
        />
      ))}
      {mode === "mass" && (
        <mesh position={calc.center}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      )}
      {mode === "technical" && (
        <>
          <axesHelper args={[1.5]} />
          <Line
            points={[
              [-p.size[0] / 2, -0.85, 0],
              [p.size[0] / 2, -0.85, 0],
            ]}
            color="#74D6FF"
            dashed
            dashSize={0.05}
            gapSize={0.03}
          />
          <Html position={[0, -0.9, 0]} center>
            <span className="dimension">{calc.size[0].toFixed(2)} м</span>
          </Html>
        </>
      )}
    </group>
  );
}
function RenderReady({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  useFrame(() => {
    frames.current++;
    if (frames.current < 3) invalidate();
    if (frames.current === 3) onReady();
  });
  return null;
}
export function Scene({
  config,
  mode = "normal",
  view = "iso",
  onSelect,
  selected,
  thumbnail = false,
  hero = false,
  resetKey = 0,
}: {
  config: Config;
  mode?: ViewMode;
  view?: CameraView;
  onSelect?: (p: Part) => void;
  selected?: string;
  thumbnail?: boolean;
  hero?: boolean;
  resetKey?: number;
}) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(!thumbnail),
    host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!thumbnail) return;
    const o = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          o.disconnect();
        }
      },
      { rootMargin: "150px" },
    );
    if (host.current) o.observe(host.current);
    return () => o.disconnect();
  }, [thumbnail]);
  return (
    <div
      ref={host}
      className={"scene " + (thumbnail ? "thumbnail" : "")}
      data-ready={ready}
      role="img"
      aria-label={"Интерактивная 3D-модель " + platformOf(config).name}
    >
      {visible && (
        <WebGLBoundary>
          <Canvas
            shadows={!thumbnail}
            dpr={[1, 1.5]}
            camera={{ position: [3.9, 2.6, 4.5], fov: hero ? 30 : 36 }}
            frameloop={thumbnail ? "demand" : "always"}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            }}
            fallback={
              <div className="canvas-fallback">
                Для 3D-просмотра нужен браузер с WebGL 2. Расчёты и проекты
                доступны ниже.
              </div>
            }
          >
            <Suspense fallback={null}>
              <RenderReady onReady={() => setReady(true)} />
              <ambientLight intensity={1.4} />
              <hemisphereLight args={["#DDE9F1", "#1A2838", 2]} />
              <directionalLight
                position={[3, 6, 2]}
                intensity={4}
                color="#EFF4ED"
                castShadow={!thumbnail}
                shadow-mapSize={1024}
              />
              <directionalLight
                position={[-4, 2, -2]}
                intensity={3}
                color="#B7DBF1"
              />
              <directionalLight
                position={[1, 0, -4]}
                intensity={2}
                color="#C4FF6B"
              />
              <Drone
                config={config}
                mode={mode}
                onSelect={onSelect}
                selected={selected}
              />
              {!thumbnail && (
                <>
                  <Grid
                    position={[0, -1.45, 0]}
                    args={[12, 12]}
                    cellSize={0.5}
                    cellThickness={0.5}
                    cellColor="#26323A"
                    sectionSize={2}
                    sectionThickness={0.7}
                    sectionColor="#3F4E4F"
                    fadeDistance={10}
                    fadeStrength={2}
                  />
                  <ContactShadows
                    position={[0, -1.44, 0]}
                    opacity={0.35}
                    scale={10}
                    blur={2.8}
                    far={4}
                    resolution={256}
                  />
                </>
              )}
              <OrbitControls
                makeDefault
                enablePan={false}
                enableZoom={!thumbnail}
                enableRotate={!thumbnail}
                minDistance={2.5}
                maxDistance={10}
                autoRotate={hero}
                autoRotateSpeed={0.35}
                maxPolarAngle={Math.PI * 0.87}
              />
              <CameraRig view={view} resetKey={resetKey} />
            </Suspense>
          </Canvas>
        </WebGLBoundary>
      )}
    </div>
  );
}
