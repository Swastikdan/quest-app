import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { Dumbbell, Flame, Scale, Sparkles, TrendingDown, TrendingUp, Utensils } from 'lucide-react-native';
import { c, font, tierPalette } from './theme';
import {
  Button, Card, Divider, IconTile, Pill, PressableScale, ProgressBar, SectionHeader, T
} from './ui';
import { dayLabel } from './Today';
import type { Connection } from './api';
import type { StatsData } from './types';

export default function Stats({
  stats, connection, onWeigh, onRecap
}: {
  stats: StatsData;
  connection: Connection;
  onWeigh: () => void;
  onRecap: (date: string) => void;
}) {
  const { summary, profile, rhythm } = stats;
  const calorie = summary.calorie;
  const points = summary.points;
  const net = calorie.net;
  const hasCalorieDays = calorie.days > 0;
  const weightLoggedToday = stats.weights.some((entry) => entry.date === stats.today);
  const delta = stats.weight_summary.delta;

  return (
    <>
      <T variant="display">Stats</T>

      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="subheading">Level {rhythm.level} · {rhythm.level_title}</T>
            <T variant="meta" tone="muted">{rhythm.xp_for_next} XP to the next level</T>
          </View>
          <Pill
            label={`${rhythm.streak}-day`}
            tone="warning"
            icon={<Flame size={13} color={c.warningInk} strokeWidth={2.4} />}
          />
        </View>
        <ProgressBar value={rhythm.progress} height={9} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MiniStat label="Best rhythm" value={`${rhythm.best_streak} days`} />
          <MiniStat label="Momentum" value={`×${rhythm.multiplier.toFixed(2)}`} />
          <MiniStat label="This month" value={`${rhythm.monthly_points} pts`} />
        </View>
      </Card>

      <SectionHeader title="7-day calorie balance" action={<T variant="caption" tone="muted">today included</T>} />
      <Card style={{ gap: 16 }}>
        <CalorieWeek stats={stats} />
        {!hasCalorieDays && (
          <T variant="caption" tone="faint" align="center">Log a meal to start the week’s balance.</T>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SummaryTile label="Average" value={hasCalorieDays ? calorie.average.toLocaleString('en-IN') : '—'} hint="kcal/day" />
          <SummaryTile label="On target" value={hasCalorieDays ? `${calorie.on_target_days}/${calorie.days}` : '—'} hint="days" />
          <SummaryTile
            label="Net"
            value={hasCalorieDays ? `${net > 0 ? '+' : ''}${net.toLocaleString('en-IN')}` : '—'}
            hint={hasCalorieDays ? (net > 0 ? 'surplus' : 'deficit') : 'no meals yet'}
            tone={hasCalorieDays ? (net > 0 ? 'warning' : 'success') : undefined}
          />
        </View>
      </Card>

      <SectionHeader title="Points" action={<T variant="caption" tone="muted">last 7 days</T>} />
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <T variant="numberMd">{points.earned}</T>
            <T variant="meta" tone="muted">/ {points.possible} pts</T>
          </View>
          <Pill label={`${Math.round(points.possible ? (points.earned / points.possible) * 100 : 0)}%`} tone="primary" />
        </View>
        <ProgressBar value={points.possible ? points.earned / points.possible : 0} height={10} />
        <T variant="meta" tone="muted">
          {points.possible - points.earned > 0
            ? `${points.possible - points.earned} points were still on the table this week.`
            : 'Every point on the table, taken. That is a clean week.'}
        </T>
      </Card>

      <SectionHeader
        title="Weight"
        action={(
          <Button label={weightLoggedToday ? 'Update' : 'Weigh in'} onPress={onWeigh} size="sm" variant="soft" />
        )}
      />
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <T variant="numberMd">{stats.weight_summary.current.toFixed(1)}</T>
              <T variant="meta" tone="muted">kg</T>
            </View>
            <T variant="meta" tone="muted">
              {stats.weight_summary.entries > 1
                ? `${delta <= 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)} kg since you started`
                : 'Log daily to see the trend, not the noise.'}
            </T>
          </View>
          {stats.weight_summary.entries > 1 && (
            <Pill
              label={`${Math.abs(delta).toFixed(1)} kg`}
              tone={delta <= 0 ? 'success' : 'warning'}
              icon={delta <= 0 ? <TrendingDown size={13} color={c.successInk} /> : <TrendingUp size={13} color={c.warningInk} />}
            />
          )}
        </View>
        {stats.weights.length > 1 ? (
          <WeightChart weights={stats.weights} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.soft, borderRadius: 16, padding: 14 }}>
            <IconTile component={Scale} size={38} bg={c.white} color={c.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="bodyStrong">One number, once a day</T>
              <T variant="meta" tone="muted">Morning, after the loo, before chai. That is the cleanest read.</T>
            </View>
          </View>
        )}
      </Card>

      <SectionHeader title="Habit heat map" action={<T variant="caption" tone="muted">last 12 weeks</T>} />
      <Card style={{ gap: 14 }}>
        <Heatmap stats={stats} onRecap={onRecap} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {(['full_clear', 'solid', 'partial', 'missed'] as const).map((tier) => (
            <View key={tier} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: tierPalette[tier].color }} />
              <T variant="caption" tone="muted" style={{ textTransform: 'capitalize' }}>
                {tier === 'full_clear' ? 'Full' : tier}
              </T>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.soft }} />
            <T variant="caption" tone="muted">No data</T>
          </View>
        </View>
      </Card>

      <SectionHeader title="Recent log" action={<T variant="caption" tone="muted">last 30 days</T>} />
      {stats.recent.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 26 }}>
          <IconTile name="sparkles" size={42} />
          <T variant="bodyStrong">Nothing logged yet</T>
          <T variant="meta" tone="muted" align="center">Your meals, workouts and quest marks will collect here.</T>
        </Card>
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {stats.recent.map((item, index) => (
            <View key={`${item.kind}-${item.at}-${index}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                {item.photo ? (
                  <Image
                    source={{ uri: connection.url + item.photo, headers: { Authorization: 'Bearer ' + connection.key } }}
                    style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: c.soft }}
                    contentFit="cover"
                    cachePolicy="memory"
                  />
                ) : (
                  <IconTile
                    component={item.kind === 'quest' ? Sparkles : item.kind === 'workout' ? Dumbbell : Utensils}
                    size={42}
                    color={item.kind === 'workout' ? c.danger : item.kind === 'meal' ? c.orange : c.primary}
                    bg={item.kind === 'workout' ? c.dangerSoft : item.kind === 'meal' ? c.orangeSoft : c.primarySoft}
                  />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="bodyStrong" numberOfLines={1}>{item.title}</T>
                  <T variant="meta" tone="muted">{item.subtitle}</T>
                </View>
                <T variant="caption" tone="faint">{relativeTime(item.at)}</T>
              </View>
              {index < stats.recent.length - 1 && <Divider />}
            </View>
          ))}
        </Card>
      )}

    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="bodyStrong">{value}</T>
      <T variant="caption" tone="muted">{label}</T>
    </View>
  );
}

function SummaryTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'warning' | 'success' }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 15, padding: 11, gap: 1 }}>
      <T variant="caption" tone="muted">{label}</T>
      <T variant="bodyStrong" style={tone === 'warning' ? { color: c.warningInk } : tone === 'success' ? { color: c.successInk } : undefined}>
        {value}
      </T>
      <T variant="caption" tone="faint">{hint}</T>
    </View>
  );
}

function CalorieWeek({ stats }: { stats: StatsData }) {
  const max = Math.max(1, ...stats.week.map((day) => Math.max(day.consumed, day.target)));
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 104 }}>
        {stats.week.map((day, index) => {
          const consumedHeight = Math.max(3, (day.consumed / max) * 92);
          const targetHeight = Math.max(3, (day.target / max) * 92);
          const over = day.consumed > day.target && day.target > 0;
          const onTarget = day.target > 0 && Math.abs(day.consumed - day.target) / day.target <= 0.1;
          const color = !day.has_data || day.consumed === 0
            ? c.soft
            : over
              ? c.warning
              : onTarget
                ? c.success
                : c.primary;
          return (
            <View key={day.date} style={{ flex: 1, alignItems: 'center', gap: 4, height: 104, justifyContent: 'flex-end' }}>
              <View style={{ width: 18, height: 92, borderRadius: 9, justifyContent: 'flex-end', backgroundColor: c.soft, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: targetHeight, backgroundColor: c.primarySoft }} />
                <BarFill height={consumedHeight} color={color} delay={index * 32} />
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: targetHeight - 1, height: 2, backgroundColor: c.primary, opacity: 0.55 }} />
              </View>
              <T variant="caption" tone={index === 6 ? 'ink' : 'muted'} style={{ fontFamily: index === 6 ? font.bold : font.semibold }}>
                {new Intl.DateTimeFormat('en', { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(day.date + 'T12:00:00Z'))}
              </T>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="caption" tone="faint">{dayLabel(stats.week[0]!.date)}</T>
        <T variant="caption" tone="faint">today</T>
      </View>
    </View>
  );
}

function BarFill({ height, color, delay }: { height: number; color: string; delay: number }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? height : 0);
  useEffect(() => {
    progress.set(withTiming(height, { duration: 420, easing: Easing.bezier(0.23, 1, 0.32, 1), }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, reduced]);
  const style = useAnimatedStyle(() => ({ height: progress.get() }));
  return <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color }, style]} />;
}

function WeightChart({ weights }: { weights: { date: string; weight_kg: number }[] }) {
  const values = weights.slice(-30);
  const min = Math.min(...values.map((entry) => entry.weight_kg));
  const max = Math.max(...values.map((entry) => entry.weight_kg));
  const span = Math.max(0.5, max - min);
  const points = values.map((entry, index) => {
    const x = values.length === 1 ? 150 : 10 + (index / (values.length - 1)) * 280;
    const y = 74 - ((entry.weight_kg - min) / span) * 58;
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `M ${points[0]![0]} 84 L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points.at(-1)![0]} 84 Z`;
  return (
    <View style={{ gap: 6 }}>
      <Svg width="100%" height={92} viewBox="0 0 300 92" accessibilityLabel="Weight trend">
        <Path d={area} fill={c.primarySoft} />
        <Polyline points={line} fill="none" stroke={c.primary} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], index) => (
          <Circle key={index} cx={x} cy={y} r={index === points.length - 1 ? 4.5 : 2.2} fill={index === points.length - 1 ? c.primary : c.white} stroke={c.primary} strokeWidth={index === points.length - 1 ? 0 : 1.5} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="caption" tone="faint">{dayLabel(values[0]!.date)}</T>
        <T variant="caption" tone="faint">{dayLabel(values.at(-1)!.date)}</T>
      </View>
    </View>
  );
}

function Heatmap({ stats, onRecap }: { stats: StatsData; onRecap: (date: string) => void }) {
  const weeks = useMemo(() => {
    const entries = stats.heatmap;
    if (entries.length === 0) return [];
    const first = new Date(entries[0]!.date + 'T12:00:00Z');
    const pad = (first.getUTCDay() + 6) % 7;
    const cells: Array<{ date: string; tier: string | null; has_data: boolean } | null> = Array.from({ length: pad }, () => null);
    cells.push(...entries.map((entry) => ({ date: entry.date, tier: entry.tier, has_data: entry.has_data })));
    while (cells.length % 7 !== 0) cells.push(null);
    const result: typeof cells[] = [];
    for (let index = 0; index < cells.length; index += 7) result.push(cells.slice(index, index + 7));
    return result;
  }, [stats.heatmap]);

  return (
    <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'space-between' }}>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={{ gap: 4 }}>
          {week.map((cell, dayIndex) => {
            if (!cell) return <View key={dayIndex} style={{ width: 15, height: 15 }} />;
            const palette = cell.tier ? tierPalette[cell.tier as keyof typeof tierPalette] : null;
            return (
              <PressableScale
                key={dayIndex}
                onPress={() => cell.has_data && onRecap(cell.date)}
                disabled={!cell.has_data || cell.date === stats.today}
                accessibilityLabel={`${cell.date}${cell.tier ? ', ' + cell.tier : ''}`}
                style={{
                  width: 15, height: 15, borderRadius: 4,
                  backgroundColor: palette ? palette.color : c.soft,
                  opacity: cell.date === stats.today ? 1 : 0.92
                }}
              >
                <View />
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function relativeTime(iso: string) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}
