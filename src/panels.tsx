import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Switch, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Camera, Check, ChevronRight, Coffee, CookingPot, Download, Dumbbell, Flame, Footprints, KeyRound,
  Minus, Moon, PenLine, Plus, RefreshCw, Scale, Sparkles, Store, Target, Trophy, Utensils, X, Zap
} from 'lucide-react-native';
import { api, type Connection } from './api';
import { ConnectionFields } from './Setup';
import {
  computeBurn, computeMetrics, type ActivityLevel, type Goal, type GoalRate, type WorkoutType
} from './nutrition';
import { c, font } from './theme';
import { iconForQuest, type IconComponent } from './icons';
import {
  Button, Card, Divider, Field, IconTile, Pill, PressableScale, ProgressBar,
  Segmented, Sheet, T
} from './ui';
import { dayLabel } from './Today';
import { checkForUpdate, currentVersion, downloadAndInstall, openInstallSettings } from './update';
import type { QuestSetting } from './Settings';
import type { Day, Meal, MealType, Profile, Quest, Report } from './types';

const mealLabel: Record<string, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'a snack'
};

const mealIcon: Record<string, IconComponent> = {
  breakfast: Coffee,
  lunch: Utensils,
  dinner: CookingPot,
  snack: CookingPot
};

export function QuickAddSheet({
  visible, onClose, onMeal, onDescribe, onWorkout, onWeigh, recapDate, onRecap
}: {
  visible: boolean;
  onClose: () => void;
  onMeal: () => void;
  onDescribe: () => void;
  onWorkout: () => void;
  onWeigh: () => void;
  recapDate?: string;
  onRecap: (date: string) => void;
}) {
  const tiles = [
    { title: 'Log a meal', hint: 'Photo or numbers', icon: Utensils, color: c.orange, soft: c.orangeSoft, action: onMeal },
    { title: 'Describe a meal', hint: 'Katoris, rotis, rough portions', icon: PenLine, color: c.primary, soft: c.primarySoft, action: onDescribe },
    { title: 'Log movement', hint: 'Gym, walk or sport', icon: Dumbbell, color: c.danger, soft: c.dangerSoft, action: onWorkout },
    { title: 'Weigh in', hint: 'One number for today', icon: Scale, color: c.purple, soft: c.purpleSoft, action: onWeigh }
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="Quick add" subtitle="Add to your day.">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <PressableScale key={tile.title} onPress={() => { onClose(); tile.action(); }} style={{ flexBasis: '47%', flexGrow: 1 }}>
              <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 20, padding: 15, gap: 12, minHeight: 132 }}>
                <IconTile component={Icon} size={42} bg={tile.soft} color={tile.color} />
                <View style={{ gap: 2 }}>
                  <T variant="bodyStrong">{tile.title}</T>
                  <T variant="caption" tone="muted">{tile.hint}</T>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
      {recapDate && (
        <PressableScale onPress={() => { onClose(); onRecap(recapDate); }} style={{ borderRadius: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.primarySoft, borderRadius: 16, padding: 13 }}>
            <IconTile name="sparkles" size={38} bg={c.white} color={c.primary} />
            <View style={{ flex: 1, gap: 1 }}>
              <T variant="bodyStrong">Yesterday’s recap</T>
              <T variant="caption" tone="muted">See how the day landed</T>
            </View>
            <ChevronRight size={18} color={c.primary} />
          </View>
        </PressableScale>
      )}
    </Sheet>
  );
}

