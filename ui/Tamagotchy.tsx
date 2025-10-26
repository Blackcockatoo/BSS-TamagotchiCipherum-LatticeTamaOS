import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Moon,
  Sun,
  UtensilsCrossed,
  PartyPopper,
  SprayCan,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Gauge,
  Settings,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  Swords,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

/**
 * Tamagotchy — a compact, modern virtual pet UI
 * - Tailwind + shadcn/ui + framer-motion
 * - Local save, soft autosave, time-based stat decay
 * - Actions: Feed, Play, Clean, Sleep
 * - Day/Night theme toggle
 * - Mood, Level, Age, XP, Status log
 * - Optional "Ouroboros" (B$S) skin + Neon Grid overlay
 */

// ---------- helpers ----------
const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const pct = (v: number) => Math.round(clamp(v));
const fmtAge = (ms: number) => {
  const d = Math.floor(ms / (24 * 3600_000));
  const h = Math.floor((ms % (24 * 3600_000)) / 3600_000);
  return `${d}d ${h}h`;
};

// simple seeded RNG for consistent particle offsets
function seeded(seed: number) {
  let x = Math.sin(seed) * 10000;
  return () => ((x = Math.sin(x) * 10000), x - Math.floor(x));
}

// ---------- types ----------
interface PetState {
  name: string;
  hunger: number; // 0 empty — 100 full
  fun: number; // 0 bored — 100 thrilled
  hygiene: number; // 0 messy — 100 fresh
  energy: number; // 0 tired — 100 rested
  xp: number; // arbitrary progress
  bornAt: number; // ms epoch
  lastTick: number; // ms epoch
  level: number;
  isAsleep: boolean;
}

interface SettingsState {
  sound: boolean;
  neonGrid: boolean;
  ouroborosSkin: boolean; // B$S palette
  tickMs: number; // game loop ms
  decayRate: number; // base decay per minute
  difficulty: "Chill" | "Standard" | "Hard";
}

// ---------- defaults ----------
const DEFAULT_PET: PetState = {
  name: "Mossy",
  hunger: 75,
  fun: 75,
  hygiene: 75,
  energy: 75,
  xp: 0,
  level: 1,
  bornAt: Date.now(),
  lastTick: Date.now(),
  isAsleep: false,
};

const DEFAULT_SETTINGS: SettingsState = {
  sound: false,
  neonGrid: false,
  ouroborosSkin: true,
  tickMs: 1000, // 1s
  decayRate: 0.8, // ~0.8 per min baseline, scaled per stat
  difficulty: "Standard",
};

const STORAGE_KEY = "tamagotchy_v1";

// Difficulty multipliers
const DIFF = { Chill: 0.7, Standard: 1.0, Hard: 1.4 } as const;

