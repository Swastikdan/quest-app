import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, RefreshControl, View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { Plus } from 'lucide-react-native';
import {
  api, enqueue, flush, loadConnection, saveConnection, type Connection
} from './api';
import Setup from './Setup';
import Today, { localTime } from './Today';
import Meals from './Meals';
import Stats from './Stats';
import Settings, { type QuestSetting } from './Settings';
import MealEditor, { type MealInitial } from './MealEditor';
import {
  GoalSheet, GraceSheet, ProfileSheet, QuestEditorSheet, QuestMenuSheet, QuickAddSheet,
  RecapSheet, ReminderSheet, ServerSheet, SleepSheet, UpdateSheet, WeightSheet, WorkoutSheet
} from './panels';
import {
  addCustomReminder, deleteCustomReminder, ensureNotificationPermission, loadReminders,
  syncReminders, updateReminder, type Reminder, type ReminderMode
} from './reminders';
import { syncUsage, usage } from './usage';
import { setBackgroundUsage } from './background';
import { c, shadow } from './theme';
import { tabIcons } from './icons';
import {
  Button, Card, LogoMark, PressableScale, Screen, Sheet, T
} from './ui';
import type { Day, Meal, MealType, Quest, StatsData } from './types';

type Tab = 'Today' | 'Meals' | 'Stats' | 'Settings';

type SheetState =
  | { kind: 'quick' }
  | { kind: 'quest-menu'; quest: Quest }
  | { kind: 'quest'; quest?: QuestSetting }
  | { kind: 'meal'; meal?: Meal; initial?: MealInitial }
  | { kind: 'workout'; walk?: boolean }
  | { kind: 'weight' }
  | { kind: 'profile' }
  | { kind: 'goal' }
  | { kind: 'recap'; date: string; markSeen?: boolean }
  | { kind: 'server' }
  | { kind: 'sleep' }
  | { kind: 'grace'; ends: number }
  | { kind: 'reminder' }
  | { kind: 'update' };

const tabs: Tab[] = ['Today', 'Meals', 'Stats', 'Settings'];

