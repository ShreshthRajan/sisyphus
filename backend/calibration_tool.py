"""
Interactive calibration tool for manual dot placement.

Task: Pick and place with obstacles
- 3 objects scattered on table (obstacles/clutter)
- Gripper starts at one side
- Target zone on table (where to place object)

Usage:
    python calibration_tool.py

Instructions:
    1. Image opens for world1
    2. Click positions in order:
       - Object 1 (red) - object to pick up
       - Object 2 (blue) - obstacle/clutter
       - Object 3 (yellow) - obstacle/clutter
       - Gripper (white) - starting position
       - Target zone (green) - where to place object 1
    3. Press 's' to save and move to next world
    4. Repeat for world2 and world3
    5. Coordinates saved to world_calibration_manual.py
"""

import cv2
import numpy as np
from pathlib import Path


class CalibrationTool:
    """Interactive tool for manual position placement."""

    def __init__(self, assets_dir: Path):
        self.assets_dir = Path(assets_dir)
        self.calibrations = {}
        self.current_world = 1
        self.clicks = []

        # Updated for 3-object pick-and-place task
        self.labels = [
            'object_to_pickup',    # Red - the target object to move
            'obstacle_1',          # Blue - clutter object 1
            'obstacle_2',          # Yellow - clutter object 2
            'gripper_start',       # White - gripper starting position
            'target_zone'          # Green - where to place object
        ]

        self.colors = {
            'object_to_pickup': (0, 0, 255),      # Red (BGR)
            'obstacle_1': (255, 0, 0),            # Blue
            'obstacle_2': (0, 255, 255),          # Yellow
            'gripper_start': (255, 255, 255),     # White
            'target_zone': (0, 255, 0)            # Green
        }

        self.descriptions = {
            'object_to_pickup': 'Object to pick up and move (RED)',
            'obstacle_1': 'Obstacle/clutter object 1 (BLUE)',
            'obstacle_2': 'Obstacle/clutter object 2 (YELLOW)',
            'gripper_start': 'Gripper starting position (WHITE)',
            'target_zone': 'Target placement zone (GREEN)'
        }

    def mouse_callback(self, event, x, y, flags, param):
        """Handle mouse clicks."""
        if event == cv2.EVENT_LBUTTONDOWN and len(self.clicks) < len(self.labels):
            self.clicks.append((x, y))
            label = self.labels[len(self.clicks) - 1]
            print(f"  ✓ {self.descriptions[label]}: pixel ({x}, {y})")

            # Redraw image with all clicks
            self.redraw_image()

    def redraw_image(self):
        """Redraw image with current clicks."""
        img = self.base_image.copy()

        for i, (x, y) in enumerate(self.clicks):
            label = self.labels[i]
            color = self.colors[label]

            # Draw filled circle (smaller, 3px)
            cv2.circle(img, (x, y), 3, color, -1)

            # Draw outline for visibility
            cv2.circle(img, (x, y), 6, (0, 0, 0), 1)  # Black outline

            # Add label text
            cv2.putText(img, str(i+1), (x + 8, y - 8),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        # Show completion status
        status_text = f"World {self.current_world}: {len(self.clicks)}/{len(self.labels)} positions marked"
        cv2.putText(img, status_text, (10, img.shape[0] - 10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        cv2.imshow('Calibration', img)

    def calibrate_world(self, world_id: int):
        """Calibrate a single world."""
        self.current_world = world_id
        self.clicks = []

        # Load exterior image
        world_dir = self.assets_dir / f"world{world_id}"
        exterior_files = list(world_dir.glob("*exterior*.png"))

        if not exterior_files:
            print(f"✗ No exterior image found for world {world_id}")
            return False

        img_path = exterior_files[0]
        self.base_image = cv2.imread(str(img_path))

        if self.base_image is None:
            print(f"✗ Failed to load {img_path}")
            return False

        h, w = self.base_image.shape[:2]

        # Resize for easier clicking if too large
        if w > 800:
            scale = 800 / w
            self.base_image = cv2.resize(self.base_image, None, fx=scale, fy=scale)
            self.scale_factor = scale
        else:
            self.scale_factor = 1.0

        # Show instructions
        instructions = self.base_image.copy()

        # Dark semi-transparent overlay for readability
        overlay = instructions.copy()
        cv2.rectangle(overlay, (0, 0), (450, 220), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, instructions, 0.4, 0, instructions)

        text_lines = [
            f"=== WORLD {world_id} CALIBRATION ===",
            "",
            "Click positions IN ORDER:",
            "1. RED:    Object to pick up (on table)",
            "2. BLUE:   Obstacle 1 (on table)",
            "3. YELLOW: Obstacle 2 (on table)",
            "4. WHITE:  Gripper start (on table, away from objects)",
            "5. GREEN:  Target zone (on table, where to place object)",
            "",
            "Controls:",
            "  's' = Save and next world",
            "  'r' = Reset (redo clicks)",
            "  'q' = Quit without saving"
        ]

        y_offset = 20
        for line in text_lines:
            color = (255, 255, 255) if line.startswith("=") else (200, 200, 200)
            cv2.putText(instructions, line, (10, y_offset),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA)
            y_offset += 18

        cv2.imshow('Calibration', instructions)
        cv2.setMouseCallback('Calibration', self.mouse_callback)

        print(f"\n{'='*50}")
        print(f"  CALIBRATING WORLD {world_id}")
        print(f"{'='*50}")
        print("Click 5 positions on the image...")

        while True:
            key = cv2.waitKey(1) & 0xFF

            if key == ord('s') and len(self.clicks) == len(self.labels):
                # Save calibration - scale to 224×224
                target_size = 224
                current_h, current_w = self.base_image.shape[:2]

                scaled_clicks = {}
                for i, (x, y) in enumerate(self.clicks):
                    label = self.labels[i]
                    scaled_x = int((x / current_w) * target_size)
                    scaled_y = int((y / current_h) * target_size)
                    scaled_clicks[label] = (scaled_x, scaled_y)

                self.calibrations[world_id] = scaled_clicks
                print(f"\n✓ World {world_id} calibration saved")
                print(f"  Positions (in 224×224 coords):")
                for label, pos in scaled_clicks.items():
                    print(f"    {label:20s}: {pos}")
                break

            elif key == ord('r'):
                # Reset clicks
                self.clicks = []
                print("\n  ⟳ Reset. Click again...")
                cv2.imshow('Calibration', self.base_image)

            elif key == ord('q'):
                print("\n  ✗ Cancelled")
                return False

            elif key == ord('s') and len(self.clicks) < len(self.labels):
                missing = len(self.labels) - len(self.clicks)
                print(f"\n  ⚠ Need {missing} more click(s) before saving")

        return True

    def save_calibrations(self):
        """Save all calibrations to Python file."""
        output_file = Path(__file__).parent / "world_calibration_manual.py"

        content = '''"""
Manually calibrated pixel positions for each world.
Generated by calibration_tool.py

Task: Pick and place with obstacles
- object_to_pickup: The object to move (red marker in visualization)
- obstacle_1, obstacle_2: Clutter objects on table (blue, yellow markers)
- gripper_start: Where gripper begins (white marker)
- target_zone: Where to place the object (green marker)

All positions are in 224×224 pixel coordinates.
"""

from typing import Dict, Tuple

MANUAL_CALIBRATIONS = {
'''

        for world_id in sorted(self.calibrations.keys()):
            positions = self.calibrations[world_id]
            content += f"    {world_id}: {{\n"
            for label, (x, y) in positions.items():
                content += f"        '{label}': ({x}, {y}),\n"
            content += "    },\n\n"

        content += """}

def get_manual_positions(world_id: int) -> Dict[str, Tuple[int, int]]:
    \"\"\"Get manually calibrated positions for a world.\"\"\"
    if world_id not in MANUAL_CALIBRATIONS:
        raise ValueError(f"No calibration for world {world_id}. Available: {list(MANUAL_CALIBRATIONS.keys())}")
    return MANUAL_CALIBRATIONS[world_id]
"""

        output_file.write_text(content)
        print(f"\n{'='*50}")
        print(f"✓ ALL CALIBRATIONS SAVED")
        print(f"{'='*50}")
        print(f"Output file: {output_file}")
        print(f"Calibrated worlds: {sorted(self.calibrations.keys())}")

    def run(self):
        """Run calibration for all worlds."""
        print("\n" + "="*50)
        print("  INTERACTIVE CALIBRATION TOOL")
        print("="*50)
        print(f"Assets directory: {self.assets_dir}\n")

        cv2.namedWindow('Calibration', cv2.WINDOW_NORMAL)
        cv2.resizeWindow('Calibration', 900, 700)

        for world_id in [1, 2, 3]:
            if not self.calibrate_world(world_id):
                break

        cv2.destroyAllWindows()

        if self.calibrations:
            self.save_calibrations()
            print("\n✓ Calibration complete!")
            print("✓ Now run: python backend/observation_builder.py")
            print("  to verify the positions look correct")
        else:
            print("\n✗ No calibrations saved")


if __name__ == "__main__":
    script_dir = Path(__file__).parent
    assets_dir = script_dir.parent / "assets"

    if not assets_dir.exists():
        print(f"✗ Assets directory not found: {assets_dir}")
        print("  Make sure you're running from the backend/ directory")
        exit(1)

    tool = CalibrationTool(assets_dir)
    tool.run()
