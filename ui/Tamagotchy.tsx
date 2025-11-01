import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  Gauge,
  Settings,
  Clock,
  Shield,
  Zap,
  Dna,
  Copy,
  Upload,
  Archive,
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

const BASE60_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function generateGenome(seed: number) {
  const rng = seededRandom(seed);
  return Array.from({ length: 16 }, () => Math.floor(rng() * 256));
}

function genomeToBase60(bytes: number[]) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  if (value === 0n) return BASE60_ALPHABET[0].repeat(22);
  let result = "";
  while (value > 0n) {
    result = BASE60_ALPHABET[Number(value % 60n)] + result;
    value = value / 60n;
  }
  return result.padStart(22, BASE60_ALPHABET[0]);
}

function base60ToGenome(str: string) {
  let value = 0n;
  for (const char of str) {
    const idx = BASE60_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error("Invalid base60 character");
    value = value * 60n + BigInt(idx);
  }
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    bytes.unshift(Number(value & 0xffn));
    value = value >> 8n;
  }
  return bytes;
}

function mutateGenome(genome: number[], rate: number) {
  const mutated = [...genome];
  for (let i = 0; i < mutated.length; i++) {
    if (Math.random() < rate) {
      const flip = Math.floor(Math.random() * 8);
      mutated[i] ^= 1 << flip;
    }
  }
  return mutated;
}

const CODON_TABLE: Record<string, string> = {
  TTT: "F",
  TTC: "F",
  TTA: "L",
  TTG: "L",
  CTT: "L",
  CTC: "L",
  CTA: "L",
  CTG: "L",
  ATT: "I",
  ATC: "I",
  ATA: "I",
  ATG: "M",
  GTT: "V",
  GTC: "V",
  GTA: "V",
  GTG: "V",
  TCT: "S",
  TCC: "S",
  TCA: "S",
  TCG: "S",
  CCT: "P",
  CCC: "P",
  CCA: "P",
  CCG: "P",
  ACT: "T",
  ACC: "T",
  ACA: "T",
  ACG: "T",
  GCT: "A",
  GCC: "A",
  GCA: "A",
  GCG: "A",
  TAT: "Y",
  TAC: "Y",
  TAA: "*",
  TAG: "*",
  CAT: "H",
  CAC: "H",
  CAA: "Q",
  CAG: "Q",
  AAT: "N",
  AAC: "N",
  AAA: "K",
  AAG: "K",
  GAT: "D",
  GAC: "D",
  GAA: "E",
  GAG: "E",
  TGT: "C",
  TGC: "C",
  TGA: "*",
  TGG: "W",
  CGT: "R",
  CGC: "R",
  CGA: "R",
  CGG: "R",
  AGT: "S",
  AGC: "S",
  AGA: "R",
  AGG: "R",
  GGT: "G",
  GGC: "G",
  GGA: "G",
  GGG: "G",
};

const HYDROPHILIC = new Set([
  "R",
  "N",
  "D",
  "C",
  "E",
  "Q",
  "G",
  "H",
  "K",
  "S",
  "T",
  "Y",
]);

type BioStats = {
  length_bp: number;
  gc: number;
  gc3: number;
  at3: number;
  stops_frac: number;
  entropy: number;
  unique_codons_frac: number;
  top_codons: Array<{ codon: string; freq: number }>;
  top_aas: Array<{ aa: string; freq: number }>;
};

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
  genome: number[];
  genomeSeed: number;
  generation: number;
  evolutions: number;
  species: string;
};

type Settings = {
  sound: boolean;
  neonGrid: boolean;
  ouroborosSkin: boolean;
  tickMs: number;
  decayRate: number;
  difficulty: Difficulty;
};

function stripATGC(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^ATGC]/g, "");
}

function parseFASTAorPlain(raw: string): string {
  const t = raw.trim();
  if (t.startsWith(">"))
    return stripATGC(
      t
        .split(/\r?\n/)
        .filter((ln) => !ln.startsWith(">"))
        .join("")
    );
  return stripATGC(raw);
}

function codonizeSeq(seq: string) {
  const n = Math.floor(seq.length / 3) * 3;
  const body = seq.slice(0, n);
  const out: string[] = [];
  for (let i = 0; i < body.length; i += 3) out.push(body.slice(i, i + 3));
  return out;
}

