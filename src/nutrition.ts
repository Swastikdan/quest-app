export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Goal = 'lose' | 'maintain' | 'gain'
export type GoalRate = 'gentle' | 'steady' | 'fast'

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly seated',
  light: 'Lightly active',
  moderate: 'Moderately active',
  active: 'Very active',
  very_active: 'Athlete'
}

export const ACTIVITY_HINTS: Record<ActivityLevel, string> = {
  sedentary: 'Desk job, little walking',
  light: 'Some walking, light chores',
  moderate: 'On your feet a fair bit',
  active: 'Training 4+ days a week',
  very_active: 'Physical job or two-a-days'
}

export const GOAL_RATES: Record<Goal, Record<GoalRate, number>> = {
  lose: { gentle: -250, steady: -500, fast: -750 },
  maintain: { gentle: 0, steady: 0, fast: 0 },
  gain: { gentle: 150, steady: 300, fast: 500 }
}

export const GOAL_RATE_LABELS: Record<GoalRate, string> = {
  gentle: 'Gentle',
  steady: 'Steady',
  fast: 'Faster'
}

export const GOAL_RATE_HINTS: Record<Goal, Record<GoalRate, string>> = {
  lose: {
    gentle: '−250 kcal · about 0.25 kg a week',
    steady: '−500 kcal · about 0.5 kg a week',
    fast: '−750 kcal · about 0.75 kg a week'
  },
  maintain: {
    gentle: 'Hold your current weight',
    steady: 'Hold your current weight',
    fast: 'Hold your current weight'
  },
  gain: {
    gentle: '+150 kcal · slow lean gain',
    steady: '+300 kcal · steady gain',
    fast: '+500 kcal · faster gain'
  }
}

export const METS = {
  strength: 5.0,
  cardio: 7.0,
  hiit: 9.0,
  sports: 6.0,
  walk: 3.5
} as const

export type WorkoutType = keyof typeof METS

export interface ProfileMetricsInput {
  sex: 'male' | 'female'
  age: number
  height_cm: number
  weight_kg: number
  activity_level: ActivityLevel
  goal: Goal
  goal_rate?: GoalRate
  custom_target_calories?: number | null
}

export function goalAdjustment(goal: Goal, rate: GoalRate = 'steady'): number {
  return GOAL_RATES[goal][rate]
}

export function computeMetrics(input: ProfileMetricsInput) {
  const base = 10 * input.weight_kg + 6.25 * input.height_cm - 5 * input.age
  const bmr = Math.round(base + (input.sex === 'male' ? 5 : -161))
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activity_level])
  const adjustment = goalAdjustment(input.goal, input.goal_rate ?? 'steady')
  const recommended = Math.max(1200, Math.round(tdee + adjustment))
  const custom =
    input.custom_target_calories && input.custom_target_calories >= 1200
      ? Math.round(input.custom_target_calories)
      : null
  const target = custom ?? recommended
  const proteinFactor = input.goal === 'lose' ? 1.9 : input.goal === 'gain' ? 1.8 : 1.6
  const protein_target = Math.round(input.weight_kg * proteinFactor)
  const fat_target = Math.round((target * 0.27) / 9)
  const carbs_target = Math.max(0, Math.round((target - protein_target * 4 - fat_target * 9) / 4))
  return {
    bmr,
    tdee,
    target_calories: target,
    recommended_calories: recommended,
    adjustment,
    protein_target,
    fat_target,
    carbs_target
  }
}

export function computeBurn(type: WorkoutType, minutes: number, weightKg: number): number {
  return Math.round(((METS[type] - 1) * 3.5 * weightKg) / 200 * minutes)
}

export function walkOffMinutes(overCalories: number, weightKg: number): number {
  const perMinute = ((METS.walk - 1) * 3.5 * weightKg) / 200
  return Math.ceil(Math.abs(overCalories) / perMinute)
}
