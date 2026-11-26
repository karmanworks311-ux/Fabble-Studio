"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import {
  CanvasTexture,
  DoubleSide,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SpotLight, PerspectiveCamera, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { reels, reelSrc, sites } from "@/lib/work";
import { site as studio } from "@/lib/site";
import { clockDate, clockMenu, clockTime } from "@/lib/clock";

type Focus = "desk" | "laptop" | "phone";
export type ScreenRect = { x: number; y: number; w: number; h: number };
type Props = {
  focus: Focus;
  lamp: boolean;
  onToggleLamp: () => void;
  onPick: (which: "laptop" | "phone") => void;
  onScreenRect: (r: ScreenRect | null) => void;
  onReady: () => void;
  active: boolean;
};

/** The 3D desk: lamp, laptop on a cooling pad, phone on a stand. Clicking a device picks it up (the camera flies to its screen). */
export default function DeskScene({ focus, lamp, onToggleLamp, onPick, onScreenRect, onReady, active }: Props) {
  const small = typeof window !== "undefined" && innerWidth < 768;
  return (
    <Canvas
      className="!absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_86%,transparent)]"
      dpr={[1, 1.5]}
      // the desk is still most of the time: draw a frame only when something moves (camera, lamp, hover)
      frameloop={active ? "demand" : "never"}
      // reveal once the first frame is on screen
      onCreated={() => requestAnimationFrame(() => requestAnimationFrame(onReady))}
      shadows="percentage"
      camera={{ position: [0, 3.4, 8], fov: 34, near: 0.1, far: 60 }}
    >
      {/* no background: the page shows through; the desk fades into the page colour */}
      <fog attach="fog" args={["#07070a", 11, 24]} />
      <Rig focus={focus} onRect={onScreenRect} />
      <Lamp on={lamp} onToggle={onToggleLamp} shadowSize={small ? 512 : 1024} />
      <Laptop lamp={lamp} onPick={() => onPick("laptop")} />
      <Phone lamp={lamp} onPick={() => onPick("phone")} />
      <Props />
    </Canvas>
  );
}

/* ---------------------------------------------------------------- camera */

const tmpQ = new Quaternion();

