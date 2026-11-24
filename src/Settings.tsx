import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Switch } from 'react-native';
import {
  AlarmClock, Bell, ChevronDown, ChevronRight, ChevronUp, Download, Moon, Plus, RefreshCw, Scale, Server, SlidersHorizontal
} from 'lucide-react-native';
import { c } from './theme';
import { iconForQuest } from './icons';
import {
  Button, Card, Divider, Field, IconTile, Pill, PressableScale, SectionHeader, Segmented, T
} from './ui';
import type { Reminder, ReminderMode } from './reminders';
import { currentVersion } from './update';
import type { Day } from './types';

export type QuestSetting = {
  id: number;
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  type: string;
  points: number;
  penalty: number;
  salvage_points: number;
  sort_order: number;
  active?: number;
};


export default function Settings({
  day, quests, reminders, onUpdateReminder, onAddReminder, onDeleteReminder, onEditProfile, onEditGoal,
  onWeigh, onEditQuest, onAddQuest, onServer, onExport, onSleep, onUpdate, serverUrl
}: {
  day: Day;
  quests: QuestSetting[];
  reminders: ReadonlyArray<Reminder>;
  onUpdateReminder: (id: string, patch: { enabled?: boolean; mode?: ReminderMode; time?: string; date?: string | null; title?: string; body?: string }) => void;
  onAddReminder: () => void;
  onDeleteReminder: (id: string) => void;
  onEditProfile: () => void;
  onEditGoal: () => void;
  onWeigh: () => void;
  onEditQuest: (quest: QuestSetting) => void;
  onAddQuest: () => void;
  onServer: () => void;
  onExport: () => void;
  onSleep: () => void;
  onUpdate: () => void;
  serverUrl: string;
}) {
  const profile = day.profile;
  const adjustment = profile.target_calories - profile.tdee;
  const serverLabel = serverUrl.replace(/^https?:\/\//, '');

  return (
    <>
      <T variant="display">Settings</T>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="subheading">Your profile</T>
            <T variant="meta" tone="muted">{profile.weight_kg} kg · {profile.timezone}</T>
          </View>
          <Button label="Edit" onPress={onEditProfile} size="sm" variant="soft" />
        </View>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Button label="Weigh in" onPress={onWeigh} size="sm" variant="soft" icon={<Scale size={15} color={c.ink} />} style={{ flex: 1 }} />
          <Button label="Adjust goal" onPress={onEditGoal} size="sm" variant="soft" icon={<SlidersHorizontal size={15} color={c.ink} />} style={{ flex: 1 }} />
        </View>
      </Card>

      <SectionHeader title="Daily budget" />
      <Card style={{ gap: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <T variant="numberMd">{profile.target_calories.toLocaleString('en-IN')}</T>
              <T variant="meta" tone="muted">kcal</T>
            </View>
            <T variant="meta" tone="muted">
              {profile.custom_target_calories ? 'Custom target' : profile.goal === 'lose' ? 'Steady fat loss' : profile.goal === 'gain' ? 'Steady gain' : 'Maintain'}
              {!profile.custom_target_calories && adjustment !== 0 ? ` · ${adjustment > 0 ? '+' : '−'}${Math.abs(adjustment)} kcal` : ''}
            </T>
          </View>
          <Pill label={`P ${profile.protein_target}g`} tone="success" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BudgetBit label="BMR" value={`${profile.bmr.toLocaleString('en-IN')}`} />
          <BudgetBit label="Maintenance" value={`${profile.tdee.toLocaleString('en-IN')}`} />
          <BudgetBit label="Protein" value={`${profile.protein_target} g`} />
        </View>
        <T variant="caption" tone="faint">Workouts add calories back on top of this budget.</T>
      </Card>

      <SectionHeader title="Quests" action={<Button label="Add" onPress={onAddQuest} size="sm" variant="soft" icon={<Plus size={14} color={c.ink} />} />} />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {quests.map((quest, index) => (
          <View key={quest.id}>
            <PressableScale onPress={() => onEditQuest(quest)} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile component={iconForQuest(quest.icon)} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="bodyStrong" numberOfLines={1}>{quest.title}</T>
                  <T variant="meta" tone="muted">+{quest.points} pts · −{quest.penalty} if missed</T>
                </View>
                <ChevronRight size={18} color={c.faint} />
              </View>
            </PressableScale>
            {index < quests.length - 1 && <Divider />}
          </View>
        ))}
      </Card>

      <SectionHeader
        title="Reminders"
        action={<Button label="Add" onPress={onAddReminder} size="sm" variant="soft" icon={<Plus size={14} color={c.ink} />} />}
      />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {reminders.map((reminder, index) => (
          <View key={reminder.id}>
            <ReminderAccordion
              reminder={reminder}
              onUpdate={onUpdateReminder}
              onDelete={onDeleteReminder}
            />
            {index < reminders.length - 1 && <Divider />}
          </View>
        ))}
      </Card>
      <T variant="caption" tone="faint" style={{ paddingHorizontal: 4 }}>
        Alarm uses the Quest alarm sound and phone alarm priority. Notification uses the normal tone. No reminders after 11 PM.
      </T>

      <SectionHeader title="Server & data" />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <SettingRow icon={<Server size={19} color={c.primary} />} title="Server connection" hint={serverLabel} onPress={onServer} bg={c.primarySoft} />
        <Divider />
        <SettingRow icon={<Download size={19} color={c.successInk} />} title="Export backup" hint="Full JSON of everything" onPress={onExport} bg={c.successSoft} />
        <Divider />
        <SettingRow icon={<Moon size={19} color={c.indigo} />} title="Sleep verification" hint="How tonight’s check-in is judged" onPress={onSleep} bg={c.indigoSoft} />
        <Divider />
        <SettingRow icon={<RefreshCw size={19} color={c.primary} />} title="App update" hint={`Version ${currentVersion()} · check GitHub Releases`} onPress={onUpdate} bg={c.primarySoft} />
      </Card>

      <T variant="caption" tone="faint" align="center">Quest 1.0</T>
    </>
  );
}

function BudgetBit({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 14, padding: 10, gap: 2 }}>
      <T variant="caption" tone="muted">{label}</T>
      <T variant="bodyStrong">{value}</T>
    </View>
  );
}

function SettingRow({
  icon, title, hint, onPress, bg
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onPress: () => void;
  bg?: string;
}) {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: bg ?? c.soft, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong">{title}</T>
        <T variant="meta" tone="muted" numberOfLines={1}>{hint}</T>
      </View>
      <ChevronRight size={18} color={c.faint} />
    </View>
  );
  return <PressableScale onPress={onPress}>{content}</PressableScale>;
}

