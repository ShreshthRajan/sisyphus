"""
Verification script for manual calibration.
Displays all 3 worlds with your manually placed dots to confirm positioning is perfect.

Usage:
    python verify_calibration.py

Output:
    - test_outputs/world{1,2,3}_verified.png with all 5 dots positioned
"""

import cv2
import numpy as np
from pathlib import Path

from world_calibration_manual import get_manual_positions


def verify_all_worlds(assets_dir: Path, output_dir: Path):
    """Generate verification images for all 3 worlds."""

    output_dir.mkdir(parents=True, exist_ok=True)

    # Dot visualization parameters
    DOT_RADIUS = 3  # Small dots (3px filled)
    OUTLINE_RADIUS = 6  # Outline for visibility
    OUTLINE_THICKNESS = 1

    # Colors (BGR for cv2)
    colors = {
        'object_to_pickup': (0, 0, 255),      # Red
        'obstacle_1': (255, 0, 0),            # Blue
        'obstacle_2': (0, 255, 255),          # Yellow
        'gripper_start': (255, 255, 255),     # White
        'target_zone': (0, 255, 0)            # Green
    }

    labels_short = {
        'object_to_pickup': 'OBJ1',
        'obstacle_1': 'OBS1',
        'obstacle_2': 'OBS2',
        'gripper_start': 'GRIP',
        'target_zone': 'GOAL'
    }

    print("\n" + "="*60)
    print("  CALIBRATION VERIFICATION")
    print("="*60)

    for world_id in [1, 2, 3]:
        # Load exterior image
        world_dir = assets_dir / f"world{world_id}"
        exterior_files = list(world_dir.glob("*exterior*.png"))

        if not exterior_files:
            print(f"✗ World {world_id}: No exterior image found")
            continue

        img_path = exterior_files[0]
        img = cv2.imread(str(img_path))

        if img is None:
            print(f"✗ World {world_id}: Failed to load {img_path}")
            continue

        # Resize to 224×224 (same as observation builder will use)
        img_resized = cv2.resize(img, (224, 224), interpolation=cv2.INTER_AREA)

        # Convert BGR → RGB for display
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)

        # Get manual positions
        try:
            positions = get_manual_positions(world_id)
        except ValueError as e:
            print(f"✗ World {world_id}: {e}")
            continue

        # Draw all dots
        for label, (x, y) in positions.items():
            color = colors[label]
            short_label = labels_short[label]

            # Filled circle
            cv2.circle(img_rgb, (x, y), DOT_RADIUS, color, -1)

            # Black outline for visibility
            cv2.circle(img_rgb, (x, y), OUTLINE_RADIUS, (0, 0, 0), OUTLINE_THICKNESS)

            # Label text
            cv2.putText(
                img_rgb,
                short_label,
                (x + 8, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.35,
                color,
                1,
                cv2.LINE_AA
            )

        # Convert back to BGR for saving
        img_output = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

        # Save verification image
        output_path = output_dir / f"world{world_id}_verified.png"
        cv2.imwrite(str(output_path), img_output)

        print(f"\n✓ World {world_id}:")
        print(f"    Object to pickup (RED):   {positions['object_to_pickup']}")
        print(f"    Obstacle 1 (BLUE):        {positions['obstacle_1']}")
        print(f"    Obstacle 2 (YELLOW):      {positions['obstacle_2']}")
        print(f"    Gripper start (WHITE):    {positions['gripper_start']}")
        print(f"    Target zone (GREEN):      {positions['target_zone']}")
        print(f"    → Saved to: {output_path.name}")

    print("\n" + "="*60)
    print("✓ VERIFICATION COMPLETE")
    print("="*60)
    print(f"View outputs: open {output_dir}")
    print("\nIf positions look correct:")
    print("  → Proceed to step 2 (update sim for 2-object task)")
    print("\nIf positions need adjustment:")
    print("  → Re-run: python backend/calibration_tool.py")
    print("="*60)


if __name__ == "__main__":
    script_dir = Path(__file__).parent
    assets_dir = script_dir.parent / "assets"
    output_dir = script_dir.parent / "calibration_verified"

    verify_all_worlds(assets_dir, output_dir)
