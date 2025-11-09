/**
 * Language-Conditioned Task System for Table Organization
 *
 * Provides:
 * - Object state tracking (3D positions)
 * - Language command parsing
 * - Path planning (collision-free movement)
 * - Automated gripper control
 * - Multi-step task execution
 */

import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

/**
 * Manages scene objects and their state
 */
export class ObjectManager {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.objects = [];
    this.bodyToObject = new Map();
    this.nextId = 0;
  }

  /**
   * Create a manipulable object on the table
   */
  createObject(position, properties = {}) {
    const {
      color = 0xff0000,
      type = 'marker',
      radius = 0.015,
      height = 0.12,
      group = 'items'
    } = properties;

    // Visual mesh
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 8);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.2
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    this.scene.add(mesh);

    // Physics body (dynamic)
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setCcdEnabled(true)
      .setLinearDamping(0.5)
      .setAngularDamping(0.5);
    const body = this.world.createRigidBody(bodyDesc);

    // Collider (cylinder)
    const colliderDesc = RAPIER.ColliderDesc.cylinder(height / 2, radius)
      .setFriction(0.8)
      .setRestitution(0.1);
    this.world.createCollider(colliderDesc, body);

    // Track object
    const obj = {
      id: this.nextId++,
      type,
      color,
      group,
      radius,
      height,
      body,
      mesh
    };

    this.objects.push(obj);
    this.bodyToObject.set(body.handle, obj);

    return obj;
  }

  /**
   * Get current state of all objects
   */
  getState() {
    return this.objects.map(obj => {
      const pos = obj.body.translation();
      const vel = obj.body.linvel();

      return {
        id: obj.id,
        type: obj.type,
        color: obj.color,
        group: obj.group,
        position: { x: pos.x, y: pos.y, z: pos.z },
        velocity: { x: vel.x, y: vel.y, z: vel.z },
        isMoving: Math.abs(vel.x) + Math.abs(vel.y) + Math.abs(vel.z) > 0.01
      };
    });
  }

  /**
   * Get objects by filter criteria
   */
  findObjects(filter = {}) {
    return this.objects.filter(obj => {
      if (filter.color !== undefined) {
        const objColorHex = obj.color;
        const filterColorHex = typeof filter.color === 'number' ? filter.color : parseInt(filter.color.replace('#', '0x'));
        if (objColorHex !== filterColorHex) return false;
      }
      if (filter.type && obj.type !== filter.type) return false;
      if (filter.group && obj.group !== filter.group) return false;
      return true;
    });
  }

  /**
   * Update visual meshes from physics state (call every frame)
   */
  updateMeshes() {
    for (const obj of this.objects) {
      const pos = obj.body.translation();
      const rot = obj.body.rotation();
      obj.mesh.position.set(pos.x, pos.y, pos.z);
      obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }
  }
}

/**
 * Autonomous gripper for pick-and-place
 */
export class AutoGripper {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;

