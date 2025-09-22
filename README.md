# 🐍 TamaOS — Blue $nake Studio Experiment

TamaOS is a Tamagotchi-inspired agent that lives inside a small, self-contained
operating system.  The project blends a toy kernel, symbolic ASCII skins, and a
"century life" progression clock so that every interaction ripples through the
creature's stats and memories.

## ✨ Highlights

- **Sandbox Kernel** – Message bus with addressable devices (`tablet.*`,
  `net.*`) and a minimal REPL for dispatching events.
- **Lattice Memory** – Mirror ◈, Shard ><, and Flux ⟡ channels form a geometric
  sheet that remembers how the agent was nurtured.
- **Century Life** – Virtual time maps a 100-year lifespan onto real seconds
  (configurable) with stages: Seed → Sprout → Bloom → Elder → Legacy.
- **Symbolic Skins** – ASCII avatars respond to the dominant lattice channel and
  overlay aura, mood, hunger, and energy descriptors.
- **Persistent Universe** – State and the knowledge stream are saved to a
  directory-backed virtual filesystem so the agent resumes where it left off.

## 🚀 Getting Started

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python tamaos.py
```

By default the OS stores state under `./vfs` and logs under `./logs`.  Configure
paths or timing via environment variables (`.env` files are supported thanks to
`python-dotenv`).  See `config.py` for the full list:

- `CENTURY_REAL_SEC` – real seconds that map to 100 virtual years (default: 30 days)
- `BURST_CAP_PER_HOUR` – maximum nourishment that can be delivered within a
  single virtual hour.
- `STASIS_FILL_RATE` / `STASIS_MAX_HOURS` – govern the temporal stasis buffer.
- `VFS_PATH`, `LOG_PATH`, `SKIN_MODE` – filesystem and presentation options.

## 🕹️ Shell Commands

Running `python tamaos.py` opens an interactive shell:

```
TamaOS shell — type 'help' for guidance.
```

Available commands:

| Command | Description |
| --- | --- |
| `post <device.endpoint> {json}` | Send payloads to devices (`tablet.feed`, `tablet.teach`, `net.add`). |
| `tick [hours]` | Advance the virtual clock, applying hunger/energy drift. |
| `observe` | Display a structured summary and the current ASCII skin. |
| `stream [limit]` | Tail the persisted knowledge/event stream. |
| `exit` / `quit` | Leave the shell. |

Example session:

```
post tablet.feed {"number":"13031"}   # nourish via palindrome → Mirror focus
post tablet.teach {"token":"Flux"}    # teach a token (channel inferred)
post net.add {"text":"Symmetry teaches order","tags":["mirror"]}
tick 5                                 # advance time by 5 hours
observe                                # print stats and symbolic skin
```

The `--once` CLI flag executes a single command and exits, which is handy for
scripting:

```bash
python tamaos.py --once "observe"
```

## 🧠 System Overview

- `tamaos.agent` – core creature model handling stats, knowledge, and lattice
  memories.
- `tamaos.devices` – implementation of the tablet (feeding/teaching) and net
  (concept streaming) devices.
- `tamaos.kernel` – message bus, persistence orchestration, and observation
  helpers.
- `tamaos.lattice` – geometric memory sheet underpinning Mirror/Shard/Flux.
- `tamaos.skin` – ASCII renderer with aura overlays.
- `tamaos.vfs` – lightweight virtual filesystem for state and stream persistence.
- `tamaos.repl` – command loop, logger wiring, and kernel bootstrapper.

## 🛣️ Roadmap Ideas

- ASCII starfield visualiser (`universe.map`).
- Room/biome exploration (Mini Tamaverse).
- Concept graph → codon mutation for deeper learning.
- Export/import life snapshots.
- Web UI sandbox.

## 📜 License

Released under the [MIT License](LICENSE).  Built as part of Blue $nake Studio's
mythic-engineering experiments.