export function QuestMenuSheet({
  visible, quest, day, onClose, onCheck, onMiss, onWorkout, onMeal, onEdit
}: {
  visible: boolean;
  quest: Quest | null;
  day: Day | null;
  onClose: () => void;
  onCheck: (quest: Quest, action: 'complete' | 'salvage' | 'skip') => void;
  onMiss: (quest: Quest) => void;
  onWorkout: (walk?: boolean) => void;
  onMeal: (type: MealType) => void;
  onEdit: () => void;
}) {
  if (!quest) return <Sheet visible={false} onClose={onClose} title="Quest"><View /></Sheet>;
  const done = quest.state === 'completed' || quest.state === 'salvaged';
  const meal = quest.key === 'breakfast' || quest.key === 'lunch' || quest.key === 'dinner';
  return (
    <Sheet visible={visible} onClose={onClose} title={quest.title} subtitle={quest.subtitle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile component={iconForQuest(quest.icon ?? quest.key)} size={50} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pill label={`+${quest.points} pts`} tone="success" />
            <Pill label={`−${quest.penalty} if missed`} tone="danger" />
          </View>
          <T variant="meta" tone="muted">
            {quest.window_start ? `Window ${quest.window_start}–${quest.window_end ?? 'close'}` : 'All day'}
          </T>
        </View>
      </View>

      {done && (
        <Card tone={quest.state === 'salvaged' ? 'warning' : 'success'} style={{ gap: 4 }}>
          <T variant="bodyStrong">
            {quest.state === 'completed' ? 'Locked in' : quest.salvage_title ?? 'Fallback logged'}
          </T>
          <T variant="meta" tone="muted">
            {quest.log?.checked_time ? `At ${quest.log.checked_time} · ` : ''}+{quest.log?.points_awarded ?? 0} pts
          </T>
        </Card>
      )}

      {quest.state === 'penalized' && (
        <Card tone="danger" style={{ gap: 4 }}>
          <T variant="bodyStrong" style={{ color: c.dangerInk }}>Outside food</T>
          <T variant="meta" style={{ color: c.dangerInk }}>−{quest.penalty} points. Honest log, no guilt.</T>
        </Card>
      )}

      {!done && quest.state !== 'penalized' && (
        <View style={{ gap: 9 }}>
          {meal ? (
            <>
              <Button
                label={`Log ${mealLabel[quest.key]}`}
                onPress={() => { onClose(); onMeal(quest.key as MealType); }}
                full
                size="lg"
                icon={<Camera size={17} color={c.white} />}
              />
              <Button
                label={`Skip ${mealLabel[quest.key]} · no penalty`}
                onPress={() => { onCheck(quest, 'skip'); onClose(); }}
                variant="soft"
                full
              />
            </>
          ) : quest.key === 'gym' ? (
            <>
              <Button label="Log a session" onPress={() => { onClose(); onWorkout(false); }} full size="lg" icon={<Dumbbell size={17} color={c.white} />} />
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <Button label="20-min walk" onPress={() => { onClose(); onWorkout(true); }} variant="soft" style={{ flex: 1 }} />
                <Button label="Couldn’t go" onPress={() => { onMiss(quest); onClose(); }} variant="ghost" style={{ flex: 1 }} />
              </View>
            </>
          ) : quest.state === 'salvageable' ? (
            <Button
              label={`${quest.salvage_title ?? 'Fallback'} · +${quest.salvage_points}`}
              onPress={() => { onCheck(quest, 'salvage'); onClose(); }}
              full
              size="lg"
            />
          ) : quest.can_complete ? (
            <Button
              label={quest.key === 'wake' ? 'I’m up' : quest.key === 'sleep' ? 'Heading to bed' : 'Check in'}
              onPress={() => { onCheck(quest, 'complete'); onClose(); }}
              full
              size="lg"
            />
          ) : (
            <Card style={{ gap: 3 }}>
              <T variant="bodyStrong">
                {quest.state === 'later' ? 'Not open yet' : quest.state === 'skipped' ? 'Skipped today' : 'Closed for today'}
              </T>
              <T variant="meta" tone="muted">The day moves on. Fresh start tomorrow.</T>
            </Card>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 9 }}>
        {quest.can_skip && !done && (
          <Button
            label={`Skip · ${day?.skips_remaining ?? 0} left this week`}
            onPress={() => { onCheck(quest, 'skip'); onClose(); }}
            variant="ghost"
            size="sm"
          />
        )}
        <Button label="Edit quest" onPress={onEdit} variant="soft" size="sm" />
      </View>
    </Sheet>
  );
}

const workoutOptions: Array<{ key: WorkoutType; label: string; icon: IconComponent }> = [
  { key: 'strength', label: 'Strength', icon: Dumbbell },
  { key: 'cardio', label: 'Cardio', icon: Flame },
  { key: 'hiit', label: 'HIIT', icon: Zap },
  { key: 'sports', label: 'Sports', icon: Trophy },
  { key: 'walk', label: 'Walk', icon: Footprints }
];

type WorkoutSegment = { id: number; type: WorkoutType; minutes: number; note: string };

export function WorkoutSheet({
  visible, day, initialWalk, connection, onClose, onSaved
}: {
  visible: boolean;
  day: Day | null;
  initialWalk?: boolean;
  connection: Connection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [segments, setSegments] = useState<WorkoutSegment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(0);

  useEffect(() => {
    if (!visible) return;
    nextId.current = 1;
    setSegments([{
      id: 0,
      type: initialWalk ? 'walk' : 'strength',
      minutes: initialWalk ? 20 : 45,
      note: ''
    }]);
    setError('');
  }, [visible, initialWalk]);

  if (!day) return null;

  const burn = segments.reduce((sum, segment) => sum + computeBurn(segment.type, segment.minutes, day.profile.weight_kg), 0);
  const totalMinutes = segments.reduce((sum, segment) => sum + segment.minutes, 0);
  const hasWalkSalvage = segments.some((segment) => segment.type === 'walk' && segment.minutes >= 15 && segment.minutes < 45);
  const gym = day.quests.find((quest) => quest.key === 'gym');

  function update(id: number, patch: Partial<WorkoutSegment>) {
    setSegments((current) => current.map((segment) => segment.id === id ? { ...segment, ...patch } : segment));
  }

  function addSegment() {
    const id = nextId.current++;
    setSegments((current) => [...current, { id, type: 'strength', minutes: 20, note: '' }]);
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(connection, '/api/workouts', 'POST', {
        date: day!.date,
        segments: segments.map((segment) => ({
          type: segment.type,
          minutes: segment.minutes,
          note: segment.note.trim()
        }))
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save that session.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Log movement" subtitle="Add each part of the session.">
      <View style={{ gap: 10 }}>
        {segments.map((segment, index) => (
          <View key={segment.id} style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 13, gap: 11 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T variant="caption" tone="muted">ACTIVITY {index + 1}</T>
              {segments.length > 1 && (
                <PressableScale
                  onPress={() => setSegments((current) => current.filter((item) => item.id !== segment.id))}
                  accessibilityLabel="Remove activity"
                  style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={14} color={c.muted} />
                </PressableScale>
              )}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {workoutOptions.map((option) => {
                const Icon = option.icon;
                const active = segment.type === option.key;
                return (
                  <PressableScale
                    key={option.key}
                    onPress={() => update(segment.id, { type: option.key })}
                    style={{
                      flexBasis: '30%', flexGrow: 1, paddingVertical: 9, borderRadius: 13,
                      alignItems: 'center', gap: 4,
                      backgroundColor: active ? c.primarySoft : c.soft,
                      borderWidth: 1.5, borderColor: active ? c.primary : 'transparent'
                    }}
                  >
                    <Icon size={18} color={active ? c.primary : c.inkSoft} />
                    <T variant="caption" style={{ fontFamily: active ? font.bold : font.semibold, color: active ? c.primary : c.inkSoft }}>
                      {option.label}
                    </T>
                  </PressableScale>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PressableScale
                onPress={() => update(segment.id, { minutes: Math.max(3, segment.minutes - 5) })}
                accessibilityLabel="Decrease minutes"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}
              >
                <Minus size={16} color={c.ink} />
              </PressableScale>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <TextInput
                  value={String(segment.minutes)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  onChangeText={(value) => {
                    const next = Number(value.replace(/[^0-9]/g, ''));
                    update(segment.id, { minutes: Number.isFinite(next) ? Math.min(300, Math.max(3, next || 3)) : 3 });
                  }}
                  style={{ fontFamily: font.extrabold, fontSize: 28, color: c.ink, minWidth: 40, textAlign: 'right', padding: 0 }}
                />
                <T variant="meta" tone="muted">min</T>
              </View>
              <PressableScale
                onPress={() => update(segment.id, { minutes: Math.min(300, segment.minutes + 5) })}
                accessibilityLabel="Increase minutes"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={16} color={c.ink} />
              </PressableScale>
              <View style={{ flex: 1 }} />
              <T variant="caption" tone="muted">+{computeBurn(segment.type, segment.minutes, day.profile.weight_kg)} kcal</T>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.soft, borderRadius: 13, paddingHorizontal: 12, height: 42 }}>
              <TextInput
                value={segment.note}
                onChangeText={(note) => update(segment.id, { note })}
                placeholder="What did you do? e.g. chest, treadmill"
                placeholderTextColor={c.faint}
                maxLength={60}
                style={{ flex: 1, fontFamily: font.medium, fontSize: 14, color: c.ink, padding: 0 }}
              />
            </View>
          </View>
        ))}
      </View>

      <Button label="Add another activity" onPress={addSegment} variant="soft" full icon={<Plus size={16} color={c.ink} />} />

      <Card tone="primary" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile component={Flame} size={40} bg={c.white} color={c.primary} />
        <View style={{ flex: 1, gap: 1 }}>
          <T variant="bodyStrong">+{burn} kcal back</T>
          <T variant="caption" tone="muted">{totalMinutes} min across {segments.length} {segments.length === 1 ? 'activity' : 'activities'}.</T>
        </View>
      </Card>

      {hasWalkSalvage && gym?.can_salvage && (
        <View style={{ backgroundColor: c.warningSoft, borderRadius: 14, padding: 12 }}>
          <T variant="meta" style={{ color: c.warningInk }}>
            The walk counts as your low-energy gym fallback (+{gym.salvage_points} pts) if no harder session is logged.
          </T>
        </View>
      )}
      {!!error && (
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: 13, padding: 12 }}>
          <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
        </View>
      )}
      <Button label={busy ? 'Saving…' : 'Save session'} onPress={save} loading={busy} disabled={busy || segments.length === 0} full size="lg" />
    </Sheet>
  );
}

export function WeightSheet({
  visible, day, connection, onClose, onSaved
}: {
  visible: boolean;
  day: Day | null;
  connection: Connection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (visible && day) setWeight(String(day.profile.weight_kg));
    if (visible) setError('');
  }, [visible, day]);
  if (!day) return null;

  async function save() {
    const value = Number(weight);
    if (!Number.isFinite(value) || value < 25 || value > 400) {
      setError('Enter a weight between 25 and 400 kg.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(connection, '/api/weight', 'POST', { date: day!.date, weight_kg: value });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save that weight.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Weigh in" subtitle="Once a day. The trend is what matters.">
      <Card style={{ alignItems: 'center', gap: 14, paddingVertical: 24 }}>
        <IconTile component={Scale} size={52} bg={c.primarySoft} color={c.primary} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <T variant="numberMd">{day.profile.weight_kg.toFixed(1)}</T>
          <T variant="meta" tone="muted">kg last known</T>
        </View>
        <T variant="meta" tone="muted">Morning, after the loo, before chai.</T>
      </Card>
      <Field label="Today’s weight" value={weight} keyboardType="decimal-pad" onChangeText={setWeight} suffix="kg" />
      {!!error && (
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: 13, padding: 12 }}>
          <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
        </View>
      )}
      <Button label={busy ? 'Saving…' : 'Save weight'} onPress={save} loading={busy} disabled={busy} full size="lg" />
    </Sheet>
  );
}

export function ProfileSheet({
  visible, profile, connection, onClose, onSaved
}: {
  visible: boolean;
  profile: Profile | null;
  connection: Connection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    sex: 'male' as 'male' | 'female',
    age: '26', height: '170', weight: '70',
    activity_level: 'moderate' as ActivityLevel,
    timezone: 'Asia/Kolkata'
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible || !profile) return;
    setDraft({
      sex: profile.sex,
      age: String(profile.age),
      height: String(profile.height_cm),
      weight: String(profile.weight_kg),
      activity_level: profile.activity_level,
      timezone: profile.timezone
    });
    setError('');
  }, [visible, profile]);
  if (!profile) return null;

  const activities: Array<{ key: ActivityLevel; title: string; hint: string }> = [
    { key: 'sedentary', title: 'Mostly seated', hint: 'Desk job · under 5k steps' },
    { key: 'light', title: 'Lightly active', hint: 'Some walking · 5–7k steps' },
    { key: 'moderate', title: 'Moderately active', hint: 'On your feet · 7–10k steps' },
    { key: 'active', title: 'Very active', hint: 'Active most of the day · 10k+ steps' },
    { key: 'very_active', title: 'Athlete', hint: 'Physical job or heavy daily movement' }
  ];

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(connection, '/api/profile', 'PUT', {
        ...profile,
        sex: draft.sex,
        age: Number(draft.age),
        height_cm: Number(draft.height),
        weight_kg: Number(draft.weight),
        activity_level: draft.activity_level,
        timezone: draft.timezone,
        custom_target_calories: profile!.custom_target_calories
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Your profile" subtitle="Your daily budget is built from these.">
      <T variant="caption" tone="muted">SEX</T>
      <Segmented options={[{ key: 'male', label: 'Male' }, { key: 'female', label: 'Female' }]} value={draft.sex} onChange={(value) => setDraft({ ...draft, sex: value })} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Age" value={draft.age} keyboardType="number-pad" onChangeText={(value) => setDraft({ ...draft, age: value })} containerStyle={{ flex: 1 }} />
        <Field label="Height" value={draft.height} suffix="cm" keyboardType="decimal-pad" onChangeText={(value) => setDraft({ ...draft, height: value })} containerStyle={{ flex: 1 }} />
      </View>
      <Field label="Weight" value={draft.weight} suffix="kg" keyboardType="decimal-pad" onChangeText={(value) => setDraft({ ...draft, weight: value })} />
      <T variant="caption" tone="muted">ACTIVITY OUTSIDE THE GYM</T>
      <View style={{ gap: 7 }}>
        {activities.map((activity) => (
          <PressableScale key={activity.key} onPress={() => setDraft({ ...draft, activity_level: activity.key })}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14,
              backgroundColor: draft.activity_level === activity.key ? c.primarySoft : c.soft
            }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: draft.activity_level === activity.key ? c.primary : c.faint, alignItems: 'center', justifyContent: 'center' }}>
                {draft.activity_level === activity.key && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />}
              </View>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">{activity.title}</T>
                <T variant="caption" tone="muted">{activity.hint}</T>
              </View>
            </View>
          </PressableScale>
        ))}
      </View>
      <Field label="Time zone" value={draft.timezone} autoCapitalize="none" onChangeText={(value) => setDraft({ ...draft, timezone: value })} />
      {!!error && (
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: 13, padding: 12 }}>
          <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
        </View>
      )}
      <Button label={busy ? 'Saving…' : 'Save profile'} onPress={save} loading={busy} disabled={busy} full size="lg" />
    </Sheet>
  );
}