    // Create gripper visual (LARGE, bright, emissive for visibility)
    const geometry = new THREE.SphereGeometry(0.2, 16, 16);  // 0.2m radius = visible
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,  // Red for high visibility
      emissive: 0xff0000,  // Glowing red
      emissiveIntensity: 0.5
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Create kinematic physics body (start at world origin, visible)
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, 0, 0);  // Start at origin for visibility
    this.body = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(0.03)
      .setSensor(true);  // Non-colliding (passes through)
    this.world.createCollider(colliderDesc, this.body);

    // State
    this.graspedObject = null;
    this.graspConstraint = null;
    this.targetPosition = null;
    this.moveSpeed = 1.0;  // m/s (slower for careful movement)
    this.moveSpeedHolding = 0.6;  // m/s when holding object (extra careful)
  }

  /**
   * Move gripper to target position smoothly
   */
  moveTo(target, deltaTime) {
    const current = this.body.translation();
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const dz = target.z - current.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (distance < 0.01) return true;  // Reached target

    // Use slower speed when holding object (more careful)
    const speed = this.graspedObject ? this.moveSpeedHolding : this.moveSpeed;
    const step = Math.min(speed * deltaTime, distance);
    const ratio = step / distance;

    // Constrain Y to never go below desk surface (prevent going under)
    const nextY = current.y + dy * ratio;
    const clampedY = Math.max(nextY, -3.0);  // Never below Y = -3.0

    this.body.setNextKinematicTranslation({
      x: current.x + dx * ratio,
      y: clampedY,
      z: current.z + dz * ratio
    });

    return false;  // Still moving
  }

  /**
   * Attempt to grasp specific target object
   */
  grasp(objectManager, targetObject = null) {
    if (this.graspedObject) return false;  // Already holding

    const gripperPos = this.body.translation();
    const GRASP_DISTANCE = 0.5;  // Larger threshold for scaled world

    // If specific target provided, try to grasp only that object
    if (targetObject) {
      const objPos = targetObject.body.translation();
      const dx = objPos.x - gripperPos.x;
      const dy = objPos.y - gripperPos.y;
      const dz = objPos.z - gripperPos.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      if (dist < GRASP_DISTANCE) {
        targetObject.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
        this.graspedObject = targetObject;
        console.log(`✓ Grasped object ${targetObject.id} (${targetObject.type})`);
        return true;
      }
      return false;  // Target not in range
    }

    // Fallback: Find closest object within grasp range (for manual control)
    for (const obj of objectManager.objects) {
      const objPos = obj.body.translation();
      const dx = objPos.x - gripperPos.x;
      const dy = objPos.y - gripperPos.y;
      const dz = objPos.z - gripperPos.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      if (dist < GRASP_DISTANCE) {
        obj.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
        this.graspedObject = obj;
        console.log(`✓ Grasped object ${obj.id} (${obj.type})`);
        return true;
      }
    }

    return false;
  }

  /**
   * Release currently grasped object
   */
  release() {
    if (!this.graspedObject) return false;

    // Convert back to dynamic so it falls with gravity
    this.graspedObject.body.setBodyType(RAPIER.RigidBodyType.Dynamic);

    // Set to zero velocity for clean drop
    this.graspedObject.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.graspedObject.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

    console.log(`✓ Released object ${this.graspedObject.id}`);
    this.graspedObject = null;
    return true;
  }

  /**
   * Update gripper visual from physics state
   */
  updateMesh() {
    const pos = this.body.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);

    // If holding object, move it with gripper
    if (this.graspedObject) {
      const gripperPos = this.body.translation();
      this.graspedObject.body.setNextKinematicTranslation({
        x: gripperPos.x,
        y: gripperPos.y - 0.05,  // Offset below gripper
        z: gripperPos.z
      });
    }
  }

  getPosition() {
    const pos = this.body.translation();
    return { x: pos.x, y: pos.y, z: pos.z };
  }
}

/**
 * Language command parser
 */
export class LanguageParser {
  static parse(command) {
    const cmd = command.toLowerCase().trim();

    // "clean my desk" / "clean desk" / "clean up" / "remove trash" / "throw trash"
    if (cmd.includes('clean') || cmd.includes('remove trash') || cmd.includes('throw trash')) {
      return {
        type: 'clean_table',
        target: 'off_table'
      };
    }

    // "organize" / "organize desk" / "organize items" / "organize the items"
    if (cmd.includes('organize')) {
      // If specifically mentions color, do color grouping
      if (cmd.includes('color')) {
        return {
          type: 'organize_by_color'
        };
      }
      // Otherwise organize by semantic groups (utensils/books)
      return {
        type: 'organize_desk'
      };
    }

    // "organize by color"
    if (cmd.includes('organize') && cmd.includes('color')) {
      return {
        type: 'organize_by_color'
      };
    }

    // "move red to corner" or "move markers to left"
    const moveMatch = cmd.match(/move\s+(\w+)\s+to\s+(\w+)/);
    if (moveMatch) {
      return {
        type: 'move_group',
        objectFilter: moveMatch[1],  // 'red' or 'markers'
        destination: moveMatch[2]     // 'corner' or 'left'
      };
    }

    // "group items together"
    if (cmd.includes('group') || cmd.includes('together')) {
      return {
        type: 'group_items',
        target: 'center'
      };
    }

    return { type: 'unknown', command: cmd };
  }
}

