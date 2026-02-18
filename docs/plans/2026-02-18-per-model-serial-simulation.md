> **For Claude:** REQUIRED SKILL: Use gaspol-execute to implement this plan.
> **CRITICAL:** This plan specifies real integrations. During execution,
> NEVER substitute placeholders for real data sources without explicit
> user approval. If a data source doesn't exist yet, STOP and ask.

## Goal

Implement per-model serial number simulation so the backend generates realistic serial number patterns based on each PCB model's actual field conditions. Currently, serial number types (barcode/timestamp/empty) are randomly distributed using a single global rate across ALL models. The new logic uses a 2-layer approach: Layer 1 determines which cavities are filled vs empty per-model (Python dict in backend), Layer 2 applies 80% barcode / 20% timestamp rate to filled cavities only.

## Architecture Context

**Backend (D:/Projects/indusia-ai-backend/):**
- `auto_inspect_edge_patch7.py` — Serial number generation (`allocate_serial_numbers()`, `build_frame_serial_map()`)
- `auto_inspect_edge_patch10.py` — Per-model frame config (`build_frame_serial_map_for_model()`, `_fetch_board_config()`)
- Patch10 fetches board config from PostgREST at inspection start, stores in `_current_model_config`
- Patch10 overrides patch7's serial map builder via `_build_frame_serial_map_override`

**HMI (D:/Projects/indusia-ai-hmi/):**
- NO changes needed — frontend already handles all 3 SN conditions

**4 Boards in DB:**
| Model | Cavities | Top | Bottom | Filled (testing) | Empty (testing) |
|-------|----------|-----|--------|-------------------|-----------------|
| EVEQSG00800 | 6 | 6 | 6 | 6 | 0 |
| EV10103-000100 | 6 | 6 | 6 | 2 | 4 |
| EV10-035790-0000 | 2 | 4 | 2 | 1 | 1 |
| EV10-033483-0001 | 1 | 3 | 3 | 1 | 0 |

## Tech Stack

- Python 3 (backend patches only)
- No database changes — filled cavity config is temporary simulation config in Python

## Data Integration Map

| Feature | Data Source | Location | Exists? | Action |
|---------|-----------|----------|---------|--------|
| Board cavity_count | PostgREST /boards | patch10 `_fetch_board_config()` | Yes | Use existing |
| Board top/bottom_frame_count | PostgREST /boards | patch10 `_fetch_board_config()` | Yes | Use existing |
| Per-model filled cavity count | Python dict | patch10 `SIM_FILLED_CAVITIES` | **No** | Add dict in patch10 |
| Serial number allocation | patch7 `allocate_serial_numbers()` | auto_inspect_edge_patch7.py:64 | Yes | Modify to accept filled_count |
| Frame-to-SN mapping | patch10 `build_frame_serial_map_for_model()` | auto_inspect_edge_patch10.py:197 | Yes | Pass filled_count through |
| Model config state | patch10 `_current_model_config` | auto_inspect_edge_patch10.py:38 | Yes | Add filled_cavities field |

---

## Phase A: Modify patch7 `allocate_serial_numbers()` for 2-layer logic

**Estimated time:** 10 minutes

**Files:**
- Modify: `D:/Projects/indusia-ai-backend/auto_inspect_edge_patch7.py`

**Steps:**

1. Update default rates at top of file:
   - `SIM_BARCODE_OK_RATE`: 0.7 → **0.8**
   - `SIM_EMPTY_CAVITY_RATE`: 0.1 → **0.0** (empty now determined by filled_count, not random)

2. Modify `allocate_serial_numbers(count, filled_count=None)` signature:
   - New param `filled_count`: number of cavities with real PCBs (None = all filled)
   - When `filled_count` is not None and `filled_count < count`:
     - Generate `filled_count` serial numbers using 80/20 barcode/timestamp
     - Generate `count - filled_count` empty serial numbers ("0")
     - Randomly shuffle positions so empty cavities aren't always at the end
   - When `filled_count` is None or `filled_count >= count`:
     - All cavities filled, use 80/20 barcode/timestamp (no empty)

3. Update the `__main__` test block to test with filled_count scenarios

**New logic:**
```python
def allocate_serial_numbers(count=PAIRS_PER_CYCLE, filled_count=None):
    effective_filled = count if filled_count is None else min(filled_count, count)
    last = _load_serial_counter()
    serials = []
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    filled_idx = 0

    # Layer 1: Generate SNs for filled cavities (80% barcode, 20% timestamp)
    for i in range(effective_filled):
        roll = random.random()
        if roll < SIM_BARCODE_OK_RATE:
            # Successful barcode read
            serial_num = last + filled_idx + 1
            serials.append(f"{SIM_BARCODE_PREFIX}|{date_str}|{serial_num:09d}")
            filled_idx += 1
        else:
            # Failed barcode read — timestamp substitute
            ts = (now + timedelta(seconds=i)).strftime("%Y%m%d_%H%M%S")
            serials.append(ts)

    # Layer 2: Generate empty SNs for remaining cavities
    for _ in range(count - effective_filled):
        serials.append("0")

    # Shuffle to randomize empty positions (not always at the end)
    random.shuffle(serials)

    _save_serial_counter(last + filled_idx)
    return serials
```