export function GoalSheet({
  visible, profile, connection, onClose, onSaved
}: {
  visible: boolean;
  profile: Profile | null;
  connection: Connection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [goal, setGoal] = useState<Goal>('lose');
  const [rate, setRate] = useState<GoalRate>('steady');
  const [customTarget, setCustomTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible || !profile) return;
    setGoal(profile.goal);
    setRate((profile.goal_rate as GoalRate) ?? 'steady');
    setCustomTarget(profile.custom_target_calories);
    setError('');
  }, [visible, profile]);
  if (!profile) return null;

  const preview = computeMetrics({
    sex: profile.sex,
    age: profile.age,
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    activity_level: profile.activity_level,
    goal,
    goal_rate: rate,
    custom_target_calories: customTarget
  });
  const target = customTarget ?? preview.recommended_calories;

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(connection, '/api/profile', 'PUT', {
        ...profile,
        goal,
        goal_rate: rate,
        custom_target_calories: customTarget
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save your goal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Adjust your goal" subtitle="Updates today’s budget right away.">
      <Segmented
        options={[
          { key: 'lose', label: 'Lose fat' },
          { key: 'maintain', label: 'Maintain' },
          { key: 'gain', label: 'Gain' }
        ]}
        value={goal}
        onChange={setGoal}
      />
      {goal !== 'maintain' && (
        <>
          <Segmented
            options={[
              { key: 'gentle', label: 'Gentle' },
              { key: 'steady', label: 'Steady' },
              { key: 'fast', label: 'Faster' }
            ]}
            value={rate}
            onChange={setRate}
          />
          <T variant="meta" tone="muted">
            {goal === 'lose' ? `${rate === 'gentle' ? '−250' : rate === 'steady' ? '−500' : '−750'} kcal · about ${rate === 'gentle' ? '0.25' : rate === 'steady' ? '0.5' : '0.75'} kg a week` : `${rate === 'gentle' ? '+150' : rate === 'steady' ? '+300' : '+500'} kcal · a small surplus`}
          </T>
        </>
      )}
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
        <T variant="caption" tone="muted">DAILY TARGET</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <PressableScale onPress={() => setCustomTarget(Math.max(1200, target - 50))} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Minus size={18} color={c.ink} />
          </PressableScale>
          <T variant="number">{target.toLocaleString('en-IN')}</T>
          <PressableScale onPress={() => setCustomTarget(Math.min(6000, target + 50))} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={18} color={c.ink} />
          </PressableScale>
        </View>
        {customTarget !== null && (
          <Button label={`Use recommended · ${preview.recommended_calories}`} onPress={() => setCustomTarget(null)} size="md" variant="soft" full />
        )}
        <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pill label={`Protein ${preview.protein_target} g`} tone="success" />
          <Pill label={`Carbs ${preview.carbs_target} g`} tone="warning" />
          <Pill label={`Fat ${preview.fat_target} g`} tone="purple" />
        </View>
      </Card>
      <T variant="meta" tone="muted">
        BMR {preview.bmr} · maintenance {preview.tdee} · workouts add calories back on top.
      </T>
      {!!error && (
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: 13, padding: 12 }}>
          <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
        </View>
      )}
      <Button label={busy ? 'Saving…' : 'Save goal'} onPress={save} loading={busy} disabled={busy} full size="lg" />
    </Sheet>
  );
}