function freqMap(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) || 0) + 1);
  return m;
}

function entropy64(codonFreq: Map<string, number>): number {
  const total = Array.from(codonFreq.values()).reduce((a, b) => a + b, 0) || 1;
  let H = 0;
  for (const v of codonFreq.values()) {
    const p = v / total;
    H += -p * Math.log2(p);
  }
  return H / Math.log2(64);
}

function aaFreqFromCodons(codonFreq: Map<string, number>): Map<string, number> {
  const total = Array.from(codonFreq.values()).reduce((a, b) => a + b, 0) || 1;
  const m = new Map<string, number>();
  for (const [codon, cnt] of codonFreq.entries()) {
    const aa = CODON_TABLE[codon] || "?";
    m.set(aa, (m.get(aa) || 0) + cnt / total);
  }
  return m;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function scaleByte01(x: number) {
  return Math.round(clamp01(x) * 255);
}

function modByteForRange(val: number) {
  return Math.round(clamp01((val - 0.85) / 0.3) * 255);
}

function deriveGenomeFromSequence(seq: string): {
  bytes: number[];
  stats: BioStats;
  base60: string;
} {
  const length_bp = seq.length;
  const codons = codonizeSeq(seq);
  const cm = freqMap(codons);
  const totalCodons = codons.length || 1;
  const A = (seq.match(/A/g) || []).length;
  const T = (seq.match(/T/g) || []).length;
  const G = (seq.match(/G/g) || []).length;
  const C = (seq.match(/C/g) || []).length;
  const gc = (G + C) / Math.max(1, length_bp);
  let gc3n = 0;
  let at3n = 0;
  for (let i = 2; i < seq.length; i += 3) {
    const b = seq[i];
    if (b === "G" || b === "C") gc3n++;
    else if (b === "A" || b === "T") at3n++;
  }
  const denom3 = gc3n + at3n || 1;
  const gc3 = gc3n / denom3;
  const at3 = at3n / denom3;
  const stops =
    (cm.get("TAA") || 0) + (cm.get("TAG") || 0) + (cm.get("TGA") || 0);
  const stops_frac = stops / totalCodons;
  const uniq = cm.size;
  const unique_codons_frac = uniq / 64;
  const H = entropy64(cm);
  const codonEntries = Array.from(cm.entries()).sort((a, b) => b[1] - a[1]);
  const top_codons = codonEntries
    .slice(0, 5)
    .map(([codon, cnt]) => ({ codon, freq: cnt / totalCodons }));
  const aaFreq = aaFreqFromCodons(cm);
  const top_aas = Array.from(aaFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([aa, freq]) => ({ aa, freq }));
  const hyd = Array.from(aaFreq.entries())
    .filter(([aa]) => HYDROPHILIC.has(aa))
    .reduce((s, [, f]) => s + f, 0);
  const bytes = new Array(16).fill(0);
  bytes[0] = scaleByte01(gc);
  bytes[1] = scaleByte01((A + T) / Math.max(1, length_bp));
  bytes[2] = scaleByte01(gc3);
  bytes[3] = Math.floor(stops_frac * 1000) % 4;
  bytes[4] = scaleByte01(H);
  bytes[5] = Math.floor(hyd * 1000) % 3;
  const hungerMod = 0.85 + 0.3 * (1 - gc);
  const funMod = 0.85 + 0.3 * H;
  const hygieneMod = 0.85 + 0.3 * hyd;
  const energyMod = 0.85 + 0.3 * at3;
  bytes[6] = modByteForRange(hungerMod);
  bytes[7] = modByteForRange(funMod);
  bytes[8] = modByteForRange(hygieneMod);
  bytes[9] = modByteForRange(energyMod);
  const xpBonus01 = unique_codons_frac;
  const resilience01 = gc;
  const metabolism01 = (A + T) / Math.max(1, length_bp);
  bytes[10] = scaleByte01(xpBonus01);
  bytes[11] = scaleByte01(resilience01);
  bytes[12] = scaleByte01(metabolism01);
  const thr = 20 + Math.floor(clamp01(codons.length / 500) * 15);
  bytes[13] = Math.round(((thr - 20) / 15) * 255);
  const mutation01 = clamp01(1 - H);
  bytes[14] = scaleByte01(mutation01);
  bytes[15] = unique_codons_frac > 0.75 ? 2 : unique_codons_frac > 0.5 ? 1 : 0;
  const base60 = genomeToBase60(bytes);
  const stats: BioStats = {
    length_bp,
    gc,
    gc3,
    at3,
    stops_frac,
    entropy: H,
    unique_codons_frac,
    top_codons,
    top_aas,
  };
  return { bytes, stats, base60 };
}
function decodeTraits(genome: number[]) {
  const g = genome;
  return {
    hue: (g[0] / 255) * 360,
    saturation: 50 + (g[1] / 255) * 30,
    lightness: 30 + (g[2] / 255) * 30,
    patternType: g[3] % 4,
    patternIntensity: g[4] / 255,
    crestStyle: g[5] % 3,
    hungerMod: 0.85 + (g[6] / 255) * 0.3,
    funMod: 0.85 + (g[7] / 255) * 0.3,
    hygieneMod: 0.85 + (g[8] / 255) * 0.3,
    energyMod: 0.85 + (g[9] / 255) * 0.3,
    xpBonus: (g[10] / 255) * 0.5,
    resilience: (g[11] / 255) * 0.3,
    metabolism: 0.85 + (g[12] / 255) * 0.3,
    evolutionThreshold: 20 + Math.floor((g[13] / 255) * 15),
    mutationRate: (g[14] / 255) * 0.15,
    maxEvolutions: 2 + (g[15] % 3),
  } as const;
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

const STORAGE_KEY = "tamagotchy_v2";
const DIFF = { Chill: 0.7, Standard: 1.0, Hard: 1.4 } as const;

function createDefaultPet(overrides?: Partial<Pet>): Pet {
  const now = Date.now();
  const seed = overrides?.genomeSeed ?? now;
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
    genomeSeed: seed,
    genome: generateGenome(seed),
    generation: 1,
    evolutions: 0,
    species: "Gen I",
  };
  return { ...base, ...overrides };
}

const DEFAULT_SETTINGS: Settings = {
  sound: false,
  neonGrid: false,
  ouroborosSkin: true,
  tickMs: 1000,
  decayRate: 0.8,
  difficulty: "Standard",
};

function exportSave({
  pet,
  settings,
  pulse,
}: {
  pet: Pet;
  settings: Settings;
  pulse: (m: string) => void;
}) {
  const payload = JSON.stringify({ pet, settings }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tamagotchy-save-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  pulse("Save exported");
}

function importSave({
  setPet,
  setSettings,
  pulse,
}: {
  setPet: React.Dispatch<React.SetStateAction<Pet>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  pulse: (m: string) => void;
}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.pet) setPet((p) => ({ ...p, ...data.pet }));
      if (data.settings) setSettings((s) => ({ ...s, ...data.settings }));
      pulse("Save imported");
    } catch {
      pulse("Failed to import save");
    }
  };
  input.click();
}

