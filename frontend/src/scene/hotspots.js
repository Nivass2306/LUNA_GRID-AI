/**
 * SPACEGRID AI - Scene Hotspot Mapping
 * Percentage-based screen coordinates (0..100) aligned to the lunar base reference scenery.
 */

export const HOTSPOTS = {
  sun: {
    id: 'sun',
    label: 'Sun & Solar Focus',
    x: 50.0,
    y: 2.5,
    radius: 7.0,
  },
  earth: {
    id: 'earth',
    label: 'Earth',
    x: 21.0,
    y: 19.5,
    radius: 5.5,
  },
  dome: {
    id: 'dome',
    label: 'Central Habitat Dome',
    x: 54.5,
    y: 44.0,
    radius: 14.0,
  },
  solar_field: {
    id: 'solar_field',
    label: 'PV Solar Array',
    x: 18.0,
    y: 49.0,
    width: 32.0,
    height: 14.0,
  },
  dish: {
    id: 'dish',
    label: 'High-Gain Deep Space Dish',
    x: 83.5,
    y: 36.5,
    radius: 4.5,
  },
  battery: {
    id: 'battery',
    label: 'Regenerative Battery Module',
    x: 76.5,
    y: 55.0,
    radius: 5.0,
  },
  // Window illumination clusters mapped to priority tiers
  windows: {
    life_support: {
      id: 'life_support',
      label: 'Life Support (Core Dome)',
      x: 54.5,
      y: 45.8,
      width: 7.5,
      height: 3.2,
      priority: 1,
    },
    habitat: {
      id: 'habitat',
      label: 'Habitat Systems (Upper Dome)',
      x: 54.5,
      y: 41.5,
      width: 6.0,
      height: 2.5,
      priority: 2,
    },
    comms: {
      id: 'comms',
      label: 'Communications Outpost',
      x: 70.0,
      y: 52.0,
      width: 4.5,
      height: 3.0,
      priority: 3,
    },
    science: {
      id: 'science',
      label: 'Science Experiments Lab',
      x: 42.0,
      y: 53.0,
      width: 4.5,
      height: 2.8,
      priority: 4,
    },
    rover: {
      id: 'rover',
      label: 'Rover Charging Bay',
      x: 62.0,
      y: 56.5,
      width: 5.0,
      height: 2.5,
      priority: 5,
    },
  },
  // Power conduits
  conduits: {
    solar_to_dome: {
      from: { x: 26.0, y: 53.5 },
      control: { x: 38.0, y: 55.5 },
      to: { x: 52.0, y: 53.8 },
    },
    battery_to_dome: {
      from: { x: 74.0, y: 56.5 },
      control: { x: 65.0, y: 56.0 },
      to: { x: 57.0, y: 54.5 },
    },
  },
};