/** Eases the camera between the desk view and a held device's screen. */
function Rig({ focus, onRect }: { focus: Focus; onRect: (r: ScreenRect | null) => void }) {
  const last = useRef<ScreenRect | null>(null);
  const { camera, scene, size, invalidate } = useThree();
  useEffect(() => invalidate(), [focus, size, invalidate]);
  const target = useRef(new Vector3(-0.2, 0.9, 0));
  const goalPos = useMemo(() => new Vector3(), []);
  const goalTarget = useMemo(() => new Vector3(), []);

  useFrame((_, dt) => {
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / size.height;
    const half = Math.tan((cam.fov * Math.PI) / 360);

    if (focus === "desk") {
      // keep the whole desk, lamp to mug (about 9.6 wide, 4.2 tall), in frame at any aspect
      // portrait screens crop to laptop + phone instead of backing far away
      const dist = Math.max((aspect < 1 ? 6.4 : 9.6) / (2 * half * aspect), 4.2 / (2 * half));
      goalTarget.set(-0.15, 0.95, 0);
      goalPos.set(-0.15, 0.95 + dist * 0.4, dist * 0.92);
    } else {
      // stop in front of the screen, close enough that it fills the view
      const screen = scene.getObjectByName(`${focus}-screen`) as Mesh | undefined;
      if (!screen) return;
      const { width: w, height: h } = (screen.geometry as PlaneGeometry).parameters;
      screen.getWorldPosition(goalTarget);
      screen.getWorldQuaternion(tmpQ);
      const fill = focus === "laptop" ? 0.82 : 0.86;
      const dist = Math.max(h / (2 * half * fill), w / (2 * half * aspect * fill));
      goalPos
        .copy(new Vector3(0, 0, 1).applyQuaternion(tmpQ))
        .multiplyScalar(dist)
        .add(goalTarget);
    }

    // fog starts just past the desk, wherever the camera is, so the floor's far edge never shows
    if (scene.fog && "near" in scene.fog) {
      const d = cam.position.distanceTo(target.current);
      scene.fog.near = d + 3;
      scene.fog.far = d + 18;
    }

    const k = 1 - Math.exp(-dt * (focus === "desk" ? 3 : 4.5));
    cam.position.lerp(goalPos, k);
    target.current.lerp(goalTarget, k);
    cam.lookAt(target.current);
    if (cam.position.distanceToSquared(goalPos) > 1e-6 || target.current.distanceToSquared(goalTarget) > 1e-6) invalidate();

    // tell the page where the held device's screen sits, so its live screen can be laid exactly over it
    let rect: ScreenRect | null = null;
    const screen = focus !== "desk" && (scene.getObjectByName(`${focus}-screen`) as Mesh | undefined);
    if (screen) {
      cam.updateMatrixWorld();
      const { width: w, height: h } = (screen.geometry as PlaneGeometry).parameters;
      const xs: number[] = [];
      const ys: number[] = [];
      for (const [cx, cy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const v = new Vector3((cx * w) / 2, (cy * h) / 2, 0).applyMatrix4(screen.matrixWorld).project(cam);
        xs.push(((v.x + 1) / 2) * size.width);
        ys.push(((1 - v.y) / 2) * size.height);
      }
      rect = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    const p = last.current;
    const moved = !p !== !rect || (p && rect && Math.max(Math.abs(p.x - rect.x), Math.abs(p.y - rect.y), Math.abs(p.w - rect.w)) > 0.5);
    if (moved) {
      last.current = rect;
      onRect(rect);
    }
  });
  return null;
}

/* ---------------------------------------------------------------- shared */

function useHover() {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);
  return [hovered, setHovered] as const;
}

/** A 2D canvas used as a screen texture; `draw` reruns when an image finishes loading or `deps` change. */
function useScreenTexture(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D, img: Record<string, HTMLImageElement>) => void,
  srcs: string[],
  deps: unknown[],
) {
  const invalidate = useThree((st) => st.invalidate);
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement>>({});
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [w, h]);

  useEffect(() => {
    srcs.forEach((src) => {
      const img = new Image();
      img.onload = () => setImgs((m) => ({ ...m, [src]: img }));
      img.src = src;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  useEffect(() => {
    const ctx = (tex.image as HTMLCanvasElement).getContext("2d")!;
    draw(ctx, imgs);
    tex.needsUpdate = true;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw on images and caller deps
  }, [tex, imgs, ...deps]);

  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Minute-resolution clock for the screens. */
function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ---------------------------------------------------------------- lamp */

/** The articulated desk lamp from three-showcase: nested groups are the joints; click to switch it. */
function Lamp({ on, onToggle, shadowSize }: { on: boolean; onToggle: () => void; shadowSize: number }) {
  const [hovered, setHovered] = useHover();
  const [target] = useState(() => new Object3D());
  const body = { color: "#d9d6ea", metalness: 0.25, roughness: 0.4, emissive: "#8b5cf6", emissiveIntensity: hovered ? 1.6 : 0 } as const;

  // switching fades the light over ~0.4s instead of snapping
  const spot = useRef<SpotLight>(null);
  const glow = useRef<PointLight>(null);
  const bulb = useRef<MeshStandardMaterial>(null);
  const room = useRef<HemisphereLight>(null);
  const level = useRef(on ? 1 : 0);
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => invalidate(), [on, hovered, invalidate]);
  useFrame((_, dt) => {
    const goal = on ? 1 : 0;
    level.current += (goal - level.current) * (1 - Math.exp(-dt * 9));
    const v = level.current;
    if (spot.current) spot.current.intensity = 70 * v;
    if (glow.current) glow.current.intensity = 1.2 * v;
    if (bulb.current) bulb.current.emissiveIntensity = 6 * v;
    if (room.current) room.current.intensity = 0.18 + 0.52 * v;
    if (Math.abs(goal - v) > 0.002) invalidate();
  });

  return (
    <group
      position={[-3.6, 0, -0.9]}
      rotation={[0, -0.35, 0]}
      scale={1.4}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <hemisphereLight ref={room} color="#b9a8ff" groundColor="#120d0b" />
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.52, 0.6, 0.12, 32]} />
        <meshStandardMaterial {...body} />
      </mesh>
      <group position={[0, 0.15, 0]} rotation={[0, 0, 0.35]}>
        <mesh castShadow>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial {...body} />
        </mesh>
        <mesh position={[0, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.5, 12]} />
          <meshStandardMaterial {...body} />
        </mesh>
        <group position={[0, 1.5, 0]} rotation={[0, 0, -1.55]}>
          <mesh castShadow>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial {...body} />
          </mesh>
          <mesh position={[0, 0.65, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 1.3, 12]} />
            <meshStandardMaterial {...body} />
          </mesh>
          <group position={[0, 1.3, 0]} rotation={[0, 0, 1.75]}>
            <mesh castShadow>
              <sphereGeometry args={[0.09, 16, 16]} />
              <meshStandardMaterial {...body} />
            </mesh>
            <mesh position={[0, -0.25, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.42, 0.5, 32, 1, true]} />
              <meshStandardMaterial {...body} side={DoubleSide} />
            </mesh>
            <mesh position={[0, -0.36, 0]}>
              <sphereGeometry args={[0.13, 24, 24]} />
              <meshStandardMaterial ref={bulb} color={on ? "#fff4d6" : "#3a3a48"} emissive="#ffd08a" toneMapped={false} />
            </mesh>
            <primitive object={target} position={[0, -4, 0]} />
            <spotLight
              ref={spot}
              position={[0, -0.35, 0]}
              target={target}
              angle={0.75}
              penumbra={0.75}
              distance={14}
              color="#ffd9a3"
              castShadow
              shadow-mapSize={[shadowSize, shadowSize]}
              shadow-bias={-0.0004}
              shadow-radius={6}
            />
            <pointLight ref={glow} position={[0, -0.3, 0]} distance={1.2} color="#ffd9a3" />
          </group>
        </group>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- laptop */

// keyboard rows as relative key widths (same layout as the 2D laptop)
const keyRows = [
  Array(14).fill(1),
  [...Array(13).fill(1), 1.6],
  [1.5, ...Array(12).fill(1), 1.1],
  [1.8, ...Array(11).fill(1), 1.8],
  [2.3, ...Array(10).fill(1), 2.3],
  [1, 1, 1, 1.3, 5.4, 1.3, 1, 1, 1, 1],
];

// legends per key, matching keyRows
const keyLabels = [
  ["esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "⏻"],
  ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "delete"],
  ["tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"],
  ["caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "return"],
  ["shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "shift"],
  ["fn", "ctrl", "opt", "cmd", "", "cmd", "opt", "◀", "▲▼", "▶"],
];
const KB_W = 2.3;
const KB_TOP = -0.86;

function Keyboard({ lit }: { lit: boolean }) {
  const keys = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; label: string }[] = [];
    const gap = 0.02;
    keyRows.forEach((row, r) => {
      const units = row.reduce((a, b) => a + b, 0);
      const unit = (KB_W - gap * (row.length - 1)) / units;
      const d = r === 0 ? 0.1 : 0.16;
      const z = KB_TOP + (r === 0 ? 0.05 : 0.12 + 0.09 + (r - 1) * 0.18);
      let x = -KB_W / 2;
      row.forEach((u, i) => {
        out.push({ x: x + (u * unit) / 2, z, w: u * unit, d, label: keyLabels[r][i] });
        x += u * unit + gap;
      });
    });
    return out;
  }, []);
  const depth = keys[keys.length - 1].z + 0.08 - KB_TOP;

  // all legends on one transparent texture laid over the key tops
  const legends = useMemo(() => {
    const W = 2048;
    const H = Math.round((W * depth) / KB_W);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const k of keys) {
      if (!k.label) continue;
      const big = k.label.length === 1;
      ctx.font = `${big ? 500 : 400} ${big ? 46 : 26}px system-ui, sans-serif`;
      ctx.fillText(k.label, ((k.x + KB_W / 2) / KB_W) * W, ((k.z - KB_TOP) / depth) * H);
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [keys, depth]);
  useEffect(() => () => legends.dispose(), [legends]);

  // every key is one instance of a unit box, stretched to its size: a single draw call for the keyboard
  const keyMesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = keyMesh.current;
    if (!m) return;
    const o = new Object3D();
    keys.forEach((k, i) => {
      o.position.set(k.x, 0, k.z);
      o.scale.set(k.w, 1, k.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [keys]);

  return (
    <group position={[0, 0.125, 0]}>
      {/* backlight, seen between the keys */}
      <mesh position={[0, -0.003, KB_TOP + depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[KB_W + 0.04, depth + 0.04]} />
        <meshBasicMaterial color={lit ? "#b9c6ff" : "#0c0c10"} toneMapped={!lit} />
      </mesh>
      <instancedMesh ref={keyMesh} args={[undefined, undefined, keys.length]} receiveShadow>
        <boxGeometry args={[1, 0.025, 1]} />
        <meshStandardMaterial color="#111116" roughness={0.6} />
      </instancedMesh>
      <mesh position={[0, 0.0135, KB_TOP + depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[KB_W, depth]} />
        <meshBasicMaterial map={legends} transparent color={lit ? "#dfe6ff" : "#7a7a86"} toneMapped={!lit} depthWrite={false} />
      </mesh>
      {lit && <pointLight position={[0, 0.25, KB_TOP + depth / 2]} color="#b9c6ff" intensity={0.5} distance={1.4} />}
    </group>
  );
}

function Laptop({ lamp, onPick }: { lamp: boolean; onPick: () => void }) {
  const [hovered, setHovered] = useHover();
  const lift = useRef<Object3D>(null);
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => invalidate(), [hovered, invalidate]);
  useFrame((_, dt) => {
    const l = lift.current;
    if (!l) return;
    const goal = hovered ? 0.06 : 0;
    l.position.y += (goal - l.position.y) * (1 - Math.exp(-dt * 8));
    if (Math.abs(goal - l.position.y) > 1e-4) invalidate();
  });

  const now = useMinute();
  const screen = useScreenTexture(
    1600,
    1000,
    (c, img) => {
      c.fillStyle = "#0b0a14";
      c.fillRect(0, 0, 1600, 1000);
      for (const [x, y, r, col] of [
        [240, 1000, 900, "rgba(99,34,230,0.8)"],
        [1440, 50, 700, "rgba(255,61,46,0.6)"],
        [1120, 800, 600, "rgba(34,211,238,0.28)"],
      ] as const) {
        const gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, col);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr;
        c.fillRect(0, 0, 1600, 1000);
      }
      const logo = img["/media/logo-mark.png"];
      if (logo) {
        c.globalAlpha = 0.22;
        c.drawImage(logo, 700, 340, 200, 200);
        c.globalAlpha = 1;
      }
      // menu bar
      c.fillStyle = "rgba(0,0,0,0.35)";
      c.fillRect(0, 0, 1600, 50);
      c.fillStyle = "white";
      c.font = "600 22px system-ui, sans-serif";
      c.fillText(studio.name, 60, 33);
      c.font = "22px system-ui, sans-serif";
      c.fillStyle = "rgba(255,255,255,0.75)";
      c.fillText("Projects    View    Window", 220, 33);
      c.textAlign = "right";
      c.fillText(clockMenu(now), 1570, 33);
      c.textAlign = "left";
      if (logo) c.drawImage(logo, 20, 12, 26, 26);
      // dock
      const tiles = [...sites.map((s) => ({ label: s.name[0], fill: `rgb(${s.accent})` })), { label: "▶", fill: "#c0389f" }];
      const size = 86;
      const gap = 18;
      const dw = tiles.length * size + (tiles.length - 1) * gap + 36;
      const dx = 800 - dw / 2;
      c.fillStyle = "rgba(255,255,255,0.16)";
      roundRect(c, dx, 870, dw, size + 28, 30);
      c.fill();
      tiles.forEach((t, i) => {
        const x = dx + 18 + i * (size + gap);
        c.fillStyle = t.fill;
        roundRect(c, x, 884, size, size, 22);
        c.fill();
        c.fillStyle = "white";
        c.font = "700 42px system-ui, sans-serif";
        c.textAlign = "center";
        c.fillText(t.label, x + size / 2, 884 + size / 2 + 15);
        c.textAlign = "left";
      });
    },
    ["/media/logo-mark.png"],
    [now],
  );

  return (
    <group
      position={[-0.55, 0, 0.15]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      {/* cooling pad legs raise the back */}
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 0.09, -1.05]} castShadow>
          <boxGeometry args={[0.12, 0.18, 0.12]} />
          <meshStandardMaterial color="#111114" />
        </mesh>
      ))}
      <group position={[0, 0.14, 0]} rotation={[0.07, 0, 0]}>
        {/* cooling pad */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.5, 0.1, 2.5]} />
          <meshStandardMaterial color="#1a1a20" metalness={0.5} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0, 1.252]}>
          <boxGeometry args={[1.4, 0.022, 0.004]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
        <pointLight position={[0, -0.05, 1.4]} color="#22d3ee" intensity={0.6} distance={1.5} />

        <group ref={lift}>
          {/* base */}
          <mesh position={[0, 0.085, 0.1]} castShadow receiveShadow>
            <boxGeometry args={[3, 0.07, 2]} />
            <meshStandardMaterial color="#3c3c46" metalness={0.75} roughness={0.32} />
          </mesh>
          <group position={[0, 0, 0.1]}>
            <Keyboard lit={!lamp} />
          </group>
          <mesh position={[0, 0.122, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.15, 0.66]} />
            <meshStandardMaterial color="#4a4a55" metalness={0.6} roughness={0.25} />
          </mesh>

          {/* lid, hinged at the back edge and leaning back */}
          <group position={[0, 0.12, -0.9]} rotation={[-0.3, 0, 0]}>
            <mesh position={[0, 0.975, -0.03]} castShadow>
              <boxGeometry args={[3, 1.95, 0.05]} />
              <meshStandardMaterial color="#2f2f38" metalness={0.75} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0.975, -0.004]}>
              <planeGeometry args={[2.96, 1.91]} />
              <meshStandardMaterial color="#08080b" roughness={0.3} />
            </mesh>
            <mesh name="laptop-screen" position={[0, 1.005, -0.002]}>
              <planeGeometry args={[2.75, 1.72]} />
              <meshBasicMaterial map={screen} toneMapped={false} />
            </mesh>
            {/* the screen lights the keyboard, more so in the dark */}
            <pointLight position={[0, 0.9, 0.6]} color="#a78bfa" intensity={lamp ? 0.4 : 1.6} distance={3.5} />
          </group>
        </group>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- phone */