/**
 * Simple path planner (straight-line with collision avoidance)
 */
export class PathPlanner {
  constructor(objectManager, world_id = 2, tableCenter = { x: 1.5, y: -2.5, z: 7.2 }, tableRadius = 2.0) {
    this.objectManager = objectManager;
    this.world_id = world_id;
    this.tableCenter = tableCenter;
    this.tableRadius = tableRadius;

    // Per-world desk bounds (manually calibrated from player positions)
    const WORLD_BOUNDS = {
      2: {  // World 2 - Rectangular desk
        minX: -0.5,
        maxX: 3.5,
        minY: -3.5,
        maxY: -0.5,
        minZ: 5.0,
        maxZ: 9.0,
        centerX: 1.5,
        centerY: -2.0,
        centerZ: 7.0
      },
      3: {  // World 3 - Circular table (from 4 player positions)
        // Players: (0.346, 2.886), (-0.833, 3.552), (-0.274, 4.734), (1.066, 4.171)
        // Opposite points: (0.346, 2.886) ↔ (-0.274, 4.734)
        // Distance: sqrt((0.346-(-0.274))² + (2.886-4.734)²) = sqrt(0.384 + 3.417) = 1.95m
        // Radius ≈ 1.0m, center ≈ (0.0, -0.7, 3.8)
        minX: -1.2,   // Center -1.0 radius
        maxX: 1.2,    // Center +1.0 radius
        minY: -1.2,   // Below table surface
        maxY: -0.2,   // Above table surface
        minZ: 2.6,    // Center -1.2 radius
        maxZ: 5.0,    // Center +1.2 radius
        centerX: 0.0,
        centerY: -0.7,
        centerZ: 3.8
      },
      1: {  // World 1 - Different desk (from earlier player positions)
        minX: -6.0,   // From player at -5.448
        maxX: -1.0,   // From player at -1.570
        minY: -1.5,
        maxY: -0.5,
        minZ: 0.0,    // From player at 0.172
        maxZ: 4.0,    // From player at 3.339
        centerX: -3.5,
        centerY: -1.0,
        centerZ: 2.0
      }
    };

    // Use world-specific bounds
    this.deskBounds = WORLD_BOUNDS[world_id] || WORLD_BOUNDS[2];

    // Update table center from bounds
    this.tableCenter = {
      x: this.deskBounds.centerX,
      y: this.deskBounds.centerY,
      z: this.deskBounds.centerZ
    };

    console.log(`✓ Using World ${world_id} desk bounds:`, this.deskBounds);
  }

  /**
   * Check if object is on desk (not fallen off)
   */
  isOnDesk(position) {
    return position.x >= this.deskBounds.minX &&
           position.x <= this.deskBounds.maxX &&
           position.y >= this.deskBounds.minY &&
           position.y <= this.deskBounds.maxY &&
           position.z >= this.deskBounds.minZ &&
           position.z <= this.deskBounds.maxZ;
  }

  /**
   * Plan sequence of waypoints from start to goal
   */
  planPath(start, goal, avoidObjects = []) {
    // For now: simple straight-line (upgrade to A* if needed)
    const waypoints = [];

    // Approach from above
    waypoints.push({ x: start.x, y: start.y + 0.1, z: start.z });

    // Move horizontally to goal XZ
    waypoints.push({ x: goal.x, y: start.y + 0.1, z: goal.z });

    // Descend to goal Y
    waypoints.push({ x: goal.x, y: goal.y, z: goal.z });

    return waypoints;
  }

