import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { DetailHeader } from '@/components/DetailHeader';
import { StreetBackground } from '@/components/StreetBackground';
import type { Category } from '@/db/types';
import { amountDraftToCentavos, centavosToAmountDraft } from '@/features/entry/utils/amountInput';
import { EditCategoryGrid } from '@/features/expense/components/EditCategoryGrid';
import { addDaysToKey, dayKeyToLocalDate, isLocalDayKey, todayKey, toLocalDayKey } from '@/lib/dates';
import { formatPeso } from '@/lib/money';
import { listAll as listCategories } from '@/repositories/categoriesRepo';
import { layout, radii, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

import { frequencies, localTime, reminderOffsets, validTime } from './calendar';
import { reminderPermission, scheduleTestReminder } from './nativeReminders';
import {
  actOnPayment, listOutstanding, listRecentPayments, listSchedules, materializeUpcoming, nextOutstandingDay,
  readOccurrence, readPreferences, savePreferences, saveSchedule, setScheduleState,
  type Occurrence, type Preferences, type Schedule, type ScheduleInput,
} from './repository';
import { recurringStatus, refreshRecurring, subscribeRecurringStatus } from './runtime';

type Selected = { id: number; day: string };
type Panel = 'list' | 'form' | 'payment' | 'confirm' | 'snooze' | 'preferences';

function Copy({ children, heading = false, muted = false }: { children: ReactNode; heading?: boolean; muted?: boolean }) {
  const { colors } = useAppTheme();
  return <Text accessibilityRole={heading ? 'header' : undefined}
    style={[heading ? typography.heading : typography.body, { color: muted ? colors.textMuted : colors.text }]}>
    {children}
  </Text>;
}

function Action({ label, press, selected, primary, disabled }: {
  label: string; press: () => void; selected?: boolean; primary?: boolean; disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
    onPress={press} style={[styles.button, {
      backgroundColor: primary ? colors.primary : selected ? colors.surfaceElevated : colors.surface,
      borderColor: selected ? colors.primary : colors.border, opacity: disabled ? 0.55 : 1,
    }]}>
    <Text style={[typography.label, { color: primary ? colors.primaryText : colors.text }]}>{label}</Text>
  </Pressable>;
}

function Field({ label, value, change, placeholder, numeric }: {
  label: string; value: string; change: (value: string) => void; placeholder?: string; numeric?: boolean;
}) {
  const { colors } = useAppTheme();
  return <View style={styles.field}>
    <Copy>{label}</Copy>
    <TextInput accessibilityLabel={label} value={value} onChangeText={change} placeholder={placeholder}
      placeholderTextColor={colors.textMuted} keyboardType={numeric ? 'decimal-pad' : 'default'}
      autoCorrect={false} autoCapitalize={numeric || placeholder ? 'none' : 'sentences'}
      style={[styles.input, typography.body, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
  </View>;
}

function CalendarField({ label, value, change, kind = 'date' }: {
  label: string; value: string; change: (value: string) => void; kind?: 'date' | 'time';
}) {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  const pickerValue = kind === 'date'
    ? dayKeyToLocalDate(isLocalDayKey(value) ? value : todayKey())
    : new Date(localTime(todayKey(), validTime(value) ? value : '09:00'));
  return <View style={styles.field}>
    <Field label={label} placeholder={kind === 'date' ? 'YYYY-MM-DD' : 'HH:MM'} value={value} change={change} />
    {Platform.OS === 'android' || Platform.OS === 'ios' ? <>
      <Action label={open && Platform.OS === 'ios' ? 'Done' : `Choose ${label.toLowerCase()}`} press={() => setOpen(!open)} />
      {open ? <DateTimePicker mode={kind} value={pickerValue} presentation="dialog" is24Hour
        accentColor={colors.primary} onDismiss={() => setOpen(false)}
        onValueChange={(_, date) => {
          if (Platform.OS === 'android') setOpen(false);
          change(kind === 'date' ? toLocalDayKey(date.getTime()) :
            `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
        }} /> : null}
    </> : null}
  </View>;
}

function Card({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>;
}

function Offsets({ value, change }: { value: number; change: (mask: number) => void }) {
  return <View style={styles.row}>
    <Action label="Off" selected={value === 0} press={() => change(0)} />
    {reminderOffsets.map((days, bit) => <Action key={days}
      label={days ? `${days}d before` : 'Due date'} selected={Boolean(value & (1 << bit))}
      press={() => change(value ^ (1 << bit))} />)}
  </View>;
}

const modeLabel = { automatic: 'Automatic recording', reminder: 'Payment reminder' };

export function RecurringScreen({ onBack, target }: { onBack: () => void; target?: Selected }) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const [panel, setPanel] = useState<Panel>(target ? 'payment' : 'list');
  const [selected, setSelected] = useState<Selected | undefined>(target);
  const [editId, setEditId] = useState<number>();
  const [draft, setDraft] = useState<ScheduleInput>();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [categories, setCategories] = useState<Category[]>([]);
  const [schedules, setSchedules] = useState<{ schedule: Schedule; next: string | null }[]>([]);
  const [outstanding, setOutstanding] = useState<Occurrence[]>([]);
  const [recent, setRecent] = useState<Occurrence[]>([]);
  const [loadedPayment, setPayment] = useState<Occurrence | null>(null);
  const payment = loadedPayment?.schedule_id === selected?.id && loadedPayment?.due_day === selected?.day
    ? loadedPayment : null;
  const [preferences, setPreferences] = useState<Preferences>();
  const [permission, setPermission] = useState('Checking…');
  const [busy, setBusy] = useState(false);
  const actionInProgress = useRef(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(() => recurringStatus(db));

  const reload = useCallback(async () => {
    const today = todayKey();
    const [rows, bills, tags, completed] = await Promise.all([
      listSchedules(db), listOutstanding(db, today), listCategories(db), listRecentPayments(db),
    ]);
    const upcoming = await Promise.all(rows.map(async (schedule) => ({
      schedule, next: await nextOutstandingDay(db, schedule, today),
    })));
    setSchedules(upcoming);
    setOutstanding(bills);
    setRecent(completed);
    setCategories(tags);
    if (selected) {
      setPayment(rows.some((row) => row.id === selected.id) ? await readOccurrence(db, selected.id, selected.day) : null);
    }
  }, [db, selected]);

  useEffect(() => {
    const update = () => {
      setStatus(recurringStatus(db));
      void reload().catch(() => setError('Could not read recurring expenses.'));
    };
    update();
    return subscribeRecurringStatus(update);
  }, [db, reload]);

  useEffect(() => {
    const update = () => { void reminderPermission(db).then(setPermission).catch(() => setPermission('Unavailable')); };
    update();
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') update(); });
    return () => app.remove();
  }, [db]);

  function run(task: () => Promise<void>) {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setBusy(true);
    setError('');
    void task().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Something went wrong.'))
      .finally(() => {
        actionInProgress.current = false;
        setBusy(false);
      });
  }

  function openForm(schedule?: Schedule) {
    run(async () => {
      const defaults = await readPreferences(db);
      setEditId(schedule?.id);
      setAmount(schedule ? centavosToAmountDraft(schedule.amount) : '');
      setDraft(schedule ?? { name: '', amount: 0, category_id: categories.find((c) => !c.isArchived)?.id ?? 0,
        start_day: todayKey(), end_day: null, due_time: defaults.due_time, frequency: 'monthly',
        mode: 'reminder', offsets: defaults.offsets });
      setPanel('form');
    });
  }

  function openPayment(id: number, day: string, upcoming = false) {
    run(async () => {
      if (upcoming) await materializeUpcoming(db, id, day);
      setPayment(await readOccurrence(db, id, day));
      setSelected({ id, day });
      setPanel('payment');
    });
  }

  function confirmAction(title: string, text: string, action: () => Promise<void>) {
    Alert.alert(title, text, [{ text: 'Cancel', style: 'cancel' },
      { text: title, style: 'destructive', onPress: () => run(action) }]);
  }

  function submitSnooze(day: string, reminderTime: string) {
    if (!selected) return;
    run(async () => {
      await actOnPayment(db, selected.id, selected.day, { type: 'snooze', day, time: reminderTime });
      await refreshRecurring(db);
      setPanel('payment');
    });
  }

  const categoryName = (id: number) => categories.find((category) => category.id === id)?.name ?? 'Category unavailable';
  const titles: Record<Panel, string> = {
    list: 'RECURRING EXPENSES', form: editId ? 'EDIT SCHEDULE' : 'ADD RECURRING EXPENSE',
    payment: 'PAYMENT DETAILS', confirm: 'CONFIRM PAYMENT', snooze: 'REMIND ME LATER', preferences: 'REMINDER SETTINGS',
  };
  const today = todayKey();

  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
    <StreetBackground />
    <DetailHeader title={titles[panel]} onBack={() => {
      if (busy) return;
      setError('');
      if (panel === 'list') onBack();
      else setPanel(panel === 'confirm' || panel === 'snooze' ? 'payment' : 'list');
    }} />
    <ScrollView key={panel} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {error ? <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.danger }]}>{error}</Text> : null}
      {status.reminderError ? <Copy>Some phone reminders could not be scheduled. They will be retried when you reopen Gastos Gang.</Copy> : null}
      {panel === 'list' ? <>
        <Action label="Add recurring expense" primary disabled={busy} press={() => openForm()} />
        <Action label="Reminder settings" disabled={busy} press={() => run(async () => {
          setPreferences(await readPreferences(db)); setPanel('preferences');
        })} />
        {status.backlog ? <Card><Copy>More missed occurrences are waiting to be processed.</Copy>
          <Action label="Process next batch" disabled={busy} press={() => run(async () => { await refreshRecurring(db); })} />
        </Card> : null}
        <Copy heading>Due / Overdue</Copy>
        {outstanding.length === 0 ? <Copy muted>No outstanding payments.</Copy> : null}
        {outstanding.map((bill) => <Card key={`${bill.schedule_id}:${bill.due_day}`}>
          <Copy heading>{bill.name} · {formatPeso(bill.amount)}</Copy>
          <Copy>{bill.due_day < today ? 'Overdue' : bill.due_day === today ? 'Due today' : 'Upcoming · Snoozed'} · {bill.due_day}</Copy>
          <Copy muted>{categoryName(bill.category_id)} · Payment reminder</Copy>
          <Action label="View payment" disabled={busy} press={() => openPayment(bill.schedule_id, bill.due_day)} />
        </Card>)}
        {(['active', 'paused'] as const).map((state) => {
          const items = schedules.filter(({ schedule }) => schedule.state === state);
          return <View key={state} style={styles.group}>
            <Copy heading>{state === 'active' ? 'Upcoming' : 'Paused'}</Copy>
            {items.length === 0 ? <Copy muted>{state === 'active' ? 'No active schedules.' : 'No paused schedules.'}</Copy> : null}
            {items.map(({ schedule, next }) => <Card key={schedule.id}>
              <Copy heading>{schedule.name} · {formatPeso(schedule.amount)}</Copy>
              <Copy>{categoryName(schedule.category_id)} · {schedule.frequency} · {modeLabel[schedule.mode]}</Copy>
              <Copy muted>{state === 'paused' ? 'Paused' : next ? `Next due ${next}` : 'Schedule ended'}</Copy>
              <View style={styles.row}>
                {state === 'active' && next && schedule.mode === 'reminder' ?
                  <Action label="View next payment" disabled={busy} press={() => openPayment(schedule.id, next, true)} /> : null}
                <Action label="Edit" disabled={busy} press={() => openForm(schedule)} />
                <Action label={state === 'active' ? 'Pause' : 'Resume'} disabled={busy}
                  press={() => run(async () => {
                    await setScheduleState(db, schedule.id, state === 'active' ? 'paused' : 'active');
                    await refreshRecurring(db);
                  })} />
                <Action label="Delete" disabled={busy} press={() => confirmAction('Delete schedule',
                  'Future reminders will stop. Recorded expenses will stay in History.', async () => {
                    await setScheduleState(db, schedule.id, 'deleted'); await refreshRecurring(db);
                  })} />
              </View>
            </Card>)}
          </View>;
        })}
        {recent.length ? <View style={styles.group}>
          <Copy heading>Recent payments and skips</Copy>
          {recent.map((bill) => <Action key={`${bill.schedule_id}:${bill.due_day}`}
            label={`${bill.name} · ${bill.due_day} · ${bill.status === 'paid' ? 'Paid' : 'Skipped'}`}
            disabled={busy} press={() => openPayment(bill.schedule_id, bill.due_day)} />)}
        </View> : null}
      </> : null}
      {panel === 'form' && draft ? <>
        <Field label="Expense name" value={draft.name} change={(name) => setDraft({ ...draft, name })} />
        <Field label="Amount (₱)" numeric value={amount} change={setAmount} />
        {amountDraftToCentavos(amount) ? <Copy>{formatPeso(amountDraftToCentavos(amount)!)}</Copy> : null}
        <Copy heading>Category</Copy>
        <EditCategoryGrid categories={categories.filter((c) => !c.isArchived || c.id === draft.category_id)}
          disabled={busy} selectedId={draft.category_id} onSelect={(category_id) => setDraft({ ...draft, category_id })} />
        <Copy heading>Repeat</Copy>
        <View style={styles.row}>{frequencies.map((frequency) => <Action key={frequency}
          label={frequency.charAt(0).toUpperCase() + frequency.slice(1)} selected={draft.frequency === frequency}
          press={() => setDraft({ ...draft, frequency })} />)}</View>
        <CalendarField label="Start date" value={draft.start_day}
          change={(start_day) => setDraft({ ...draft, start_day })} />
        <CalendarField label="End date (optional)" value={draft.end_day ?? ''}
          change={(end_day) => setDraft({ ...draft, end_day: end_day || null })} />
        <CalendarField label="Due time (local)" kind="time" value={draft.due_time}
          change={(due_time) => setDraft({ ...draft, due_time })} />
        <Copy heading>Recording mode</Copy>
        <Card><Action label="Automatic recording" selected={draft.mode === 'automatic'}
          press={() => setDraft({ ...draft, mode: 'automatic' })} />
          <Copy muted>Adds eligible expenses when the app runs. An automatic entry doesn’t confirm that you paid.</Copy>
        </Card>
        <Card><Action label="Payment reminder" selected={draft.mode === 'reminder'}
          press={() => setDraft({ ...draft, mode: 'reminder' })} />
          <Copy muted>Track what’s due and confirm payment when you pay.</Copy>
        </Card>
        {draft.mode === 'reminder' ? <>
          <Copy heading>Phone reminders</Copy>
          <Offsets value={draft.offsets} change={(offsets) => setDraft({ ...draft, offsets })} />
          {draft.offsets > 0 && permission !== 'Allowed' ? <>
            <Copy muted>Allow notifications to receive reminders while Gastos Gang is closed.</Copy>
            <Action label={permission === 'Denied' ? 'Open device settings' : 'Allow notifications'} disabled={busy}
              press={() => run(async () => {
                if (permission === 'Denied') await Linking.openSettings();
                else setPermission(await reminderPermission(db, true));
              })} />
          </> : null}
        </> : null}
        <Action label="Save schedule" primary disabled={busy} press={() => run(async () => {
          await saveSchedule(db, { ...draft, amount: amountDraftToCentavos(amount) ?? 0 }, editId);
          await refreshRecurring(db); setPanel('list');
        })} />
      </> : null}
      {panel === 'payment' ? payment ? <>
        <Card>
          <Copy heading>{payment.name}</Copy>
          <Copy>{formatPeso(payment.amount)} estimated · {categoryName(payment.category_id)}</Copy>
          <Copy>Due {payment.due_day}</Copy>
          <Copy>{payment.status === 'paid' ? `Paid · ${payment.payment_day}` : payment.status === 'skipped' ? 'Skipped' :
            payment.status === 'auto' ? 'Automatically recorded' : payment.due_day < today ? 'Overdue' : payment.due_day === today ? 'Due today' : 'Upcoming'}</Copy>
          {payment.recorded_amount !== null ? <Copy>Recorded {formatPeso(payment.recorded_amount)}</Copy> : null}
          {payment.snooze_day ? <Copy>Snoozed until {payment.snooze_day} at {payment.snooze_time}</Copy> : null}
        </Card>
        {payment.status === 'pending' && selected ? <>
          <Action label="Mark as paid" primary disabled={busy} press={() => {
            setAmount(centavosToAmountDraft(payment.amount)); setDate(todayKey()); setPanel('confirm');
          }} />
          <Action label="Remind me later" disabled={busy} press={() => run(async () => {
            const defaults = await readPreferences(db);
            setDate(addDaysToKey(todayKey(), 1)); setTime(defaults.due_time); setPanel('snooze');
          })} />
          <Action label="Skip this payment" disabled={busy} press={() => confirmAction('Skip this payment',
            'Only this occurrence will be skipped.', async () => {
              await actOnPayment(db, selected.id, selected.day, { type: 'skip' }); await refreshRecurring(db);
            })} />
        </> : null}
      </> : <Copy>This payment is unavailable.</Copy> : null}
      {panel === 'confirm' && selected && payment ? <>
        <Copy heading>{payment.name}</Copy>
        <Copy>Estimated {formatPeso(payment.amount)} · {categoryName(payment.category_id)}</Copy>
        <Field label="Actual amount (₱)" numeric value={amount} change={setAmount} />
        <CalendarField label="Payment date" value={date} change={setDate} />
        <Action label="Confirm payment" primary disabled={busy} press={() => run(async () => {
          const paid = await actOnPayment(db, selected.id, selected.day,
            { type: 'pay', amount: amountDraftToCentavos(amount) ?? 0, day: date });
          if (paid) Toast.show({ type: 'success', text1: 'Bayad na, Geng! Expense logged. 🤙' });
          await refreshRecurring(db); setPanel('payment');
        })} />
      </> : null}
      {panel === 'snooze' && payment ? <>
        <Copy>Original due date {payment.due_day}</Copy>
        <View style={styles.row}>{[1, 3, 7].map((days) => <Action key={days} disabled={busy}
          label={days === 1 ? 'Tomorrow' : `In ${days} days`}
          press={() => submitSnooze(addDaysToKey(todayKey(), days), time)} />)}</View>
        <CalendarField label="Reminder date" value={date} change={setDate} />
        <CalendarField label="Reminder time (local)" kind="time" value={time} change={setTime} />
        <Action label="Save custom reminder" primary disabled={busy || !isLocalDayKey(date)} press={() => submitSnooze(date, time)} />
        {permission !== 'Allowed' ? <Copy muted>Your snooze stays in Gastos Gang. Phone notifications require device permission.</Copy> : null}
      </> : null}
      {panel === 'preferences' && preferences ? <>
        <Copy>Phone permission · {permission}</Copy>
        <Copy muted>Allow notifications to receive payment reminders while the app is closed.</Copy>
        <View style={styles.row}>
          {permission === 'Not requested' ? <Action label="Allow notifications" disabled={busy}
            press={() => run(async () => { setPermission(await reminderPermission(db, true)); await refreshRecurring(db); })} /> : null}
          <Action label="Open device settings" disabled={busy} press={() => run(() => Linking.openSettings())} />
        </View>
        <Action label={preferences.enabled ? 'Phone reminders on' : 'Phone reminders off'} selected={!!preferences.enabled}
          press={() => setPreferences({ ...preferences, enabled: Number(!preferences.enabled) })} />
        <Action label={preferences.preview ? 'Show name and amount in previews' : 'Hide name and amount in previews'} selected={!!preferences.preview}
          press={() => setPreferences({ ...preferences, preview: Number(!preferences.preview) })} />
        <CalendarField label="Default reminder time" kind="time" value={preferences.due_time}
          change={(due_time) => setPreferences({ ...preferences, due_time })} />
        <Copy heading>Default advance reminders</Copy>
        <Offsets value={preferences.offsets} change={(offsets) => setPreferences({ ...preferences, offsets })} />
        {permission === 'Allowed' ? <Action label="Schedule test notification" disabled={busy} press={() => run(async () => {
          await scheduleTestReminder(db);
          Toast.show({ type: 'success', text1: 'Test reminder scheduled', text2: 'Expected in about two minutes.' });
        })} /> : null}
        <Action label="Save settings" primary disabled={busy} press={() => run(async () => {
          await savePreferences(db, preferences); await refreshRecurring(db); setPanel('list');
        })} />
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', padding: spacing.lg,
    paddingBottom: spacing.xxl, gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  group: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  button: { minHeight: layout.minimumTapTarget, justifyContent: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1 },
  field: { gap: spacing.xs },
  input: { minHeight: layout.minimumTapTarget, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md },
});
