import type { ProfileMetricsInput } from './nutrition';

export type Profile = ProfileMetricsInput & {
  timezone: string;
  journey_start_date: string | null;
  target_calories: number;
  bmr: number;
  tdee: number;
  recommended_calories: number;
  protein_target: number;
  fat_target: number;
  carbs_target: number;
  goal_rate: string;
  custom_target_calories: number | null;
  xp: number;
  level: number;
  title: string;
  xp_in_level: number;
  xp_for_next: number;
  progress: number;
};

export type Quest = {
  id: number;
  key: string;
  title: string;
  icon: string;
  type: string;
  subtitle: string;
  state: string;
  points: number;
  penalty: number;
  salvage_points: number;
  salvage_title: string | null;
  salvage_subtitle: string | null;
  window_start: string | null;
  window_end: string | null;
  salvage_until: string | null;
  deadline: string | null;
  sort_order: number;
  opens_at: string;
  closes_at: string;
  salvage_closes_at: string;
  can_complete: boolean;
  can_salvage: boolean;
  can_skip: boolean;
  log: {
    checked_time: string | null;
    checked_at: string | null;
    status: string;
    points_awarded: number;
    salvage_note: string | null;
    verification: string | null;
    auto_skipped: number;
  } | null;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Meal = {
  id: number;
  date?: string;
  meal_type: MealType;
  state: 'draft' | 'confirmed';
  description: string | null;
  is_outside_food: number;
  edited: number;
  photo_url?: string | null;
  asset_public_id?: string | null;
  ai_calories: number | null;
  ai_protein: number | null;
  ai_carbs: number | null;
  ai_fat: number | null;
  ai_confidence: string | null;
  ai_ingredients: string[] | string | null;
  final_calories: number | null;
  final_protein: number | null;
  final_carbs: number | null;
  final_fat: number | null;
  estimate_status?: string;
  created_at?: string;
};

export type Workout = {
  id: number;
  type: string;
  minutes: number;
  burned: number;
  note?: string | null;
  created_at?: string;
};

export type Day = {
  date: string;
  timezone: string;
  profile: Profile;
  quests: Quest[];
  meals: Meal[];
  workouts: Workout[];
  budget: {
    target: number;
    adjusted_target: number;
    eaten: number;
    burned: number;
    remaining: number;
    protein: number;
    carbs: number;
    fat: number;
    protein_target: number;
    fat_target: number;
    carbs_target: number;
    walk_hint: number | null;
    percent: number;
  };
  rhythm: {
    streak: number;
    best_streak: number;
    multiplier: number;
    level: number;
    level_title: string;
    progress: number;
    xp_for_next: number;
    monthly_points: number;
  };
  points_today: number;
  all_resolved: boolean;
  skips_remaining: number;
  unread_report: {
    date: string;
    day_tier: string | null;
    quests_completed: number;
    quests_salvaged: number;
    quests_total: number;
    streak_after: number;
    xp_earned: number;
    points_possible?: number;
  } | null;
};

export type Score = {
  date: string;
  day_tier: string;
  quests_completed: number;
  quests_salvaged: number;
  quests_total: number;
  streak_after: number;
  multiplier: number;
  xp_earned: number;
  target_calories: number;
  consumed_calories: number | null;
  burned_calories: number | null;
  bonus_points: number;
  points_earned: number;
  points_possible: number;
  calorie_verdict: string | null;
  reflection_text: string | null;
};

export type Report = {
  score: Score;
  timezone: string;
  quests: { id: number; title: string; status: string; points_awarded: number }[];
  meals: Meal[];
  workouts: Workout[];
};

export type History = {
  today: string;
  monthly_points: number;
  scores: Score[];
  weights: { date: string; weight_kg: number }[];
};

export type WeekDay = {
  date: string;
  consumed: number;
  burned: number;
  target: number;
  points_earned: number;
  points_possible: number;
  tier: string | null;
  has_data: boolean;
  weight: number | null;
};

export type RecentItem = {
  kind: 'meal' | 'workout' | 'quest';
  at: string;
  title: string;
  subtitle: string;
  photo: string | null;
};

export type StatsData = {
  today: string;
  profile: Profile;
  budget: Day['budget'];
  points_today: number;
  rhythm: Day['rhythm'];
  week: WeekDay[];
  summary: {
    calorie: {
      consumed: number;
      target: number;
      net: number;
      average: number;
      on_target_days: number;
      days: number;
    };
    points: { earned: number; possible: number };
  };
  heatmap: { date: string; tier: string | null; points: number; has_data: boolean }[];
  weights: { date: string; weight_kg: number }[];
  weight_summary: { current: number; start: number; delta: number; entries: number };
  recent: RecentItem[];
};