function Phone({ lamp, onPick }: { lamp: boolean; onPick: () => void }) {
  const [hovered, setHovered] = useHover();
  const lift = useRef<Object3D>(null);
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => invalidate(), [hovered, invalidate]);
  useFrame((_, dt) => {
    const l = lift.current;
    if (!l) return;
    const goal = hovered ? 0.06 : 0;
    l.position.y += (goal - l.position.y) * (1 - Math.exp(-dt * 8));
    if (Math.abs(goal - l.position.y) > 1e-4) invalidate();
  });

  const now = useMinute();
  const poster = reelSrc(reels[0].id).poster;
  const screen = useScreenTexture(
    720,
    1560,
    (c, img) => {
      c.fillStyle = "#111";
      c.fillRect(0, 0, 720, 1560);
      const p = img[poster];
      if (p) {
        const s = Math.max(720 / p.width, 1560 / p.height);
        c.drawImage(p, (720 - p.width * s) / 2, (1560 - p.height * s) / 2, p.width * s, p.height * s);
      }
      const shade = c.createLinearGradient(0, 0, 0, 1560);
      shade.addColorStop(0, "rgba(20,8,40,0.35)");
      shade.addColorStop(1, "rgba(0,0,0,0.7)");
      c.fillStyle = shade;
      c.fillRect(0, 0, 720, 1560);

      c.fillStyle = "white";
      c.textAlign = "center";
      c.font = "500 30px system-ui, sans-serif";
      c.fillText(clockDate(now), 360, 190);
      c.font = "600 170px system-ui, sans-serif";
      c.fillText(clockTime(now), 360, 350);
      c.textAlign = "left";

      // notification
      c.fillStyle = "rgba(255,255,255,0.22)";
      roundRect(c, 40, 1180, 640, 150, 40);
      c.fill();
      const logo = img["/media/logo-mark.png"];
      c.fillStyle = "white";
      roundRect(c, 66, 1210, 84, 84, 20);
      c.fill();
      if (logo) c.drawImage(logo, 76, 1220, 64, 64);
      c.font = "600 28px system-ui, sans-serif";
      c.fillText(studio.instagram.handle, 172, 1240);
      c.font = "26px system-ui, sans-serif";
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.fillText(`posted a new reel: ${reels[0].title}`, 172, 1282);
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.textAlign = "right";
      c.fillText("now", 656, 1240);
      c.textAlign = "center";
      c.font = "24px system-ui, sans-serif";
      c.fillText("Tap the notification to open", 360, 1390);
      c.textAlign = "left";
      // island + home bar
      c.fillStyle = "black";
      roundRect(c, 260, 26, 200, 56, 28);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.85)";
      roundRect(c, 230, 1520, 260, 10, 5);
      c.fill();
    },
    [poster, "/media/logo-mark.png"],
    [now],
  );

  return (
    <group
      position={[2.35, 0, 0.45]}
      rotation={[0, -0.32, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      {/* stand */}
      <mesh position={[0, 0.02, -0.1]} receiveShadow castShadow>
        <boxGeometry args={[0.7, 0.04, 0.6]} />
        <meshStandardMaterial color="#26262d" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.5, -0.32]} rotation={[-0.32, 0, 0]} castShadow>
        <boxGeometry args={[0.5, 1, 0.04]} />
        <meshStandardMaterial color="#26262d" metalness={0.6} roughness={0.4} />
      </mesh>
      <group ref={lift}>
        <group position={[0, 0.06, 0.06]} rotation={[-0.3, 0, 0]}>
          <RoundedBox args={[0.8, 1.68, 0.07]} radius={0.09} smoothness={4} position={[0, 0.84, 0]} castShadow>
            <meshStandardMaterial color="#17171d" metalness={0.7} roughness={0.3} />
          </RoundedBox>
          <mesh name="phone-screen" position={[0, 0.84, 0.0365]}>
            <planeGeometry args={[0.72, 1.56]} />
            <meshBasicMaterial map={screen} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 0.9, 0.5]} color="#f5d0fe" intensity={lamp ? 0.15 : 0.6} distance={2} />
        </group>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- desk + props */

