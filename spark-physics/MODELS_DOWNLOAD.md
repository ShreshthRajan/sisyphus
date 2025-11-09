# 3D Model Download Instructions

This project uses realistic 3D models for objects. Follow these steps to download and install them.

## Quick Setup (5 minutes)

### 1. Create models directory
```bash
cd spark-physics/public
mkdir models
cd models
```

### 2. Download Models from Sketchfab

Visit each URL and click "Download 3D Model" → Select **GLB** format → Download

| Object | URL | License | Notes |
|--------|-----|---------|-------|
| **Pencil** | https://sketchfab.com/3d-models/cc0-pencil-cb1b27db90eb469eb845017bb300b5d3 | CC0 | Rename to `pencil.glb` |
| **Pen** | https://sketchfab.com/3d-models/ballpoint-pen-glb-v09-free-low-poly-ab39152e6e144adb8186a1e603b97717 | Free | Rename to `pen.glb` |
| **Marker** | https://sketchfab.com/3d-models/gambar-glb-marker-5f9e2058bd9a480fbadf8e181751acba | Free | Rename to `marker.glb` |
| **Book** | https://sketchfab.com/3d-models/cc0-bookshelf-with-books-961af2daa6344e4fba0c7a4c92ff91f8 | CC0 | Extract single book, rename to `book.glb` |
| **Crumpled Paper** | https://sketchfab.com/3d-models/cc0-paper-b0776948a05f4766a03856223344b264 | CC0 | Rename to `crumpled_paper.glb` |
| **Soda Can** | https://sketchfab.com/3d-models/soda-can-330ml-d6e922b66cec4fb8ab8688e69baacd0a | Free | Rename to `soda_can.glb` |
| **Robot Hand** | https://sketchfab.com/3d-models/robotic-hand-gripper-3-claws-901f08997a404b178f06dced935f57ba | Free | Rename to `robot_hand.glb` |

### 3. Final Directory Structure

```
spark-physics/
└── public/
    └── models/
        ├── pencil.glb
        ├── pen.glb
        ├── marker.glb
        ├── book.glb
        ├── crumpled_paper.glb
        ├── soda_can.glb
        └── robot_hand.glb
```

## Fallback Behavior

If models fail to load, the system automatically uses geometric primitives (cylinders, boxes, spheres) as fallback. The physics and functionality will work identically, just without realistic visuals.

## Alternative: Procedural Models

If you don't want to download models, comment out the model loading in `realistic_objects.js` and the system will use the geometric fallbacks automatically.

## Troubleshooting

**Models not loading?**
1. Check browser console for errors
2. Verify files are in `public/models/` directory
3. Ensure files are named exactly as shown above
4. Try refreshing the page (Cmd+Shift+R / Ctrl+Shift+R)

**Models too big/small?**
- Adjust the `scale.set()` values in `realistic_objects.js`
- Default scales are estimates and may need tuning per model

**Physics not working?**
- The colliders are independent of visual models
- Physics will work even if models fail to load