**Verification:**
- [ ] `python auto_inspect_edge_patch7.py` shows correct distribution
- [ ] With filled_count=2, count=6: exactly 2 filled + 4 empty (shuffled)
- [ ] With filled_count=None, count=6: all 6 filled (80/20 barcode/timestamp)
- [ ] With filled_count=1, count=1: 1 filled, 0 empty
- [ ] No empty ("0") SNs when filled_count >= count
- [ ] Serial counter only increments for barcode SNs (not timestamp or empty)

---

## Phase B: Add `SIM_FILLED_CAVITIES` dict to patch10 and pass to patch7

**Estimated time:** 10 minutes

**Files:**
- Modify: `D:/Projects/indusia-ai-backend/auto_inspect_edge_patch10.py`

**Steps:**

1. Add `SIM_FILLED_CAVITIES` dict at module level (after POSTGREST_URL):
   ```python
   # Temporary simulation config: filled cavities per model during field testing.
   # Key = board name (model_id), Value = number of filled cavities.
   # Models not listed here = all cavities filled (default).
   SIM_FILLED_CAVITIES = {
       "EV10103-000100": 2,      # 2 of 6 cavities have PCBs
       "EV10-035790-0000": 1,    # 1 of 2 cavities has a PCB
   }
   ```

2. Update `DEFAULT_CONFIG` to include `"filled_cavities": None`

3. Update `build_config_from_board(board)` to include filled_cavities:
   - Lookup board name in `SIM_FILLED_CAVITIES` dict
   - Add to returned config as `"filled_cavities"` key
   - Not in dict → None → all filled

4. Update `build_frame_serial_map_for_model(model_config)` to pass filled_count:
   - Extract `filled_cavities` from model_config
   - Pass to `allocate_serial_numbers(cavities, filled_count=filled_cavities)`

5. Update `_patched_start_inspection()` log messages to show filled_cavities

6. Update `__main__` test block to display filled_cavities per model

**Verification:**
- [ ] `python auto_inspect_edge_patch10.py` shows correct per-model config
- [ ] EVEQSG00800: filled_cavities=None → all 6 filled, 0 empty
- [ ] EV10103-000100: filled_cavities=2 → 2 filled, 4 empty
- [ ] EV10-035790-0000: filled_cavities=1 → 1 filled, 1 empty
- [ ] EV10-033483-0001: filled_cavities=None → 1 filled, 0 empty
- [ ] Frame-to-SN mapping shows correct empty cavity pattern per model
- [ ] Same SN assigned to all TOP+BOTTOM frames of same cavity

---

## Phase C: Integration test — run backend with each model

**Estimated time:** 10 minutes

**Steps:**

1. Ensure PostgREST is running on port 3001
2. Run `python auto_inspect_edge_patch10.py` standalone test — verify all 4 models
3. Run `python auto_inspect_edge_patch7.py` standalone test — verify filled_count logic
4. Start full backend (`python start_ai_edge.py` with .env.ai-edge)
5. Start HMI (`npm run dev` on port 3000)
6. Test each model via HMI select-line page:
   - Select EVEQSG00800 → start inspection → verify 6/6 filled SNs in SidePanel
   - Select EV10103-000100 → start inspection → verify 2 filled + 4 empty (hidden) in SidePanel
   - Select EV10-035790-0000 → start inspection → verify 1 filled + 1 empty in SidePanel
   - Select EV10-033483-0001 → start inspection → verify 1/1 filled SN in SidePanel

**Expected log output per model:**
```
EVEQSG00800:       6 cavities, filled=6 (6 barcode/timestamp, 0 empty)
EV10103-000100:    6 cavities, filled=2 (2 barcode/timestamp, 4 empty)
EV10-035790-0000:  2 cavities, filled=1 (1 barcode/timestamp, 1 empty)
EV10-033483-0001:  1 cavity,   filled=1 (1 barcode/timestamp, 0 empty)
```

**Verification:**
- [ ] Each model produces correct number of filled vs empty cavities
- [ ] Filled cavities have ~80% barcode / ~20% timestamp distribution
- [ ] Empty cavities always produce SN="0"
- [ ] Frame-to-SN mapping correctly assigns same SN to TOP+BOTTOM of same cavity
- [ ] HMI SidePanel displays correct badges: teal (barcode), yellow "NO READ" (timestamp), hidden (empty)
- [ ] HMI counters exclude empty cavities from good/ng counting

---

## Summary of Changes

| File | Change |
|------|--------|
| `indusia-ai-backend/auto_inspect_edge_patch7.py` | MODIFY: 2-layer `allocate_serial_numbers(count, filled_count)`, rates 80/20 |
| `indusia-ai-backend/auto_inspect_edge_patch10.py` | MODIFY: Add `SIM_FILLED_CAVITIES` dict, pass filled_count to patch7 |
| `indusia-ai-hmi/**` | NO CHANGES |
| Database | NO CHANGES |
