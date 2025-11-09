"""
Per-world calibration configuration.
Maps physics coordinates to actual table positions in Marble photos.
"""

from dataclasses import dataclass
from typing import Tuple


@dataclass
class WorldCalibration:
    """Calibration parameters for a specific Marble world."""
    world_id: int

    # Table region in 224×224 image (pixels)
    table_center_px: Tuple[int, int]  # (x, y) pixel coordinates
    table_radius_px: int  # Approximate table size

    # Floor/goal region in 224×224 image
    floor_center_px: Tuple[int, int]  # Where to place goal marker

    # Physics coordinate mapping
    # Maps physics world coordinates to pixel offsets from table center
    pixels_per_meter: float  # Scaling factor


# Calibrated values for each world (measured from Marble exterior.png files)
WORLD_CALIBRATIONS = {
    1: WorldCalibration(
        world_id=1,
        table_center_px=(75, 137),
        table_radius_px=45,
        floor_center_px=(60, 190),  # Floor to left-bottom of table
        pixels_per_meter=150.0  # 0.3m on table ≈ 45px
    ),

    2: WorldCalibration(
        world_id=2,
        table_center_px=(70, 105),
        table_radius_px=50,
        floor_center_px=(50, 170),  # Floor to left-bottom
        pixels_per_meter=165.0  # Square table slightly larger in view
    ),

    3: WorldCalibration(
        world_id=3,
        table_center_px=(70, 137),
        table_radius_px=42,
        floor_center_px=(65, 185),  # Floor below table
        pixels_per_meter=140.0
    ),
}


def get_world_calibration(world_id: int) -> WorldCalibration:
    """Get calibration for a specific world."""
    if world_id not in WORLD_CALIBRATIONS:
        raise ValueError(f"No calibration for world {world_id}. Available: {list(WORLD_CALIBRATIONS.keys())}")
    return WORLD_CALIBRATIONS[world_id]
