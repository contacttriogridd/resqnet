import {
  Building2,
  CloudLightning,
  Flame,
  Mountain,
  Package,
  Trees,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react';

export const GUIDE_ICON: Record<string, LucideIcon> = {
  FLOOD: Waves,
  EARTHQUAKE: Building2,
  CYCLONE: Wind,
  TSUNAMI: Waves,
  FIRE: Flame,
  LANDSLIDE: Mountain,
  STORM: CloudLightning,
  HEAVY_RAIN: CloudLightning,
  FOREST_FIRE: Trees,
  GENERAL: Package,
};
