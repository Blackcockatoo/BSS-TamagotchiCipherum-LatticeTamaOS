import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Rocket,
  Compass,
  Satellite,
  MessageSquare,
  Download,
  Upload,
  Map as MapIcon,
  ScanLine,
  Settings,
  Play,
  Pause,
  Send,
  Gauge,
  Flag,
  Navigation2,
  Shield as ShieldIcon,
  Flame,
  Zap,
  Thermometer,
} from "lucide-react";

/**
 * Vimana Universe — Navigator & Communicator (TamaOSverse)
 * Single-file React component (Tailwind CSS) that renders a minimal "universe"
 * with a Vimana you can navigate and a comms console to talk to local beacons.
 *
 * Design notes (Blue $nake Studios friendly):
 * - Global coupling of fields: energy, entropy, cohesion, novelty → ψ (psi) resonance.
 * - Click map to move; WASD / arrow keys to step; space to scan; enter to send message.
 * - Three Elemental Weights (Star Forge): Solar, Aqua, Aether → adjust ψ blend.
 * - Deterministic seed → reproducible universe; export/import JSON state.
 * - No backend; runs entirely client-side.
 */

// ---------- Deterministic PRNG helpers ----------
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(x: number, y: number, seed: number) {
  // Simple integer hash for (x,y,seed) → uint32
  let h = 2166136261 ^ seed;
  h = Math.imul(h ^ x, 16777619);
  h = Math.imul(h ^ (y + 0x9e3779b9), 16777619);
  h ^= h >>> 13;
  return h >>> 0;
}

function rand2D01(x: number, y: number, seed: number) {
  const r = mulberry32(hash2D(x, y, seed));
  return r();
}

// ---------- Domain Types ----------
const LAYERS = ["energy", "entropy", "cohesion", "novelty", "psi"] as const;

type Layer = (typeof LAYERS)[number];

type Cell = {
  x: number;
  y: number;
  energy: number; // 0..1
  entropy: number; // 0..1
  cohesion: number; // 0..1
  novelty: number; // 0..1
};

type Waypoint = { x: number; y: number } | null;

type Vimana = {
  x: number; // continuous position in grid space
  y: number;
  heading: number; // degrees 0..360
  throttle: number; // 0..1
  speed: number; // cells / second
  hull: number; // 0..1
  shield: number; // 0..1
  heat: number; // 0..1
  fuel: number; // 0..1
  autopilot: boolean;
  waypoint: Waypoint;
  ageHours: number; // in-world time (for flavor)
};

type Message = {
  id: string;
  role: "you" | "beacon" | "system";
  text: string;
  t: number; // timestamp ms
};

