import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Check, ChevronRight, Flame, Sparkles } from 'lucide-react-native';
import { c, font, mealPalette, questPalette } from './theme';
import { iconForQuest } from './icons';
import {
  Button, Card, Divider, IconTile, Pill, PressableScale, ProgressBar, SectionHeader, T
} from './ui';
import type { Day, Quest } from './types';

export function localTime(zone: string, date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(date);
}

export function dayLabel(date: string, full = false) {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC', weekday: full ? 'long' : 'short', month: 'short', day: 'numeric'
  }).format(new Date(date + 'T12:00:00Z'));
}

export function phaseFor(clock: string) {
  if (clock < '06:00' || clock >= '21:00') return 'night';
  if (clock < '10:30') return 'morning';
  if (clock < '16:30') return 'midday';
  return 'evening';
}

const phaseCopy = {
  morning: 'Morning. Easy start today.',
  midday: 'Midday check-in.',
  evening: 'Evening stretch.',
  night: 'Winding down.'
} as const;

const focusByPhase = {
  morning: ['wake', 'breakfast', 'lunch', 'gym', 'dinner', 'sleep'],
  midday: ['lunch', 'gym', 'dinner', 'wake', 'breakfast', 'sleep'],
  evening: ['gym', 'dinner', 'sleep', 'wake', 'breakfast', 'lunch'],
  night: ['sleep', 'dinner', 'gym', 'wake', 'breakfast', 'lunch']
} as const;

const doneStates = ['completed', 'salvaged', 'skipped', 'missed', 'penalized', 'voided'];

function statusLine(quest: Quest) {
  const log = quest.log;
  if (!log) return quest.subtitle;
  if (quest.state === 'completed') {
    if (quest.key === 'wake' && log.checked_time) return `Up at ${log.checked_time}`;
    if (quest.key === 'sleep') return `Locked in at ${log.checked_time ?? 'bedtime'}`;
    return `Done · +${log.points_awarded} pts`;
  }
  if (quest.state === 'salvaged') return `${quest.salvage_title ?? 'Fallback'} · +${log.points_awarded} pts`;
  if (quest.state === 'penalized') return `Outside food · −${quest.penalty} pts`;
  if (quest.state === 'salvageable' && log.salvage_note === 'marked_missed') return `Marked missed · −${quest.penalty} pts`;
  if (quest.state === 'skipped') return 'Skipped · no penalty';
  if (quest.state === 'missed' || quest.state === 'voided') {
    return quest.key === 'sleep' ? `Phone used late · −${quest.penalty} pts` : `Missed · −${quest.penalty} pts`;
  }
  if (quest.state === 'later') {
    const time = quest.window_start ? new Date(quest.opens_at) : null;
    return time
      ? `Opens at ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', hour12: true }).format(time)}`
      : 'Later today';
  }
  return quest.subtitle;
}

function actionLabel(quest: Quest) {
  if (quest.state === 'salvageable') return `+${quest.salvage_points}`;
  if (quest.key === 'wake') return 'I’m up';
  if (quest.key === 'gym') return 'Log';
  if (quest.key === 'sleep') return 'Bed';
  if (quest.key === 'breakfast' || quest.key === 'lunch' || quest.key === 'dinner') return 'Log';
  return 'Check';
}

function BudgetCard({ day }: { day: Day }) {
  const { budget } = day;
  const over = budget.remaining < 0;
  const percent = budget.adjusted_target ? budget.eaten / budget.adjusted_target : 0;
  return (
    <Card style={{ padding: 16, gap: 11 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ gap: 0 }}>
          <T variant="caption" tone="muted">Calories left</T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <T variant="numberMd" style={{ color: over ? c.warningInk : c.ink }}>
              {over ? '+' : ''}{Math.abs(budget.remaining).toLocaleString('en-IN')}
            </T>
            <T variant="meta" tone="muted">kcal</T>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <T variant="caption" tone="muted">Eaten</T>
            <T variant="meta" style={{ fontFamily: font.bold }}>{budget.eaten.toLocaleString('en-IN')}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <T variant="caption" tone="muted">Workout</T>
            <T variant="meta" style={{ fontFamily: font.bold, color: c.successInk }}>+{budget.burned}</T>
          </View>
        </View>
      </View>
      <ProgressBar value={over ? 1 : percent} color={over ? c.warning : c.primary} height={8} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Macro label="P" value={Math.round(budget.protein)} target={budget.protein_target} color={c.success} />
        <Macro label="C" value={Math.round(budget.carbs)} target={budget.carbs_target} color={c.warning} />
        <Macro label="F" value={Math.round(budget.fat)} target={budget.fat_target} color={c.purple} />
        <View style={{ flex: 1 }} />
        <T variant="caption" tone="faint">{Math.round(percent * 100)}%</T>
      </View>
      {over && (
        <View style={{ backgroundColor: c.warningSoft, borderRadius: 12, padding: 10 }}>
          <T variant="caption" style={{ color: c.warningInk }}>
            {budget.walk_hint
              ? `A ${budget.walk_hint}-min walk brings you back into range.`
              : 'Logged and done. A fresh budget starts tomorrow.'}
          </T>
        </View>
      )}
    </Card>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
      <T variant="caption" tone="muted">{label}</T>
      <T variant="caption" style={{ fontFamily: font.semibold, color: c.ink }}>{value}</T>
      <T variant="caption" tone="faint">/{target}</T>
    </View>
  );
}

