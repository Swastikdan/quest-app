import { View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Plus, Sparkles } from 'lucide-react-native';
import { c, font, mealPalette } from './theme';
import { mealIcons, workoutIcons } from './icons';
import {
  Button, Card, IconTile, Pill, PressableScale, ProgressBar, SectionHeader, T
} from './ui';
import { dayLabel } from './Today';
import type { Connection } from './api';
import type { Day, Meal, MealType } from './types';

const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const mealNames: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks'
};

const suggestions: Array<{ label: string; text: string; type: MealType }> = [
  { label: '2 rotis + dal', text: '2 rotis, 1 katori dal, 1 katori sabzi', type: 'lunch' },
  { label: 'Poha + chai', text: '1 bowl poha, 1 cup chai with sugar', type: 'breakfast' },
  { label: 'Idli + sambar', text: '3 idlis, 1 katori sambar, 1 spoon coconut chutney', type: 'breakfast' },
  { label: 'Chicken + rice', text: '150 g chicken curry, 1 katori rice', type: 'dinner' },
  { label: 'Curd rice', text: '1 katori curd rice with a little pickle', type: 'lunch' }
];

export default function Meals({
  day, connection, onAdd, onEdit, onDescribe, onWorkout, onRemoveWorkout
}: {
  day: Day;
  connection: Connection;
  onAdd: (type?: MealType) => void;
  onEdit: (meal: Meal) => void;
  onDescribe: (text: string, type: MealType) => void;
  onWorkout: () => void;
  onRemoveWorkout: (id: number) => void;
}) {
  const { budget } = day;
  const over = budget.remaining < 0;
  const percent = budget.adjusted_target ? budget.eaten / budget.adjusted_target : 0;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="display">Meals</T>
        <Pill label={dayLabel(day.date)} tone="soft" />
      </View>

      <Card style={{ padding: 20, gap: 15 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: 1 }}>
            <T variant="numberMd">{budget.eaten.toLocaleString('en-IN')}</T>
            <T variant="meta" tone="muted">of {budget.adjusted_target.toLocaleString('en-IN')} kcal today</T>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 3 }}>
            <T variant="numberSm" style={{ color: over ? c.warningInk : c.successInk }}>
              {over ? '+' : ''}{Math.abs(budget.remaining).toLocaleString('en-IN')}
            </T>
            <T variant="caption" tone="muted">{over ? 'over budget' : 'left to eat'}</T>
          </View>
        </View>
        <ProgressBar value={over ? 1 : percent} color={over ? c.warning : c.primary} height={9} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Macro label="Protein" value={Math.round(budget.protein)} target={budget.protein_target} color={c.success} />
          <Macro label="Carbs" value={Math.round(budget.carbs)} target={budget.carbs_target} color={c.warning} />
          <Macro label="Fat" value={Math.round(budget.fat)} target={budget.fat_target} color={c.purple} />
        </View>
      </Card>

      <Card tone="primary" style={{ gap: 13 }}>
        <View style={{ gap: 3 }}>
          <T variant="subheading">Just tell me what you ate</T>
          <T variant="meta" tone="muted">Grams, katoris, rotis — ramble. AI does the maths.</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {suggestions.map((item) => (
            <PressableScale
              key={item.label}
              onPress={() => onDescribe(item.text, item.type)}
              style={{ backgroundColor: c.white, borderRadius: 999, paddingHorizontal: 13, height: 34, justifyContent: 'center' }}
            >
              <T variant="caption" style={{ fontFamily: font.semibold }}>{item.label}</T>
            </PressableScale>
          ))}
        </View>
        <Button label="Describe a meal" onPress={() => onDescribe('', 'lunch')} full />
      </Card>

      {mealOrder.map((type) => {
        const items = day.meals.filter((meal) => meal.meal_type === type);
        const total = items.reduce((sum, meal) => sum + (meal.final_calories ?? 0), 0);
        const palette = mealPalette[type]!;
        return (
          <View key={type} style={{ gap: 9 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <IconTile component={mealIcons[type]} size={34} bg={palette.soft} color={palette.color} iconSize={17} />
              <T variant="subheading" style={{ flex: 1 }}>{mealNames[type]}</T>
              {total > 0 && <T variant="meta" tone="muted">{total} kcal</T>}
              <PressableScale
                onPress={() => onAdd(type)}
                accessibilityLabel={`Add ${mealNames[type]}`}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={16} color={c.ink} strokeWidth={2.4} />
              </PressableScale>
            </View>

            {items.length === 0 ? (
              <PressableScale onPress={() => onAdd(type)}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line,
                  padding: 14
                }}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={16} color={palette.color} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T variant="bodyStrong">Add {mealNames[type].toLowerCase()}</T>
                    <T variant="meta" tone="muted">Photo it, or describe it.</T>
                  </View>
                  <ChevronRight size={17} color={c.faint} />
                </View>
              </PressableScale>
            ) : (
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {items.map((meal, index) => (
                  <View key={meal.id}>
                    <MealRow meal={meal} connection={connection} onPress={() => onEdit(meal)} />
                    {index < items.length - 1 && <View style={{ height: 1, backgroundColor: c.line }} />}
                  </View>
                ))}
              </Card>
            )}
          </View>
        );
      })}

      <SectionHeader
        title="Movement"
        action={<Button label="Log" onPress={onWorkout} size="sm" variant="soft" />}
      />
      {day.workouts.length === 0 ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile name="dumbbell" size={42} color={c.danger} bg={c.dangerSoft} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="bodyStrong">No session yet</T>
            <T variant="meta" tone="muted">A walk counts. So does a full gym session.</T>
          </View>
          <ChevronRight size={17} color={c.faint} />
        </Card>
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {day.workouts.map((workout, index) => (
            <PressableScale key={workout.id} onLongPress={() => onRemoveWorkout(workout.id)} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile component={workoutIcons[workout.type]} size={40} color={c.danger} bg={c.dangerSoft} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="bodyStrong" style={{ textTransform: 'capitalize' }}>{workout.type}{workout.note ? ` · ${workout.note}` : ''}</T>
                  <T variant="meta" tone="muted">{workout.minutes} min · +{workout.burned} kcal back</T>
                </View>
                <T variant="caption" tone="faint">hold to remove</T>
              </View>
              {index < day.workouts.length - 1 && <View style={{ height: 1, backgroundColor: c.line, marginTop: 12 }} />}
            </PressableScale>
          ))}
        </Card>
      )}

      <T variant="caption" tone="faint" align="center" style={{ paddingHorizontal: 24 }}>
        Indian portions are estimated — one katori, one roti, one spoon of ghee at a time.
      </T>
    </>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 14, padding: 11, gap: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        <T variant="caption" tone="muted">{label}</T>
      </View>
      <T variant="bodyStrong">{value}<T variant="caption" tone="faint"> / {target}g</T></T>
    </View>
  );
}

