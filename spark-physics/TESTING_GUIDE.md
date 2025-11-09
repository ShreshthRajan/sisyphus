# Testing Guide: Realistic Objects & Robot Hand Gripper

## Overview
This guide covers testing the new realistic object spawning system (keys 1-6) and robot hand gripper replacement.

---

## Pre-Test Setup

### Option A: With Realistic Models (Recommended)
1. Follow `MODELS_DOWNLOAD.md` to download GLB models
2. Place all 7 models in `public/models/` directory
3. Run `npm run dev`

### Option B: Without Models (Geometric Fallback)
1. Skip model download
2. Run `npm run dev`
3. System will automatically use geometric primitives

---

## Test Sequence

### 1. **Launch Application**
```bash
cd spark-physics
npm run dev
```
- Open http://localhost:5173
- Click "Click to play" button
- Camera should lock (crosshair appears)

**Expected Console Output:**
```
✓ Rapier physics initialized
✓ Simulation initialized
✓ Task system initialized
🤖 Loading robot hand gripper...
✓ Robot hand gripper created at (0.60, -2.60, 7.40)
✓ Robot hand gripper installed
```

---

### 2. **Test Object Spawning (Keys 1-6)**

**Test Each Key:**
- Press `1` → Should spawn **Pencil** (black/yellow cylinder)
- Press `2` → Should spawn **Pen** (blue cylinder)
- Press `3` → Should spawn **Marker** (red/thick cylinder)
- Press `4` → Should spawn **Book** (flat rectangle)
- Press `5` → Should spawn **Crumpled Paper** (lumpy sphere)
- Press `6` → Should spawn **Soda Can** (aluminum cylinder)

**Expected Behavior:**
- Objects spawn ~1.5m in front of camera
- Fall with gravity and collide with table/floor
- Console logs object type and position
- Can spawn multiple of each type

**Console Output Example:**
```
✏️ Pencil spawned at (0.45, -2.10, 6.95)
🖊️ Pen spawned at (0.50, -2.15, 7.00)
🖍️ Marker spawned at (0.55, -2.20, 7.05)
📕 Book spawned at (0.60, -2.25, 7.10)
🗑️ Crumpled paper (trash) spawned at (0.65, -2.30, 7.15)
🥫 Soda can (trash) spawned at (0.70, -2.35, 7.20)
```

---

### 3. **Test Robot Hand Gripper**

#### Visual Check
- Look down (move mouse down)
- Robot hand should be visible near desk
- Should have metallic/gray appearance
- If model failed to load, will show 3-finger geometric gripper

#### Functional Test (Console Commands)
Open browser console (F12) and run:

```javascript
// 1. Spawn a test object
// Press '6' to spawn a soda can

// 2. Get object position
const b = getState()[0].position;
console.log(b);  // Should show object position

// 3. Move gripper to object
testMove(b.x, b.y, b.z);
// Expected: "🎯 Moving gripper to (X, Y, Z)"
// Wait ~2 seconds
// Expected: "✓ Reached target position"

// 4. Grasp object
testGrasp();
// Expected: "✓ Grasped object 0 (soda_can)"

// 5. Move to new location
testMove(0, 0, 6);
// Expected: "🎯 Moving gripper to (0.00, 0.00, 6.00)"
// Wait ~2 seconds
// Object should move with gripper

// 6. Release object
testRelease();
// Expected: "✓ Released object 0"
// Object should fall from new position
```

---

### 4. **Test Object Grouping**

#### Spawn Mixed Objects:
```
Press 1, 2, 3 → Utensils (pencil, pen, marker)
Press 4, 4, 4 → Books (multiple books)
Press 5, 6    → Trash (paper, can)
```

#### Query Objects by Group:
```javascript
// Get all objects
taskSystem.objectManager.getState();

// Filter by group
taskSystem.objectManager.findObjects({ group: 'utensils' });
taskSystem.objectManager.findObjects({ group: 'books' });
taskSystem.objectManager.findObjects({ group: 'trash' });
```