export default function Today({
  day, clock, onCheck, onWorkout, onMeal, onQuest, onRecap
}: {
  day: Day;
  clock: string;
  onCheck: (quest: Quest, action: 'complete' | 'salvage' | 'skip') => void;
  onWorkout: (walk?: boolean) => void;
  onMeal: (type: string) => void;
  onQuest: (quest: Quest) => void;
  onRecap: (date: string) => void;
}) {
  const phase = phaseFor(clock);
  const focus = focusByPhase[phase]
    .map((key) => day.quests.find((quest) => quest.key === key))
    .find((quest) => quest && !doneStates.includes(quest.state) && quest.state !== 'later');

  function primaryAction(quest: Quest) {
    if (quest.state === 'salvageable') {
      onCheck(quest, 'salvage');
      return;
    }
    if (quest.key === 'gym') {
      onWorkout(false);
      return;
    }
    if (quest.key === 'breakfast' || quest.key === 'lunch' || quest.key === 'dinner') {
      onMeal(quest.key);
      return;
    }
    onCheck(quest, 'complete');
  }

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="meta" tone="muted">{dayLabel(day.date)}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {day.unread_report && (
            <PressableScale
              onPress={() => onRecap(day.unread_report!.date)}
              accessibilityLabel="Yesterday's recap"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}
            >
              <Sparkles size={16} color={c.primary} />
            </PressableScale>
          )}
          <Pill
            label={`${day.rhythm.streak}-day rhythm`}
            tone="warning"
            icon={<Flame size={13} color={c.warningInk} strokeWidth={2.4} />}
          />
        </View>
      </View>

      <T variant="display" style={{ fontSize: 34, lineHeight: 40 }}>{phaseCopy[phase]}</T>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: c.soft, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(1, day.rhythm.progress) * 100}%`, height: 4, borderRadius: 4, backgroundColor: c.primary }} />
        </View>
        <T variant="caption" tone="muted">Level {day.rhythm.level} · {day.rhythm.xp_for_next} XP to next</T>
      </View>

      <BudgetCard day={day} />

      {focus && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 12 }}>
          <IconTile
            component={iconForQuest(focus.icon ?? focus.key)}
            size={38}
            bg={(mealPalette[focus.key] ?? questPalette[focus.key] ?? questPalette.default!).soft}
            color={(mealPalette[focus.key] ?? questPalette[focus.key] ?? questPalette.default!).color}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="caption" tone="muted">Next up</T>
            <T variant="bodyStrong" numberOfLines={1}>{focus.title}</T>
          </View>
          <Button label={actionLabel(focus)} onPress={() => primaryAction(focus)} size="sm" />
        </View>
      )}

      {day.all_resolved && (
        <Animated.View entering={FadeInDown.duration(240).reduceMotion(ReduceMotion.System)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.primarySoft, borderRadius: 16, padding: 12 }}>
            <IconTile name="sparkles" size={34} bg={c.white} color={c.primary} iconSize={16} />
            <View style={{ flex: 1, gap: 1 }}>
              <T variant="bodyStrong">Clean sweep.</T>
              <T variant="caption" tone="primary">Everything is locked in.</T>
            </View>
          </View>
        </Animated.View>
      )}

      <SectionHeader
        title="Your day"
        action={<T variant="caption" tone="muted">+{day.points_today} pts</T>}
      />

      <Card padded={false} style={{ overflow: 'hidden' }}>
        {day.quests.map((quest, index) => (
          <QuestRow
            key={quest.id}
            quest={quest}
            last={index === day.quests.length - 1}
            onOpen={() => onQuest(quest)}
            onAction={() => primaryAction(quest)}
          />
        ))}
      </Card>
    </>
  );
}

function QuestRow({
  quest, last, onOpen, onAction
}: {
  quest: Quest;
  last: boolean;
  onOpen: () => void;
  onAction: () => void;
}) {
  const done = quest.state === 'completed' || quest.state === 'salvaged';
  const penalized = quest.state === 'penalized';
  const skipped = quest.state === 'skipped';
  const missed = quest.state === 'missed' || quest.state === 'voided';
  const later = quest.state === 'later';
  const markedMissed = quest.state === 'salvageable' && quest.log?.salvage_note === 'marked_missed';

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 10, paddingVertical: 8, gap: 6 }}>
        <PressableScale onPress={onOpen} onLongPress={onOpen} accessibilityLabel={`${quest.title} options`} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <IconTile
              component={iconForQuest(quest.icon ?? quest.key)}
              size={36}
              bg={(mealPalette[quest.key] ?? questPalette[quest.key] ?? questPalette.default!).soft}
              color={(mealPalette[quest.key] ?? questPalette[quest.key] ?? questPalette.default!).color}
              iconSize={19}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <T
                variant="bodyStrong"
                numberOfLines={1}
                style={skipped || missed ? { color: c.muted } : undefined}
              >
                {quest.title}
              </T>
              <T
                variant="caption"
                tone={penalized || missed || markedMissed ? 'danger' : 'muted'}
                numberOfLines={1}
              >
                {statusLine(quest)}
              </T>
            </View>
          </View>
        </PressableScale>

        {done ? (
          <View style={{
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: quest.state === 'salvaged' ? c.warningSoft : c.successSoft,
            alignItems: 'center', justifyContent: 'center'
          }}>
            <Check size={13} color={quest.state === 'salvaged' ? c.warningInk : c.successInk} strokeWidth={3} />
          </View>
        ) : penalized ? (
          <Pill label={`−${quest.penalty}`} tone="danger" />
        ) : skipped ? (
          <T variant="caption" tone="faint">Skipped</T>
        ) : missed ? (
          <T variant="caption" tone="faint">Closed</T>
        ) : later ? (
          <ChevronRight size={17} color={c.faint} />
        ) : (
          <Button
            label={actionLabel(quest)}
            onPress={onAction}
            size="sm"
            variant={quest.state === 'salvageable' ? 'soft' : 'primary'}
            style={{ height: 34, paddingHorizontal: 13 }}
          />
        )}
      </View>
      {!last && <Divider />}
    </View>
  );
}