// ---------- Core Component ----------
export default function VimanaUniverse() {
  // Universe params
  const [cols, setCols] = useState(24);
  const [rows, setRows] = useState(16);
  const [seed, setSeed] = useState(108);
  const [selectedLayer, setSelectedLayer] = useState<Layer>("psi");
  const [running, setRunning] = useState(false);
  const [tickMs, setTickMs] = useState(300);

  // Elemental weights → blend into ψ
  const [solar, setSolar] = useState(0.35); // favors energy
  const [aqua, setAqua] = useState(0.30); // favors cohesion
  const [aether, setAether] = useState(0.35); // favors novelty

  // Coupling strength for scan perturbations
  const [coupling, setCoupling] = useState(0.18);

  // Vimana state
  const [vimana, setVimana] = useState<Vimana>({
    x: Math.floor(24 / 2),
    y: Math.floor(16 / 2),
    heading: 0,
    throttle: 0.2,
    speed: 0,
    hull: 1,
    shield: 0.85,
    heat: 0.1,
    fuel: 1,
    autopilot: false,
    waypoint: null,
    ageHours: 0,
  });

  const [boosting, setBoosting] = useState(false);

  // Communications
  const [messages, setMessages] = useState<Message[]>([
    { id: cryptoId(), role: "system", text: "Vimana online. Comms grid primed.", t: Date.now() },
  ]);
  const [draft, setDraft] = useState("");

  // Build universe grid deterministically from seed
  const baseGrid = useMemo(() => {
    const g: Cell[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const e = rand2D01(x * 31 + 7, y * 17 + 3, seed);
        const n = rand2D01(x * 53 + 11, y * 29 + 5, seed ^ 0x9e3779b9);
        const c = rand2D01(x * 19 + 13, y * 37 + 17, seed ^ 0x85ebca6b);
        const H = rand2D01(x * 7 + 23, y * 13 + 19, seed ^ 0xc2b2ae35);
        g.push({
          x,
          y,
          energy: 0.55 * e + 0.20 * H + 0.25 * (1 - n),
          entropy: 0.60 * n + 0.20 * H + 0.20 * (1 - e),
          cohesion: 0.65 * c + 0.15 * H + 0.20 * (1 - n),
          novelty: 0.55 * H + 0.25 * e + 0.20 * n,
        });
      }
    }
    return g;
  }, [cols, rows, seed]);

  // Mutable grid (perturbed by scans & moves)
  const [grid, setGrid] = useState<Cell[]>(baseGrid);
  useEffect(() => setGrid(baseGrid), [baseGrid]);

  useEffect(() => {
    setVimana((v) => ({
      ...v,
      x: clampFloat(v.x, 0, cols - 1),
      y: clampFloat(v.y, 0, rows - 1),
      waypoint: v.waypoint
        ? {
            x: clampFloat(v.waypoint.x, 0, cols - 1),
            y: clampFloat(v.waypoint.y, 0, rows - 1),
          }
        : null,
    }));
  }, [cols, rows]);

  // ψ calculator
  const psiOf = (cell: Cell) => {
    const wE = solar;
    const wCoh = aqua;
    const wNov = aether;
    const wEnt = 1 - (wE + wCoh + wNov);
    const ent = Math.max(0, wEnt);
    const dot = wE * cell.energy + ent * cell.entropy + wCoh * cell.cohesion + wNov * cell.novelty;
    return clamp01(dot);
  };

  // Tick loop (age + subtle drift)
  useInterval(() => {
    const dt = tickMs / 1000;
    const hoursStep = tickMs / 1000 / 60 / 60;
    let autopArrived = false;
    let stopBoost = false;
    let latestPosition = { x: vimana.x, y: vimana.y };

    setVimana((v) => {
      const cellX = clampInt(Math.round(v.x), 0, cols - 1);
      const cellY = clampInt(Math.round(v.y), 0, rows - 1);
      const cellIdx = cellY * cols + cellX;
      const cell = grid[cellIdx] ?? baseGrid[cellIdx];

      const envEnergy = cell?.energy ?? 0.5;
      const envEntropy = cell?.entropy ?? 0.5;
      const envCohesion = cell?.cohesion ?? 0.5;
      const envNovelty = cell?.novelty ?? 0.5;

      let heading = v.heading;
      let throttle = v.throttle;
      let autopilot = v.autopilot;
      let waypoint = v.waypoint;

      if (autopilot && !waypoint) {
        autopilot = false;
      }

      if (autopilot && waypoint) {
        const dx = waypoint.x - v.x;
        const dy = waypoint.y - v.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.25) {
          autopilot = false;
          waypoint = null;
          throttle = Math.min(throttle, 0.25);
          autopArrived = true;
        } else {
          const desired = (Math.atan2(dy, dx) * 180) / Math.PI;
          heading = rotateToward(heading, desired, 120 * dt);
          throttle = Math.max(throttle, 0.45);
        }
      }

      const boostActive = boosting && v.fuel > 0.02;
      if (boosting && !boostActive) {
        stopBoost = true;
      }

      const envSpeedMod = 1 + (envEnergy - 0.5) * 0.35 + (envNovelty - 0.5) * 0.15;
      const boostMultiplier = boostActive ? 1.6 : 1;
      const maxSpeed = 3.2 * envSpeedMod * boostMultiplier;
      const accel = 3.1;
      const targetSpeed = throttle * maxSpeed;
      const speed = approach(v.speed, targetSpeed, accel * dt);

      const rad = (heading * Math.PI) / 180;
      let nx = v.x + Math.cos(rad) * speed * dt;
      let ny = v.y + Math.sin(rad) * speed * dt;
      nx = clampFloat(nx, 0, cols - 1);
      ny = clampFloat(ny, 0, rows - 1);

      latestPosition = { x: nx, y: ny };

      let heat = clamp01(v.heat + ((envEntropy - 0.5) * 0.2 + speed * 0.04 + (boostActive ? 0.25 : -0.03)) * dt);
      let shield = clamp01(
        v.shield + (envCohesion - 0.45) * dt * 0.6 - heat * dt * 0.22 - (boostActive ? dt * 0.12 : 0),
      );

      let hull = v.hull;
      if (heat > 0.8 && shield < 0.4) {
        hull = clamp01(hull - dt * 0.08 * (heat - 0.75));
      } else if (envCohesion > 0.65 && heat < 0.4 && hull < 1) {
        hull = clamp01(hull + dt * 0.03 * (envCohesion - 0.6));
      }

      let fuel = clamp01(v.fuel - dt * (0.04 + throttle * 0.06) - (boostActive ? dt * 0.18 : 0));
      if (boostActive && fuel <= 0.02) {
        fuel = 0;
        stopBoost = true;
      }

      return {
        ...v,
        x: nx,
        y: ny,
        heading,
        throttle,
        speed,
        heat,
        shield,
        hull,
        fuel,
        autopilot,
        waypoint,
        ageHours: v.ageHours + hoursStep,
      };
    });

    setGrid((prev) => {
      const drifted = prev.map((cell, i) => {
        const base = baseGrid[i];
        const rate = 0.002;
        return {
          ...cell,
          energy: lerp(cell.energy, base.energy, rate),
          entropy: lerp(cell.entropy, base.entropy, rate),
          cohesion: lerp(cell.cohesion, base.cohesion, rate),
          novelty: lerp(cell.novelty, base.novelty, rate),
        };
      });

      if (boosting) {
        const cx = clampInt(Math.round(latestPosition.x), 0, cols - 1);
        const cy = clampInt(Math.round(latestPosition.y), 0, rows - 1);
        const radius = 1;
        for (let y = Math.max(0, cy - radius); y <= Math.min(rows - 1, cy + radius); y++) {
          for (let x = Math.max(0, cx - radius); x <= Math.min(cols - 1, cx + radius); x++) {
            const dist = Math.hypot(x - latestPosition.x, y - latestPosition.y);
            const fall = Math.max(0, 1 - dist / (radius + 0.001));
            const index = y * cols + x;
            const c = drifted[index];
            drifted[index] = {
              ...c,
              entropy: clamp01(c.entropy + 0.04 * fall),
              novelty: clamp01(c.novelty + 0.05 * fall),
            };
          }
        }
      }

      return drifted;
    });

    if (stopBoost) {
      setBoosting(false);
      addMsg("system", "Fuel reserves unable to sustain boost.");
    }
    if (autopArrived) {
      addMsg("system", "Waypoint reached. Autopilot disengaged.");
    }
  }, running ? tickMs : null);

  // Keyboard flight controls & scan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        performScan();
        return;
      }
      if (e.key === "Enter" && draft.trim()) {
        sendMessage();
        return;
      }
      if (e.key === "Shift") {
        e.preventDefault();
        setBoosting(true);
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "q") adjustThrottle(-0.1);
      if (key === "e") adjustThrottle(0.1);
      if (key === "w" || e.key === "ArrowUp") adjustThrottle(0.05);
      if (key === "s" || e.key === "ArrowDown") adjustThrottle(-0.05);
      if (key === "a" || e.key === "ArrowLeft") rotateHeadingBy(-8);
      if (key === "d" || e.key === "ArrowRight") rotateHeadingBy(8);
      if (key === "f") toggleAutopilot();
      if (key === "r") clearWaypoint();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setBoosting(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [draft, performScan, sendMessage, adjustThrottle, rotateHeadingBy, toggleAutopilot, clearWaypoint]);

  function setThrottle(value: number) {
    setVimana((v) => ({ ...v, throttle: clamp01(value) }));
  }

  function adjustThrottle(delta: number) {
    setVimana((v) => ({ ...v, throttle: clamp01(v.throttle + delta) }));
  }

  function rotateHeadingBy(delta: number) {
    setVimana((v) => ({ ...v, heading: (v.heading + delta + 360) % 360 }));
  }

  function toggleAutopilot() {
    let message: string | null = null;
    setVimana((v) => {
      if (!v.waypoint && !v.autopilot) {
        message = "No waypoint set.";
        return v;
      }
      const autopilot = !v.autopilot;
      message = autopilot ? "Autopilot engaged." : "Autopilot disengaged.";
      return { ...v, autopilot };
    });
    if (message) addMsg("system", message);
  }

  function clearWaypoint() {
    let cleared = false;
    setVimana((v) => {
      if (!v.waypoint && !v.autopilot) {
        return v;
      }
      cleared = true;
      return { ...v, waypoint: null, autopilot: false };
    });
    if (cleared) addMsg("system", "Waypoint cleared.");
  }

  function setWaypoint(x: number, y: number) {
    setVimana((v) => ({ ...v, waypoint: { x, y } }));
    addMsg("system", `Waypoint set to (${x},${y}).`);
  }

  function performScan() {
    // Perturb local cell → propagate via coupling to neighbors within R
    const R = 2;
    const idx = (x: number, y: number) => y * cols + x;
    const cx = vimana.x,
      cy = vimana.y;
    const delta = 0.06; // agent ΔS

    const C = makeCouplingMatrix(coupling);

    const dS = [delta, delta * 0.75, delta * 0.6, delta * 0.9]; // energy, entropy, cohesion, novelty
    const CdS = mat4MulVec(C, dS);

    setGrid((prev) => {
      const copy = prev.slice();
      for (let y = Math.max(0, cy - R); y <= Math.min(rows - 1, cy + R); y++) {
        for (let x = Math.max(0, cx - R); x <= Math.min(cols - 1, cx + R); x++) {
          const dist = Math.hypot(x - cx, y - cy);
          const fall = Math.max(0, 1 - dist / (R + 0.001));
          const i = idx(x, y);
          const c = copy[i];
          copy[i] = {
            ...c,
            energy: clamp01(c.energy + CdS[0] * fall),
            entropy: clamp01(c.entropy + CdS[1] * fall),
            cohesion: clamp01(c.cohesion + CdS[2] * fall),
            novelty: clamp01(c.novelty + CdS[3] * fall),
          };
        }
      }
      return copy;
    });

    addMsg("system", `Scan pulse emitted. Coupling=${coupling.toFixed(2)}.`);
  }

  function cellColor(cell: Cell): string {
    const val = selectedLayer === "psi" ? psiOf(cell) : (cell as any)[selectedLayer];
    // Map to cozy cosmic gradient (0..1 → teal→violet)
    const hue = 200 + 140 * val; // 200..340
    const sat = 60 + 20 * val; // 60..80
    const lit = 25 + 35 * val; // 25..60
    return `hsl(${hue} ${sat}% ${lit}%)`;
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    addMsg("you", text);
    setDraft("");
    // Simulated beacon response based on local ψ and keywords
    const cell = grid[vimana.y * cols + vimana.x];
    const psi = psiOf(cell);
    const reply = oracleReply(text, psi, cell, { solar, aqua, aether });
    setTimeout(() => addMsg("beacon", reply), 120);
  }

  function addMsg(role: Message["role"], text: string) {
    setMessages((m) => [...m, { id: cryptoId(), role, text, t: Date.now() }]);
    // Auto-scroll
    setTimeout(() => {
      const el = document.getElementById("comms-log");
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  function exportState() {
    const payload = {
      meta: { cols, rows, seed, when: new Date().toISOString() },
      vimana,
      params: { solar, aqua, aether, coupling, selectedLayer },
      grid,
      messages,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `vimana_universe_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importState(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data?.meta?.cols && data?.grid) {
          setCols(data.meta.cols);
          setRows(data.meta.rows);
          setSeed(data.meta.seed ?? seed);
          setVimana((prev) => ({
            ...prev,
            ...(data.vimana ?? {}),
            x: data.vimana?.x ?? prev.x,
            y: data.vimana?.y ?? prev.y,
            heading: data.vimana?.heading ?? prev.heading,
            throttle: clamp01(data.vimana?.throttle ?? prev.throttle ?? 0.2),
            speed: data.vimana?.speed ?? 0,
            hull: clamp01(data.vimana?.hull ?? prev.hull ?? 1),
            shield: clamp01(data.vimana?.shield ?? prev.shield ?? 0.85),
            heat: clamp01(data.vimana?.heat ?? prev.heat ?? 0.1),
            fuel: clamp01(data.vimana?.fuel ?? prev.fuel ?? 1),
            autopilot: data.vimana?.autopilot ?? false,
            waypoint: data.vimana?.waypoint ?? null,
            ageHours: data.vimana?.ageHours ?? prev.ageHours,
          }));
          setGrid(data.grid);
          setMessages(data.messages ?? messages);
          const p = data.params ?? {};
          setSolar(p.solar ?? solar);
          setAqua(p.aqua ?? aqua);
          setAether(p.aether ?? aether);
          setCoupling(p.coupling ?? coupling);
          setSelectedLayer(p.selectedLayer ?? selectedLayer);
          addMsg("system", "State imported.");
        }
      } catch (err) {
        addMsg("system", "Import failed: bad JSON");
      }
    };
    reader.readAsText(file);
  }

  const cellX = clampInt(Math.round(vimana.x), 0, cols - 1);
  const cellY = clampInt(Math.round(vimana.y), 0, rows - 1);
  const selectedCell = grid[cellY * cols + cellX];
  const psiHere = selectedCell ? psiOf(selectedCell) : 0;
  const envSpeedMod = selectedCell
    ? 1 + (selectedCell.energy - 0.5) * 0.35 + (selectedCell.novelty - 0.5) * 0.15
    : 1;
  const speedCap = 3.2 * envSpeedMod * (boosting ? 1.6 : 1);
  const waypointDistance = vimana.waypoint
    ? Math.hypot(vimana.waypoint.x - vimana.x, vimana.waypoint.y - vimana.y)
    : null;
  const hasWaypoint = Boolean(vimana.waypoint);
  const canClearWaypoint = hasWaypoint || vimana.autopilot;
  const autopStatusText = vimana.autopilot ? "Autopilot: Engaged" : "Autopilot: Manual";
  const autopButtonLabel = vimana.autopilot ? "Disengage AP" : "Engage AP";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-[#0a0f1f] to-slate-900 text-slate-100 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Rocket className="w-6 h-6 text-cyan-300" />
          <h1 className="text-xl md:text-2xl font-semibold tracking-wide">Vimana Universe</h1>
          <span className="text-xs md:text-sm text-cyan-200/80 px-2 py-0.5 rounded-full bg-cyan-700/20 border border-cyan-500/30">
            B$S TamaOSverse
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <button
            onClick={() => setRunning((r) => !r)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 hover:bg-slate-800 active:scale-[.98] transition"
          >
            <div className="inline-flex items-center gap-2">
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {running ? "Pause" : "Run"}
            </div>
          </button>
          <button
            onClick={performScan}
            title="Scan (space)"
            className="px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 hover:bg-slate-800"
          >
            <div className="inline-flex items-center gap-2">
              <ScanLine className="w-4 h-4" />
              Scan
            </div>
          </button>
          <button
            onClick={exportState}
            className="px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 hover:bg-slate-800"
          >
            <div className="inline-flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </div>
          </button>
          <label className="px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700 hover:bg-slate-800 cursor-pointer">
            <div className="inline-flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import
            </div>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importState(f);
              }}
            />
          </label>
        </div>
      </div>

      {/* Controls + Map + Comms layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: Controls & Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg p-4 space-y-4">
          <SectionTitle icon={<Settings className="w-4 h-4" />} title="Universe Settings" />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Cols" value={cols} setValue={setCols} min={8} max={60} />
            <NumberField label="Rows" value={rows} setValue={setRows} min={6} max={60} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Seed" value={seed} setValue={setSeed} min={0} max={1_000_000_000} />
            <NumberField label="Tick (ms)" value={tickMs} setValue={setTickMs} min={60} max={2000} />
            <SliderField label="Coupling" value={coupling} setValue={setCoupling} min={0} max={0.6} step={0.01} />
          </div>

          <SectionTitle icon={<Compass className="w-4 h-4" />} title="Vimana" />
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="X" value={vimana.x.toFixed(2)} />
            <Stat label="Y" value={vimana.y.toFixed(2)} />
            <Stat label="Heading" value={`${Math.round((vimana.heading + 360) % 360)}°`} />
          </div>

          <SectionTitle icon={<Gauge className="w-4 h-4" />} title="Vehicle Systems" />
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-200">
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-300" />
                    Throttle
                  </span>
                  <span>{Math.round(vimana.throttle * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={vimana.throttle}
                  onChange={(e) => setThrottle(Number(e.target.value))}
                  className="mt-2 w-full accent-amber-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={toggleAutopilot}
                  disabled={!vimana.autopilot && !hasWaypoint}
                  className={`rounded-lg border px-2 py-2 transition ${
                    vimana.autopilot
                      ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-200 hover:bg-emerald-600/30"
                      : hasWaypoint
                      ? "bg-slate-900/60 border-slate-700 text-slate-200 hover:bg-slate-900"
                      : "bg-slate-900/20 border-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    <Navigation2 className="w-3.5 h-3.5" />
                    {autopButtonLabel}
                  </span>
                </button>
                <button
                  onClick={clearWaypoint}
                  disabled={!canClearWaypoint}
                  className={`rounded-lg border px-2 py-2 transition ${
                    canClearWaypoint
                      ? "bg-slate-900/60 border-slate-700 text-slate-200 hover:bg-slate-900"
                      : "bg-slate-900/20 border-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    <Flag className="w-3.5 h-3.5" />
                    Clear Waypoint
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-300 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Navigation2 className="w-3 h-3 text-cyan-300" />
                  {autopStatusText}
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="w-3 h-3 text-amber-300" />
                  {vimana.waypoint ? `Waypoint (${vimana.waypoint.x},${vimana.waypoint.y})` : "No waypoint"}
                </div>
                {waypointDistance !== null && (
                  <div className="flex items-center gap-2 text-emerald-200 sm:col-span-2">
                    <Gauge className="w-3 h-3" />
                    Distance {waypointDistance.toFixed(2)} cells
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <VitalBar
                label="Fuel"
                value={vimana.fuel}
                gradient="from-amber-400 via-amber-500 to-orange-500"
                icon={<Flame className="w-4 h-4 text-amber-300" />}
              />
              <VitalBar
                label="Shield"
                value={vimana.shield}
                gradient="from-cyan-300 via-sky-400 to-blue-500"
                icon={<ShieldIcon className="w-4 h-4 text-cyan-300" />}
              />
              <VitalBar
                label="Hull"
                value={vimana.hull}
                gradient="from-lime-300 via-emerald-400 to-teal-500"
                icon={<Rocket className="w-4 h-4 text-emerald-300" />}
              />
              <VitalBar
                label="Heat"
                value={vimana.heat}
                gradient="from-rose-400 via-orange-500 to-amber-500"
                icon={<Thermometer className="w-4 h-4 text-rose-300" />}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <LayerPicker selected={selectedLayer} onChange={setSelectedLayer} />
            <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>ψ Resonance</span>
                <span>{(psiHere * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${psiHere * 100}%`, background: `linear-gradient(90deg, #22d3ee, #a78bfa)` }}
                />
              </div>
              <div className="text-[11px] mt-2 text-slate-300">
                Solar {Math.round(solar * 100)}% · Aqua {Math.round(aqua * 100)}% · Aether {Math.round(aether * 100)}%
              </div>
            </div>
          </div>

          <SectionTitle icon={<Satellite className="w-4 h-4" />} title="Star Forge Weights" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SliderField label="Solar" value={solar} setValue={setSolar} min={0} max={1} step={0.01} />
            <SliderField label="Aqua" value={aqua} setValue={setAqua} min={0} max={1} step={0.01} />
            <SliderField label="Aether" value={aether} setValue={setAether} min={0} max={1} step={0.01} />
          </div>

          <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3 text-xs">
            <p className="text-slate-300 font-semibold uppercase tracking-wide">Flight Controls</p>
            <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
              <li><span className="text-slate-200">Q / E</span> — throttle down / up</li>
              <li><span className="text-slate-200">W / S</span> or <span className="text-slate-200">↑ / ↓</span> — fine throttle trim</li>
              <li><span className="text-slate-200">A / D</span> or <span className="text-slate-200">← / →</span> — adjust heading</li>
              <li><span className="text-slate-200">Shift</span> — hold to boost</li>
              <li><span className="text-slate-200">Space</span> — scan pulse · <span className="text-slate-200">F</span> — toggle autopilot · <span className="text-slate-200">R</span> — clear waypoint</li>
              <li><span className="text-slate-200">Enter</span> — send comms · click cell — dev jump · right-click — set waypoint</li>
            </ul>
          </div>
        </div>

        {/* Center: Map */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg p-4 flex flex-col">
          <SectionTitle icon={<MapIcon className="w-4 h-4" />} title="Sector Map" />
          <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
            <Starfield />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-950/80 px-4 py-3 shadow-lg backdrop-blur">
                <div className="flex flex-col gap-2 text-xs md:text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-cyan-200">
                    <span className="flex items-center gap-2">
                      <Navigation2 className="w-4 h-4" />
                      Heading {Math.round((vimana.heading + 360) % 360)}°
                    </span>
                    <span className={`font-semibold ${vimana.autopilot ? "text-emerald-300" : "text-cyan-200"}`}>
                      {vimana.autopilot ? "Autopilot" : "Manual"}
                    </span>
                    {boosting && (
                      <span className="flex items-center gap-1 text-amber-300">
                        <Flame className="w-3.5 h-3.5" />
                        Boost
                      </span>
                    )}
                  </div>
                  <HudBar
                    icon={<Gauge className="w-4 h-4 text-cyan-300" />}
                    label="Speed"
                    value={vimana.speed}
                    max={speedCap}
                    accent="bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500"
                    format={(value) => `${value.toFixed(2)} c/s`}
                  />
                  <HudBar
                    icon={<Zap className="w-4 h-4 text-amber-300" />}
                    label="Throttle"
                    value={vimana.throttle}
                    max={1}
                    accent="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"
                    format={(value) => `${Math.round(value * 100)}%`}
                  />
                  {hasWaypoint && waypointDistance !== null && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                      <span className="flex items-center gap-2">
                        <Flag className="w-3.5 h-3.5 text-amber-300" />
                        Waypoint ({vimana.waypoint?.x}, {vimana.waypoint?.y})
                      </span>
                      <span>{waypointDistance.toFixed(2)} cells</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div
              className="grid absolute inset-0"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              }}
            >
              {grid.map((cell) => {
                const key = `${cell.x}-${cell.y}`;
                const isHere = cell.x === cellX && cell.y === cellY;
                const isWaypoint = vimana.waypoint && cell.x === vimana.waypoint.x && cell.y === vimana.waypoint.y;
                return (
                  <div
                    key={key}
                    className={`relative border border-slate-900/60 transition-colors cursor-pointer ${
                      isHere ? "ring-2 ring-cyan-300/80" : ""
                    }`}
                    style={{ backgroundColor: cellColor(cell) }}
                    onClick={() => setVimana((v) => ({ ...v, x: cell.x, y: cell.y }))}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setWaypoint(cell.x, cell.y);
                    }}
                    title={`(${cell.x},${cell.y})`}
                  >
                    {isHere && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <VimanaGlyph heading={vimana.heading} />
                      </div>
                    )}
                    {isWaypoint && (
                      <div className="absolute top-1 right-1 text-amber-300 drop-shadow">
                        <Flag className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Local readout */}
          {selectedCell && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Bar label="Energy" v={selectedCell.energy} />
              <Bar label="Entropy" v={selectedCell.entropy} />
              <Bar label="Cohesion" v={selectedCell.cohesion} />
              <Bar label="Novelty" v={selectedCell.novelty} />
            </div>
          )}
        </div>

        {/* Right: Comms */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg p-4 flex flex-col">
          <SectionTitle icon={<MessageSquare className="w-4 h-4" />} title="Communications" />
          <div
            id="comms-log"
            className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`px-3 py-2 rounded-xl text-sm max-w-[90%] ${
                  m.role === "you"
                    ? "ml-auto bg-cyan-700/20 border border-cyan-600/30"
                    : m.role === "beacon"
                    ? "bg-violet-700/20 border border-violet-600/30"
                    : "bg-slate-800/50 border border-slate-700/60"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">{m.role}</div>
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Transmit to nearest beacon…"
              className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-cyan-400/40"
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />
            <button
              onClick={sendMessage}
              className="px-3 py-2 rounded-xl bg-cyan-700/30 border border-cyan-500/40 hover:bg-cyan-700/40 active:scale-[.98]"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- UI Subcomponents ----------
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-200/90 mb-2">
      <div className="p-1.5 rounded-lg bg-slate-800/70 border border-slate-700">{icon}</div>
      <div className="font-medium tracking-wide">{title}</div>
    </div>
  );
}

function Starfield() {
  // Lightweight starfield using layered radial gradients
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.15), transparent)," +
          "radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.12), transparent)," +
          "radial-gradient(1.5px 1.5px at 40% 80%, rgba(255,255,255,0.10), transparent)," +
          "radial-gradient(1px 1px at 85% 20%, rgba(255,255,255,0.14), transparent)",
        backgroundColor: "transparent",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

function VimanaGlyph({ heading }: { heading: number }) {
  // A tiny pointing triangle that rotates with heading
  const rot = `rotate(${heading}deg)`;
  return (
    <div
      className="w-0 h-0 border-l-[9px] border-l-transparent border-b-[14px] border-b-cyan-300 border-r-[9px] border-r-transparent drop-shadow-[0_0_6px_rgba(94,234,212,0.6)]"
      style={{ transform: rot }}
    />
  );
}

function LayerPicker({ selected, onChange }: { selected: Layer; onChange: (l: Layer) => void }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-2 flex items-center gap-1 flex-wrap">
      {LAYERS.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-2.5 py-1 rounded-lg text-xs border ${
            selected === l ? "bg-cyan-700/30 border-cyan-500/50" : "bg-slate-900/40 border-slate-700 hover:bg-slate-800"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  setValue,
  min,
  max,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="text-xs space-y-1">
      <div className="text-slate-300">{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 outline-none focus:ring-2 focus:ring-cyan-400/40"
      />
    </label>
  );
}

function SliderField({
  label,
  value,
  setValue,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="text-xs space-y-1">
      <div className="text-slate-300 flex items-center justify-between">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step ?? 0.01}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-cyan-300"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span>{label}</span>
        <span>{Math.round(v * 100)}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${clamp01(v) * 100}%`, background: `linear-gradient(90deg, #22d3ee, #a78bfa)` }}
        />
      </div>
    </div>
  );
}

function HudBar({
  icon,
  label,
  value,
  max,
  accent,
  format,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  max: number;
  accent: string;
  format?: (value: number, max: number) => string;
}) {
  const ratio = max > 0 ? clamp01(value / max) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-300">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span>{format ? format(value, max) : `${Math.round(ratio * 100)}%`}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
        <div className={`h-full ${accent}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function VitalBar({
  label,
  value,
  gradient,
  icon,
}: {
  label: string;
  value: number;
  gradient: string;
  icon?: React.ReactNode;
}) {
  const pct = clamp01(value) * 100;
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3">
      <div className="flex items-center justify-between text-xs mb-2 text-slate-200">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${gradient}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------- Math helpers ----------
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function clampInt(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function clampFloat(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function approach(current: number, target: number, maxDelta: number) {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return target;
}
function rotateToward(current: number, target: number, maxDelta: number) {
  let diff = ((target - current + 540) % 360) - 180;
  if (Math.abs(diff) <= maxDelta) {
    return (target + 360) % 360;
  }
  const step = Math.sign(diff) * maxDelta;
  return (current + step + 360) % 360;
}
function cryptoId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeCouplingMatrix(k: number) {
  // 4x4 matrix lightly coupling all fields; diagonals dominant
  const d = 0.7 + 0.25 * (1 - k); // diag strength ↘ with k
  const o = k / 3; // off-diagonal
  return [
    [d, o, o * 0.9, o * 1.1],
    [o * 1.1, d, o * 0.8, o * 1.0],
    [o * 0.9, o * 1.2, d, o * 0.85],
    [o * 1.05, o * 1.0, o * 0.9, d],
  ];
}

function mat4MulVec(M: number[][], v: number[]): number[] {
  return [0, 1, 2, 3].map((r) => M[r][0] * v[0] + M[r][1] * v[1] + M[r][2] * v[2] + M[r][3] * v[3]);
}

// ---------- Oracle reply ----------
function oracleReply(text: string, psi: number, c: Cell, w: { solar: number; aqua: number; aether: number }) {
  const key = text.toLowerCase();
  const tag = key.includes("status")
    ? "Status"
    : key.includes("where")
    ? "Nav"
    : key.includes("scan")
    ? "Scan"
    : key.includes("hello")
    ? "Greeting"
    : "Reply";
  const lines: string[] = [];
  if (tag === "Greeting") {
    lines.push("Beacon: Signal received. Your wake is visible on the grid.");
  }
  if (tag === "Nav") {
    lines.push(`Nav: Sector (${c.x},${c.y}). ψ=${(psi * 100).toFixed(0)}%.`);
  }
  if (tag === "Scan" || tag === "Status") {
    lines.push(
      `Scan: E=${pct(c.energy)} | H=${pct(c.entropy)} | Coh=${pct(c.cohesion)} | Nov=${pct(c.novelty)}.`,
    );
  }
  lines.push(`Forge Weights — Solar ${pct(w.solar)} · Aqua ${pct(w.aqua)} · Aether ${pct(w.aether)}.`);
  if (psi > 0.72) lines.push("Recommendation: Anchor a relay here; resonance is strong.");
  else if (psi < 0.28) lines.push("Recommendation: Drift outward; the field is thin.");
  else lines.push("Recommendation: Maintain course; coupling is stable.");
  return lines.join("\n");
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

// ---------- Interval Hook ----------
function useInterval(callback: () => void, delay: number | null) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