  /**
   * Get target positions based on task type
   */
  getTargetZones(taskType) {
    const zones = {
      // Organize zones (ON desk surface, ABOVE to prevent falling through)
      'left': { x: this.deskBounds.minX + 0.5, y: -2.0, z: this.tableCenter.z },  // Higher placement
      'right': { x: this.deskBounds.maxX - 0.5, y: -2.0, z: this.tableCenter.z }, // Higher placement
      'corner': { x: this.deskBounds.maxX - 0.5, y: -2.0, z: this.deskBounds.maxZ - 0.5 },
      'center': { x: this.tableCenter.x, y: -2.0, z: this.tableCenter.z },

      // Trash zone (OFF desk edge, drop over left edge)
      'off_table': { x: this.deskBounds.minX - 0.3, y: -2.0, z: this.tableCenter.z }  // Just off left edge
    };

    return zones[taskType] || zones['center'];
  }
}

/**
 * High-level task executor
 */
export class TaskExecutor {
  constructor(objectManager, gripper, pathPlanner) {
    this.objectManager = objectManager;
    this.gripper = gripper;
    this.pathPlanner = pathPlanner;

    this.currentTask = null;
    this.taskQueue = [];
    this.executing = false;
    this.currentWaypoint = 0;
    this.currentAction = null;
    this.stuckTimer = 0;
    this.lastGripperPos = null;
  }

  /**
   * Execute language command
   */
  async executeCommand(command) {
    console.log(`📝 Command: "${command}"`);

    const parsed = LanguageParser.parse(command);
    console.log(`  Parsed:`, parsed);

    if (parsed.type === 'unknown') {
      console.warn(`  ⚠ Unknown command`);
      return;
    }

    // Build task list based on command
    const tasks = this.buildTaskList(parsed);
    console.log(`  Generated ${tasks.length} tasks`);

    this.taskQueue = tasks;
    this.executing = true;
  }