const iconChoices = ['sun', 'dumbbell', 'coffee', 'bowl', 'soup', 'moon', 'camera', 'sparkles', 'target', 'book'];

export function QuestEditorSheet({
  visible, quest, connection, onClose, onSaved
}: {
  visible: boolean;
  quest: QuestSetting | null;
  connection: Connection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [icon, setIcon] = useState('sparkles');
  const [points, setPoints] = useState('10');
  const [penalty, setPenalty] = useState('0');
  const [salvage, setSalvage] = useState('0');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(quest?.title ?? '');
    setSubtitle(quest?.subtitle ?? '');
    setIcon(quest?.icon ?? 'sparkles');
    setPoints(String(quest?.points ?? 10));
    setPenalty(String(quest?.penalty ?? 0));
    setSalvage(String(quest?.salvage_points ?? 0));
    setError('');
    setConfirming(false);
  }, [visible, quest]);

  async function save() {
    if (!title.trim()) {
      setError('Give this quest a name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        icon,
        type: 'check',
        points: Number(points),
        penalty: Number(penalty),
        salvage_points: Number(salvage),
        salvage_title: salvage && Number(salvage) > 0 ? 'Honest fallback' : null,
        salvage_subtitle: salvage && Number(salvage) > 0 ? 'A smaller version still counts.' : null,
        window_start: start.trim() || null,
        window_end: end.trim() || null,
        deadline: end.trim() ? null : '23:59',
        salvage_until: end.trim() ? null : '23:59'
      };
      if (quest) await api(connection, `/api/quests/${quest.id}`, 'PATCH', body);
      else await api(connection, '/api/quests', 'POST', body);
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save that quest.');
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!quest) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await api(connection, `/api/quests/${quest.id}`, 'DELETE');
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t archive that quest.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={quest ? 'Edit quest' : 'New quest'}
      subtitle={quest ? 'Changes take effect tomorrow.' : 'Something small worth doing every day.'}
    >
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Read 10 pages" maxLength={80} />
      <Field label="Subtitle" value={subtitle} onChangeText={setSubtitle} placeholder="Why it matters" maxLength={140} />
      <T variant="caption" tone="muted">ICON</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {iconChoices.map((name) => (
          <PressableScale key={name} onPress={() => setIcon(name)}>
            <View style={{ borderRadius: 14, padding: 2, borderWidth: 1.5, borderColor: icon === name ? c.primary : 'transparent' }}>
              <IconTile component={iconForQuest(name)} size={40} bg={c.soft} color={icon === name ? c.primary : c.muted} />
            </View>
          </PressableScale>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Points" value={points} keyboardType="number-pad" onChangeText={setPoints} containerStyle={{ flex: 1 }} />
        <Field label="Miss penalty" value={penalty} keyboardType="number-pad" onChangeText={setPenalty} containerStyle={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Fallback points" value={salvage} keyboardType="number-pad" onChangeText={setSalvage} containerStyle={{ flex: 1 }} />
        <Field label="Opens (HH:MM)" value={start} onChangeText={setStart} placeholder="optional" containerStyle={{ flex: 1 }} />
      </View>
      <Field label="Closes (HH:MM)" value={end} onChangeText={setEnd} placeholder="Leave empty for all day" />
      {!!error && (
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: 13, padding: 12 }}>
          <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
        </View>
      )}
      <Button label={busy ? 'Saving…' : quest ? 'Save changes' : 'Create quest'} onPress={save} loading={busy} disabled={busy} full size="lg" />
      {quest && (
        <Button
          label={confirming ? 'Tap again to archive' : 'Archive quest'}
          onPress={archive}
          variant="danger"
          size="sm"
          disabled={busy}
        />
      )}
    </Sheet>
  );
}

export function ServerSheet({
  visible, connection, onClose, onSaved
}: {
  visible: boolean;
  connection: Connection;
  onClose: () => void;
  onSaved: (next: Connection) => void;
}) {
  const [draft, setDraft] = useState(connection);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (visible) {
      setDraft(connection);
      setError('');
      setOk(false);
    }
  }, [visible, connection]);

  async function save() {
    setBusy(true);
    setError('');
    setOk(false);
    try {
      const next = { url: new URL(draft.url.trim()).origin, key: draft.key.trim() };
      if (!next.url.startsWith('https://') && !(__DEV__ && next.url.startsWith('http://127.0.0.1'))) {
        throw new Error('Enter an HTTPS server address.');
      }
      await api(next, '/api/ping');
      setOk(true);
      onSaved(next);
      setTimeout(onClose, 450);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t reach that server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Server connection" subtitle="The Worker that stores your data.">
      <ConnectionFields value={draft} change={setDraft} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: c.primarySoft, borderRadius: 14, padding: 12 }}>
        <KeyIcon />
        <T variant="meta" style={{ color: c.primaryPressed, flex: 1 }}>
          Stored encrypted on this device. Used to authenticate every request to your Worker.
        </T>
      </View>
      {!!ok && <Pill label="Connected" tone="success" />}
      {!!error && (
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: 13, padding: 12 }}>
          <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
        </View>
      )}
      <Button label={busy ? 'Testing…' : 'Test & save'} onPress={save} loading={busy} disabled={busy || !draft.url.trim() || draft.key.trim().length < 20} full size="lg" />
    </Sheet>
  );
}