function wipeSave({
  setPet,
  setSettings,
  pulse,
}: {
  setPet: React.Dispatch<React.SetStateAction<Pet>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  pulse: (m: string) => void;
}) {
  localStorage.removeItem(STORAGE_KEY);
  setPet(createDefaultPet());
  setSettings({ ...DEFAULT_SETTINGS });
  pulse("Save wiped");
}
export default function Tamagotchy() {
  const [pet, setPet] = useState<Pet>(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return createDefaultPet();
    try {
      const parsed = JSON.parse(raw).pet as Pet;
      return createDefaultPet({
        ...parsed,
        genome: parsed.genome || generateGenome(Date.now()),
      });
    } catch {
      return createDefaultPet();
    }
  });

  const [settings, setSettings] = useState<Settings>(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw).settings as Settings) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  const [openSettings, setOpenSettings] = useState(false);
  const [showDNA, setShowDNA] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [draftName, setDraftName] = useState(pet.name);
  const [bioStats, setBioStats] = useState<BioStats | null>(null);
  const [base60FromATGC, setBase60FromATGC] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const traits = useMemo(() => decodeTraits(pet.genome), [pet.genome]);
  const genomeString = useMemo(() => genomeToBase60(pet.genome), [pet.genome]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pet, settings }));
  }, [pet, settings]);

  const pulse = useCallback((msg: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev.slice(0, 49)]);
  }, []);

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
          prev.hunger - 1.2 * k * minutes * traits.hungerMod * sleepShield
        );
        const fun = clamp(prev.fun - 1.0 * k * minutes * traits.funMod * sleepShield);
        const hygiene = clamp(
          prev.hygiene - 0.8 * k * minutes * traits.hygieneMod * sleepShield
        );
        const energy = clamp(
          prev.energy +
            0.9 * k * minutes * traits.energyMod * sleepBoost -
            0.9 * k * minutes * traits.energyMod * (prev.isAsleep ? 0 : 1)
        );
        const xpGain = 0.25 * minutes * (1 + traits.xpBonus);
        const xp = prev.xp + xpGain;
        const level = 1 + Math.floor(xp / 25);
        let newGenome = prev.genome;
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
            newGenome = mutateGenome(prev.genome, 0.08);
            evolved = true;
          }
          newEvolutions = prev.evolutions + 1;
          newSpecies = `Gen ${prev.generation} Evo ${newEvolutions}`;
        }
        if (evolved)
          setTimeout(
            () => pulse(`✨ Evolution! ${prev.name} mutated into ${newSpecies}!`),
            0
          );
        return {
          ...prev,
          hunger,
          fun,
          hygiene,
          energy,
          xp,
          level,
          lastTick: now,
          genome: newGenome,
          evolutions: newEvolutions,
          species: newSpecies,
        } as Pet;
      });
    }, settings.tickMs);
    return () => clearInterval(t);
  }, [settings.tickMs, settings.decayRate, settings.difficulty, traits, pulse]);

  const mood = useMemo(() => {
    const { hunger, fun, hygiene, energy, isAsleep } = pet;
    const avg = (hunger + fun + hygiene + energy) / 4;
    if (isAsleep)
      return { key: "asleep", label: "Asleep", emoji: "😴", tone: "blue" } as const;
    if (avg > 85)
      return { key: "ecstatic", label: "Ecstatic", emoji: "🤩", tone: "emerald" } as const;
    if (avg > 70)
      return { key: "happy", label: "Happy", emoji: "😊", tone: "cyan" } as const;
    if (avg > 50)
      return { key: "okay", label: "Okay", emoji: "🙂", tone: "amber" } as const;
    if (avg > 30)
      return { key: "grumpy", label: "Grumpy", emoji: "😒", tone: "orange" } as const;
    return { key: "critical", label: "Needs care", emoji: "🥺", tone: "red" } as const;
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

      pulse(
        { feed: "Nom nom!", play: "Play time!", clean: "Fresh and shiny!", sleep: "Zzz" }[
          kind
        ]
      );
      return { ...p, hunger: h, fun: f, hygiene: hy, energy: e, xp } as Pet;
    });
  };

  const reset = () => {
    const newSeed = Date.now();
    setPet(
      createDefaultPet({
        name: draftName || "Mossy",
        genomeSeed: newSeed,
        genome: generateGenome(newSeed),
        generation: pet.generation + 1,
        species: `Gen ${pet.generation + 1}`,
      })
    );
    setLog([]);
    pulse("New life begins ✨ Generation " + (pet.generation + 1));
  };

  const copyDNA = () => {
    navigator.clipboard.writeText(genomeString);
    pulse("Genome copied to clipboard!");
  };

  const onATGCFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const seq = parseFASTAorPlain(raw);
      if (!seq || seq.length < 3) {
        pulse("No ATGC found in file.");
        return;
      }
      const { bytes, stats, base60 } = deriveGenomeFromSequence(seq);
      setPet((p) => ({
        ...p,
        genome: bytes,
        evolutions: 0,
        species: `Gen ${p.generation} Imported (ATGC)`,
      }));
      setBioStats(stats);
      setBase60FromATGC(base60);
      pulse(`Loaded ${seq.length}bp ATGC → DNA updated.`);
    } catch {
      pulse("Failed to load ATGC file.");
    }
  };

  const onZipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      let bestSeq = "";
      await Promise.all(
        Object.keys(zip.files).map(async (name) => {
          const lower = name.toLowerCase();
          if (!/\.fa(sta)?$|\.txt$/.test(lower)) return;
          const content = await zip.files[name].async("string");
          const seq = parseFASTAorPlain(content);
          if (seq.length > bestSeq.length) bestSeq = seq;
        })
      );
      if (bestSeq.length < 3) {
        pulse("No usable ATGC found in ZIP.");
        return;
      }
      const { bytes, stats, base60 } = deriveGenomeFromSequence(bestSeq);
      setPet((p) => ({
        ...p,
        genome: bytes,
        evolutions: 0,
        species: `Gen ${p.generation} Imported (ZIP)`,
      }));
      setBioStats(stats);
      setBase60FromATGC(base60);
      pulse(`Loaded ZIP ATGC (${bestSeq.length}bp) → DNA updated.`);
    } catch {
      pulse("Failed to read ZIP (need a .fa/.fasta/.txt inside).");
    }
  };

  const importDNA = () => {
    const inputStr = prompt("Enter genome string (base60):");
    if (!inputStr) return;
    try {
      const newGenome = base60ToGenome(inputStr.trim());
      setPet((p) => ({
        ...p,
        genome: newGenome,
        evolutions: 0,
        species: `Gen ${p.generation} Imported`,
      }));
      pulse("Genome imported successfully!");
    } catch {
      pulse("Failed to import genome: Invalid format");
    }
  };

  const forceMutate = () => {
    setPet((p) => ({
      ...p,
      genome: mutateGenome(p.genome, 0.15),
      evolutions: p.evolutions + 1,
      species: `Gen ${p.generation} Mutant`,
    }));
    pulse("⚡ Forced mutation applied!");
  };

  const rng = useMemo(() => seeded(pet.level * 13 + Math.floor(pet.xp)), [
    pet.level,
    pet.xp,
  ]);
  const blink = pet.isAsleep ? 0 : rng() > 0.8 ? 1 : 0;
  const vib =
    mood.key === "ecstatic" ? 1.3 : mood.key === "happy" ? 0.9 : mood.key === "critical" ? 2.0 : 0.5;

  const bodyColor = `hsl(${traits.hue} ${traits.saturation}% ${traits.lightness}%)`;
  const secondaryColor = `hsl(${(traits.hue + 40) % 360} ${traits.saturation}% ${Math.min(
    95,
    traits.lightness + 10
  )}%)`;
  return (
    <div
      className={`relative min-h-[100svh] w-full bg-gradient-to-b ${skin.bg} selection:bg-cyan-400/20 ${skin.ink}`}
    >
      {settings.neonGrid && <NeonGridLayer />}

      <div className="mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Tamagotchy</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${skin.chip} border`}>
              DNA v2
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/5 hover:bg-white/10 border border-white/10"
              onClick={() => setShowDNA((v) => !v)}
            >
              <Dna className="h-4 w-4 mr-2" />
              Genome
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
                    bodyColor={bodyColor}
                    secondaryColor={secondaryColor}
                    blink={blink}
                    traits={traits}
                    neon={settings.neonGrid}
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
              <Button className="flex-1" variant="secondary" onClick={() => act("play")}>
                <PartyPopper className="h-4 w-4 mr-2" /> Play
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => act("clean")}>
                <SprayCan className="h-4 w-4 mr-2" /> Clean
              </Button>
              <Button
                className="flex-1"
                variant={pet.isAsleep ? "destructive" : "ghost"}
                onClick={() => act("sleep")}
              >
                {pet.isAsleep ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {pet.isAsleep ? "Wake" : "Sleep"}
              </Button>
            </CardFooter>
          </Card>

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
                  DNA-driven evolution • Stats affected by genome • Mutations can occur at level {traits.evolutionThreshold}
                </div>

                {showDNA && (
                  <div className="mt-3 rounded-md border border-white/10 p-3 bg-black/20 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                      <span className="flex items-center gap-2">
                        <Dna className="h-4 w-4" /> Genome Code
                      </span>
                      <button onClick={copyDNA} className="text-white/70 hover:text-white">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="font-mono text-xs text-white/80 break-all bg-white/5 p-2 rounded">
                      {genomeString}
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                      <button
                        onClick={importDNA}
                        className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10"
                      >
                        Import DNA
                      </button>
                      <button
                        onClick={forceMutate}
                        className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30"
                      >
                        Force Mutate
                      </button>
                      <button
                        onClick={() => exportSave({ pet, settings, pulse })}
                        className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30"
                      >
                        Export Save
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2 py-1 rounded bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 flex items-center justify-center gap-1"
                      >
                        <Upload className="h-3 w-3" /> Load ATGC
                      </button>
                      <button
                        onClick={() => zipInputRef.current?.click()}
                        className="px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 flex items-center justify-center gap-1"
                      >
                        <Archive className="h-3 w-3" /> Load ZIP
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".fa,.fasta,.txt"
                      className="hidden"
                      onChange={onATGCFileChange}
                    />
                    <input
                      ref={zipInputRef}
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={onZipFileChange}
                    />

                    <div className="text-xs text-white/60 space-y-1">
                      <div>XP Bonus: +{Math.round(traits.xpBonus * 100)}%</div>
                      <div>Resilience: {Math.round(traits.resilience * 100)}%</div>
                      <div>Metabolism: {Math.round(traits.metabolism * 100)}%</div>
                      <div>Next Evolution: Level {traits.evolutionThreshold}</div>
                      {base60FromATGC && (
                        <div className="mt-2">
                          <div className="text-cyan-300 font-semibold mb-1">
                            Derived Base‑60 (from ATGC)
                          </div>
                          <div className="font-mono text-[11px] bg-white/5 p-2 rounded break-all">
                            {base60FromATGC}
                          </div>
                        </div>
                      )}
                    </div>

                    {bioStats && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded border border-white/10 p-2 bg-white/5">
                          <div className="font-semibold text-white/80 mb-1">Genome Stats</div>
                          <div>Length: {bioStats.length_bp} bp</div>
                          <div>GC%: {(bioStats.gc * 100).toFixed(2)}%</div>
                          <div>GC3%: {(bioStats.gc3 * 100).toFixed(2)}%</div>
                          <div>AT3%: {(bioStats.at3 * 100).toFixed(2)}%</div>
                          <div>Stops: {(bioStats.stops_frac * 100).toFixed(2)}%</div>
                          <div>Entropy: {bioStats.entropy.toFixed(3)}</div>
                          <div>
                            Unique codons: {(bioStats.unique_codons_frac * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded border border-white/10 p-2 bg-white/5">
                          <div className="font-semibold text-white/80 mb-1">Top Codons & AAs</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-white/60 mb-1">Codons</div>
                              <ul className="space-y-0.5">
                                {bioStats.top_codons.map((t, i) => (
                                  <li key={i} className="font-mono">
                                    {t.codon} — {(t.freq * 100).toFixed(1)}%
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="text-white/60 mb-1">Amino acids</div>
                              <ul className="space-y-0.5">
                                {bioStats.top_aas.map((t, i) => (
                                  <li key={i} className="font-mono">
                                    {t.aa} — {(t.freq * 100).toFixed(1)}%
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Pet Name
                </label>
                <div className="flex gap-2">
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Name your pal"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => setPet((p) => ({ ...p, name: draftName }))}
                  >
                    Save
                  </Button>
                </div>

                <div className="text-xs text-white/60">Generation: {pet.generation}</div>
                <div className="text-xs text-white/60">Genome Seed: {pet.genomeSeed}</div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => importSave({ setPet, setSettings, pulse })}>
                    Import Save
                  </Button>
                  <Button variant="destructive" onClick={() => wipeSave({ setPet, setSettings, pulse })}>
                    Wipe Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {openSettings && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed right-4 top-20 z-50 w-[320px]"
          >
            <Card className={`shadow-2xl ${skin.rim} bg-white/10 backdrop-blur-md`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Row label="Sound">
                  <Switch
                    checked={settings.sound}
                    onCheckedChange={(v: boolean) =>
                      setSettings((s) => ({ ...s, sound: v }))
                    }
                  />
                </Row>
                <Row label="Neon Grid">
                  <Switch
                    checked={settings.neonGrid}
                    onCheckedChange={(v: boolean) =>
                      setSettings((s) => ({ ...s, neonGrid: v }))
                    }
                  />
                </Row>
                <Row label="Ouroboros Skin">
                  <Switch
                    checked={settings.ouroborosSkin}
                    onCheckedChange={(v: boolean) =>
                      setSettings((s) => ({ ...s, ouroborosSkin: v }))
                    }
                  />
                </Row>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>Difficulty</span>
                    <span className="text-white/60">{settings.difficulty}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(DIFF) as Difficulty[]).map((d) => (
                      <Button
                        key={d}
                        variant={settings.difficulty === d ? "default" : "secondary"}
                        onClick={() => setSettings((s) => ({ ...s, difficulty: d }))}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>

                <SliderRow
                  label={`Tick (${settings.tickMs}ms)`}
                  min={250}
                  max={2000}
                  step={50}
                  value={settings.tickMs}
                  onChange={(v) => setSettings((s) => ({ ...s, tickMs: v }))}
                />
                <SliderRow
                  label={`Decay (${settings.decayRate.toFixed(2)})`}
                  min={0.4}
                  max={1.2}
                  step={0.02}
                  value={settings.decayRate}
                  onChange={(v) => setSettings((s) => ({ ...s, decayRate: v }))}
                />

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSettings({ ...DEFAULT_SETTINGS })}
                  >
                    Defaults
                  </Button>
                  <Button onClick={() => setOpenSettings(false)}>Close</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
/********************
 * Presentational UI
 ********************/
function NeonGridLayer() {
  return (
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
  );
}

function PetSprite({
  bodyColor,
  secondaryColor,
  blink,
  traits,
  neon,
}: {
  bodyColor: string;
  secondaryColor: string;
  blink: number;
  traits: ReturnType<typeof decodeTraits>;
  neon: boolean;
}) {
  return (
    <motion.svg
      viewBox="0 0 160 160"
      className="w-40 h-40 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
      initial={{ scale: 0.95 }}
      animate={{ scale: 1, rotate: neon ? Math.sin(Date.now() / 2000) * 0.5 : 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 12 }}
    >
      <defs>
        <radialGradient id="pet-body" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={bodyColor} stopOpacity="0.9" />
          <stop offset="70%" stopColor={secondaryColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
        </radialGradient>
        {traits.patternType === 2 && (
          <pattern
            id="pet-stripes"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect
              width="5"
              height="10"
              fill={secondaryColor}
              opacity={traits.patternIntensity * 0.5}
            />
          </pattern>
        )}
      </defs>

      <motion.ellipse
        cx="80"
        cy="85"
        rx="55"
        ry="50"
        fill={traits.patternType === 2 ? "url(#pet-stripes)" : "url(#pet-body)"}
        stroke="white"
        strokeOpacity="0.08"
        strokeWidth="2"
        animate={{ y: [0, -2, 0, 2, 0], rotate: [0, -1, 0, 1, 0] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />

      {traits.patternType === 1 && (
        <>
          <circle
            cx="60"
            cy="70"
            r="8"
            fill={secondaryColor}
            opacity={traits.patternIntensity * 0.6}
          />
          <circle
            cx="100"
            cy="70"
            r="8"
            fill={secondaryColor}
            opacity={traits.patternIntensity * 0.6}
          />
          <circle
            cx="80"
            cy="95"
            r="10"
            fill={secondaryColor}
            opacity={traits.patternIntensity * 0.5}
          />
        </>
      )}

      <motion.circle cx="60" cy="75" r={blink ? 1.2 : 5} fill="#0b1020" />
      <motion.circle cx="100" cy="75" r={blink ? 1.2 : 5} fill="#0b1020" />

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
          strokeLinecap="round"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
      )}

      <AnimatePresence>
        {(traits.patternType === 0 || traits.patternIntensity > 0.6) && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {[...Array(6)].map((_, i) => (
              <motion.circle
                key={i}
                cx={30 + i * 18}
                cy={40 + ((i + 1) % 3) * 20}
                r={1.5 + (i % 3)}
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

function StatBar({
  label,
  value,
  icon,
  tone,
  modifier,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "emerald" | "cyan" | "indigo" | "amber" | "red";
  modifier?: number;
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
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color}`}
          style={{ width: `${pct(value)}%` }}
        />
      </div>
      {modifier !== undefined && (
        <div className="mt-1 text-[10px] text-white/50">Modifier ×{modifier.toFixed(2)}</div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span>{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-white/60">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </div>
  );
}


