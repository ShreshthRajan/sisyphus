/**
 * Realistic Robot Hand Gripper
 * Replaces the red ball gripper with a 3D robot hand model
 */

import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

/**
 * Create robot hand gripper with realistic 3D model
 */
export async function createRobotHandGripper(world, scene, initialPosition = { x: 0, y: -2.6, z: 7.4 }) {
    console.log('🤖 Loading robot hand gripper...');

    let gripperMesh;
    let gripperScale = 0.15;  // Adjust based on actual model size

    try {
        // Try to load Shrek as gripper
        const result = await new Promise((resolve, reject) => {
            gltfLoader.load(
                '/models/shrek.glb',
                (gltf) => resolve(gltf),
                (progress) => {
                    console.log(`Loading Shrek gripper: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
                },
                (error) => reject(error)
            );
        });

        gripperMesh = result.scene;
        gripperMesh.scale.set(0.3, 0.3, 0.3);  // Shrek-appropriate scale

        // Keep original Shrek materials (green skin, etc)
        // No material modification needed

        console.log('✓ Shrek gripper loaded');
    } catch (error) {
        console.warn('Robot hand model not found, using fallback geometric gripper');

        // Fallback: Create a simple gripper from primitives
        gripperMesh = createGeometricGripper();
        gripperScale = 1.0;
    }

    gripperMesh.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
    scene.add(gripperMesh);

    // Create kinematic physics body
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(initialPosition.x, initialPosition.y, initialPosition.z);
    const body = world.createRigidBody(bodyDesc);

    // Sensor collider (non-colliding, for grasp detection)
    const colliderDesc = RAPIER.ColliderDesc.ball(0.08)  // Larger grasp radius
        .setSensor(true);
    world.createCollider(colliderDesc, body);

    console.log(`✓ Shrek gripper created at (${initialPosition.x.toFixed(2)}, ${initialPosition.y.toFixed(2)}, ${initialPosition.z.toFixed(2)})`);

    return {
        mesh: gripperMesh,
        body,
        scale: 0.3  // Return Shrek scale
    };
}

/**
 * Fallback geometric gripper (3-finger claw shape)
 */
function createGeometricGripper() {
    const group = new THREE.Group();

    // Palm (cube)
    const palmGeom = new THREE.BoxGeometry(0.08, 0.04, 0.08);
    const palmMat = new THREE.MeshStandardMaterial({
        color: 0x505050,
        metalness: 0.8,
        roughness: 0.3
    });
    const palm = new THREE.Mesh(palmGeom, palmMat);
    group.add(palm);

    // Three fingers (cylinders)
    const fingerGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8);
    const fingerMat = new THREE.MeshStandardMaterial({
        color: 0x404040,
        metalness: 0.9,
        roughness: 0.2
    });

    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const finger = new THREE.Mesh(fingerGeom, fingerMat);
        finger.position.set(
            Math.cos(angle) * 0.04,
            -0.03,
            Math.sin(angle) * 0.04
        );
        finger.rotation.x = Math.PI / 6;  // Angle inward
        group.add(finger);
    }

    // Add emissive accent (glowing indicator)
    const indicatorGeom = new THREE.SphereGeometry(0.01, 8, 8);
    const indicatorMat = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.8
    });
    const indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
    indicator.position.set(0, 0.025, 0);
    group.add(indicator);

    return group;
}

/**
 * Update gripper mesh position from physics body
 */
export function updateGripperMesh(gripperMesh, gripperBody) {
    const pos = gripperBody.translation();
    gripperMesh.position.set(pos.x, pos.y, pos.z);
}

/**
 * Update gripper to hold object (moves with gripper)
 */
export function updateGraspedObject(graspedObject, gripperBody) {
    if (!graspedObject) return;

    const gripperPos = gripperBody.translation();
    graspedObject.body.setNextKinematicTranslation({
        x: gripperPos.x,
        y: gripperPos.y - 0.08,  // Offset below gripper
        z: gripperPos.z
    });
}
