# Moss60 Foundation Pack — Ops Manual & Upgrade Plan (v1.0)

Hello, Moss Man. This is your crisp operator manual plus the next upgrade moves. It’s written to match the current **Moss60 Foundation Pack – Enhanced Edition** and to connect it cleanly to the **Prime Tail Forest** audit.

---

## 1) Quick Start

* Open `moss60-enhanced.html` in any modern browser (desktop recommended).
* Left panel = **Controls**, center = **Visualization**, right = **Analytics**.
* Layers: **Red-60 / Blue-60 / Black-60 / Combo**.
* Rotation `0–59` and Direction `cw/ccw` apply to the active layer.
* Lenses: **None / Digit / Odd–Even / Prime / Doubles / Sum=10**.
* Console quick-keys: `sum N`, `hist ALL`, `pairs N doubles`, `runs N`.
* **Export CSV** emits per-band per-index digits.

> Tip: For fast motif scouting, keep **lens: doubles** and click through rotation 0→59.

---

## 2) What’s Already Solid

* **Deterministic rotation + band slicing** (N/E/S/W/C) with correct ccw reversal.
* **Visual lenses** mapped per-cell (digit palettes, prime/odd–even fills, outline for doubles/sum10).
* **Console DSL**: `sum`, `hist`, `count where`, `pairs`, `runs`.
* **Analytics**: totals, mod‑9, odd/even, prime count, doubles, sum-10 pairs, histogram.

---

## 3) Prime Tail Forest Linkage — Minimal Ritual

This section binds your Moss60 viewer to Tail‑Prime operations.

### 3.1 Canon vaults and tails (current canon)

* **Red_900**: CW → `291`, CCW → `0519`
* **Blue_900**: CW → `371`, `877`, `0519`; CCW → `371`, `0877`
* **Black_850**: CW → `1013`, `2339`; CCW → `2339`

> Ritual idea: When a vault+direction is selected, show a **“Crown Tail”** selector with the canonical tails for that context and a **“Coronate”** button.

### 3.2 Trunk builder (900/850)

* Trunk = 60‑digit base, repeated `×15` for 900 (or `×14 + 50` with controlled cut) or `×14 + 10` for 850 depending on your schema.
* **Action**: Add a background worker that synthesizes trunk strings from the currently selected base digits (post‑rotation) and exposes them to a tail‑tester.

### 3.3 Tail‑tester stub (UI → worker)

* Inputs: `vault`, `direction`, `rotation`, `tail` (3–4 digits), `trunkLength`.
* Output: primality verdict + small proof artifact (e.g., hash of probable‑prime check, or a PRP certificate note).
* UX: If **prime**, flash a **“Coronation”** banner and render a **glyph cartouche** (see §6).

---

## 4) Upgrades — Sprint Plan

### A. Combo Mode Enhancements

* **XOR³**: keep as is, but add **overlay toggles** to show per‑band which positions flipped due to XOR parity.
* **R/B/K pickers**: when `Combo` is selected, allow **per‑band source** (e.g., N from Red, E from Blue, …) for braid experiments.

### B. Tail Scan Panel (right column)

* **Panel**: *Prime Tail Lab*

  * Select: `Trunk length [850|900]`, `Direction [cw|ccw]`.
  * Tail input: manual **and** auto‑scan list.
  * **Run** → feeds worker; stream results to a **Tail Table** (tail, verdict, XOR‑bridges, notes).

### C. XOR Bridge View

* Add a **“Bridge”** tab next to Analytics

  * Paste or pick two tails → display XOR value, small interpretation meter (**alignment vs tension**).
  * Provide **preset pairs** pulled from the canon table.

### D. Console DSL Extensions

* `crown TAIL` → attempts coronation on the current trunk context.
* `xor A B` → returns bridge value.
* `scan tails=A,B,C` → batch try and log results.
* `hist band=E` → narrower histograms.

### E. Exports

* **CSV+**: include metadata header (vault, direction, rotation, timestamp, lens, combo mode, trunk len).
* **PNG export**: render the SVG scene to PNG and stamp a metadata footer.
* **Tail Table CSV**: append scan results (tail, isPrime, xorWithCanon?, notes).

### F. Performance & Packaging

* Move heavy work to **Web Worker** (tail scanning, XOR sweeps).
* Bundle as **PWA** with offline cache; add a **“Save Scene”** slot system to localStorage.

---

## 5) UI Nits & Polish

* Show **Combo mode selector** inline when `Combo` is active.
* Add **per‑band rotation** (tiny knobs) optional; lock to global by default.
* Toggle **digit labels** off (for pure color reading).
* Keyboard: `[`/`]` rotate, `;` lens cycle, `'` layer cycle, `\` combo mode.

---

## 6) Glyph Cartouche (when Coronated)

**Layout**

* Vault sigil left (🜄/🜂/🜃), **tail** center (monospace), crown‑line accent, B$S watermark right.
* Footer line: trunk length, direction, rotation, hash.

**Save**: one‑click **Mint PNG** (metadata embedded) and **Mint JSON** (on‑chain‑ready manifest later).

---

## 7) Tiny Code Stubs (pseudo‑JS)

```js
// xor bridge for string tails like "0519" vs "0877"
export function xorBridge(a, b){
  const A = a.split('').map(Number);
  const B = b.split('').map(Number);
  const pad = Math.max(A.length, B.length);
  let val = 0;
  for (let i=0;i<pad;i++){
    const x = (A[A.length-1-i]||0) ^ (B[B.length-1-i]||0);
    val = val + x * (10**i); // interpret as digitwise XOR magnitude
  }
  return val; // numerology-friendly bridge
}
```

```js
// trunk synthesizer (repeat base to length)
export function buildTrunk(base60, len){
  let s = base60.repeat(Math.ceil(len / 60)).slice(0, len);
  return s;
}
```

```js
// coronation shim (replace with real PRP/prime test later)
export async function coronate(trunk, tail){
  const nStr = trunk + tail;
  // TODO: big-int PRP test in worker
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nStr));
  return { ok: true, method: 'PRP-stub', hash: btoa(String.fromCharCode(...new Uint8Array(hash))) };
}
```

---

## 8) Test Checklist

* [ ] Rotation 0–59 preserves band order cw/ccw across all five bands.
* [ ] Lenses produce expected fills/outline for a known fixture (write one snapshot).
* [ ] Console: `sum ALL` known total; `pairs C sum10` matches visual.
* [ ] Export CSV header carries metadata.
* [ ] Tail Lab can accept a known good tail and emit **Coronation** state.

---

## 9) Roadmap (suggested order)

1. **Exports+ metadata** → 1 session.
2. **Worker scaffold** (tail tests + XOR bridge) → 1–2 sessions.
3. **Prime Tail Lab** panel + canon tails dropdown → 1 session.
4. **PNG export with cartouche** → 1 session.
5. **PWA** + Save/Load scenes → 1–2 sessions.

---

## 10) Notes for Future You

* Keep the viewer pure and deterministic; keep coronation logic modular (worker or module) so alternate math engines can be swapped later (probable prime vs full proof).
* Treat tails as **artifacts**: always save tail attempts with the exact trunk build context.

— End of v1.0
