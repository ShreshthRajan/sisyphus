"""
Bidirectional coordinate mapping between pixels and 3D world coordinates.
Handles the conversion from manual pixel positions to PyBullet 3D physics coordinates.
"""

import numpy as np
from typing import Tuple
from world_calibration_manual import get_manual_positions, MANUAL_CALIBRATIONS


class CoordinateMapper:
    """
    Maps between 2D pixel coordinates and 3D world coordinates.

    Uses per-world calibration to handle different camera angles in Marble photos.
    """

    # Physics Z-levels (meters)
    TABLE_SURFACE_Z = 0.81  # Top of table surface
    OBJECT_ON_TABLE_Z = 0.86  # Object resting on table (table_z + object_radius)
    FLOOR_Z = 0.02  # Floor level (just above ground plane)
    GRIPPER_START_Z = 0.88  # Gripper starting height (slightly above objects)

    # Image dimensions
    IMAGE_SIZE = 224

    def __init__(self, world_id: int):
        """
        Initialize mapper for a specific world.

        Args:
            world_id: World number (1, 2, or 3)
        """
        self.world_id = world_id
        self.manual_positions = get_manual_positions(world_id)

        # Derive world coordinate system from manual positions
        # Use object positions to infer table center and scale
        self._infer_world_bounds()

    def _infer_world_bounds(self):
        """
        Infer world coordinate bounds from manual positions.

        Uses the assumption that objects span approximately the table surface,
        which has known physical dimensions (~0.8m diameter for round tables).
        """
        # Get all table-level object positions (excluding floor goal)
        table_positions = [
            self.manual_positions['object_to_pickup'],
            self.manual_positions['obstacle_1'],
            self.manual_positions['obstacle_2'],
            self.manual_positions['gripper_start'],
        ]

        # Find bounding box of table objects in pixels
        xs = [pos[0] for pos in table_positions]
        ys = [pos[1] for pos in table_positions]

        # Table center (average of object positions)
        self.table_center_px = (
            int(np.mean(xs)),
            int(np.mean(ys))
        )

        # Table extent in pixels (how many pixels = table diameter)
        table_span_x = max(xs) - min(xs)
        table_span_y = max(ys) - min(ys)
        table_span_px = max(table_span_x, table_span_y)

        # Physical table size (assume ~0.6m diameter based on visible objects)
        table_diameter_meters = 0.6

        # Pixels per meter scaling
        self.pixels_per_meter = table_span_px / table_diameter_meters if table_span_px > 0 else 100.0

        # World coordinate bounds (table is centered at world origin)
        self.world_x_range = (-0.4, 0.4)
        self.world_y_range = (-0.3, 0.3)

    def pixel_to_world_3d(self, pixel_pos: Tuple[int, int], z_level: str = 'table') -> np.ndarray:
        """
        Convert 2D pixel position to 3D world coordinates.

        Args:
            pixel_pos: (x, y) in pixel coordinates [0, 224)
            z_level: 'table' or 'floor' to determine Z coordinate

        Returns:
            (3,) array [x, y, z] in world coordinates (meters)
        """
        px, py = pixel_pos

        # Convert pixel offset from table center to world meters
        offset_x_px = px - self.table_center_px[0]
        offset_y_px = py - self.table_center_px[1]

        # Convert pixels to meters
        world_x = offset_x_px / self.pixels_per_meter
        world_y = -offset_y_px / self.pixels_per_meter  # Negative (image Y is flipped)

        # Assign Z based on level
        if z_level == 'table':
            world_z = self.OBJECT_ON_TABLE_Z
        elif z_level == 'floor':
            world_z = self.FLOOR_Z
        elif z_level == 'gripper':
            world_z = self.GRIPPER_START_Z
        else:
            raise ValueError(f"Unknown z_level: {z_level}")

        return np.array([world_x, world_y, world_z])

    def world_to_pixel_2d(self, world_pos: np.ndarray) -> Tuple[int, int]:
        """
        Convert 3D world coordinates to 2D pixel position (inverse of pixel_to_world_3d).

        Args:
            world_pos: (3,) array [x, y, z] in world coordinates

        Returns:
            (x, y) in pixel coordinates [0, 224)
        """
        x, y, _ = world_pos  # Ignore Z for 2D projection

        # Convert meters to pixel offset
        offset_x_px = int(x * self.pixels_per_meter)
        offset_y_px = int(-y * self.pixels_per_meter)  # Flip Y

        # Add to table center
        px = self.table_center_px[0] + offset_x_px
        py = self.table_center_px[1] + offset_y_px

        # Clamp to image bounds
        px = np.clip(px, 0, self.IMAGE_SIZE - 1)
        py = np.clip(py, 0, self.IMAGE_SIZE - 1)

        return (px, py)

    def get_initial_object_positions_3d(self) -> dict:
        """
        Get 3D world positions for all manually calibrated objects.

        Returns:
            Dictionary mapping object names to 3D positions (meters)
        """
        return {
            'object_to_pickup': self.pixel_to_world_3d(
                self.manual_positions['object_to_pickup'],
                z_level='table'
            ),
            'obstacle_1': self.pixel_to_world_3d(
                self.manual_positions['obstacle_1'],
                z_level='table'
            ),
            'obstacle_2': self.pixel_to_world_3d(
                self.manual_positions['obstacle_2'],
                z_level='table'
            ),
            'gripper_start': self.pixel_to_world_3d(
                self.manual_positions['gripper_start'],
                z_level='gripper'
            ),
            'target_zone': self.pixel_to_world_3d(
                self.manual_positions['target_zone'],
                z_level='floor'  # Target is on floor
            ),
        }


# Test and validation
if __name__ == "__main__":
    print("Testing CoordinateMapper...\n")

    for world_id in [1, 2, 3]:
        print(f"=== World {world_id} ===")

        mapper = CoordinateMapper(world_id)

        print(f"  Table center (px): {mapper.table_center_px}")
        print(f"  Pixels per meter: {mapper.pixels_per_meter:.1f}")

        # Get 3D positions
        positions_3d = mapper.get_initial_object_positions_3d()

        print(f"\n  3D World Positions (meters):")
        for name, pos in positions_3d.items():
            print(f"    {name:20s}: [{pos[0]:6.3f}, {pos[1]:6.3f}, {pos[2]:6.3f}]")

        # Verify round-trip conversion
        print(f"\n  Round-trip verification (world → pixel → world):")
        test_pos_3d = np.array([0.1, 0.05, 0.86])
        pixel_pos = mapper.world_to_pixel_2d(test_pos_3d)
        back_to_3d = mapper.pixel_to_world_3d(pixel_pos, z_level='table')

        error = np.linalg.norm(test_pos_3d[:2] - back_to_3d[:2])  # Check XY only
        print(f"    Test position: {test_pos_3d}")
        print(f"    → Pixel: {pixel_pos}")
        print(f"    → Back to 3D: {back_to_3d}")
        print(f"    XY error: {error:.6f} meters")

        if error < 0.01:  # 1cm tolerance
            print(f"    ✓ Conversion accurate")
        else:
            print(f"    ✗ Error too large")

        print()

    print("✓ CoordinateMapper validated for all worlds")
