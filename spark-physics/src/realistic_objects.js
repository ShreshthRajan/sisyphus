/**
 * Realistic Object Spawning System with Key Bindings
 *
 * Loads 3D models from Sketchfab (GLB format) and spawns them with physics
 * Key bindings: 1=Pencil, 2=Pen, 3=Marker, 4=Book, 5=Paper, 6=Can
 */

import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ===== MODEL CACHE =====
const modelCache = new Map();
const gltfLoader = new GLTFLoader();

/**
 * Load GLB model with caching
 */
async function loadModel(path) {
    if (modelCache.has(path)) {
        return modelCache.get(path).clone();
    }

    return new Promise((resolve, reject) => {
        gltfLoader.load(
            path,
            (gltf) => {
                modelCache.set(path, gltf.scene);
                resolve(gltf.scene.clone());
            },
            (progress) => {
                console.log(`Loading ${path}: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
            },
            (error) => {
                console.error(`Failed to load ${path}:`, error);
                reject(error);
            }
        );
    });
}

/**
 * Helper to register object in all tracking systems
 * Handles both simple Mesh objects and GLB model Groups
 */
function registerObject(mesh, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem) {
    jengaBlocks.push({ mesh, body });
    bodyToMesh.set(body.handle, mesh);

    // For GLB models (Groups), add all child meshes to grabbable list
    if (mesh.isGroup || mesh.isObject3D) {
        mesh.traverse((child) => {
            if (child.isMesh) {
                meshToBody.set(child, body);
                grabbableMeshes.push(child);
            }
        });
    } else {
        // Simple mesh
        meshToBody.set(mesh, body);
        grabbableMeshes.push(mesh);
    }

    if (taskSystem) {
        taskSystem.objectManager.objects.push(objData);
        taskSystem.objectManager.bodyToObject.set(body.handle, objData);
    }
}

/**
 * Get spawn position (match spawnBlock behavior exactly)
 */
function getSpawnPosition(camera, world) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.normalize();
    // Spawn 2.0 units in front of camera (same as spawnBlock line 450)
    return camera.position.clone().addScaledVector(forward, 2.0);
}

// ===== OBJECT SPAWNERS =====

export async function spawnPencil(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem) {
    const spawnPos = getSpawnPosition(camera, world);

    try {
        const pencilModel = await loadModel('/models/pencil.glb');
        pencilModel.scale.set(0.03, 0.03, 0.03);  // 2x bigger to be visible
        pencilModel.position.copy(spawnPos);
        pencilModel.rotation.x = Math.PI / 2;  // Lay horizontal

        // Enable emissive for hover highlighting
        pencilModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.emissive = child.material.emissive || new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });

        scene.add(pencilModel);

        // Cylinder collider (same size as blocks ~0.2 scale)
        const radius = 0.01;
        const height = 0.2;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setCanSleep(true)
            .setLinearDamping(0.5)
            .setAngularDamping(0.5);
        const body = world.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.cylinder(height/2, radius)
            .setFriction(0.6)
            .setRestitution(0.1);
        world.createCollider(collider, body);

        const objData = {
            id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
            type: 'pencil',
            color: 0x000000,
            group: 'utensils',
            radius,
            height,
            body,
            mesh: pencilModel
        };

        registerObject(pencilModel, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
        console.log(`✏️ Pencil spawned at (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
    } catch (error) {
        console.error('Failed to spawn pencil:', error);
        // Fallback to geometric primitive
        spawnGeometricPencil(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos);
    }
}

export async function spawnPen(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem) {
    const spawnPos = getSpawnPosition(camera, world);

    try {
        const penModel = await loadModel('/models/pen.glb');
        penModel.scale.set(0.000118, 0.000592, 0.000118);  // 1.3x smaller again
        penModel.position.copy(spawnPos);
        penModel.rotation.set(Math.PI / 2, 0, 0);  // Rotate around X to lay flat

        // Enable emissive for hover highlighting
        penModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.emissive = child.material.emissive || new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });

        scene.add(penModel);

        const radius = 0.01;
        const height = 0.2;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setCanSleep(true)
            .setLinearDamping(0.5)
            .setAngularDamping(0.5)
            .lockRotations(true);  // Lock rotation to prevent tumbling
        const body = world.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.cylinder(height/2, radius)
            .setFriction(0.6)
            .setRestitution(0.1);
        world.createCollider(collider, body);

        const objData = {
            id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
            type: 'pen',
            color: 0x0000ff,
            group: 'utensils',
            radius,
            height,
            body,
            mesh: penModel
        };

        registerObject(penModel, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
        console.log(`🖊️ Pen spawned at (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
    } catch (error) {
        console.error('Failed to spawn pen:', error);
        spawnGeometricPencil(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos, 0x0000ff);
    }
}

export async function spawnMarker(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem) {
    const spawnPos = getSpawnPosition(camera, world);

    try {
        const markerModel = await loadModel('/models/marker.glb');
        markerModel.scale.set(0.0525, 0.0525, 0.0525);  // 1.4x bigger from 0.0375
        markerModel.position.copy(spawnPos);
        markerModel.rotation.set(Math.PI / 2, 0, 0);  // Rotate around X to lay flat

        // Enable emissive for hover highlighting
        markerModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.emissive = child.material.emissive || new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });

        scene.add(markerModel);

        const radius = 0.015;
        const height = 0.15;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setCanSleep(true)
            .setLinearDamping(0.5)
            .setAngularDamping(0.5)
            .lockRotations(true);  // Lock rotation to prevent tumbling
        const body = world.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.cylinder(height/2, radius)
            .setFriction(0.7)
            .setRestitution(0.1);
        world.createCollider(collider, body);

        const objData = {
            id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
            type: 'marker',
            color: 0xff0000,
            group: 'utensils',
            radius,
            height,
            body,
            mesh: markerModel
        };

        registerObject(markerModel, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
        console.log(`🖍️ Marker spawned at (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
    } catch (error) {
        console.error('Failed to spawn marker:', error);
        spawnGeometricPencil(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos, 0xff0000, 0.008, 0.14);
    }
}

export async function spawnBook(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem) {
    const spawnPos = getSpawnPosition(camera, world);

    try {
        const bookModel = await loadModel('/models/book.glb');
        bookModel.scale.set(0.6, 0.6, 0.6);  // 1.5x bigger from 0.4
        bookModel.position.copy(spawnPos);

        // Enable emissive for hover highlighting
        bookModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.emissive = child.material.emissive || new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });

        scene.add(bookModel);

        // Book dimensions (flat rectangle, match block scale)
        const width = 0.3;
        const height = 0.05;
        const depth = 0.4;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setCanSleep(true)
            .setLinearDamping(0.8)
            .setAngularDamping(0.8)
            .lockRotations(true);  // Lock rotation to prevent tumbling
        const body = world.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.cuboid(width/2, height/2, depth/2)
            .setFriction(0.9)
            .setRestitution(0.0);
        world.createCollider(collider, body);

        const objData = {
            id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
            type: 'book',
            color: 0x8b4513,
            group: 'books',
            radius: Math.max(width, depth) / 2,
            height,
            body,
            mesh: bookModel
        };

        registerObject(bookModel, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
        console.log(`📕 Book spawned at (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
    } catch (error) {
        console.error('Failed to spawn book:', error);
        spawnGeometricBook(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos);
    }
}

export async function spawnCrumpledPaper(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem) {
    const spawnPos = getSpawnPosition(camera, world);

    try {
        const paperModel = await loadModel('/models/crumpled_paper.glb');
        paperModel.scale.set(0.00107, 0.00107, 0.00107);  // 1.5x smaller
        paperModel.position.copy(spawnPos);

        // Enable emissive for hover highlighting and make white
        paperModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.color = new THREE.Color(0xffffff);  // White paper
                child.material.emissive = child.material.emissive || new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });

        scene.add(paperModel);

        const radius = 0.08;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setCanSleep(true)
            .setLinearDamping(0.3)
            .setAngularDamping(0.3)
            .lockRotations(true);  // Lock rotation only (still falls with gravity)
        const body = world.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.ball(radius)
            .setFriction(0.5)
            .setRestitution(0.2);
        world.createCollider(collider, body);

        const objData = {
            id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
            type: 'crumpled_paper',
            color: 0xeeeeee,
            group: 'trash',
            radius,
            height: radius * 2,
            body,
            mesh: paperModel
        };

        registerObject(paperModel, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
        console.log(`🗑️ Crumpled paper (trash) spawned at (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
    } catch (error) {
        console.error('Failed to spawn crumpled paper:', error);
        spawnGeometricPaper(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos);
    }
}

export async function spawnSodaCan(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem) {
    const spawnPos = getSpawnPosition(camera, world);

    try {
        const canModel = await loadModel('/models/soda_can.glb');
        canModel.scale.set(0.04, 0.04, 0.04);  // 2x smaller
        canModel.position.copy(spawnPos);

        // Enable emissive for hover highlighting
        canModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.emissive = child.material.emissive || new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });

        scene.add(canModel);

        const radius = 0.06;
        const height = 0.2;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setCanSleep(true)
            .setLinearDamping(0.2)
            .setAngularDamping(0.2);
        const body = world.createRigidBody(bodyDesc);
        const collider = RAPIER.ColliderDesc.cylinder(height/2, radius)
            .setFriction(0.4)
            .setRestitution(0.3);
        world.createCollider(collider, body);

        const objData = {
            id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
            type: 'soda_can',
            color: 0xff0000,
            group: 'trash',
            radius,
            height,
            body,
            mesh: canModel
        };

        registerObject(canModel, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
        console.log(`🥫 Soda can (trash) spawned at (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
    } catch (error) {
        console.error('Failed to spawn soda can:', error);
        spawnGeometricCan(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos);
    }
}

// ===== FALLBACK GEOMETRIC PRIMITIVES =====

function spawnGeometricPencil(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos, color = 0x000000, radius = 0.01, height = 0.2) {
    const geom = new THREE.CylinderGeometry(radius, radius, height, 8);
    const mat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.2,
        roughness: 0.7,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(spawnPos);
    scene.add(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        .setCanSleep(true)
        .setLinearDamping(0.5)
        .setAngularDamping(0.5);
    const body = world.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.cylinder(height/2, radius)
        .setFriction(0.6)
        .setRestitution(0.1);
    world.createCollider(collider, body);

    const objData = {
        id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
        type: 'pencil',
        color,
        group: 'utensils',
        radius,
        height,
        body,
        mesh
    };

    registerObject(mesh, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
    console.log(`✏️ Geometric pencil spawned (fallback)`);
}

function spawnGeometricBook(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos) {
    const width = 0.3;
    const height = 0.05;
    const depth = 0.4;

    const geom = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x8b4513,
        metalness: 0.1,
        roughness: 0.9,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(spawnPos);
    scene.add(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        .setCanSleep(true)
        .setLinearDamping(0.8)
        .setAngularDamping(0.8);
    const body = world.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.cuboid(width/2, height/2, depth/2)
        .setFriction(0.9)
        .setRestitution(0.0);
    world.createCollider(collider, body);

    const objData = {
        id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
        type: 'book',
        color: 0x8b4513,
        group: 'books',
        radius: Math.max(width, depth) / 2,
        height,
        body,
        mesh
    };

    registerObject(mesh, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
    console.log(`📕 Geometric book spawned (fallback)`);
}

function spawnGeometricPaper(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos) {
    const radius = 0.08;
    const geom = new THREE.IcosahedronGeometry(radius, 1);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        metalness: 0.0,
        roughness: 1.0,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(spawnPos);
    scene.add(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        .setCanSleep(true)
        .setLinearDamping(0.3)
        .setAngularDamping(0.3);
    const body = world.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.ball(radius)
        .setFriction(0.5)
        .setRestitution(0.2);
    world.createCollider(collider, body);

    const objData = {
        id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
        type: 'crumpled_paper',
        color: 0xeeeeee,
        group: 'trash',
        radius,
        height: radius * 2,
        body,
        mesh
    };

    registerObject(mesh, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
    console.log(`🗑️ Geometric paper spawned (fallback)`);
}

function spawnGeometricCan(world, scene, camera, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem, spawnPos) {
    const radius = 0.06;
    const height = 0.2;

    const geom = new THREE.CylinderGeometry(radius, radius, height, 16);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.8,
        roughness: 0.2,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(spawnPos);
    scene.add(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        .setCanSleep(true)
        .setLinearDamping(0.2)
        .setAngularDamping(0.2);
    const body = world.createRigidBody(bodyDesc);
    const collider = RAPIER.ColliderDesc.cylinder(height/2, radius)
        .setFriction(0.4)
        .setRestitution(0.3);
    world.createCollider(collider, body);

    const objData = {
        id: taskSystem ? taskSystem.objectManager.nextId++ : 0,
        type: 'soda_can',
        color: 0xff0000,
        group: 'trash',
        radius,
        height,
        body,
        mesh
    };

    registerObject(mesh, body, objData, jengaBlocks, bodyToMesh, meshToBody, grabbableMeshes, taskSystem);
    console.log(`🥫 Geometric can spawned (fallback)`);
}
