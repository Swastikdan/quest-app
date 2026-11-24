import type { ComponentType } from 'react';
import {
  Bike, BookOpen, Camera, ChartColumn, ChefHat, Coffee, CookingPot, Dumbbell,
  Flame, Footprints, House, Moon, Salad, Settings, Soup, Sparkles, Store,
  Sun, Target, Trophy, Utensils, Waves
} from 'lucide-react-native';

export type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export const questIcons: Record<string, IconComponent> = {
  sun: Sun,
  wake: Sun,
  dumbbell: Dumbbell,
  gym: Dumbbell,
  coffee: Coffee,
  breakfast: Coffee,
  bowl: Salad,
  lunch: Salad,
  soup: Soup,
  dinner: Soup,
  moon: Moon,
  sleep: Moon,
  camera: Camera,
  utensils: Utensils,
  sparkles: Sparkles,
  target: Target,
  book: BookOpen,
  waves: Waves,
  default: Sparkles
};

export const tabIcons = {
  Today: House,
  Meals: Utensils,
  Stats: ChartColumn,
  Settings: Settings
} as const;

export const workoutIcons: Record<string, IconComponent> = {
  strength: Dumbbell,
  cardio: Flame,
  hiit: Flame,
  sports: Trophy,
  walk: Footprints
};

export const mealIcons: Record<string, IconComponent> = {
  breakfast: Coffee,
  lunch: Salad,
  dinner: Soup,
  snack: ChefHat
};

export const homeIcon = CookingPot;
export const outsideIcon = Store;
export const bikeIcon = Bike;

export function iconForQuest(name: string): IconComponent {
  return questIcons[name] ?? questIcons.default;
}