**Expected Output:**
- Utensils: pencil, pen, marker
- Books: all book objects
- Trash: crumpled_paper, soda_can

---

### 5. **Test Natural Language Commands** (Future)

```javascript
// These will be implemented next:
testCommand("move the trash off my desk");
testCommand("organize utensils");
testCommand("stack all books");
```

---

## Success Criteria

### ✅ **PASS**: All tests working
- [x] Objects spawn with keys 1-6
- [x] Robot hand gripper visible
- [x] Can move gripper with testMove()
- [x] Can grasp/release objects
- [x] Objects grouped correctly (utensils, books, trash)
- [x] Physics behaves realistically

### ⚠️ **PARTIAL**: Fallback mode working
- [x] Geometric primitives spawn (models failed to load)
- [x] Geometric gripper visible (robot hand failed to load)
- [x] All functionality works identically

### ❌ **FAIL**: Critical errors
- [ ] Objects don't spawn
- [ ] Console shows JavaScript errors
- [ ] Gripper doesn't move
- [ ] Grasp/release doesn't work

---

## Troubleshooting

### Models Not Loading
**Symptom:** Console shows "Failed to load..."
**Solution:**
1. Check `public/models/` directory exists
2. Verify GLB file names match exactly
3. System will automatically use geometric fallback

### Gripper Not Visible
**Symptom:** Can't see robot hand
**Solution:**
1. Look down (move mouse down)
2. Check console for "Robot hand gripper created at..."
3. Try: `testMove(0, -2, 6)` to move to visible position

### Objects Not Grabbable
**Symptom:** testGrasp() returns "No object nearby"
**Solution:**
1. Check distance: `testMove(b.x, b.y, b.z)` must reach target first
2. Grasp distance is 0.5m - may need to get closer
3. Verify object exists: `getState()` should show it

### Physics Glitches
**Symptom:** Objects flying around / clipping through floor
**Solution:**
1. Refresh page (Cmd+Shift+R)
2. Check GLOBAL_SCALE in main.js (line 47)
3. Verify Rapier initialized: console should show "✓ Rapier physics initialized"

---

## Performance Benchmarks

**Target Performance:**
- Object spawn: < 100ms per object
- Model load (first time): < 2 seconds
- Model spawn (cached): < 50ms
- Gripper movement: 60 FPS smooth
- Grasp/release: Instant

**Check FPS:**
- Open browser dev tools
- Rendering tab → Show frame rate
- Should be 60 FPS with ~20 objects spawned

---

## Known Issues & Limitations

1. **Model Scale:** May need adjustment per downloaded model (edit `scale.set()` in realistic_objects.js)
2. **Grasp Distance:** Set to 0.5m - may need tuning for your world scale
3. **Robot Hand Rotation:** Currently fixed orientation (no IK yet)
4. **Collision Approximation:** Uses simple colliders (box/cylinder/sphere) regardless of visual complexity

---

## Next Steps After Testing

Once all tests pass:
1. Implement natural language parser for "move trash off desk"
2. Add collision-aware path planning
3. Implement multi-object task coordination
4. Train VLA model with collected trajectories

---

## Quick Reference

### Keyboard Controls
| Key | Action |
|-----|--------|
| 1 | Spawn Pencil |
| 2 | Spawn Pen |
| 3 | Spawn Marker |
| 4 | Spawn Book |
| 5 | Spawn Crumpled Paper (trash) |
| 6 | Spawn Soda Can (trash) |
| B | Spawn colored block (original) |

### Console Commands
```javascript
getState()                        // Get all object positions
testMove(x, y, z)                // Move gripper to position
testGrasp()                      // Grasp nearby object
testRelease()                    // Release held object
taskSystem.objectManager.objects // View all tracked objects
```

---

## Report Issues

If you encounter bugs:
1. Check browser console for errors
2. Note which test failed
3. Include console output
4. Specify: with models or geometric fallback?