function Props() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#2a1c13" roughness={0.85} />
      </mesh>
      {/* mug */}
      <mesh position={[3.75, 0.24, -0.6]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.2, 0.48, 28]} />
        <meshStandardMaterial color="#e8e4f0" roughness={0.35} />
      </mesh>
      <mesh position={[3.99, 0.26, -0.6]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.1, 0.03, 10, 20, Math.PI]} />
        <meshStandardMaterial color="#e8e4f0" roughness={0.35} />
      </mesh>
      {/* pens and a pencil standing in the mug */}
      <group position={[3.75, 0, -0.6]}>
        <mesh position={[-0.06, 0.62, 0.02]} rotation={[0.12, 0, 0.22]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 0.85, 12]} />
          <meshStandardMaterial color="#1d4ed8" roughness={0.35} />
        </mesh>
        <mesh position={[0.07, 0.6, -0.04]} rotation={[-0.15, 0, -0.18]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.8, 12]} />
          <meshStandardMaterial color="#111114" roughness={0.3} metalness={0.4} />
        </mesh>
        {/* pencil: hexagonal body, sharpened tip up */}
        <group position={[0.02, 0.6, 0.07]} rotation={[0.2, 0, 0.05]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
            <meshStandardMaterial color="#f5c400" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.46, 0]} castShadow>
            <coneGeometry args={[0.03, 0.12, 6]} />
            <meshStandardMaterial color="#e3b98a" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.51, 0]}>
            <coneGeometry args={[0.009, 0.03, 6]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
        </group>
      </group>
      {/* notebook + pen */}
      <mesh position={[-2.75, 0.03, 1.25]} rotation={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.06, 1.5]} />
        <meshStandardMaterial color="#6322e6" roughness={0.6} />
      </mesh>
      <mesh position={[-2.35, 0.08, 1.2]} rotation={[0, 0.35, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1, 12]} />
        <meshStandardMaterial color="#ff7a2c" roughness={0.4} />
      </mesh>
    </group>
  );
}