function KeyIcon() {
  return <IconTile component={KeyRound} size={22} bg={c.white} color={c.primary} iconSize={12} />;
}

export function RecapSheet({
  visible, date, connection, onClose, onSeen
}: {
  visible: boolean;
  date: string;
  connection: Connection;
  onClose: () => void;
  onSeen?: () => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible || !date) return;
    setReport(null);
    setError('');
    let active = true;
    api<Report>(connection, `/api/report/${date}`)
      .then((value) => { if (active) setReport(value); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Couldn’t load that day.'); });
    return () => { active = false; };
  }, [visible, date, connection]);

  const score = report?.score;
  return (
    <Sheet visible={visible} onClose={onClose} title={date ? dayLabel(date, true) : 'Recap'} subtitle="A calm look back.">
      {!report && !error && <View style={{ paddingVertical: 30, alignItems: 'center' }}><ActivityIndicator color={c.primary} /></View>}
      {!!error && <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>}
      {report && score && (
        <>
          <Card tone="primary" style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T variant="caption" tone="primary">THE DAY</T>
              <Pill label={score.day_tier?.replace('_', ' ') ?? 'open'} tone="white" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <T variant="number">{score.quests_completed}</T>
              <T variant="heading" style={{ color: c.primaryPressed }}>/ {score.quests_total} quests</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Mini label="XP" value={`+${score.xp_earned}`} />
              <Mini label="Rhythm" value={`${score.streak_after} days`} />
              <Mini label="Fallbacks" value={`${score.quests_salvaged}`} />
            </View>
          </Card>
          <Card style={{ gap: 8 }}>
            <T variant="subheading">Calories</T>
            <T variant="body">
              {score.consumed_calories?.toLocaleString('en-IN') ?? 0} / {score.target_calories?.toLocaleString('en-IN') ?? 0} kcal
              {score.bonus_points > 0 ? ` · +${score.bonus_points} bonus` : ''}
            </T>
            <T variant="meta" tone="muted">{score.calorie_verdict?.replace('_', ' ') ?? 'no data'}</T>
          </Card>
          {!!score.reflection_text && (
            <Card tone="success" style={{ flexDirection: 'row', gap: 11 }}>
              <IconTile name="sparkles" size={38} bg={c.white} color={c.successInk} />
              <T variant="meta" style={{ color: c.successInk, flex: 1 }}>{score.reflection_text}</T>
            </Card>
          )}
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {report.quests.map((quest, index) => (
              <View key={quest.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }}>
                  <IconTile component={Sparkles} size={34} bg={c.soft} color={c.inkSoft} iconSize={16} />
                  <T variant="bodyStrong" style={{ flex: 1 }}>{quest.title}</T>
                  <Pill label={quest.status === 'completed' ? `+${quest.points_awarded}` : quest.status.replace('_', ' ')} tone={quest.status === 'completed' ? 'success' : quest.status === 'failed' ? 'danger' : 'soft'} />
                </View>
                {index < report.quests.length - 1 && <Divider />}
              </View>
            ))}
          </Card>
          <Button label="Done" onPress={() => { onSeen?.(); onClose(); }} full size="lg" />
        </>
      )}
      {report && !score && <T variant="meta" tone="muted">This day is still in progress.</T>}
    </Sheet>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <T variant="bodyStrong" style={{ color: c.primaryPressed }}>{value}</T>
      <T variant="caption" tone="primary">{label}</T>
    </View>
  );
}