// ---------- main component ----------
export default function Tamagotchy() {
  const [pet, setPet] = useState<PetState>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return DEFAULT_PET;
    try {
      return { ...DEFAULT_PET, ...JSON.parse(raw).pet };
    } catch {
      return DEFAULT_PET;
    }
  });

  const [settings, setSettings] = useState<SettingsState>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return DEFAULT_SETTINGS;
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw).settings };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [openSettings, setOpenSettings] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // Persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pet, settings }));
  }, [pet, settings]);

  // Game loop — stat decay & passive XP
  useEffect(() => {
    const t = setInterval(() => {
      setPet((prev) => {
        const now = Date.now();
        const dt = Math.max(0, now - (prev.lastTick || now)); // ms
        const minutes = dt / 60_000;
        const diffMul = DIFF[settings.difficulty];
        const k = settings.decayRate * diffMul;

        // Sleep recovers energy faster & slows other decays slightly
        const sleepBoost = prev.isAsleep ? 1.6 : 1.0;
        const sleepShield = prev.isAsleep ? 0.7 : 1.0;

        const hunger = clamp(prev.hunger - 1.2 * k * minutes * sleepShield);
        const fun = clamp(prev.fun - 1.0 * k * minutes * sleepShield);
        const hygiene = clamp(prev.hygiene - 0.8 * k * minutes * sleepShield);
        const energy = clamp(
          prev.energy + 0.9 * k * minutes * sleepBoost - 0.9 * k * minutes * (prev.isAsleep ? 0 : 1)
        );
        const xp = prev.xp + 0.25 * minutes;

        const level = 1 + Math.floor(xp / 25);
        return { ...prev, hunger, fun, hygiene, energy, xp, level, lastTick: now };
      });
    }, settings.tickMs);
    return () => clearInterval(t);
  }, [settings.tickMs, settings.decayRate, settings.difficulty, pet.isAsleep]);

  // Mood logic
  const mood = useMemo(() => {
    const { hunger, fun, hygiene, energy, isAsleep } = pet;
    const avg = (hunger + fun + hygiene + energy) / 4;
    if (isAsleep) return { key: "asleep", label: "Asleep", emoji: "😴", tone: "blue" } as const;
    if (avg > 85) return { key: "ecstatic", label: "Ecstatic", emoji: "🤩", tone: "emerald" } as const;
    if (avg > 70) return { key: "happy", label: "Happy", emoji: "😊", tone: "cyan" } as const;
    if (avg > 50) return { key: "okay", label: "Okay", emoji: "🙂", tone: "amber" } as const;
    if (avg > 30) return { key: "grumpy", label: "Grumpy", emoji: "😒", tone: "orange" } as const;
    return { key: "critical", label: "Needs care", emoji: "🥺", tone: "red" } as const;
  }, [pet]);

  // Theme classes
  const skin = settings.ouroborosSkin
    ? {
        bg: "from-[#0b0f14] via-[#0e1420] to-[#141b2a]",
        rim: "ring-1 ring-white/10",
        ink: "text-slate-100",
        accent: "text-cyan-300",
        chip: "bg-white/5 border-white/10",
      }
    : {
        bg: "from-zinc-900 via-zinc-950 to-black",
        rim: "ring-1 ring-zinc-800",
        ink: "text-zinc-100",
        accent: "text-sky-300",
        chip: "bg-zinc-800 border-zinc-700",
      };

  // Status helpers
  const ageMs = Date.now() - pet.bornAt;
  const statusChips = [
    { icon: <Gauge className="h-3.5 w-3.5" />, text: `Lvl ${pet.level}` },
    { icon: <Clock className="h-3.5 w-3.5" />, text: fmtAge(ageMs) },
    { icon: <Shield className="h-3.5 w-3.5" />, text: mood.label },
  ];

  // Action handlers
  const pulse = (msg: string) =>
    setLog((prev) => [
      `${new Date().toLocaleTimeString()} — ${msg}`,
      ...prev.slice(0, 19),
    ]);

  const act = (kind: "feed" | "play" | "clean" | "sleep") => {
    if (kind === "sleep") {
      setPet((p) => ({ ...p, isAsleep: !p.isAsleep }));
      pulse(pet.isAsleep ? "Woke up" : "Fell asleep");
      return;
    }
    if (pet.isAsleep) {
      pulse("Too sleepy to act. Try waking later.");
      return;
    }
    setPet((p) => {
      let h = p.hunger,
        f = p.fun,
        hy = p.hygiene,
        e = p.energy,
        xp = p.xp;
      if (kind === "feed") {
        h = clamp(p.hunger + 18);
        hy = clamp(hy - 2);
        e = clamp(e + 4);
        xp += 1.5;
      }
      if (kind === "play") {
        f = clamp(p.fun + 18);
        e = clamp(e - 8);
        hy = clamp(hy - 3);
        xp += 1.8;
      }
      if (kind === "clean") {
        hy = clamp(p.hygiene + 22);
        f = clamp(f - 2);
        xp += 1.2;
      }
      pulse({ feed: "Nom nom!", play: "Play time!", clean: "Fresh and shiny!", sleep: "Zzz" }[kind]);
      return { ...p, hunger: h, fun: f, hygiene: hy, energy: e, xp };
    });
  };

  const reset = () => {
    setPet({ ...DEFAULT_PET, bornAt: Date.now(), lastTick: Date.now() });
    setLog([]);
    pulse("New life begins ✨");
  };

  // ---------- visual pet (SVG sprite) ----------
  const rng = useMemo(() => seeded(pet.level * 13 + Math.floor(pet.xp)), [pet.level, pet.xp]);
  const blink = pet.isAsleep ? 0 : rng() > 0.8 ? 1 : 0;
  const vib =
    mood.key === "ecstatic" ? 1.3 : mood.key === "happy" ? 0.9 : mood.key === "critical" ? 2.0 : 0.5;

  const PetSprite = (
    <motion.svg
      viewBox="0 0 160 160"
      className="w-40 h-40 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
      initial={{ scale: 0.95 }}
      animate={{ scale: 1, rotate: settings.neonGrid ? Math.sin(Date.now() / 2000) * 0.5 : 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 12 }}
    >
      {/* Body */}
      <defs>
        <radialGradient id="g" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={settings.ouroborosSkin ? "#00ffd0" : "#93c5fd"} stopOpacity="0.9" />
          <stop offset="70%" stopColor={settings.ouroborosSkin ? "#60a5fa" : "#22d3ee"} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
        </radialGradient>
      </defs>
      <motion.ellipse
        cx="80"
        cy="85"
        rx="55"
        ry="50"
        fill="url(#g)"
        stroke="white"
        strokeOpacity="0.08"
        strokeWidth="2"
        animate={{ y: [0, -2, 0, 2, 0], rotate: [0, -1, 0, 1, 0] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />
      {/* Eyes */}
      <motion.circle cx="60" cy="75" r={blink ? 1.2 : 5} fill="#0b1020" />
      <motion.circle cx="100" cy="75" r={blink ? 1.2 : 5} fill="#0b1020" />
      {/* Mouth */}
      <path
        d="M60 100 Q80 115 100 100"
        stroke={settings.ouroborosSkin ? "#e6c76c" : "#f4d06f"}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      {/* Crest/ear fluff */}
      <motion.path
        d="M75 38 C70 20 95 20 90 38"
        fill={settings.ouroborosSkin ? "#a5b4fc" : "#fde68a"}
        opacity="0.9"
        animate={{ y: [0, -2, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 2.6, repeat: Infinity }}
      />
      {/* Sparkles when happy */}
      <AnimatePresence>
        {(mood.key === "ecstatic" || mood.key === "happy") && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {[...Array(7)].map((_, i) => (
              <motion.circle
                key={i}
                cx={20 + rng() * 120}
                cy={20 + rng() * 120}
                r={1.5 + rng() * 1.5}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2 + rng() * 1.2, repeat: Infinity }}
              />
            ))}
          </motion.g>
        )}
      </AnimatePresence>
    </motion.svg>
  );

  // Neon grid
  const NeonGrid = settings.neonGrid ? (
    <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]">
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(transparent 31px, rgba(255,255,255,0.12) 32px), linear-gradient(90deg, transparent 31px, rgba(255,255,255,0.12) 32px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-indigo-500/0" />
    </div>
  ) : null;

  // ---------- UI ----------
  return (
    <div
      className={`relative min-h-[100svh] w-full bg-gradient-to-b ${skin.bg} selection:bg-cyan-400/20 ${skin.ink}`}
    >
      {NeonGrid}

      <div className="mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Tamagotchy</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${skin.chip} border`}>v1</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/5 hover:bg-white/10 border border-white/10"
              onClick={() => setOpenSettings((v) => !v)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings {openSettings ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
            <Button size="sm" variant="outline" className="border-white/20" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Pet Pane */}
          <Card className={`relative overflow-hidden ${skin.rim} bg-white/5 backdrop-blur-sm`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <span className="font-semibold">{pet.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${skin.chip} border`}>
                  {mood.emoji} {mood.label}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ y: [0, -2 * vib, 0, 2 * vib, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                  className="relative"
                >
                  {PetSprite}
                  {pet.isAsleep && (
                    <motion.div
                      className="absolute -top-2 -right-1 text-cyan-200/80"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Moon className="h-5 w-5" />
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* Chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {statusChips.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${skin.chip} border`}
                  >
                    {c.icon}
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>

              {/* Bars */}
              <div className="mt-4 space-y-3">
                <StatBar label="Hunger" value={pet.hunger} icon={<UtensilsCrossed className="h-4 w-4" />} tone="emerald" />
                <StatBar label="Fun" value={pet.fun} icon={<PartyPopper className="h-4 w-4" />} tone="cyan" />
                <StatBar label="Hygiene" value={pet.hygiene} icon={<SprayCan className="h-4 w-4" />} tone="indigo" />
                <StatBar label="Energy" value={pet.energy} icon={<Zap className="h-4 w-4" />} tone="amber" />
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button className="flex-1" onClick={() => act("feed")}>
                {" "}
                <UtensilsCrossed className="h-4 w-4 mr-2" /> Feed
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => act("play")}>
                {" "}
                <PartyPopper className="h-4 w-4 mr-2" /> Play
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => act("clean")}>
                {" "}
                <SprayCan className="h-4 w-4 mr-2" /> Clean
              </Button>
              <Button className="flex-1" variant={pet.isAsleep ? "destructive" : "ghost"} onClick={() => act("sleep")}>
                {pet.isAsleep ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}{" "}
                {pet.isAsleep ? "Wake" : "Sleep"}
              </Button>
            </CardFooter>
          </Card>

          {/* Log Pane */}
          <Card className={`xl:col-span-2 ${skin.rim} bg-white/5`}>
            <CardHeader className="pb-2">
              <CardTitle>Status & Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <div className="h-56 overflow-y-auto rounded-md border border-white/10 p-3 bg-black/20 font-mono text-xs leading-relaxed">
                  {log.length === 0 ? (
                    <div className="text-white/60">No events yet. Take an action to begin!</div>
                  ) : (
                    <ul className="space-y-1">
                      {log.map((line, i) => (
                        <li key={i} className="text-white/80">
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-3 text-xs text-white/60">
                  Autosaves each change • Decay scales with difficulty • Sleep recovers energy, slows other drains
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">Pet name</label>
                <Input
                  value={pet.name}
                  onChange={(e) => setPet((p) => ({ ...p, name: e.target.value.slice(0, 20) }))}
                  className="bg-white/5 border-white/10"
                />

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    {settings.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Sound
                  </div>
                  <Switch checked={settings.sound} onCheckedChange={(v) => setSettings((s) => ({ ...s, sound: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4" /> Ouroboros skin
                  </div>
                  <Switch
                    checked={settings.ouroborosSkin}
                    onCheckedChange={(v) => setSettings((s) => ({ ...s, ouroborosSkin: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Swords className="h-4 w-4" /> Neon grid
                  </div>
                  <Switch checked={settings.neonGrid} onCheckedChange={(v) => setSettings((s) => ({ ...s, neonGrid: v }))} />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2">
                  {["Chill", "Standard", "Hard"].map((d) => (
                    <Button
                      key={d}
                      variant={settings.difficulty === d ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setSettings((s) => ({ ...s, difficulty: d as SettingsState["difficulty"] }))}
                    >
                      {d}
                    </Button>
                  ))}
                </div>

                {openSettings && (
                  <div className="mt-3 space-y-2 text-xs text-white/70">
                    <div className="flex items-center justify-between">
                      <span>Tick (ms)</span>
                      <Input
                        type="number"
                        min={250}
                        max={2000}
                        value={settings.tickMs}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            tickMs: clamp(parseInt(e.target.value || "1000"), 250, 2000),
                          }))
                        }
                        className="h-8 bg-white/5 border-white/10 w-28"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Decay rate</span>
                      <Input
                        type="number"
                        step="0.1"
                        min={0.2}
                        max={3}
                        value={settings.decayRate}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            decayRate: Number(e.target.value || 1),
                          }))
                        }
                        className="h-8 bg-white/5 border-white/10 w-28"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <footer className="mt-6 text-xs text-white/50">
          <div>Made with ❤️ — stats auto-save to localStorage (“{STORAGE_KEY}”).</div>
        </footer>
      </div>
    </div>
  );
}

// ---------- subcomponents ----------
function StatBar({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "emerald" | "cyan" | "indigo" | "amber" | "red";
}) {
  const t = tone ?? "cyan";
  const color = {
    emerald: "from-emerald-400 to-emerald-600",
    cyan: "from-cyan-400 to-cyan-600",
    indigo: "from-indigo-400 to-indigo-600",
    amber: "from-amber-400 to-amber-600",
    red: "from-rose-400 to-rose-600",
  }[t];
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <div className="flex items-center gap-2 opacity-80">
          {icon}
          <span>{label}</span>
        </div>
        <div className="tabular-nums opacity-80">{pct(value)}%</div>
      </div>
      <div className="relative h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden">
        <div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color}`} style={{ width: `${pct(value)}%` }} />
      </div>
    </div>
  );
}
