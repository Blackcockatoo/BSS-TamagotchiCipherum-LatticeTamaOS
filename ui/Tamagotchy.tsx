import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
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
  Clock,
  Shield,
  Swords,
  Zap,
  Dna,
  Copy,
  Microscope,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type GenomeType = "blue" | "red";

interface PetState {
  name: string;
  hunger: number;
  fun: number;
  hygiene: number;
  energy: number;
  xp: number;
  level: number;
  bornAt: number;
  lastTick: number;
  isAsleep: boolean;
  genomeType: GenomeType;
  genomeSeed: number;
  generation: number;
  evolutions: number;
  species: string;
}

type Difficulty = "Chill" | "Standard" | "Hard";

interface SettingsState {
  sound: boolean;
  neonGrid: boolean;
  ouroborosSkin: boolean;
  tickMs: number;
  decayRate: number;
  difficulty: Difficulty;
}

interface Traits {
  hue: number;
  saturation: number;
  lightness: number;
  bodyShape: number;
  patternType: number;
  patternIntensity: number;
  crestStyle: number;
  eyeStyle: number;
  hungerMod: number;
  funMod: number;
  hygieneMod: number;
  energyMod: number;
  xpBonus: number;
  resilience: number;
  metabolism: number;
  evolutionThreshold: number;
  mutationRate: number;
  maxEvolutions: number;
  curiosity: number;
  sociability: number;
  stubbornness: number;
}

interface Sparkle {
  x: number;
  y: number;
  radius: number;
}

// TamaOS Genetic Code
const TAMAOS_CODE = {
  ATG: "MET",
  CCG: "PRO",
  CGT: "ARG",
  CAT: "HIS",
  ATC: "ILE",
  ACG: "THR",
  TTA: "LEU",
  TGC: "CYS",
  TAT: "TYR",
  ACT: "THR",
  ATA: "ILE",
  CCA: "PRO",
  GTC: "VAL",
  ACA: "THR",
  TTG: "LEU",
  TAC: "TYR",
  TGT: "CYS",
  GCT: "ALA",
  ATT: "ILE",
  GTT: "VAL",
  TTC: "PHE",
  TAA: "STOP",
  TAG: "STOP",
  TGA: "STOP",
} as const satisfies Record<string, string>;

// Genomes
const BLUE_GENOME =
  "ATGCCGCGTCATATCACGTTATGCTATACTATACCACATCGTGTCACATTGTACTGTGCT".repeat(5);
const RED_GENOME =
  "TTCACTATTATCTATCATTACCCACCATTATTCACTGTTGTCTGTCGTTGCCCGCCGTTA".repeat(4) +
  "TTCACTATTATCTATCATTA";

// --- helpers ---
function genomeToCodons(sequence: string): string[] {
  const codons: string[] = [];
  const n = Math.floor(sequence.length / 3) * 3;
  for (let i = 0; i < n; i += 3) codons.push(sequence.slice(i, i + 3));
  return codons;
}

function translateCodons(codons: string[]): string[] {
  const protein: string[] = [];
  for (const codon of codons) {
    const aa = TAMAOS_CODE[codon as keyof typeof TAMAOS_CODE] ?? "X";
    if (aa === "STOP") break;
    protein.push(aa);
  }
  return protein;
}