export function SleepSheet({
  visible, onClose, connection, device, usageEnabled, onToggleUsage
}: {
  visible: boolean;
  onClose: () => void;
  connection: Connection;
  device: string;
  usageEnabled: boolean;
  onToggleUsage: (value: boolean) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Sleep verification" subtitle="Honest, not surveillance.">
      <Card style={{ gap: 9 }}>
        <T variant="bodyStrong">What Quest can see</T>
        <T variant="meta" tone="muted">
          Quest only sees when this app opens or moves to the background. It cannot see other apps or anything else on your phone.
        </T>
      </Card>
      <Card style={{ gap: 9 }}>
        <T variant="bodyStrong">How the check works</T>
        <T variant="meta" tone="muted">
          Lock in when you put the phone down. If there’s a gap in activity, your check-in stays self-reported. Only sustained use past the two-minute grace window voids the sleep quest.
        </T>
      </Card>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="bodyStrong">Verify with screen time</T>
            <T variant="meta" tone="muted">
              {Platform.OS === 'android'
                ? 'Uses Android Usage Access. If you keep using the phone after lock-in, sleep is voided.'
                : 'iOS only sees this app. The check-in stays self-reported.'}
            </T>
          </View>
          {Platform.OS === 'android' && (
            <Switch
              value={usageEnabled}
              onValueChange={onToggleUsage}
              trackColor={{ false: c.soft, true: c.primary }}
              thumbColor={c.white}
              ios_backgroundColor={c.soft}
            />
          )}
        </View>
        {usageEnabled && <Pill label="Watching this phone tonight" tone="primary" />}
      </Card>
      <Pill label="Two-minute grace window" tone="primary" />
      <Button label="Got it" onPress={onClose} full size="lg" />
    </Sheet>
  );
}

