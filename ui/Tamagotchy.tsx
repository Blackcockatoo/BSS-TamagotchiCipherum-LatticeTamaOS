import React, {
  useCallback,
  useEffect,
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

const TAMAOS_CODE: Record<string, string> = {
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
};

const BLUE_GENOME_BASE =
  "ATGCCGCGTCATATCACGTTATGCTATACTATACCACATCGTGTCACATTGTACTGTGCT";
const BLUE_GENOME = BLUE_GENOME_BASE.repeat(5);

const RED_GENOME_BASE =
  "TTCACTATTATCTATCATTACCCACCATTATTCACTGTTGTCTGTCGTTGCCCGCCGTTA";
const RED_GENOME = `${RED_GENOME_BASE.repeat(4)}TTCACTATTATCTATCATTA`;

type Difficulty = "Chill" | "Standard" | "Hard";

type Pet = {
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
  genomeType: "blue" | "red";
  genomeSeed: number;
  generation: number;
  evolutions: number;
  species: string;
};

type SettingsState = {
  sound: boolean;
  neonGrid: boolean;
  ouroborosSkin: boolean;
  tickMs: number;
  decayRate: number;
  difficulty: Difficulty;
};

type Traits = {
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
};

type Mood = {
  key: "asleep" | "ecstatic" | "happy" | "okay" | "grumpy" | "critical";
  label: string;
  emoji: string;
  tone: "blue" | "emerald" | "cyan" | "amber" | "orange" | "red";
};

const STORAGE_KEY = "tamagotchy_genetic_v1";
const DIFF: Record<Difficulty, number> = { Chill: 0.7, Standard: 1, Hard: 1.4 };

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function genomeToCodons(sequence: string) {
  const codons: string[] = [];
  for (let i = 0; i + 3 <= sequence.length; i += 3) {
    codons.push(sequence.substring(i, i + 3));
  }
  return codons;
}

function translateCodons(codons: string[]) {
  const protein: string[] = [];
  for (const codon of codons) {
    const aa = TAMAOS_CODE[codon];
    if (aa === "STOP") break;
    protein.push(aa ?? "X");
  }
  return protein;
}

function generateGenomeFromSeed(seed: number, type: Pet["genomeType"]) {
  const rng = seededRandom(seed);
  const baseGenome = type === "blue" ? BLUE_GENOME : RED_GENOME;
  const mutated = baseGenome.split("");
  const mutationRate = 0.02;
  const bases: Array<"A" | "T" | "G" | "C"> = ["A", "T", "G", "C"];

  for (let i = 0; i < mutated.length; i += 1) {
    if (rng() < mutationRate) {
      mutated[i] = bases[Math.floor(rng() * 4)];
    }
  }

  return mutated.join("");
}

function decodeTraitsFromProtein(protein: string[]): Traits {
  const signature = protein.slice(0, 20).join("");
  let hash = 0;
  for (let i = 0; i < signature.length; i += 1) {
    hash = ((hash << 5) - hash + signature.charCodeAt(i)) | 0;
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    const shift = (i * 2) % 16;
    bytes[i] = (hash >> shift) & 0xff;
  }

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

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pct(value: number) {
  return Math.round(clamp(value));
}

function fmtAge(ms: number) {
  const day = 24 * 3_600_000;
  const days = Math.floor(ms / day);
  const hours = Math.floor((ms % day) / 3_600_000);
  return `${days}d ${hours}h`;
}

function seeded(seed: number) {
  let x = Math.sin(seed) * 10_000;
  return () => {
    x = Math.sin(x) * 10_000;
    return x - Math.floor(x);
  };
}

function createDefaultPet(overrides?: Partial<Pet>): Pet {
  const now = Date.now();
  const base: Pet = {
    name: "Mossy",
    hunger: 75,
    fun: 75,
    hygiene: 75,
    energy: 75,
    xp: 0,
    level: 1,
    bornAt: now,
    lastTick: now,
    isAsleep: false,
    genomeType: "blue",
    genomeSeed: now,
    generation: 1,
    evolutions: 0,
    species: "Blue Gen I",
  };

  const merged: Pet = {
    ...base,
    ...overrides,
  };

  if (!overrides?.species) {
    merged.species = `${
      merged.genomeType === "blue" ? "Blue" : "Red"
    } Gen ${merged.generation}`;
  }

  return merged;
}

const DEFAULT_SETTINGS: SettingsState = {
  sound: false,
  neonGrid: false,
  ouroborosSkin: true,
  tickMs: 1000,
  decayRate: 0.8,
  difficulty: "Standard",
};

export default function Tamagotchy() {
  const [pet, setPet] = useState<Pet>(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return createDefaultPet();
    try {
      const parsed = JSON.parse(raw).pet as Partial<Pet> | undefined;
      return createDefaultPet(parsed ?? {});
    } catch {
      return createDefaultPet();
    }
  });

  const [settings, setSettings] = useState<SettingsState>(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw).settings as Partial<SettingsState> | undefined;
      return { ...DEFAULT_SETTINGS, ...(parsed ?? {}) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  const [openSettings, setOpenSettings] = useState(false);
  const [showGenetics, setShowGenetics] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const genome = useMemo(
    () => generateGenomeFromSeed(pet.genomeSeed, pet.genomeType),
    [pet.genomeSeed, pet.genomeType],
  );
  const codons = useMemo(() => genomeToCodons(genome), [genome]);
  const protein = useMemo(() => translateCodons(codons), [codons]);
  const traits = useMemo(() => decodeTraitsFromProtein(protein), [protein]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pet, settings }));
  }, [pet, settings]);

  const pulse = useCallback((msg: string) => {
    setLog((prev) => [
      `${new Date().toLocaleTimeString()} — ${msg}`,
      ...prev.slice(0, 19),
    ]);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setPet((prev) => {
        const now = Date.now();
        const dt = Math.max(0, now - (prev.lastTick || now));
        const minutes = dt / 60_000;
        const diffMul = DIFF[settings.difficulty];
        const decay = settings.decayRate * diffMul;

        const sleepBoost = prev.isAsleep ? 1.6 : 1;
        const sleepShield = prev.isAsleep ? 0.7 : 1;

        const hunger = clamp(
          prev.hunger - 1.2 * decay * minutes * traits.hungerMod * sleepShield,
        );
        const fun = clamp(
          prev.fun - 1.0 * decay * minutes * traits.funMod * sleepShield,
        );
        const hygiene = clamp(
          prev.hygiene - 0.8 * decay * minutes * traits.hygieneMod * sleepShield,
        );
        const energy = clamp(
          prev.energy +
            0.9 * decay * minutes * traits.energyMod * sleepBoost -
            0.9 * decay * minutes * traits.energyMod * (prev.isAsleep ? 0 : 1),
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
          if (Math.random() < traits.mutationRate) {
            newGenomeSeed = prev.genomeSeed + Math.floor(Math.random() * 1000);
            evolved = true;
          }
          newEvolutions = prev.evolutions + 1;
          newSpecies = `${
            prev.genomeType === "blue" ? "Blue" : "Red"
          } Gen ${prev.generation} Evo ${newEvolutions}`;
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

    return () => clearInterval(timer);
  }, [settings.tickMs, settings.decayRate, settings.difficulty, traits, pulse]);

  const mood = useMemo<Mood>(() => {
    const { hunger, fun, hygiene, energy, isAsleep } = pet;
    const avg = (hunger + fun + hygiene + energy) / 4;
    if (isAsleep)
      return { key: "asleep", label: "Asleep", emoji: "😴", tone: "blue" };
    if (avg > 85)
      return { key: "ecstatic", label: "Ecstatic", emoji: "🤩", tone: "emerald" };
    if (avg > 70)
      return { key: "happy", label: "Happy", emoji: "😊", tone: "cyan" };
    if (avg > 50)
      return { key: "okay", label: "Okay", emoji: "🙂", tone: "amber" };
    if (avg > 30)
      return { key: "grumpy", label: "Grumpy", emoji: "😒", tone: "orange" };
    return { key: "critical", label: "Needs care", emoji: "🥺", tone: "red" };
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
      let hunger = p.hunger;
      let fun = p.fun;
      let hygiene = p.hygiene;
      let energy = p.energy;
      let xp = p.xp;

      if (kind === "feed") {
        hunger = clamp(p.hunger + 18 * traits.metabolism);
        hygiene = clamp(hygiene - 2);
        energy = clamp(energy + 4);
        xp += 1.5 * (1 + traits.xpBonus);
      }
      if (kind === "play") {
        fun = clamp(p.fun + 18);
        energy = clamp(energy - 8 * (1 - traits.resilience));
        hygiene = clamp(hygiene - 3);
        xp += 1.8 * (1 + traits.xpBonus);
      }
      if (kind === "clean") {
        hygiene = clamp(p.hygiene + 22);
        fun = clamp(fun - 2);
        xp += 1.2 * (1 + traits.xpBonus);
      }

      pulse(
        {
          feed: "Nom nom!",
          play: "Play time!",
          clean: "Fresh and shiny!",
          sleep: "Zzz",
        }[kind],
      );
      return { ...p, hunger, fun, hygiene, energy, xp };
    });
  };

  const reset = () => {
    const newSeed = Date.now();
    setPet(
      createDefaultPet({
        name: pet.name,
        genomeType: pet.genomeType,
        bornAt: Date.now(),
        lastTick: Date.now(),
        genomeSeed: newSeed,
        generation: pet.generation + 1,
        species: `${pet.genomeType === "blue" ? "Blue" : "Red"} Gen ${
          pet.generation + 1
        }`,
      }),
    );
    setLog([]);
    pulse(`New life begins ✨ Generation ${pet.generation + 1}`);
  };

  const switchGenomeType = () => {
    const newType: Pet["genomeType"] = pet.genomeType === "blue" ? "red" : "blue";
    setPet((p) => ({
      ...p,
      genomeType: newType,
      genomeSeed: Date.now(),
      species: `${newType === "blue" ? "Blue" : "Red"} Gen ${p.generation}`,
      evolutions: 0,
    }));
    pulse(`Switched to ${newType.toUpperCase()} genome lineage!`);
  };

  const copyGenome = () => {
    void navigator.clipboard.writeText(genome);
    pulse("Full genome sequence copied to clipboard!");
  };

  const rng = useMemo(
    () => seeded(pet.level * 13 + Math.floor(pet.xp)),
    [pet.level, pet.xp],
  );
  const blink = pet.isAsleep ? 0 : rng() > 0.8 ? 1 : 0;
  const vib =
    mood.key === "ecstatic"
      ? 1.3
      : mood.key === "happy"
      ? 0.9
      : mood.key === "critical"
      ? 2
      : 0.5;

  const bodyLightness = Math.min(95, traits.lightness + 10);
  const bodyColor = `hsl(${traits.hue} ${traits.saturation}% ${traits.lightness}%)`;
  const secondaryColor = `hsl(${(traits.hue + 40) % 360} ${traits.saturation}% ${bodyLightness}%)`;

  const neonGrid = settings.neonGrid ? (
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
      {neonGrid}

      <div className="mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Tamagotchy
            </h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${skin.chip} border`}>
              TamaOS Genetics
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="border border-white/10 bg-white/5 hover:bg-white/10"
              onClick={() => setShowGenetics((v) => !v)}
            >
              <Microscope className="mr-2 h-4 w-4" />
              Genetics
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="border border-white/10 bg-white/5 hover:bg-white/10"
              onClick={() => setOpenSettings((v) => !v)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/20"
              onClick={reset}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className={`relative overflow-hidden ${skin.rim} bg-white/5 backdrop-blur-sm`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <span className="font-semibold">{pet.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${skin.chip} border`}>
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
                    bodyColor={bodyColor}
                    secondaryColor={secondaryColor}
                    traits={traits}
                    neon={settings.neonGrid}
                    moodKey={mood.key}
                    rng={rng}
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
                {statusChips.map((chip, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${skin.chip} border`}
                  >
                    {chip.icon}
                    <span>{chip.text}</span>
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
                <UtensilsCrossed className="mr-2 h-4 w-4" /> Feed
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => act("play")}
              >
                <PartyPopper className="mr-2 h-4 w-4" /> Play
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => act("clean")}
              >
                <SprayCan className="mr-2 h-4 w-4" /> Clean
              </Button>
              <Button
                className="flex-1"
                variant={pet.isAsleep ? "destructive" : "ghost"}
                onClick={() => act("sleep")}
              >
                {pet.isAsleep ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {pet.isAsleep ? "Wake" : "Sleep"}
              </Button>
            </CardFooter>
          </Card>

          <Card className={`bg-white/5 ${skin.rim} xl:col-span-2`}>
            <CardHeader className="pb-2">
              <CardTitle>Genetic Analysis</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <Tabs defaultValue="activity" className="w-full">
                <TabsList className="grid w-full grid-cols-3 border-white/10 bg-black/20">
                  <TabsTrigger value="activity">Activity Log</TabsTrigger>
                  <TabsTrigger value="protein">Protein Sequence</TabsTrigger>
                  <TabsTrigger value="code">Genetic Code</TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="mt-4 space-y-4">
                  <div className="h-56 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-3 font-mono text-xs leading-relaxed">
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
                    Real genetic code from TamaOS research • Protein-driven traits • {codons.length} codons → {protein.length} amino acids
                  </div>
                </TabsContent>

                <TabsContent value="protein" className="mt-4 space-y-4">
                  <div className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                        <Microscope className="h-4 w-4" />
                        Translated Protein Sequence ({protein.length} residues)
                      </span>
                      <Button size="sm" variant="ghost" onClick={copyGenome}>
                        <Copy className="mr-1 h-3 w-3" /> Copy Genome
                      </Button>
                    </div>
                    <div className="h-48 overflow-y-auto font-mono text-xs leading-relaxed text-white/80">
                      {protein.slice(0, 60).map((aa, i) => (
                        <span
                          key={i}
                          className="mr-2 mb-1 inline-block rounded bg-white/5 px-1 py-0.5"
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
                    <div className="rounded-md border border-white/10 bg-black/20 p-3">
                      <div className="mb-2 text-xs font-semibold text-amber-300">
                        Genome Stats
                      </div>
                      <div className="space-y-1 text-xs text-white/70">
                        <div>
                          Type: <span className="font-semibold uppercase text-white">{pet.genomeType}</span>
                        </div>
                        <div>Length: {genome.length} bp</div>
                        <div>Codons: {codons.length}</div>
                        <div>Seed: {pet.genomeSeed}</div>
                      </div>
                    </div>

                    <div className="rounded-md border border-white/10 bg-black/20 p-3">
                      <div className="mb-2 text-xs font-semibold text-purple-300">
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
                    <Dna className="mr-2 h-4 w-4" /> Switch to {pet.genomeType === "blue" ? "RED" : "BLUE"} Genome Lineage
                  </Button>
                </TabsContent>

                <TabsContent value="code" className="mt-4 space-y-4">
                  <div className="mb-3 text-xs text-white/60">
                    TamaOS Genetic Code: Codon → Amino Acid mapping (from Blue Snake Studios research)
                  </div>
                  <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-2">
                    {Object.entries(TAMAOS_CODE).map(([codon, aa]) => (
                      <div
                        key={codon}
                        className="flex items-center justify-between rounded bg-white/5 p-2 font-mono text-xs transition hover:bg-white/10"
                      >
                        <span className="font-bold text-cyan-300">{codon}</span>
                        <span className="text-white/50">→</span>
                        <span
                          className={`font-semibold text-white/90 ${aa === "STOP" ? "text-red-400" : ""}`}
                        >
                          {aa}
                        </span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {showGenetics && (
                <div className="mt-4 space-y-3 rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                    <span className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Raw Genome Sequence
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto rounded bg-white/5 p-2 font-mono text-[10px] text-white/70">
                    {genome}
                  </div>
                  <div className="space-y-1 text-xs text-white/60">
                    <div className="font-bold text-white/80">Trait Modifiers (Protein-Derived)</div>
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
              <CardContent className="border-t border-white/10 pt-0">
                <div className="mt-4 space-y-3">
                  <label className="text-sm font-medium">Pet name</label>
                  <Input
                    value={pet.name}
                    onChange={(event) =>
                      setPet((p) => ({
                        ...p,
                        name: event.target.value.slice(0, 20),
                      }))
                    }
                    className="border-white/10 bg-white/5"
                  />

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      {settings.sound ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <VolumeX className="h-4 w-4" />
                      )}
                      Sound
                    </div>
                    <Switch
                      checked={settings.sound}
                      onCheckedChange={(value) =>
                        setSettings((s) => ({ ...s, sound: value }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4" /> Ouroboros skin
                    </div>
                    <Switch
                      checked={settings.ouroborosSkin}
                      onCheckedChange={(value) =>
                        setSettings((s) => ({ ...s, ouroborosSkin: value }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Swords className="h-4 w-4" /> Neon grid
                    </div>
                    <Switch
                      checked={settings.neonGrid}
                      onCheckedChange={(value) =>
                        setSettings((s) => ({ ...s, neonGrid: value }))
                      }
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
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
                        onChange={(event) =>
                          setSettings((s) => ({
                            ...s,
                            tickMs: clamp(
                              Number.parseInt(event.target.value || "1000", 10),
                              250,
                              2000,
                            ),
                          }))
                        }
                        className="h-8 w-28 border-white/10 bg-white/5"
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
                        onChange={(event) =>
                          setSettings((s) => ({
                            ...s,
                            decayRate: Number(event.target.value || 1),
                          }))
                        }
                        className="h-8 w-28 border-white/10 bg-white/5"
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
            Generation {pet.generation} • Evolutions {pet.evolutions}/
            {traits.maxEvolutions} • Powered by TamaOS Genetic Code
          </div>
        </footer>
      </div>
    </div>
  );
}

type PetSpriteProps = {
  bodyColor: string;
  secondaryColor: string;
  blink: number;
  traits: Traits;
  neon: boolean;
  moodKey: Mood["key"];
  rng: () => number;
};

function PetSprite({
  bodyColor,
  secondaryColor,
  blink,
  traits,
  neon,
  moodKey,
  rng,
}: PetSpriteProps) {
  return (
    <motion.svg
      viewBox="0 0 160 160"
      className="h-40 w-40 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
      initial={{ scale: 0.95 }}
      animate={{ scale: 1, rotate: neon ? Math.sin(Date.now() / 2000) * 0.5 : 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 12 }}
    >
      <defs>
        <radialGradient id="pet-gradient" cx="50%" cy="40%" r="60%">
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
          fill="url(#pet-gradient)"
          stroke="white"
          strokeOpacity="0.08"
          strokeWidth="2"
          animate={{ y: [0, -2, 0, 2, 0], rotate: [0, -1, 0, 1, 0] }}
          transition={{ duration: 3.5, repeat: Infinity }}
        />
      )}
      {traits.bodyShape === 1 && (
        <motion.circle
          cx="80"
          cy="85"
          r="55"
          fill="url(#pet-gradient)"
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
          fill="url(#pet-gradient)"
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
          <motion.rect x="55" y="73" width="10" height="4" rx="1" ry="1" fill="#0b1020" />
          <motion.rect x="95" y="73" width="10" height="4" rx="1" ry="1" fill="#0b1020" />
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
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />

      {traits.crestStyle === 0 && (
        <motion.path
          d="M75 38 C70 20 95 20 90 38"
          fill={secondaryColor}
          opacity={0.9}
          animate={{ y: [0, -2, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
      )}
      {traits.crestStyle === 1 && (
        <motion.circle
          cx="80"
          cy="35"
          r="12"
          fill={secondaryColor}
          opacity={0.9}
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
      )}
      {traits.crestStyle === 2 && (
        <motion.path
          d="M70 40 L75 25 L80 35 L85 20 L90 35 L95 25 L100 40"
          stroke={secondaryColor}
          strokeWidth={3}
          fill="none"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
      )}

      <AnimatePresence>
        {(moodKey === "ecstatic" || moodKey === "happy") && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {Array.from({ length: 7 }).map((_, index) => (
              <motion.circle
                key={index}
                cx={20 + rng() * 120}
                cy={20 + rng() * 120}
                r={1.5 + rng() * 1.5}
                fill={bodyColor}
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
}

type StatBarProps = {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "emerald" | "cyan" | "indigo" | "amber" | "red";
  modifier?: number;
};

function StatBar({ label, value, icon, tone = "cyan", modifier }: StatBarProps) {
  const color = {
    emerald: "from-emerald-400 to-emerald-600",
    cyan: "from-cyan-400 to-cyan-600",
    indigo: "from-indigo-400 to-indigo-600",
    amber: "from-amber-400 to-amber-600",
    red: "from-rose-400 to-rose-600",
  }[tone];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 opacity-80">
          {icon}
          <span>
            {label}
            {modifier !== undefined ? ` (${modifier.toFixed(2)}x)` : ""}
          </span>
        </div>
        <div className="tabular-nums opacity-80">{pct(value)}%</div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full border border-white/10 bg-white/5">
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color}`}
          style={{ width: `${pct(value)}%` }}
        />
      </div>
    </div>
  );
}