function seededRandom(seed: number) {
  // 32-bit LCG
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function generateGenomeFromSeed(seed: number, type: GenomeType = "blue"): string {
  const rng = seededRandom(seed);
  const baseGenome = type === "blue" ? BLUE_GENOME : RED_GENOME;
  const bases = ["A", "T", "G", "C"] as const;
  const mutationRate = 0.02;
  const arr = baseGenome.split("");
  for (let i = 0; i < arr.length; i++)
    if (rng() < mutationRate) arr[i] = bases[(rng() * 4) | 0];
  return arr.join("");
}

// FNV-1a (stable)
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// build a STOP-robust signature from first N codons (STOP -> '-')
function buildTraitSignature(codons: string[], take = 60): string {
  let out = "";
  const n = Math.min(codons.length, take);
  for (let i = 0; i < n; i++) {
    const aa = TAMAOS_CODE[codons[i] as keyof typeof TAMAOS_CODE] ?? "X";
    out += aa === "STOP" ? "-" : aa;
  }
  return out;
}

function decodeTraitsFromSignature(sig: string): Traits {
  const h = fnv1a32(sig);
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = (h >>> ((i * 2) & 31)) & 0xff;
  return {
    hue: (bytes[0] / 255) * 360,
    saturation: 50 + (bytes[1] / 255) * 30,
    lightness: 30 + (bytes[2] / 255) * 30,
    bodyShape: bytes[1] % 3,
    patternType: bytes[3] % 4,
    patternIntensity: bytes[4] / 255,
    crestStyle: bytes[5] % 3,
    eyeStyle: bytes[15] % 3,
    hungerMod: 0.85 + (bytes[6] / 255) * 0.3,
    funMod: 0.85 + (bytes[7] / 255) * 0.3,
    hygieneMod: 0.85 + (bytes[8] / 255) * 0.3,
    energyMod: 0.85 + (bytes[9] / 255) * 0.3,
    xpBonus: (bytes[10] / 255) * 0.5,
    resilience: (bytes[11] / 255) * 0.3,
    metabolism: 0.85 + (bytes[12] / 255) * 0.3,
    evolutionThreshold: 20 + Math.floor((bytes[13] / 255) * 15),
    mutationRate: (bytes[14] / 255) * 0.15,
    maxEvolutions: 2 + (bytes[15] % 3),
    curiosity: 0.1 + (bytes[3] / 255) * 0.4,
    sociability: 0.1 + (bytes[4] / 255) * 0.4,
    stubbornness: 0.1 + (bytes[5] / 255) * 0.4,
  };
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const pct = (v: number) => Math.round(clamp(v));
const fmtAge = (ms: number) => {
  const d = Math.floor(ms / (24 * 3600_000));
  const h = Math.floor((ms % (24 * 3600_000)) / 3600_000);
  return `${d}d ${h}h`;
};

function seeded(seed: number) {
  let x = Math.sin(seed) * 10000;
  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

// --- defaults ---
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
  genomeType: "blue",
  genomeSeed: Date.now(),
  generation: 1,
  evolutions: 0,
  species: "Blue Gen I",
};

const DEFAULT_SETTINGS: SettingsState = {
  sound: false,
  neonGrid: false,
  ouroborosSkin: true,
  tickMs: 1000,
  decayRate: 0.8,
  difficulty: "Standard",
};

const STORAGE_KEY = "tamagotchy_genetic_v1";
const DIFF: Record<Difficulty, number> = { Chill: 0.7, Standard: 1.0, Hard: 1.4 };

export default function Tamagotchy(): JSX.Element {
  const [pet, setPet] = useState<PetState>(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return DEFAULT_PET;
    try {
      const parsed = JSON.parse(raw).pet as Partial<PetState> | undefined;
      return { ...DEFAULT_PET, ...parsed };
    } catch {
      return DEFAULT_PET;
    }
  });

  const [settings, setSettings] = useState<SettingsState>(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return DEFAULT_SETTINGS;
    try {
      const parsed = JSON.parse(raw).settings as
        | Partial<SettingsState>
        | undefined;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [openSettings, setOpenSettings] = useState(false);
  const [showGenetics, setShowGenetics] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // genomes → codons → protein → traits
  const genome = useMemo(
    () => generateGenomeFromSeed(pet.genomeSeed, pet.genomeType),
    [pet.genomeSeed, pet.genomeType],
  );
  const codons = useMemo(() => genomeToCodons(genome), [genome]);
  const protein = useMemo(() => translateCodons(codons), [codons]);
  const traitSignature = useMemo(() => buildTraitSignature(codons, 60), [codons]);
  const traits = useMemo(() => decodeTraitsFromSignature(traitSignature), [
    traitSignature,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pet, settings }));
  }, [pet, settings]);

  const pulse = useCallback((msg: string) => {
    setLog((prev) => [
      `${new Date().toLocaleTimeString()} — ${msg}`,
      ...prev.slice(0, 49),
    ]);
  }, []);

  // sim tick
  useEffect(() => {
    const t = setInterval(() => {
      setPet((prev) => {
        const now = Date.now();
        const dt = Math.max(0, now - (prev.lastTick || now));
        const minutes = dt / 60_000;
        const diffMul = DIFF[settings.difficulty];
        const k = settings.decayRate * diffMul;

        const sleepBoost = prev.isAsleep ? 1.6 : 1.0;
        const sleepShield = prev.isAsleep ? 0.7 : 1.0;

        const hunger = clamp(
          prev.hunger - 1.2 * k * minutes * traits.hungerMod * sleepShield,
        );
        const fun = clamp(
          prev.fun - 1.0 * k * minutes * traits.funMod * sleepShield,
        );
        const hygiene = clamp(
          prev.hygiene - 0.8 * k * minutes * traits.hygieneMod * sleepShield,
        );
        const energy = clamp(
          prev.energy +
            0.9 * k * minutes * traits.energyMod * sleepBoost -
            0.9 * k * minutes * traits.energyMod * (prev.isAsleep ? 0 : 1),
        );

        const xpGain = 0.25 * minutes * (1 + traits.xpBonus);
        const xp = prev.xp + xpGain;
        const level = 1 + Math.floor(xp / 25);

        let newGenomeSeed = prev.genomeSeed;
        let newEvolutions = prev.evolutions;
        let newSpecies = prev.species;
        let evolved = false;

        if (
          level >= traits.evolutionThreshold &&
          prev.evolutions < traits.maxEvolutions &&
          level > prev.level
        ) {
          const shouldMutate = Math.random() < traits.mutationRate;
          if (shouldMutate) {
            newGenomeSeed = prev.genomeSeed + ((Math.random() * 1000) | 0);
            evolved = true;
          }
          newEvolutions = prev.evolutions + 1;
          newSpecies = `${prev.genomeType === "blue" ? "Blue" : "Red"} Gen ${prev.generation} Evo ${newEvolutions}`;
        }

        if (evolved) {
          setTimeout(
            () =>
              pulse(
                `✨ Evolution! ${prev.name} mutated! Genome seed: ${newGenomeSeed}`,
              ),
            0,
          );
        }

        return {
          ...prev,
          hunger,
          fun,
          hygiene,
          energy,
          xp,
          level,
          lastTick: now,
          genomeSeed: newGenomeSeed,
          evolutions: newEvolutions,
          species: newSpecies,
        };
      });
    }, settings.tickMs);
    return () => clearInterval(t);
  }, [
    settings.tickMs,
    settings.decayRate,
    settings.difficulty,
    traits,
    pulse,
  ]);

  const mood = useMemo(() => {
    const { hunger, fun, hygiene, energy, isAsleep } = pet;
    const avg = (hunger + fun + hygiene + energy) / 4;
    if (isAsleep)
      return { key: "asleep", label: "Asleep", emoji: "😴", tone: "blue" } as const;
    if (avg > 85)
      return {
        key: "ecstatic",
        label: "Ecstatic",
        emoji: "🤩",
        tone: "emerald",
      } as const;
    if (avg > 70)
      return { key: "happy", label: "Happy", emoji: "😊", tone: "cyan" } as const;
    if (avg > 50)
      return { key: "okay", label: "Okay", emoji: "🙂", tone: "amber" } as const;
    if (avg > 30)
      return {
        key: "grumpy",
        label: "Grumpy",
        emoji: "😒",
        tone: "orange",
      } as const;
    return {
      key: "critical",
      label: "Needs care",
      emoji: "🥺",
      tone: "red",
    } as const;
  }, [pet]);

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

  const ageMs = Date.now() - pet.bornAt;
  const statusChips = [
    { icon: <Gauge className="h-3.5 w-3.5" />, text: `Lvl ${pet.level}` },
    { icon: <Clock className="h-3.5 w-3.5" />, text: fmtAge(ageMs) },
    { icon: <Shield className="h-3.5 w-3.5" />, text: mood.label },
    { icon: <Dna className="h-3.5 w-3.5" />, text: pet.species },
    { icon: <Microscope className="h-3.5 w-3.5" />, text: `${protein.length} AA` },
  ];

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
      let h = p.hunger;
      let f = p.fun;
      let hy = p.hygiene;
      let e = p.energy;
      let xp = p.xp;
      if (kind === "feed") {
        h = clamp(p.hunger + 18 * traits.metabolism);
        hy = clamp(hy - 2);
        e = clamp(e + 4);
        xp += 1.5 * (1 + traits.xpBonus);
      }
      if (kind === "play") {
        f = clamp(p.fun + 18);
        e = clamp(e - 8 * (1 - traits.resilience));
        hy = clamp(hy - 3);
        xp += 1.8 * (1 + traits.xpBonus);
      }
      if (kind === "clean") {
        hy = clamp(p.hygiene + 22);
        f = clamp(f - 2);
        xp += 1.2 * (1 + traits.xpBonus);
      }
      pulse({
        feed: "Nom nom!",
        play: "Play time!",
        clean: "Fresh and shiny!",
        sleep: "Zzz",
      }[kind]);
      return { ...p, hunger: h, fun: f, hygiene: hy, energy: e, xp };
    });
  };

  const reset = () => {
    const newSeed = Date.now();
    const lineage = pet.genomeType;
    setPet({
      ...DEFAULT_PET,
      bornAt: Date.now(),
      lastTick: Date.now(),
      genomeSeed: newSeed,
      genomeType: lineage,
      generation: pet.generation + 1,
      species: `${lineage === "blue" ? "Blue" : "Red"} Gen ${pet.generation + 1}`,
      evolutions: 0,
      name: pet.name,
    });
    setLog([]);
    pulse("New life begins ✨ Generation " + (pet.generation + 1));
  };

  const switchGenomeType = () => {
    const newType: GenomeType = pet.genomeType === "blue" ? "red" : "blue";
    setPet((p) => ({
      ...p,
      genomeType: newType,
      genomeSeed: Date.now(),
      species: `${newType === "blue" ? "Blue" : "Red"} Gen ${p.generation}`,
      evolutions: 0,
    }));
    pulse(`Switched to ${newType.toUpperCase()} genome lineage!`);
  };

  const copyGenome = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(genome);
        pulse("Full genome sequence copied to clipboard!");
      } else {
        pulse("Clipboard unavailable in this context.");
      }
    } catch {
      pulse("Copy failed (permissions?).");
    }
  };

  const rng = useMemo(() => seeded(pet.level * 13 + Math.floor(pet.xp)), [
    pet.level,
    pet.xp,
  ]);
  const blink = pet.isAsleep ? 0 : rng() > 0.8 ? 1 : 0;
  const vib =
    mood.key === "ecstatic"
      ? 1.3
      : mood.key === "happy"
      ? 0.9
      : mood.key === "critical"
      ? 2.0
      : 0.5;

  const bodyColor = `hsl(${traits.hue} ${traits.saturation}% ${traits.lightness}%)`;
  const secondaryColor = `hsl(${(traits.hue + 40) % 360} ${traits.saturation}% ${Math.min(
    95,
    traits.lightness + 10,
  )}%)`;

  // deterministic sparkles from genome hash
  const sparkSeed = useMemo(() => fnv1a32(genome), [genome]);
  const sparkles = useMemo<Sparkle[]>(() => {
    const r = seededRandom(sparkSeed);
    return Array.from({ length: 7 }, () => ({
      x: 20 + r() * 120,
      y: 20 + r() * 120,
      radius: 1.5 + r() * 1.5,
    }));
  }, [sparkSeed]);

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

  return (
    <div
      className={`relative min-h-[100svh] w-full bg-gradient-to-b ${skin.bg} selection:bg-cyan-400/20 ${skin.ink}`}
    >
      {NeonGrid}

      <div className="mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Tamagotchy
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${skin.chip} border`}>
              TamaOS Genetics
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/5 hover:bg-white/10 border border-white/10"
              onClick={() => setShowGenetics((v) => !v)}
            >
              <Microscope className="h-4 w-4 mr-2" />
              Genetics
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/5 hover:bg-white/10 border border-white/10"
              onClick={() => setOpenSettings((v) => !v)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button size="sm" variant="outline" className="border-white/20" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
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
                  <PetSprite
                    blink={blink}
                    traits={traits}
                    bodyColor={bodyColor}
                    secondaryColor={secondaryColor}
                    neon={settings.neonGrid}
                    sparkles={sparkles}
                    moodKey={mood.key}
                  />
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

              <div className="mt-4 space-y-3">
                <StatBar
                  label="Hunger"
                  value={pet.hunger}
                  icon={<UtensilsCrossed className="h-4 w-4" />}
                  tone="emerald"
                  modifier={traits.hungerMod}
                />
                <StatBar
                  label="Fun"
                  value={pet.fun}
                  icon={<PartyPopper className="h-4 w-4" />}
                  tone="cyan"
                  modifier={traits.funMod}
                />
                <StatBar
                  label="Hygiene"
                  value={pet.hygiene}
                  icon={<SprayCan className="h-4 w-4" />}
                  tone="indigo"
                  modifier={traits.hygieneMod}
                />
                <StatBar
                  label="Energy"
                  value={pet.energy}
                  icon={<Zap className="h-4 w-4" />}
                  tone="amber"
                  modifier={traits.energyMod}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button className="flex-1" onClick={() => act("feed")}>
                <UtensilsCrossed className="h-4 w-4 mr-2" /> Feed
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => act("play")}
              >
                <PartyPopper className="h-4 w-4 mr-2" /> Play
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => act("clean")}
              >
                <SprayCan className="h-4 w-4 mr-2" /> Clean
              </Button>
              <Button
                className="flex-1"
                variant={pet.isAsleep ? "destructive" : "ghost"}
                onClick={() => act("sleep")}
              >
                {pet.isAsleep ? (
                  <Sun className="h-4 w-4 mr-2" />
                ) : (
                  <Moon className="h-4 w-4 mr-2" />
                )}
                {pet.isAsleep ? "Wake" : "Sleep"}
              </Button>
            </CardFooter>
          </Card>

          <Card className={`xl:col-span-2 ${skin.rim} bg-white/5`}>
            <CardHeader className="pb-2">
              <CardTitle>Genetic Analysis</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <Tabs defaultValue="activity" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-black/20 border-white/10">
                  <TabsTrigger value="activity">Activity Log</TabsTrigger>
                  <TabsTrigger value="protein">Protein Sequence</TabsTrigger>
                  <TabsTrigger value="code">Genetic Code</TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="mt-4 space-y-4">
                  <div className="h-56 overflow-y-auto rounded-md border border-white/10 p-3 bg-black/20 font-mono text-xs leading-relaxed">
                    {log.length === 0 ? (
                      <div className="text-white/60">
                        No events yet. Take an action to begin!
                      </div>
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
                  <div className="text-xs text-white/60">
                    Real genetic code • Protein-driven traits • {codons.length} codons →
                    {" "}
                    {protein.length} amino acids
                  </div>
                </TabsContent>

                <TabsContent value="protein" className="mt-4 space-y-4">
                  <div className="rounded-md border border-white/10 p-3 bg-black/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-cyan-300 flex items-center gap-2">
                        <Microscope className="h-4 w-4" /> Translated Protein Sequence (
                        {protein.length} residues)
                      </span>
                      <Button size="sm" variant="ghost" onClick={copyGenome}>
                        <Copy className="h-3 w-3 mr-1" /> Copy Genome
                      </Button>
                    </div>
                    <div className="h-48 overflow-y-auto font-mono text-xs text-white/80 leading-relaxed">
                      {protein.slice(0, 60).map((aa, i) => (
                        <span
                          key={i}
                          className="inline-block mr-2 mb-1 px-1 py-0.5 rounded bg-white/5"
                        >
                          {aa}
                        </span>
                      ))}
                      {protein.length > 60 && (
                        <span className="text-white/50">
                          ... +{protein.length - 60} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-white/10 p-3 bg-black/20">
                      <div className="text-xs font-semibold text-amber-300 mb-2">
                        Genome Stats
                      </div>
                      <div className="space-y-1 text-xs text-white/70">
                        <div>
                          Type: <span className="text-white font-semibold uppercase">{pet.genomeType}</span>
                        </div>
                        <div>Length: {genome.length} bp</div>
                        <div>Codons: {codons.length}</div>
                        <div>Seed: {pet.genomeSeed}</div>
                      </div>
                    </div>
                    <div className="rounded-md border border-white/10 p-3 bg-black/20">
                      <div className="text-xs font-semibold text-purple-300 mb-2">
                        Personality
                      </div>
                      <div className="space-y-1 text-xs text-white/70">
                        <div>Curiosity: {Math.round(traits.curiosity * 100)}%</div>
                        <div>Sociability: {Math.round(traits.sociability * 100)}%</div>
                        <div>Stubbornness: {Math.round(traits.stubbornness * 100)}%</div>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" variant="secondary" onClick={switchGenomeType}>
                    <Dna className="h-4 w-4 mr-2" /> Switch to {pet.genomeType === "blue" ? "RED" : "BLUE"} Genome
                    Lineage
                  </Button>
                </TabsContent>

                <TabsContent value="code" className="mt-4 space-y-4">
                  <div className="text-xs text-white/60 mb-3">
                    TamaOS Genetic Code: Codon → Amino Acid mapping
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 rounded-md bg-black/20 border border-white/10">
                    {Object.entries(TAMAOS_CODE).map(([codon, aa]) => (
                      <div
                        key={codon}
                        className="flex items-center justify-between p-2 text-xs font-mono bg-white/5 rounded hover:bg-white/10 transition"
                      >
                        <span className="text-cyan-300 font-bold">{codon}</span>
                        <span className="text-white/50">→</span>
                        <span
                          className={`text-white/90 font-semibold ${
                            aa === "STOP" ? "text-red-400" : ""
                          }`}
                        >
                          {aa}
                        </span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {showGenetics && (
                <div className="mt-4 rounded-md border border-white/10 p-3 bg-black/20 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                    <span className="flex items-center gap-2">
                      <Code className="h-4 w-4" /> Raw Genome Sequence
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-white/70 break-all bg-white/5 p-2 rounded max-h-32 overflow-y-auto">
                    {genome}
                  </div>
                  <div className="text-xs text-white/60 space-y-1">
                    <div className="font-bold text-white/80">
                      Trait Modifiers (Protein-Derived)
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <div>XP Bonus: +{Math.round(traits.xpBonus * 100)}%</div>
                      <div>Resilience: {Math.round(traits.resilience * 100)}%</div>
                      <div>Metabolism: {Math.round(traits.metabolism * 100)}%</div>
                      <div>Evolution Level: {traits.evolutionThreshold}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            {openSettings && (
              <CardContent className="pt-0 border-t border-white/10">
                <div className="space-y-3 mt-4">
                  <label className="text-sm font-medium">Pet name</label>
                  <Input
                    value={pet.name}
                    onChange={(e) =>
                      setPet((p) => ({ ...p, name: e.target.value.slice(0, 20) }))
                    }
                    className="bg-white/5 border-white/10"
                  />

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      {settings.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      Sound
                    </div>
                    <Switch
                      checked={settings.sound}
                      onCheckedChange={(v) =>
                        setSettings((s) => ({ ...s, sound: v }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4" /> Ouroboros skin
                    </div>
                    <Switch
                      checked={settings.ouroborosSkin}
                      onCheckedChange={(v) =>
                        setSettings((s) => ({ ...s, ouroborosSkin: v }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Swords className="h-4 w-4" /> Neon grid
                    </div>
                    <Switch
                      checked={settings.neonGrid}
                      onCheckedChange={(v) =>
                        setSettings((s) => ({ ...s, neonGrid: v }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {["Chill", "Standard", "Hard"].map((d) => (
                      <Button
                        key={d}
                        variant={settings.difficulty === d ? "default" : "secondary"}
                        size="sm"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            difficulty: d as Difficulty,
                          }))
                        }
                      >
                        {d}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-2 text-xs text-white/70">
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
                            tickMs: clamp(
                              parseInt(e.target.value || "1000", 10),
                              250,
                              2000,
                            ),
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
                            decayRate: Math.max(
                              0.2,
                              Math.min(3, Number(e.target.value || 1)),
                            ),
                          }))
                        }
                        className="h-8 bg-white/5 border-white/10 w-28"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        <footer className="mt-6 text-xs text-white/50">
          <div>
            Generation {pet.generation} • Evolutions {pet.evolutions}/{
              traits.maxEvolutions
            } • Powered by TamaOS Genetic Code
          </div>
        </footer>
      </div>
    </div>
  );
}

interface PetSpriteProps {
  blink: number;
  traits: Traits;
  bodyColor: string;
  secondaryColor: string;
  neon: boolean;
  sparkles: Sparkle[];
  moodKey: string;
}

function PetSprite({
  blink,
  traits,
  bodyColor,
  secondaryColor,
  neon,
  sparkles,
  moodKey,
}: PetSpriteProps) {
  const gid = useId();
  return (
    <motion.svg
      viewBox="0 0 160 160"
      className="w-40 h-40 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
      initial={{ scale: 0.95 }}
      animate={neon ? { rotate: [-0.5, 0.5, -0.5] } : { rotate: 0 }}
      transition={neon ? { duration: 3.2, repeat: Infinity } : { duration: 0.2 }}
    >
      <defs>
        <radialGradient id={`g-${gid}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={bodyColor} stopOpacity="0.9" />
          <stop offset="70%" stopColor={secondaryColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
        </radialGradient>
      </defs>

      {traits.bodyShape === 0 && (
        <motion.ellipse
          cx="80"
          cy="85"
          rx="55"
          ry="50"
          fill={`url(#g-${gid})`}
          stroke="white"
          strokeOpacity="0.08"
          strokeWidth="2"
          animate={{ y: [0, -2, 0, 2, 0] }}
          transition={{ duration: 3.5, repeat: Infinity }}
        />
      )}
      {traits.bodyShape === 1 && (
        <motion.circle
          cx="80"
          cy="85"
          r="55"
          fill={`url(#g-${gid})`}
          stroke="white"
          strokeOpacity="0.08"
          strokeWidth="2"
          animate={{ y: [0, -2, 0, 2, 0] }}
          transition={{ duration: 3.5, repeat: Infinity }}
        />
      )}
      {traits.bodyShape === 2 && (
        <motion.rect
          x="25"
          y="30"
          width="110"
          height="110"
          rx="25"
          ry="25"
          fill={`url(#g-${gid})`}
          stroke="white"
          strokeOpacity="0.08"
          strokeWidth="2"
          animate={{ y: [0, -2, 0, 2, 0] }}
          transition={{ duration: 3.5, repeat: Infinity }}
        />
      )}

      {traits.eyeStyle === 0 && (
        <>
          <motion.circle cx="60" cy="75" r={blink ? 1.2 : 5} fill="#0b1020" />
          <motion.circle cx="100" cy="75" r={blink ? 1.2 : 5} fill="#0b1020" />
        </>
      )}
      {traits.eyeStyle === 1 && (
        <>
          <motion.rect
            x="55"
            y="73"
            width="10"
            height="4"
            rx="1"
            ry="1"
            fill="#0b1020"
          />
          <motion.rect
            x="95"
            y="73"
            width="10"
            height="4"
            rx="1"
            ry="1"
            fill="#0b1020"
          />
        </>
      )}
      {traits.eyeStyle === 2 && (
        <>
          <motion.circle cx="60" cy="75" r={blink ? 1.2 : 2.5} fill="#0b1020" />
          <motion.circle cx="100" cy="75" r={blink ? 1.2 : 2.5} fill="#0b1020" />
        </>
      )}

      <path
        d="M60 100 Q80 115 100 100"
        stroke={secondaryColor}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />

      {traits.crestStyle === 0 && (
        <motion.path
          d="M75 38 C70 20 95 20 90 38"
          fill={secondaryColor}
          opacity="0.9"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
      )}
      {traits.crestStyle === 1 && (
        <motion.circle
          cx="80"
          cy="35"
          r="12"
          fill={secondaryColor}
          opacity="0.9"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
      )}
      {traits.crestStyle === 2 && (
        <motion.path
          d="M70 40 L75 25 L80 35 L85 20 L90 35 L95 25 L100 40"
          stroke={secondaryColor}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
      )}

      <AnimatePresence>
        {(moodKey === "ecstatic" || moodKey === "happy") && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {sparkles.map((s, i) => (
              <motion.circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.radius}
                fill={secondaryColor}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2 + i * 0.2, repeat: Infinity }}
              />
            ))}
          </motion.g>
        )}
      </AnimatePresence>
    </motion.svg>
  );
}

interface StatBarProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "emerald" | "cyan" | "indigo" | "amber" | "red";
  modifier?: number;
}

function StatBar({ label, value, icon, tone, modifier }: StatBarProps) {
  const t = tone || "cyan";
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
          <span>
            {label}
            {modifier ? ` (${modifier.toFixed(2)}x)` : ""}
          </span>
        </div>
        <div className="tabular-nums opacity-80">{pct(value)}%</div>
      </div>
      <div className="relative h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color}`}
          style={{ width: `${pct(value)}%` }}
        />
      </div>
    </div>
  );
}