function MealRow({ meal, connection, onPress }: { meal: Meal; connection: Connection; onPress: () => void }) {
  const ingredients = Array.isArray(meal.ai_ingredients)
    ? meal.ai_ingredients
    : typeof meal.ai_ingredients === 'string'
      ? safeParse(meal.ai_ingredients)
      : [];
  const title = meal.description || ingredients.slice(0, 3).join(', ') || mealNames[meal.meal_type];
  const outside = meal.is_outside_food === 1;
  const hasPenalty = outside && meal.meal_type !== 'snack';
  const calories = meal.final_calories ?? meal.ai_calories ?? 0;
  return (
    <PressableScale onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {meal.photo_url ? (
          <Image
            source={{ uri: connection.url + meal.photo_url, headers: { Authorization: 'Bearer ' + connection.key } }}
            style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: c.soft }}
            contentFit="cover"
            cachePolicy="memory"
          />
        ) : (
          <IconTile component={mealIcons[meal.meal_type]} size={54} color={mealPalette[meal.meal_type]!.color} bg={mealPalette[meal.meal_type]!.soft} />
        )}
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <T variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{title}</T>
            <View style={{ alignItems: 'flex-end' }}>
              <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{calories}</T>
              <T variant="caption" tone="faint" style={{ marginTop: -2 }}>kcal</T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <MiniMacro label="P" value={Math.round(meal.final_protein ?? meal.ai_protein ?? 0)} color={c.success} />
            <MiniMacro label="C" value={Math.round(meal.final_carbs ?? meal.ai_carbs ?? 0)} color={c.warning} />
            <MiniMacro label="F" value={Math.round(meal.final_fat ?? meal.ai_fat ?? 0)} color={c.purple} />
            {hasPenalty && <Pill label="Outside · −8" tone="danger" />}
            {!hasPenalty && outside && <Pill label="Outside" tone="warning" />}
            {meal.state === 'draft' && <Pill label="Draft" tone="warning" />}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function MiniMacro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
      <T variant="caption" tone="muted">{label}</T>
      <T variant="caption" style={{ fontFamily: font.semibold }}>{value}</T>
    </View>
  );
}

function safeParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