  /**
   * Build task list from parsed command
   */
  buildTaskList(parsed) {
    const tasks = [];

    if (parsed.type === 'clean_table') {
      // Move ONLY TRASH objects that are ON desk
      const allTrash = this.objectManager.findObjects({ group: 'trash' });

      console.log(`  🔍 All objects:`, this.objectManager.objects.map(o => ({id: o.id, type: o.type, group: o.group})));
      console.log(`  🗑️ Trash filter found:`, allTrash.map(o => ({id: o.id, type: o.type, group: o.group})));

      const trashOnDesk = allTrash.filter(obj => {
        const pos = obj.body.translation();
        const onDesk = this.pathPlanner.isOnDesk(pos);
        console.log(`    Object ${obj.id} (${obj.type}, group:'${obj.group}'): pos=(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) onDesk=${onDesk}`);
        return onDesk;
      });

      const target = this.pathPlanner.getTargetZones('off_table');

      console.log(`  ✅ Final trash to remove: ${trashOnDesk.length} items`);

      trashOnDesk.forEach((obj, idx) => {
        tasks.push({
          type: 'pick_and_place',
          object: obj,
          target: {
            x: target.x,  // Drop off left edge
            y: -2.5,  // Desk surface height
            z: target.z + (idx * 0.2)  // Spread along edge
          }
        });
      });
    }

    else if (parsed.type === 'organize_desk') {
      // Organize ONLY items that are ON desk
      const allUtensils = this.objectManager.findObjects({ group: 'utensils' });
      const allBooks = this.objectManager.findObjects({ group: 'books' });

      console.log(`  🔍 Found ${allUtensils.length} utensils, ${allBooks.length} books total`);

      const utensils = allUtensils.filter(obj => {
        const pos = obj.body.translation();
        const onDesk = this.pathPlanner.isOnDesk(pos);
        console.log(`    Utensil ${obj.id} (${obj.type}): pos=(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) onDesk=${onDesk}`);
        return onDesk;
      });

      const books = allBooks.filter(obj => {
        const pos = obj.body.translation();
        const onDesk = this.pathPlanner.isOnDesk(pos);
        console.log(`    Book ${obj.id}: pos=(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) onDesk=${onDesk}`);
        return onDesk;
      });

      console.log(`  📐 Organizing ${utensils.length} utensils and ${books.length} books (on desk)`);

      // Utensils to left corner (grid layout, no stacking)
      const leftTarget = this.pathPlanner.getTargetZones('left');
      utensils.forEach((obj, idx) => {
        tasks.push({
          type: 'pick_and_place',
          object: obj,
          target: {
            x: leftTarget.x + (idx % 3) * 0.2,  // 3 columns
            y: leftTarget.y + 0.1,  // Place slightly above desk to prevent falling through
            z: leftTarget.z + Math.floor(idx / 3) * 0.25  // Rows
          }
        });
      });

      // Books to right corner (grid layout, no stacking)
      const booksTarget = this.pathPlanner.getTargetZones('right');
      books.forEach((obj, idx) => {
        tasks.push({
          type: 'pick_and_place',
          object: obj,
          target: {
            x: booksTarget.x - (idx % 2) * 0.3,  // 2 columns
            y: booksTarget.y + 0.1,  // Place slightly above desk to prevent falling through
            z: booksTarget.z + Math.floor(idx / 2) * 0.3  // Rows
          }
        });
      });
    }

    else if (parsed.type === 'organize_by_color') {
      // Group by color
      const colorGroups = {};
      for (const obj of this.objectManager.objects) {
        const colorKey = obj.color.toString();
        if (!colorGroups[colorKey]) colorGroups[colorKey] = [];
        colorGroups[colorKey].push(obj);
      }

      // Assign each color group to a zone
      const zones = ['left', 'right', 'corner'];
      const colorKeys = Object.keys(colorGroups);

      colorKeys.forEach((colorKey, idx) => {
        const zone = zones[idx % zones.length];
        const target = this.pathPlanner.getTargetZones(zone);

        colorGroups[colorKey].forEach((obj, objIdx) => {
          tasks.push({
            type: 'pick_and_place',
            object: obj,
            target: {
              ...target,
              x: target.x + (objIdx * 0.08 - 0.08),  // Arrange in line
              z: target.z + (objIdx * 0.08 - 0.08)
            }
          });
        });
      });
    }

    else if (parsed.type === 'group_items') {
      // Move all to center
      const target = this.pathPlanner.getTargetZones('center');
      this.objectManager.objects.forEach((obj, idx) => {
        const angle = (idx / this.objectManager.objects.length) * Math.PI * 2;
        const r = 0.15;
        tasks.push({
          type: 'pick_and_place',
          object: obj,
          target: {
            x: target.x + Math.cos(angle) * r,
            y: target.y,
            z: target.z + Math.sin(angle) * r
          }
        });
      });
    }

    return tasks;
  }

  /**
   * Update task execution (call every frame)
   */
  update(deltaTime) {
    if (!this.executing) return;

    if (this.taskQueue.length === 0) {
      this.executing = false;
      return;
    }

    const task = this.taskQueue[0];
    if (!task || !task.object || !task.object.body) {
      this.taskQueue.shift();
      this.currentAction = null;
      return;
    }

    // Stuck detection
    const gripperPos = this.gripper.getPosition();
    const moved = !this.lastGripperPos ||
      Math.abs(gripperPos.x - this.lastGripperPos.x) > 0.01 ||
      Math.abs(gripperPos.y - this.lastGripperPos.y) > 0.01 ||
      Math.abs(gripperPos.z - this.lastGripperPos.z) > 0.01;

    if (moved) {
      this.stuckTimer = 0;
      this.lastGripperPos = gripperPos;
    } else {
      this.stuckTimer += deltaTime;
    }

    // If stuck for 1.5 seconds, skip task and continue
    if (this.stuckTimer > 1.5) {
      console.warn(`  ⚠ Gripper stuck for 1.5s, skipping object ${task.object.id} (${task.object.type})`);
      this.gripper.release();
      this.taskQueue.shift();
      this.currentAction = null;
      this.stuckTimer = 0;
      this.lastGripperPos = null;
      return;
    }

    if (task.type === 'pick_and_place') {
      this.executePickAndPlace(task, deltaTime);
    }
  }

