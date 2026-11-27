import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Call } from "../lib/api";
import { RC_W, drawReceipt, drawShape, loadReceiptFonts } from "./receiptCanvas";

// The hero: a thermal printer on a desk prints the call as a receipt. The paper rises out of the slot,
// curls over at the top and gets stamped with what the followers made.

type View = { target: [number, number, number]; base: [number, number, number]; fov?: number };
type Props = { front: Call; frontExample: boolean; solUsd: number; night: boolean; className?: string; onReady?: () => void; view?: View };

const PAPER_W = 1.0;

function receiptCanvas(call: Call, example: boolean, solUsd: number, stamp: number) {
  const probe = document.createElement("canvas");
  probe.width = RC_W;
  probe.height = 4000;
  const { height } = drawReceipt(probe.getContext("2d")!, call, { example, solUsd, stamp: 0, height: 4000 });
  const c = document.createElement("canvas");
  c.width = RC_W;
  c.height = Math.ceil(height);
  drawReceipt(c.getContext("2d")!, call, { example, solUsd, stamp });
  return c;
}

function shapeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  drawShape(c.getContext("2d")!);
  return c;
}

function labelTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#f4f1e8";
  x.font = `900 78px "Archivo Variable", system-ui, sans-serif`;
  (x as any).fontStretch = "extra-condensed";
  x.textBaseline = "middle";
  x.fillText("CALLED", 18, 68);
  x.font = `600 21px "Martian Mono Variable", monospace`;
  x.fillStyle = "rgba(244,241,232,0.55)";
  x.fillText("CALL RECEIPTS", 262, 72);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export default function PrinterScene({ front, frontExample, solUsd, night, className, onReady, view }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = night ? 1.05 : 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = night ? 0.35 : 0.75;

    const camera = new THREE.PerspectiveCamera(view?.fov ?? 28, 1, 0.1, 60);
    const target = view ? new THREE.Vector3(...view.target) : new THREE.Vector3(0.16, 0.98, 0.18);
    const base = view ? new THREE.Vector3(...view.base) : new THREE.Vector3(1.0, 1.66, 5.2);

    // Light: a warm key from the upper left, a soft fill, a cool rim from behind.
    scene.add(new THREE.HemisphereLight(0xffffff, night ? 0x2a2820 : 0xd9d3c3, night ? 0.25 : 0.9));
    const key = new THREE.DirectionalLight(night ? 0xffe2b8 : 0xfff2dc, night ? 3.4 : 2.3);
    key.position.set(-3.2, 6.4, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 16;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 6;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe8ff, night ? 1.4 : 0.7);
    rim.position.set(3.5, 3.2, -4);
    scene.add(rim);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: night ? 0.55 : 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ——— The printer ———
    const printer = new THREE.Group();
    scene.add(printer);
    const BW = 1.32, BH = 0.5, BD = 1.06;
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x1d1c17, roughness: 0.42, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.32 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(BW, BH, BD, 6, 0.12), bodyMat);
    body.position.y = BH / 2 + 0.03;
    body.castShadow = true;
    body.receiveShadow = true;
    printer.add(body);
    const lidMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2922, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5 });
    const lid = new THREE.Mesh(new RoundedBoxGeometry(BW - 0.08, 0.08, BD * 0.62, 4, 0.035), lidMat);
    lid.position.set(0, BH + 0.03 + 0.02, -BD * 0.16);
    lid.castShadow = true;
    printer.add(lid);
    const TOP = BH + 0.03;
    const SLOT_Z = BD * 0.26;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(PAPER_W + 0.14, 0.03, 0.05), new THREE.MeshBasicMaterial({ color: 0x050504 }));
    slot.position.set(0, TOP + 0.002, SLOT_Z);
    printer.add(slot);
    const bar = new THREE.Mesh(new RoundedBoxGeometry(PAPER_W + 0.2, 0.035, 0.05, 2, 0.012), new THREE.MeshStandardMaterial({ color: 0xa8a69c, metalness: 1, roughness: 0.3 }));
    bar.position.set(0, TOP + 0.02, SLOT_Z + 0.055);
    printer.add(bar);
    const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture(), transparent: true, roughness: 0.6 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.18), labelMat);
    label.position.set(-0.22, 0.28, BD / 2 + 0.031);
    printer.add(label);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 14), new THREE.MeshBasicMaterial({ color: 0xd4ff3a }));
    led.position.set(0.5, 0.29, BD / 2 + 0.022);
    printer.add(led);
    const ledGlow = new THREE.PointLight(0xd4ff3a, night ? 0.9 : 0.35, 0.9, 2);
    ledGlow.position.set(0.5, 0.29, BD / 2 + 0.12);
    printer.add(ledGlow);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24), new THREE.MeshPhysicalMaterial({ color: 0x3a382f, roughness: 0.5, clearcoat: 0.4 }));
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0.33, 0.29, BD / 2 + 0.03);
    printer.add(btn);
    for (const [fx, fz] of [[-0.52, -0.42], [0.52, -0.42], [-0.52, 0.42], [0.52, 0.42]]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0x0c0c0a, roughness: 0.9 }));
      foot.position.set(fx, 0.02, fz);
      printer.add(foot);
    }

    // ——— The paper ———
    let frontCanvas = receiptCanvas(front, frontExample, solUsd, 0);
    const L = (PAPER_W * frontCanvas.height) / RC_W; // paper length in scene units
    const tex = new THREE.CanvasTexture(frontCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const shape = new THREE.CanvasTexture(shapeCanvas(RC_W / 4, Math.round(frontCanvas.height / 4)));
    const SEG_Y = 180;
    const geo = new THREE.PlaneGeometry(PAPER_W, L, 10, SEG_Y);
    const orig = Float32Array.from(geo.attributes.position.array as Float32Array);
    const paperFront = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: night ? 0.08 : 0.12, roughness: 0.88, alphaTest: 0.5, side: THREE.FrontSide }),
    );
    const paperBack = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.95, alphaMap: shape, alphaTest: 0.5, side: THREE.BackSide }));
    paperFront.castShadow = paperBack.castShadow = true;
    paperFront.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: shape, alphaTest: 0.5 });
    scene.add(paperFront, paperBack);

    // The paper rises straight up, then curls back over the top.
    const UP = L * 0.9;
    const RAD = 0.17;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    function place(feed: number, time: number) {
      for (let i = 0; i < pos.count; i++) {
        const x = orig[i * 3];
        const u = L / 2 - orig[i * 3 + 1]; // 0 at the header
        const d = feed - u; // distance out of the slot
        let y: number, z: number, ny: number, nz: number;
        if (d <= 0) {
          y = TOP - 0.06;
          z = SLOT_Z;
          ny = 0;
          nz = 1;
        } else if (d <= UP) {
          y = TOP + d;
          z = SLOT_Z;
          ny = 0;
          nz = 1;
        } else {
          const th = Math.min((d - UP) / RAD, 2.6);
          const extra = Math.max(0, d - UP - 2.6 * RAD);
          y = TOP + UP + RAD * Math.sin(th) - extra * Math.sin(th - Math.PI / 2);
          z = SLOT_Z - RAD + RAD * Math.cos(th) - extra * Math.cos(th - Math.PI / 2);
          ny = Math.sin(th);
          nz = Math.cos(th);
        }
        // A slight cup across the width, and a slow sway that grows with height.
        const across = (x / (PAPER_W / 2)) ** 2;
        const cup = 0.035 * (1 - across) * Math.min(1, Math.max(0, d) / 0.3);
        const h = Math.max(0, Math.min(1, d / UP));
        const sway = reduce ? 0 : 0.03 * h * h * Math.sin(time * 0.9 + x * 0.8);
        pos.setXYZ(i, x, y + ny * cup, z + nz * cup + sway);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }

    // ——— Sizing, pointer, loop ———
    const camBase = new THREE.Vector3();
    function resize() {
      const w = el!.clientWidth;
      const h = el!.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Pull back on narrow screens so the whole printer stays in frame.
      const fit = !view && w / h < 0.62 ? 1.12 : 1;
      camBase.copy(base).sub(target).multiplyScalar(fit).add(target);
      camera.position.copy(camBase);
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const pointer = new THREE.Vector2();
    const eased = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    const FEED_MS = 3300;
    const start = performance.now() + 450;
    let stampAt = 0;
    let stampDone = false;
    let ready = false;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const t = now / 1000;
      const p = reduce ? 1 : Math.min(1, Math.max(0, (now - start) / FEED_MS));
      // Thermal feed: line by line, slowing at the end.
      const eased01 = 1 - Math.pow(1 - p, 2.2);
      const feed = L * (Math.floor(eased01 * 90) / 90);
      place(feed, t);
      if (p >= 1 && !stampDone) {
        if (!stampAt) stampAt = now + (reduce ? 0 : 180);
        const s = reduce ? 1 : Math.min(1, Math.max(0, (now - stampAt) / 320));
        if (s > 0) {
          drawReceipt(frontCanvas.getContext("2d")!, front, { example: frontExample, solUsd, stamp: s });
          tex.needsUpdate = true;
        }
        if (s >= 1) stampDone = true;
      }
      (led.material as THREE.MeshBasicMaterial).color.setHex(p < 1 && Math.floor(t * 6) % 2 ? 0x6b7f1d : 0xd4ff3a);
      eased.lerp(pointer, 0.05);
      camera.position.set(camBase.x + eased.x * 0.35, camBase.y - eased.y * 0.18, camBase.z);
      camera.position.copy(camera.position).sub(target).normalize().multiplyScalar(camBase.distanceTo(target)).add(target);
      camera.lookAt(target);
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        onReady?.();
      }
    }
    loadReceiptFonts().then(() => {
      if (disposed) return;
      labelMat.map?.dispose();
      labelMat.map = labelTexture();
      labelMat.needsUpdate = true;
      frontCanvas = receiptCanvas(front, frontExample, solUsd, 0);
      tex.image = frontCanvas;
      tex.needsUpdate = true;
      raf = requestAnimationFrame(frame);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          Object.values(x).forEach((v) => v instanceof THREE.Texture && v.dispose());
          x.dispose();
        });
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [front, frontExample, solUsd, night, onReady, view]);

  if (failed) return null;
  return <div ref={host} className={className} />;
}