export function GraceSheet({
  visible, ends, onClose, onGrace
}: {
  visible: boolean;
  ends: number;
  onClose: () => void;
  onGrace: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible]);
  const left = Math.max(0, Math.ceil((ends - now) / 1000));
  return (
    <Sheet visible={visible} onClose={onClose} title="Putting the phone down?" subtitle="Two-minute grace, then sleep.">
      <Card tone="primary" style={{ gap: 8, alignItems: 'center', paddingVertical: 24 }}>
        <IconTile component={Moon} size={48} bg={c.white} color={c.primary} />
        <T variant="heading">{left > 0 ? `${left}s` : 'Grace ended'}</T>
        <T variant="meta" tone="primary" align="center" style={{ maxWidth: 270 }}>
          {left > 0
            ? 'Lock your phone within two minutes to keep tonight’s sleep quest.'
            : 'The grace window ended. Fresh start tomorrow.'}
        </T>
      </Card>
      {left > 0 && <Button label="Putting it down now" onPress={() => { onGrace(); onClose(); }} full size="lg" />}
      <Button label="I need to stay up" onPress={onClose} variant="ghost" full />
    </Sheet>
  );
}

export function ReminderSheet({
  visible, onClose, onSave
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (input: { title: string; body: string; time: string; date: string | null; mode: 'notification' | 'alarm' }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [time, setTime] = useState('08:00');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<'notification' | 'alarm'>('notification');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setBody('');
    setTime('08:00');
    setDate('');
    setMode('notification');
    setError('');
  }, [visible]);

  async function save() {
    if (!title.trim()) {
      setError('Give the reminder a name.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError('Use a time like 06:45.');
      return;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Use a date like 2026-11-24, or leave it blank for daily.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({ title: title.trim(), body: body.trim(), time, date: date || null, mode });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the reminder.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Add reminder" subtitle="One custom nudge.">
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Evening walk" maxLength={80} />
      <Field label="Message" value={body} onChangeText={setBody} placeholder="What should it say?" maxLength={140} multiline />
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <Field label="Time" value={time} onChangeText={setTime} placeholder="18:30" containerStyle={{ flex: 1 }} />
        <Field label="Date (optional)" value={date} onChangeText={setDate} placeholder="Daily" autoCapitalize="none" containerStyle={{ flex: 1 }} />
      </View>
      <Segmented
        options={[{ key: 'notification', label: 'Notification' }, { key: 'alarm', label: 'Alarm' }]}
        value={mode}
        onChange={setMode}
      />
      <T variant="caption" tone="muted">
        Alarm uses the Quest alarm sound with phone alarm priority. Notification uses the normal tone.
      </T>
      {!!error && <T variant="caption" style={{ color: c.dangerInk }}>{error}</T>}
      <Button label={busy ? 'Saving…' : 'Save reminder'} onPress={save} loading={busy} disabled={busy} full size="lg" />
    </Sheet>
  );
}

export function UpdateSheet({
  visible, onClose
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<'checking' | 'latest' | 'available' | 'downloading' | 'opened' | 'error' | 'unsupported'>('checking');
  const [info, setInfo] = useState<{ version: string; notes: string; apk_url: string } | null>(null);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(currentVersion());

  useEffect(() => {
    if (!visible) return;
    setState('checking');
    setError('');
    setCurrent(currentVersion());
    let active = true;
    checkForUpdate()
      .then((result) => {
        if (!active) return;
        if (!result.supported) {
          setState('unsupported');
          return;
        }
        setCurrent(result.current);
        if (result.available && result.info) {
          setInfo(result.info);
          setState('available');
        } else {
          setState('latest');
        }
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Could not check for updates.');
        setState('error');
      });
    return () => { active = false; };
  }, [visible]);

  async function install() {
    if (!info) return;
    setState('downloading');
    setError('');
    try {
      await downloadAndInstall(info);
      setState('opened');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open the installer.');
      setState('error');
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Update Quest" subtitle="Install the newest build over this one.">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile component={RefreshCw} size={40} bg={c.primarySoft} color={c.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="bodyStrong">You’re on v{current}</T>
          <T variant="caption" tone="muted">Updates are Android APKs from GitHub Releases.</T>
        </View>
      </Card>

      {state === 'checking' && (
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
          <ActivityIndicator color={c.primary} />
          <T variant="meta" tone="muted">Checking GitHub…</T>
        </View>
      )}

      {state === 'latest' && (
        <Card tone="success" style={{ gap: 4 }}>
          <T variant="bodyStrong">This is the latest build.</T>
          <T variant="meta" style={{ color: c.successInk }}>Nothing to install right now.</T>
        </Card>
      )}

      {state === 'unsupported' && (
        <Card style={{ gap: 4 }}>
          <T variant="bodyStrong">iOS updates come from TestFlight or the App Store.</T>
          <T variant="meta" tone="muted">The in-app APK updater is Android-only.</T>
        </Card>
      )}

      {state === 'available' && info && (
        <>
          <Card tone="primary" style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T variant="subheading">v{info.version} is ready</T>
              <IconTile component={Download} size={34} bg={c.white} color={c.primary} iconSize={16} />
            </View>
            {!!info.notes && <T variant="meta" style={{ color: c.primaryPressed }}>{info.notes}</T>}
          </Card>
          <Button label="Download & install" onPress={install} full size="lg" icon={<Download size={17} color={c.white} />} />
          <T variant="caption" tone="muted" align="center">
            Android will ask you to confirm the install. The app restarts when it finishes.
          </T>
        </>
      )}

      {state === 'downloading' && (
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
          <ActivityIndicator size="large" color={c.primary} />
          <T variant="bodyStrong">Downloading the next build…</T>
          <T variant="caption" tone="muted" align="center">Keep the app open. The installer opens when it’s ready.</T>
        </View>
      )}

      {state === 'opened' && (
        <Card tone="success" style={{ gap: 4 }}>
          <T variant="bodyStrong">Installer opened.</T>
          <T variant="meta" style={{ color: c.successInk }}>Confirm the install with Android, then reopen Quest.</T>
        </Card>
      )}

      {state === 'error' && (
        <>
          <Card tone="danger" style={{ gap: 4 }}>
            <T variant="bodyStrong" style={{ color: c.dangerInk }}>Update couldn’t finish.</T>
            <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
          </Card>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Button label="Try again" onPress={() => {
              setState('checking');
              setError('');
              checkForUpdate()
                .then((result) => {
                  setCurrent(result.current);
                  if (result.available && result.info) { setInfo(result.info); setState('available'); }
                  else setState('latest');
                })
                .catch((caught) => { setError(caught instanceof Error ? caught.message : 'Could not check.'); setState('error'); });
            }} variant="soft" size="sm" />
            <Button label="Install settings" onPress={() => { void openInstallSettings(); }} variant="ghost" size="sm" />
          </View>
        </>
      )}
    </Sheet>
  );
}