  /**
   * Execute pick-and-place task (state machine)
   */
  executePickAndPlace(task, deltaTime) {
    if (!this.currentAction) {
      this.currentAction = 'approach';
      this.currentWaypoint = 0;
      this.pickupPosition = null;  // Initialize pickup position storage
      console.log(`  🎯 Starting task for object ${task.object.id} (${task.object.type}, group:'${task.object.group}')`);
    }

    if (this.currentAction === 'approach') {
      // Move to object
      const objPos = task.object.body.translation();
      const target = { x: objPos.x, y: objPos.y + 0.05, z: objPos.z };

      if (this.gripper.moveTo(target, deltaTime)) {
        this.currentAction = 'grasp';
      }
    }

    else if (this.currentAction === 'grasp') {
      // Grasp SPECIFIC target object (not just any nearby object)
      const grasped = this.gripper.grasp(this.objectManager, task.object);

      if (grasped) {
        const objPos = task.object.body.translation();
        this.pickupPosition = { x: objPos.x, y: objPos.y, z: objPos.z };  // Store ONCE
        this.currentAction = 'lift';
        this.graspAttempts = 0;
      } else {
        // Failed to grasp - retry or skip
        this.graspAttempts = (this.graspAttempts || 0) + 1;

        if (this.graspAttempts > 60) {  // After 60 attempts (~1 second), skip this object
          console.warn(`  ⚠ Failed to grasp object ${task.object.id} (${task.object.type}), skipping`);
          this.taskQueue.shift();
          this.currentAction = null;
          this.graspAttempts = 0;
        }
      }
    }

    else if (this.currentAction === 'lift') {
      // Skip lift - just go straight to transport
      // Objects have locked rotations, safe to slide
      this.currentAction = 'transport';
    }

    else if (this.currentAction === 'transport') {
      // Move to target at SAME HEIGHT as pickup (stay on desk)
      if (this.gripper.moveTo({ x: task.target.x, y: this.pickupPosition.y, z: task.target.z }, deltaTime)) {
        this.currentAction = 'release';
      }
    }

    else if (this.currentAction === 'lower') {
      // Skip lower - already at desk height
      this.currentAction = 'release';
    }

    else if (this.currentAction === 'release') {
      // Release object
      this.gripper.release();
      this.currentAction = 'retreat';
    }

    else if (this.currentAction === 'retreat') {
      // Skip retreat - stay where we are, move to next task
      // Task complete
      console.log(`  ✓ Completed task for object ${task.object.id} (${task.object.type})`);
      this.taskQueue.shift();
      this.currentAction = null;
      this.pickupPosition = null;  // Reset pickup position

      const remaining = this.taskQueue.length;
      console.log(`  📋 ${remaining} tasks remaining`);

      if (remaining === 0) {
        this.executing = false;
        console.log('🎉 All tasks completed!');
      }
    }
  }

  /**
   * Stop execution
   */
  stop() {
    this.executing = false;
    this.taskQueue = [];
    this.currentAction = null;
    this.gripper.release();
  }
}

/**
 * Initialize task system (no auto-spawning - use manual block placement)
 */
export function initializeTaskSystem(world, scene, world_id = 2) {
  const objectManager = new ObjectManager(world, scene);
  const gripper = new AutoGripper(world, scene);
  const pathPlanner = new PathPlanner(objectManager, world_id);
  const executor = new TaskExecutor(objectManager, gripper, pathPlanner);

  console.log(`✓ Task system initialized for World ${world_id}`);

  return { objectManager, gripper, pathPlanner, executor };
}
