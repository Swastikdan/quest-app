import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, ArrowRight, Dumbbell, Flame, Footprints, House,
  Minus, MapPin, Plus, TrendingDown, TrendingUp, Trophy
} from 'lucide-react-native';
import { computeBurn, computeMetrics, GOAL_RATE_HINTS, type ActivityLevel, type Goal, type GoalRate } from './nutrition';
import { api, RequestError, saveConnection, type Connection } from './api';
import { c } from './theme';
import {
  Button, Card, Field, IconTile, LogoMark, Pill, PressableScale, ProgressBar, Segmented, T
} from './ui';
import type { Profile } from './types';

const steps = ['Welcome', 'About you', 'Goal', 'Activity', 'Budget', 'Connect'] as const;

type Draft = {
  sex: 'male' | 'female';
  age: string;
  height: string;
  weight: string;
  activity_level: ActivityLevel;
  goal: Goal;
  goal_rate: GoalRate;
  timezone: string;
};

const goalOptions: Array<{ key: Goal; title: string; hint: string; icon: typeof TrendingDown; color: string; soft: string }> = [
  { key: 'lose', title: 'Lose fat', hint: 'A steady deficit without going hungry', icon: TrendingDown, color: c.successInk, soft: c.successSoft },
  { key: 'maintain', title: 'Maintain', hint: 'Hold your weight and build the rhythm', icon: Minus, color: c.primary, soft: c.primarySoft },
  { key: 'gain', title: 'Gain muscle', hint: 'A small surplus with enough protein', icon: TrendingUp, color: c.purple, soft: c.purpleSoft }
];

const activityOptions: Array<{ key: ActivityLevel; title: string; hint: string; icon: typeof House }> = [
  { key: 'sedentary', title: 'Mostly seated', hint: 'Desk job · under 5k steps', icon: House },
  { key: 'light', title: 'Lightly active', hint: 'Some walking · 5–7k steps', icon: Footprints },
  { key: 'moderate', title: 'Moderately active', hint: 'On your feet · 7–10k steps', icon: Dumbbell },
  { key: 'active', title: 'Very active', hint: 'Active most of the day · 10k+ steps', icon: Flame },
  { key: 'very_active', title: 'Athlete', hint: 'Physical job or training twice a day', icon: Trophy }
];