export default function QuestApp() {
  const [connection, setConnection] = useState<Connection | null>();
  const [day, setDay] = useState<Day | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [quests, setQuests] = useState<QuestSetting[]>([]);
  const [tab, setTab] = useState<Tab>('Today');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [clockTick, setClockTick] = useState(Date.now());
  const [reminderList, setReminderList] = useState<Reminder[]>([]);
  const [device, setDevice] = useState('');
  const [usageEnabled, setUsageEnabled] = useState(false);
  const latest = useRef(0);
  const checks = useRef(new Set<number>());
  const graceShown = useRef('');
  const insets = useSafeAreaInsets();
  const clock = day ? localTime(day.timezone, new Date(clockTick)) : '09:00';

  useEffect(() => {
    loadConnection().then(setConnection).catch(() => setConnection(null));
    loadReminders().then(setReminderList).catch(() => {});
    AsyncStorage.getItem('quest.usage.enabled').then((value) => setUsageEnabled(value === 'yes')).catch(() => {});
    AsyncStorage.getItem('quest.device').then(async (id) => {
      const value = id ?? Crypto.randomUUID();
      if (!id) await AsyncStorage.setItem('quest.device', value);
      setDevice(value);
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClockTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(id);
  }, [notice]);

  const refresh = useCallback(async (sync = false) => {
    if (!connection) return;
    const index = ++latest.current;
    try {
      const next = sync
        ? (await api<{ day: Day }>(connection, '/api/sync', 'POST')).day
        : await api<Day>(connection, '/api/day/today');
      if (index !== latest.current) return;
      setDay(next);
      setError('');
      setClockTick(Date.now());
      void syncReminders(next).catch(() => {});
    } catch (caught) {
      if (index === latest.current) {
        setError(caught instanceof Error ? caught.message : 'Couldn’t load today.');
      }
    }
  }, [connection]);

  const refreshStats = useCallback(async () => {
    if (!connection) return;
    try { setStats(await api<StatsData>(connection, '/api/stats')); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : 'Couldn’t load stats.'); }
  }, [connection]);

  const refreshQuests = useCallback(async () => {
    if (!connection) return;
    try { setQuests((await api<{ quests: QuestSetting[] }>(connection, '/api/quests')).quests); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : 'Couldn’t load quests.'); }
  }, [connection]);

  useEffect(() => {
    if (!connection) return;
    void refresh();
    const id = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void flush(connection).catch(() => {}).finally(() => refresh());
    }, 60_000);
    return () => clearInterval(id);
  }, [connection, refresh]);

  useEffect(() => {
    if (!connection) return;
    if (tab === 'Stats') void refreshStats();
    if (tab === 'Settings') void refreshQuests();
  }, [connection, tab, refreshStats, refreshQuests]);

  const activity = useCallback(async (kind: string) => {
    if (!connection || !device) return;
    await enqueue(connection, '/api/activity', 'POST', {
      device_id: device,
      events: [{ event_id: Crypto.randomUUID(), kind, occurred_at: new Date().toISOString() }]
    });
  }, [connection, device]);

  useEffect(() => {
    if (!connection || !device) return;
    const foreground = () => {
      setClockTick(Date.now());
      void activity('app_foreground')
        .catch(() => {})
        .then(() => connection && device ? syncUsage(connection, device).catch(() => {}) : undefined)
        .then(() => refresh(true))
        .catch(() => {});
    };
    foreground();
    let state = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && state !== 'active') foreground();
      if (next === 'background' && state !== 'background') void activity('app_background').catch(() => {});
      state = next;
    });
    return () => sub.remove();
  }, [activity, connection, device, refresh]);

  useEffect(() => {
    if (!day || sheet) return;
    const sleep = day.quests.find((quest) => quest.key === 'sleep');
    if (clock >= '23:00' && sleep?.state === 'completed' && graceShown.current !== day.date) {
      graceShown.current = day.date;
      setSheet({ kind: 'grace', ends: Date.now() + 120_000 });
    }
  }, [clock, day, sheet]);

  const mutate = useCallback(async (path: string, method: string, body?: Record<string, unknown>) => {
    if (!connection) return;
    const message = await enqueue(connection, path, method, body);
    setNotice(message);
    if (message === 'Saved') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    void refresh();
    if (tab === 'Stats') void refreshStats();
    if (tab === 'Settings') void refreshQuests();
    if (message !== 'Saved' && !message.startsWith('Saved on this device')) {
      throw new Error(message);
    }
  }, [connection, refresh, refreshQuests, refreshStats, tab]);

  const check = useCallback((quest: Quest, action: 'complete' | 'salvage' | 'skip' | 'miss') => {
    if (!day || checks.current.has(quest.id)) return;
    checks.current.add(quest.id);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void mutate(`/api/quests/${quest.id}/check`, 'POST', {
      date: day.date, action, device_id: device
    }).catch((caught) => setNotice(caught.message)).finally(() => checks.current.delete(quest.id));
  }, [day, device, mutate]);

  useEffect(() => {
    if (!day) return;
    const receive = (response: Notifications.NotificationResponse) => {
      const action = response.actionIdentifier;
      const data = response.notification.request.content.data;
      if (data?.date !== day.date) return;
      setTab('Today');
      const reminderId = String(data?.reminder ?? '');
      if (action === 'default') {
        if (reminderId === 'breakfast' || reminderId === 'lunch' || reminderId === 'dinner') {
          setSheet({ kind: 'meal', initial: { meal_type: reminderId as MealType } });
        } else if (reminderId === 'move') {
          setSheet({ kind: 'workout' });
        } else if (reminderId === 'sleep') {
          const sleepQuest = day.quests.find((entry) => entry.key === 'sleep');
          if (sleepQuest) setSheet({ kind: 'quest-menu', quest: sleepQuest });
        }
        Notifications.clearLastNotificationResponse();
        return;
      }
      if (action === 'breakfast' || action === 'lunch' || action === 'dinner') {
        setSheet({ kind: 'meal', initial: { meal_type: action as MealType } });
      } else if (action === 'gym' || action === 'walk') {
        setSheet({ kind: 'workout', walk: action === 'walk' });
      } else if (action === 'wake' || action === 'late' || action === 'sleep') {
        const quest = day.quests.find((entry) => entry.key === (action === 'sleep' ? 'sleep' : 'wake'));
        if (quest) {
          const salvage = action === 'late' || quest.state === 'salvageable';
          void check(quest, salvage ? 'salvage' : 'complete');
        }
      }
      Notifications.clearLastNotificationResponse();
    };
    const saved = Notifications.getLastNotificationResponse();
    if (saved) receive(saved);
    const sub = Notifications.addNotificationResponseReceivedListener(receive);
    return () => sub.remove();
  }, [check, day]);

  const toggleUsage = useCallback(async (enable: boolean) => {
    if (!connection || !device) return;
    if (enable) {
      if (!usage) {
        setNotice('Phone-wide verification is Android-only. This check-in stays self-reported.');
        return;
      }
      if (!(await usage.hasAccess())) {
        await usage.openSettings();
        setNotice('Allow Usage Access for Quest, then switch it on again.');
        return;
      }
      await api(connection, '/api/activity/device', 'PUT', { device_id: device });
      await AsyncStorage.setItem('quest.usage.enabled', 'yes');
      await setBackgroundUsage(true).catch(() => {});
      await syncUsage(connection, device).catch(() => {});
      setUsageEnabled(true);
      setNotice('Phone use after 11 will now void the sleep quest.');
    } else {
      await api(connection, '/api/activity/device', 'PUT', { device_id: null });
      await AsyncStorage.multiRemove(['quest.usage.enabled', 'quest.usage.cursor']);
      await setBackgroundUsage(false).catch(() => {});
      setUsageEnabled(false);
      setNotice('Phone-wide sleep verification is off.');
    }
  }, [connection, device]);

  const updateReminderHandler = useCallback(async (id: string, patch: {
    enabled?: boolean; mode?: ReminderMode; time?: string; date?: string | null; title?: string; body?: string
  }) => {
    if (patch.enabled) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        setNotice('Allow notifications in system settings to turn this on.');
        return;
      }
    }
    await updateReminder(id, patch);
    setReminderList(await loadReminders());
    if (day) await syncReminders(day).catch(() => {});
  }, [day]);

  const addReminderHandler = useCallback(async (input: {
    title: string; body: string; time: string; date: string | null; mode: ReminderMode
  }) => {
    const granted = await ensureNotificationPermission();
    if (!granted) throw new Error('Allow notifications in system settings first.');
    await addCustomReminder(input);
    setReminderList(await loadReminders());
    if (day) await syncReminders(day).catch(() => {});
  }, [day]);

  const deleteReminderHandler = useCallback(async (id: string) => {
    await deleteCustomReminder(id);
    setReminderList(await loadReminders());
    if (day) await syncReminders(day).catch(() => {});
  }, [day]);

  const openMeal = useCallback((type?: MealType, startStage?: 'pick' | 'describe') => {
    setSheet({ kind: 'meal', initial: { meal_type: type ?? guessMeal(clock), startStage } });
  }, [clock]);

  const closeSheet = useCallback(() => setSheet(null), []);

  const markSeen = useCallback(async (date: string, seen: boolean) => {
    if (!seen || !connection) return;
    try { await api(connection, `/api/report/${date}/seen`, 'POST'); } catch { /* quiet */ }
    void refresh();
  }, [connection, refresh]);

  const removeMeal = useCallback((id: number) => {
    if (!connection) return;
    Alert.alert('Remove this meal?', 'Today’s calorie total will update.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void api(connection, `/api/meals/${id}`, 'DELETE')
            .then(() => { closeSheet(); void refresh(); void refreshStats(); })
            .catch((caught) => setNotice(caught instanceof Error ? caught.message : 'Couldn’t remove that meal.'));
        }
      }
    ]);
  }, [connection, refresh, refreshStats]);

  const removeWorkout = useCallback((id: number) => {
    Alert.alert('Remove this session?', 'Those extra calories will come off today’s budget.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => { void mutate(`/api/workouts/${id}`, 'DELETE'); }
      }
    ]);
  }, [mutate]);

  const startTomorrow = useCallback(() => {
    if (!connection) return;
    Alert.alert(
      'Start tomorrow?',
      'Tonight won’t count and no penalties apply. Your first real day starts at midnight.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Start tomorrow',
          style: 'destructive',
          onPress: () => {
            void api(connection, '/api/profile/start', 'POST', { mode: 'tomorrow' })
              .then(async () => {
                setNotice('Tonight is off the record. Your first day starts tomorrow.');
                await refresh();
                await refreshStats();
              })
              .catch((caught) => setNotice(caught instanceof Error ? caught.message : 'Could not start tomorrow.'));
          }
        }
      ]
    );
  }, [connection, refresh, refreshStats]);

  const exportData = useCallback(async () => {
    if (!connection) return;
    try {
      const backup = await api(connection, '/api/export');
      const file = new File(Paths.cache, `quest-backup-${day?.date ?? 'today'}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(backup, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Couldn’t export your data.');
    }
  }, [connection, day?.date]);

  const refreshPage = async () => {
    setSyncing(true);
    try {
      if (connection) await flush(connection).catch(() => []);
      await Promise.all([refresh(true), refreshStats(), refreshQuests()]);
    } finally {
      setSyncing(false);
    }
  };

  const mealSheet = sheet?.kind === 'meal' ? sheet : null;
  const questMenu = sheet?.kind === 'quest-menu' ? sheet.quest : null;
  const questEditing = sheet?.kind === 'quest' ? sheet.quest ?? null : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="dark" />
      {connection === undefined && <Loading />}
      {connection === null && <Setup onConnect={setConnection} />}
      {connection && !day && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
          <LogoMark size={52} />
          {error ? (
            <Card style={{ gap: 12, width: '100%' }}>
              <T variant="subheading">Couldn’t load today</T>
              <T variant="meta" tone="muted">{error}</T>
              <Button label="Try again" onPress={refreshPage} full />
              <Button label="Server settings" onPress={() => setSheet({ kind: 'server' })} variant="soft" full />
            </Card>
          ) : (
            <>
              <ActivityIndicator color={c.primary} />
              <T variant="meta" tone="muted">Loading your day…</T>
            </>
          )}
        </View>
      )}
      {connection && day && (
        <>
          {tab === 'Today' && (
            <Screen refreshControl={<RefreshControl refreshing={syncing} onRefresh={refreshPage} tintColor={c.primary} colors={[c.primary]} />}>
              <Today
                day={day}
                clock={clock}
                onCheck={check}
                onWorkout={(walk) => setSheet({ kind: 'workout', walk })}
                onMeal={(type) => openMeal(type as MealType)}
                onQuest={(quest) => setSheet({ kind: 'quest-menu', quest })}
              />
            </Screen>
          )}
          {tab === 'Meals' && (
            <Screen refreshControl={<RefreshControl refreshing={syncing} onRefresh={refreshPage} tintColor={c.primary} colors={[c.primary]} />}>
              <Meals
                day={day}
                connection={connection}
                onAdd={(type) => openMeal(type)}
                onEdit={(meal) => setSheet({ kind: 'meal', meal })}
                onDescribe={(text, type) => setSheet({ kind: 'meal', initial: { text, meal_type: type, startStage: 'describe' } })}
                onWorkout={() => setSheet({ kind: 'workout' })}
                onRemoveWorkout={removeWorkout}
              />
            </Screen>
          )}
          {tab === 'Stats' && (
            <Screen>
              {stats ? (
                <Stats
                  stats={stats}
                  connection={connection}
                  onWeigh={() => setSheet({ kind: 'weight' })}
                  onRecap={(date) => setSheet({ kind: 'recap', date })}
                />
              ) : (
                <View style={{ paddingTop: 60, alignItems: 'center', gap: 12 }}>
                  <ActivityIndicator color={c.primary} />
                  <T variant="meta" tone="muted">Pulling your week together…</T>
                </View>
              )}
            </Screen>
          )}
          {tab === 'Settings' && (
            <Screen refreshControl={<RefreshControl refreshing={syncing} onRefresh={refreshPage} tintColor={c.primary} colors={[c.primary]} />}>
              <Settings
                day={day}
                quests={quests}
                reminders={reminderList}
                onUpdateReminder={(id, patch) => { void updateReminderHandler(id, patch); }}
                onAddReminder={() => setSheet({ kind: 'reminder' })}
                onDeleteReminder={(id) => { void deleteReminderHandler(id); }}
                onEditProfile={() => setSheet({ kind: 'profile' })}
                onEditGoal={() => setSheet({ kind: 'goal' })}
                onWeigh={() => setSheet({ kind: 'weight' })}
                onEditQuest={(quest) => setSheet({ kind: 'quest', quest })}
                onAddQuest={() => setSheet({ kind: 'quest' })}
                onServer={() => setSheet({ kind: 'server' })}
                onExport={exportData}
                onSleep={() => setSheet({ kind: 'sleep' })}
                onUpdate={() => setSheet({ kind: 'update' })}
                onStartTomorrow={startTomorrow}
                serverUrl={connection.url}
              />
            </Screen>
          )}

          <TabBar tab={tab} setTab={setTab} onAdd={() => setSheet({ kind: 'quick' })} bottom={insets.bottom} />

          {!!notice && (
            <View pointerEvents="none" style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 78, alignItems: 'center' }}>
              <View style={{ backgroundColor: c.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '100%' }}>
                <T variant="meta" style={{ color: c.white }} numberOfLines={2}>{notice}</T>
              </View>
            </View>
          )}

          <QuickAddSheet
            visible={sheet?.kind === 'quick'}
            onClose={closeSheet}
            recapDate={day.unread_report?.date}
            onRecap={(date) => setSheet({ kind: 'recap', date, markSeen: true })}
            onMeal={() => openMeal()}
            onDescribe={() => openMeal(guessMeal(clock), 'describe')}
            onWorkout={() => setSheet({ kind: 'workout' })}
            onWeigh={() => setSheet({ kind: 'weight' })}
          />
          <QuestMenuSheet
            visible={sheet?.kind === 'quest-menu'}
            quest={questMenu}
            day={day}
            onClose={closeSheet}
            onCheck={check}
            onMiss={(quest) => check(quest, 'miss')}
            onWorkout={(walk) => setSheet({ kind: 'workout', walk })}
            onMeal={(type) => openMeal(type)}
            onEdit={() => questMenu && setSheet({ kind: 'quest', quest: questMenu })}
          />
          <Sheet
            visible={!!mealSheet}
            onClose={closeSheet}
            title={mealSheet?.meal ? 'Edit meal' : 'Log a meal'}
            subtitle="Take a photo, describe it, or enter the numbers."
          >
            {mealSheet && (
              <MealEditor
                key={`${mealSheet.meal?.id ?? 'new'}-${mealSheet.initial?.meal_type ?? ''}-${mealSheet.initial?.startStage ?? ''}-${mealSheet.initial?.text ?? ''}`}
                connection={connection}
                date={day.date}
                initial={mealSheet.initial}
                meal={mealSheet.meal}
                onDone={() => { closeSheet(); void refresh(); void refreshStats(); }}
              />
            )}
            {mealSheet?.meal && (
              <Button
                label="Remove meal"
                onPress={() => removeMeal(mealSheet.meal!.id)}
                variant="danger"
                full
              />
            )}
          </Sheet>
          <QuestEditorSheet
            visible={sheet?.kind === 'quest'}
            quest={questEditing}
            connection={connection}
            onClose={closeSheet}
            onSaved={() => { void refreshQuests(); void refresh(); }}
          />
          <WorkoutSheet
            visible={sheet?.kind === 'workout'}
            day={day}
            initialWalk={sheet?.kind === 'workout' ? sheet.walk : false}
            connection={connection}
            onClose={closeSheet}
            onSaved={() => { void refresh(); void refreshStats(); }}
          />
          <WeightSheet
            visible={sheet?.kind === 'weight'}
            day={day}
            connection={connection}
            onClose={closeSheet}
            onSaved={() => { void refresh(); void refreshStats(); }}
          />
          <ProfileSheet
            visible={sheet?.kind === 'profile'}
            profile={day.profile}
            connection={connection}
            onClose={closeSheet}
            onSaved={() => { void refresh(); void refreshStats(); }}
          />
          <GoalSheet
            visible={sheet?.kind === 'goal'}
            profile={day.profile}
            connection={connection}
            onClose={closeSheet}
            onSaved={() => { void refresh(); void refreshStats(); }}
          />
          <RecapSheet
            visible={sheet?.kind === 'recap'}
            date={sheet?.kind === 'recap' ? sheet.date : ''}
            connection={connection}
            onClose={closeSheet}
            onSeen={() => { if (sheet?.kind === 'recap') void markSeen(sheet.date, !!sheet.markSeen); }}
          />
          <ServerSheet
            visible={sheet?.kind === 'server'}
            connection={connection}
            onClose={closeSheet}
            onSaved={async (next) => {
              await saveConnection(next);
              setConnection(next);
            }}
          />
          <UpdateSheet visible={sheet?.kind === 'update'} onClose={closeSheet} />
          <ReminderSheet
            visible={sheet?.kind === 'reminder'}
            onClose={closeSheet}
            onSave={addReminderHandler}
          />
          <SleepSheet
            visible={sheet?.kind === 'sleep'}
            onClose={closeSheet}
            connection={connection}
            device={device}
            usageEnabled={usageEnabled}
            onToggleUsage={toggleUsage}
          />
          <GraceSheet
            visible={sheet?.kind === 'grace'}
            ends={sheet?.kind === 'grace' ? sheet.ends : 0}
            onClose={closeSheet}
            onGrace={() => { void activity('sleep_grace_lock'); }}
          />
        </>
      )}
    </View>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.bg }}>
      <ActivityIndicator size="large" color={c.primary} />
      <T variant="meta" tone="muted">Loading your day…</T>
    </View>
  );
}

function TabBar({
  tab, setTab, onAdd, bottom
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  onAdd: () => void;
  bottom: number;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: Math.max(bottom, 8) + 6,
        backgroundColor: c.bg
      }}
    >
      <View
        style={{
          height: 62, borderRadius: 31, backgroundColor: c.surface,
          flexDirection: 'row', alignItems: 'center', paddingLeft: 6, paddingRight: 8, gap: 2,
          ...shadow.floating
        }}
      >
        {tabs.map((item) => {
          const Icon = tabIcons[item];
          const active = tab === item;
          return (
            <PressableScale
              key={item}
              onPress={() => setTab(item)}
              accessibilityLabel={item}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 54 }}
            >
              <View
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'transparent'
                }}
              >
                <Icon size={24} color={active ? c.primary : c.faint} strokeWidth={active ? 2.5 : 2} />
              </View>
            </PressableScale>
          );
        })}
        <PressableScale
          onPress={onAdd}
          accessibilityLabel="Quick add"
          style={{
            width: 46, height: 46, borderRadius: 23, backgroundColor: c.primary,
            alignItems: 'center', justifyContent: 'center'
          }}
        >
          <Plus size={24} color={c.white} strokeWidth={2.6} />
        </PressableScale>
      </View>
    </View>
  );
}

function guessMeal(clock: string): MealType {
  if (clock < '11:00') return 'breakfast';
  if (clock < '16:30') return 'lunch';
  if (clock < '21:00') return 'dinner';
  return 'snack';
}