function ReminderAccordion({
  reminder, onUpdate, onDelete
}: {
  reminder: Reminder;
  onUpdate: (id: string, patch: { enabled?: boolean; mode?: ReminderMode; time?: string; date?: string | null; title?: string; body?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ReminderMode>(reminder.mode);
  const [time, setTime] = useState(reminder.time);
  const [date, setDate] = useState(reminder.date ?? '');
  const [title, setTitle] = useState(reminder.title);
  const [body, setBody] = useState(reminder.body);
  const [error, setError] = useState('');

  function save() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError('Use a time like 06:45.');
      return;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Use a date like 2026-11-24, or leave it blank for daily.');
      return;
    }
    setError('');
    onUpdate(reminder.id, {
      mode,
      time,
      date: date || null,
      ...(reminder.custom ? { title: title.trim() || reminder.title, body: body.trim() } : {})
    });
    setOpen(false);
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 12, paddingVertical: 12 }}>
        <PressableScale
          onPress={() => setOpen((value) => !value)}
          style={{ flex: 1 }}
          accessibilityLabel={`${reminder.title} settings`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: reminder.mode === 'alarm' ? c.warningSoft : c.soft, alignItems: 'center', justifyContent: 'center' }}>
              {reminder.mode === 'alarm'
                ? <AlarmClock size={18} color={c.warningInk} />
                : <Bell size={18} color={c.inkSoft} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="bodyStrong" numberOfLines={1}>{reminder.title}</T>
              <T variant="caption" tone="muted">
                {reminder.time}{reminder.date ? ` · ${reminder.date}` : ' · daily'} · {reminder.mode === 'alarm' ? 'Alarm' : 'Notify'}
              </T>
            </View>
          </View>
        </PressableScale>
        <Switch
          value={reminder.enabled}
          onValueChange={(value) => onUpdate(reminder.id, { enabled: value })}
          trackColor={{ false: c.soft, true: c.primary }}
          thumbColor={c.white}
          ios_backgroundColor={c.soft}
        />
        <PressableScale onPress={() => setOpen((value) => !value)} accessibilityLabel={open ? 'Collapse reminder' : 'Expand reminder'} style={{ width: 26, height: 34, alignItems: 'center', justifyContent: 'center' }}>
          {open ? <ChevronUp size={17} color={c.faint} /> : <ChevronDown size={17} color={c.faint} />}
        </PressableScale>
      </View>
      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 11 }}>
          <Segmented
            options={[{ key: 'notification', label: 'Notification' }, { key: 'alarm', label: 'Alarm' }]}
            value={mode}
            onChange={setMode}
          />
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Field label="Time" value={time} onChangeText={setTime} placeholder="06:45" containerStyle={{ flex: 1 }} />
            <Field label="Date (optional)" value={date} onChangeText={setDate} placeholder="Daily" autoCapitalize="none" containerStyle={{ flex: 1 }} />
          </View>
          {reminder.custom && (
            <>
              <Field label="Title" value={title} onChangeText={setTitle} maxLength={80} />
              <Field label="Message" value={body} onChangeText={setBody} maxLength={140} multiline />
            </>
          )}
          {!!error && <T variant="caption" style={{ color: c.dangerInk }}>{error}</T>}
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Button label="Save reminder" onPress={save} full size="sm" style={{ flex: 1 }} />
            {reminder.custom && (
              <Button label="Remove" onPress={() => onDelete(reminder.id)} variant="danger" size="sm" />
            )}
          </View>
          {!reminder.custom && (
            <T variant="caption" tone="faint">
              This reminder follows the quest window, so it won’t fire after the quest is closed.
            </T>
          )}
        </View>
      )}
    </View>
  );
}