export function normalizeConnection(value: Connection): Connection {
  const parsed = new URL(value.url.trim());
  const devLoopback = __DEV__ && parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1';
  if ((!devLoopback && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
    throw new Error('Enter an HTTPS server address.');
  }
  return { url: parsed.origin, key: value.key.trim() };
}

export function ConnectionFields({ value, change }: { value: Connection; change: (value: Connection) => void }) {
  return (
    <>
      <Field
        label="Server address"
        placeholder="https://quest.example.workers.dev"
        value={value.url}
        autoCapitalize="none"
        keyboardType="url"
        onChangeText={(url) => change({ ...value, url })}
      />
      <Field
        label="API key"
        placeholder="64-character key"
        value={value.key}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        onChangeText={(key) => change({ ...value, key })}
      />
    </>
  );
}

export default function Setup({ onConnect }: { onConnect: (next: Connection) => void }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    sex: 'male',
    age: '26',
    height: '170',
    weight: '70',
    activity_level: 'moderate',
    goal: 'lose',
    goal_rate: 'steady',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Kolkata'
  });
  const [customTarget, setCustomTarget] = useState<number | null>(null);
  const [startMode, setStartMode] = useState<'today' | 'tomorrow'>(() => {
    const hour = new Date().getHours();
    return hour >= 20 || hour < 5 ? 'tomorrow' : 'today';
  });
  const [connection, setConnection] = useState<Connection>({
    url: process.env.EXPO_PUBLIC_QUEST_URL ?? 'https://quest.swastik.workers.dev',
    key: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigating = useRef(false);

  const age = Number(draft.age) || 0;
  const height = Number(draft.height) || 0;
  const weight = Number(draft.weight) || 0;
  const validBody = age >= 13 && age <= 110 && height >= 100 && height <= 250 && weight >= 25 && weight <= 400;
  const preview = computeMetrics({
    sex: draft.sex,
    age,
    height_cm: height,
    weight_kg: weight,
    activity_level: draft.activity_level,
    goal: draft.goal,
    goal_rate: draft.goal_rate,
    custom_target_calories: customTarget
  });
  const target = customTarget ?? preview.recommended_calories;
  const workoutPreview = computeBurn('strength', 45, weight || 70);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function next() {
    if (navigating.current) return;
    navigating.current = true;
    setError('');
    setStep((current) => Math.min(steps.length - 1, current + 1));
    setTimeout(() => { navigating.current = false; }, 380);
  }

  function back() {
    if (navigating.current) return;
    navigating.current = true;
    setError('');
    setStep((current) => Math.max(0, current - 1));
    setTimeout(() => { navigating.current = false; }, 380);
  }

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const credentials = normalizeConnection(connection);
      if (!credentials.key) throw new Error('Paste your API key.');
      await api(credentials, '/api/ping');
      const existing = await api<{ profile: Profile | null }>(credentials, '/api/profile');
      if (!existing.profile) {
        await api(credentials, '/api/profile', 'PUT', {
          sex: draft.sex,
          age,
          height_cm: height,
          weight_kg: weight,
          activity_level: draft.activity_level,
          goal: draft.goal,
          goal_rate: draft.goal_rate,
          custom_target_calories: customTarget,
          timezone: draft.timezone
        });
      }
      await api(credentials, '/api/profile/start', 'POST', { mode: startMode });
      await saveConnection(credentials);
      onConnect(credentials);
    } catch (caught) {
      setError(
        caught instanceof RequestError && caught.status === 401
          ? 'Your server didn’t recognise that key. Check for extra spaces.'
          : caught instanceof Error
            ? caught.message
            : 'Couldn’t connect to your server.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 26, gap: 16, flexGrow: 1, minHeight: '100%' }}
        >
          {step > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <PressableScale
                onPress={back}
                accessibilityLabel="Back"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowLeft size={18} color={c.ink} strokeWidth={2.3} />
              </PressableScale>
              <ProgressBar value={step / (steps.length - 1)} style={{ flex: 1 }} height={5} />
              <T variant="caption" tone="faint">{step}/{steps.length - 1}</T>
            </View>
          )}

          {step === 0 && (
            <>
              <View style={{ alignItems: 'center', gap: 12, paddingTop: 18 }}>
                <LogoMark size={58} />
                <T variant="display" align="center" style={{ fontSize: 36, lineHeight: 41 }}>
                  Your day, in rhythm.
                </T>
                <T tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22, maxWidth: 300 }}>
                  A calm check-in for food, movement and sleep.
                </T>
              </View>

              <Card style={{ padding: 20, gap: 13 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T variant="caption" tone="muted">TODAY</T>
                  <Pill label="×1.05" tone="primary" />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                  <T variant="number">1,980</T>
                  <T variant="meta" tone="muted">kcal left</T>
                </View>
                <ProgressBar value={0.62} height={9} />
                <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                  <Pill label="Up for the day" tone="success" />
                  <Pill label="Home breakfast" tone="success" />
                  <Pill label="Gym · 45 min" tone="soft" />
                  <Pill label="Lunch" tone="soft" />
                </View>
              </Card>

              <View style={{ flexGrow: 1 }} />
              <Button label="Let’s set you up" onPress={next} full size="lg" />
            </>
          )}

          {step === 1 && (
            <>
              <StepTitle hint="Used to calculate your daily budget.">A few numbers to start.</StepTitle>
              <View style={{ alignItems: 'center' }}><T variant="caption" tone="muted">SEX</T></View>
              <Segmented
                options={[{ key: 'male', label: 'Male' }, { key: 'female', label: 'Female' }]}
                value={draft.sex}
                onChange={(value) => set('sex', value)}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Field label="Age" value={draft.age} keyboardType="number-pad" onChangeText={(value) => set('age', value)} containerStyle={{ flex: 1 }} />
                <Field label="Height" value={draft.height} suffix="cm" keyboardType="decimal-pad" onChangeText={(value) => set('height', value)} containerStyle={{ flex: 1 }} />
                <Field label="Weight" value={draft.weight} suffix="kg" keyboardType="decimal-pad" onChangeText={(value) => set('weight', value)} containerStyle={{ flex: 1 }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.soft, borderRadius: 16, padding: 14 }}>
                <MapPin size={18} color={c.inkSoft} />
                <View style={{ flex: 1, gap: 1 }}>
                  <T variant="bodyStrong">Time zone</T>
                  <T variant="meta" tone="muted">{draft.timezone}</T>
                </View>
                <Pill label="Auto" tone="soft" />
              </View>
              <View style={{ flexGrow: 1 }} />
              <Button label="Continue" onPress={next} full size="lg" disabled={!validBody} />
            </>
          )}

          {step === 2 && (
            <>
              <StepTitle>What are you working toward?</StepTitle>
              <View style={{ gap: 9 }}>
                {goalOptions.map((option) => (
                  <PressableScale key={option.key} onPress={() => set('goal', option.key)}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14,
                      borderRadius: 18, borderWidth: 1.5,
                      borderColor: draft.goal === option.key ? c.primary : c.line,
                      backgroundColor: draft.goal === option.key ? c.primarySoft : c.surface
                    }}>
                      <IconTile component={option.icon} size={44} bg={option.soft} color={option.color} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="bodyStrong">{option.title}</T>
                        <T variant="meta" tone="muted">{option.hint}</T>
                      </View>
                      {draft.goal === option.key && <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.primary }} />}
                    </View>
                  </PressableScale>
                ))}
              </View>

              {draft.goal !== 'maintain' && (
                <>
                  <T variant="caption" tone="muted">PACE</T>
                  <Segmented
                    options={[
                      { key: 'gentle', label: 'Gentle' },
                      { key: 'steady', label: 'Steady' },
                      { key: 'fast', label: 'Faster' }
                    ]}
                    value={draft.goal_rate}
                    onChange={(value) => set('goal_rate', value)}
                  />
                  <T variant="meta" tone="muted">{GOAL_RATE_HINTS[draft.goal][draft.goal_rate]}</T>
                </>
              )}
              <Button label="Continue" onPress={next} full size="lg" />
            </>
          )}

          {step === 3 && (
            <>
              <StepTitle>How much do you move?</StepTitle>
              <View style={{ gap: 9 }}>
                {activityOptions.map((option) => (
                  <PressableScale key={option.key} onPress={() => set('activity_level', option.key)}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14,
                      borderRadius: 18, borderWidth: 1.5,
                      borderColor: draft.activity_level === option.key ? c.primary : c.line,
                      backgroundColor: draft.activity_level === option.key ? c.primarySoft : c.surface
                    }}>
                      <IconTile component={option.icon} size={44} bg={c.soft} color={c.primary} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="bodyStrong">{option.title}</T>
                        <T variant="meta" tone="muted">{option.hint}</T>
                      </View>
                      {draft.activity_level === option.key && <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.primary }} />}
                    </View>
                  </PressableScale>
                ))}
              </View>
              <View style={{ flexGrow: 1 }} />
              <Button label="Continue" onPress={next} full size="lg" />
            </>
          )}

          {step === 4 && (
            <>
              <StepTitle>Your daily budget.</StepTitle>
              <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 22 }}>
                <T variant="caption" tone="muted">CALORIES PER DAY</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                  <PressableScale
                    onPress={() => setCustomTarget(Math.max(1200, target - 50))}
                    accessibilityLabel="Decrease target"
                    style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Minus size={19} color={c.ink} />
                  </PressableScale>
                  <T variant="number">{target.toLocaleString('en-IN')}</T>
                  <PressableScale
                    onPress={() => setCustomTarget(Math.min(6000, target + 50))}
                    accessibilityLabel="Increase target"
                    style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={19} color={c.ink} />
                  </PressableScale>
                </View>
                {customTarget !== null && (
                  <Button
                    label={`Use recommended · ${preview.recommended_calories.toLocaleString('en-IN')}`}
                    onPress={() => setCustomTarget(null)}
                    variant="soft"
                    full
                  />
                )}
                <T variant="caption" tone="faint">Recommended for {draft.goal === 'lose' ? 'fat loss' : draft.goal === 'gain' ? 'muscle gain' : 'maintenance'} · {draft.activity_level.replace('_', ' ')}</T>
              </Card>

              <Card style={{ gap: 10 }}>
                <BudgetLine label="Resting burn (BMR)" value={`${preview.bmr.toLocaleString('en-IN')}`} />
                <BudgetLine label="Daily movement" value={`+${Math.max(0, preview.tdee - preview.bmr).toLocaleString('en-IN')}`} />
                <BudgetLine label="Goal adjustment" value={`${preview.target_calories - preview.tdee > 0 ? '+' : ''}${(preview.target_calories - preview.tdee).toLocaleString('en-IN')}`} />
                <View style={{ height: 1, backgroundColor: c.line, marginVertical: 2 }} />
                <BudgetLine label="Daily target" value={`${preview.target_calories.toLocaleString('en-IN')} kcal`} strong />
                <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                  <Pill label={`Protein ${preview.protein_target} g`} tone="success" />
                  <Pill label={`Carbs ${preview.carbs_target} g`} tone="warning" />
                  <Pill label={`Fat ${preview.fat_target} g`} tone="purple" />
                </View>
              </Card>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.dangerSoft, borderRadius: 16, padding: 14 }}>
                <IconTile component={Dumbbell} size={38} bg={c.white} color={c.danger} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="bodyStrong">Workouts add calories back</T>
                  <T variant="meta" style={{ color: c.dangerInk }}>45 min of strength adds about {workoutPreview} kcal.</T>
                </View>
              </View>

              <View style={{ flexGrow: 1 }} />
              <Button label="Looks right" onPress={next} full size="lg" disabled={target < 1200} />
            </>
          )}

          {step === 5 && (
            <>
              <StepTitle hint="Enter your Worker address and API key.">Connect your server.</StepTitle>
              <Card style={{ gap: 13 }}>
                <ConnectionFields value={connection} change={setConnection} />
              </Card>
              <View style={{ alignItems: 'center', gap: 7 }}>
                <T variant="caption" tone="muted">STARTING</T>
                <Segmented
                  options={[{ key: 'today', label: 'Today' }, { key: 'tomorrow', label: 'Tomorrow' }]}
                  value={startMode}
                  onChange={setStartMode}
                />
                <T variant="caption" tone="faint" align="center" style={{ maxWidth: 320 }}>
                  {startMode === 'tomorrow'
                    ? 'Tonight is off the record. Your first day starts at midnight.'
                    : 'Today’s quests count from midnight; late setup can include closed windows.'}
                </T>
              </View>
              {!!error && (
                <View style={{ backgroundColor: c.dangerSoft, borderRadius: 14, padding: 13 }}>
                  <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
                </View>
              )}
              <View style={{ flexGrow: 1 }} />
              <Button
                label={busy ? 'Connecting…' : 'Test & finish'}
                onPress={connect}
                full
                size="lg"
                loading={busy}
                disabled={!connection.url.trim() || connection.key.trim().length < 20}
                icon={<ArrowRight size={17} color={c.white} />}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BudgetLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <T variant={strong ? 'bodyStrong' : 'meta'} tone={strong ? 'ink' : 'muted'}>{label}</T>
      <T variant={strong ? 'bodyStrong' : 'meta'} style={strong ? { color: c.primary } : undefined}>{value}</T>
    </View>
  );
}

function StepTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 7, paddingTop: 4 }}>
      <T variant="title" align="center" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -0.9 }}>
        {children}
      </T>
      {hint ? (
        <T variant="meta" tone="muted" align="center" style={{ maxWidth: 300 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}
