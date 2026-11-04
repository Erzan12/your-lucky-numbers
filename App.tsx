import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { GameCard } from './src/components/GameCard';
import {
  DRAW_TIME_LABEL,
  formatNumbers,
  gamesDrawnOn,
  gamesNotDrawnOn,
  GAMES,
  manilaDateKey,
  manilaDateKeyFor,
  nextDrawLabel,
  pickForGame,
  prettyDateFromKey,
  WEEKDAYS,
  weekdayFromKey,
} from './src/lucky';
import {
  disableReminders,
  enableReminders,
  refreshReminders,
  ReminderBuilder,
  ReminderContent,
  ReminderResult,
  sendTestNotification,
} from './src/notifications';
import { dark, light } from './src/theme';

const NAME_KEY = 'lucky-name';
const REMINDER_KEY = 'lucky-reminder'; // 'on' | 'off' (older values 'daily'/'dates' count as on)
const rollKey = (date: string) => `lucky-roll-${date}`;

type Notice = { text: string; showSettings: boolean; tone: 'error' | 'info' } | null;

function noticeFor(result: ReminderResult): Notice {
  if (result.ok) return null;
  if (result.reason === 'denied') {
    return {
      text: 'Notifications are blocked for this app. Allow them in Settings to get the reminder.',
      showSettings: true,
      tone: 'error',
    };
  }
  return { text: `Couldn't set the reminder: ${result.message}`, showSettings: false, tone: 'error' };
}

/** Notification text for a given day: only the games drawn that night, with their numbers. */
function reminderFor(dateKey: string, name: string, roll: number): ReminderContent {
  const weekday = weekdayFromKey(dateKey);
  const games = gamesDrawnOn(weekday);
  const lines = games.map(
    (g) => `${g.name} ${g.id}: ${formatNumbers(pickForGame(g, dateKey, name, roll))}`,
  );
  return {
    title: `${WEEKDAYS[weekday]}'s lucky numbers 🍀`,
    body: lines.length
      ? `Drawing tonight at ${DRAW_TIME_LABEL}:\n${lines.join('\n')}`
      : 'No major draws tonight. Open the app to see your numbers.',
  };
}

/**
 * Builder used for the 14 scheduled mornings. Today's notification uses the
 * current roll; future days use roll 0, which is what the app will show
 * on those days until "Draw again" is tapped.
 */
function makeBuilder(name: string, roll: number, todayKey: string): ReminderBuilder {
  return (date: Date) => {
    const key = manilaDateKeyFor(date);
    return reminderFor(key, name, key === todayKey ? roll : 0);
  };
}

function LuckyScreen() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? dark : light;

  // nameInput = what's in the text field; appliedName = the name the numbers use.
  // Numbers only change when the Draw button is pressed, never while typing.
  const [nameInput, setNameInput] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [dateKey, setDateKey] = useState(manilaDateKey());
  const [roll, setRoll] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const [reminderOn, setReminderOn] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const nameChanged = nameInput.trim() !== appliedName.trim();
  const weekday = weekdayFromKey(dateKey);

  const saveReminder = (on: boolean) => {
    setReminderOn(on);
    AsyncStorage.setItem(REMINDER_KEY, on ? 'on' : 'off').catch(() => {});
  };

  // Load saved name, today's roll, and reminder state
  useEffect(() => {
    (async () => {
      try {
        const [savedName, savedRoll, savedReminder] = await Promise.all([
          AsyncStorage.getItem(NAME_KEY),
          AsyncStorage.getItem(rollKey(dateKey)),
          AsyncStorage.getItem(REMINDER_KEY),
        ]);
        const name = savedName ?? '';
        const r = Number(savedRoll ?? 0);
        setNameInput(name);
        setAppliedName(name);
        setRoll(r);

        const wasOn = savedReminder === 'on' || savedReminder === 'daily' || savedReminder === 'dates';
        if (wasOn) {
          setReminderOn(true);
          if (savedReminder !== 'on') AsyncStorage.setItem(REMINDER_KEY, 'on').catch(() => {});
          // Refill the next 14 mornings with up-to-date numbers
          refreshReminders(makeBuilder(name, r, dateKey));
        }
      } catch {
        // Storage failing just means defaults; the app still works
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // When the app comes back to the foreground: handle a new day and refill reminders
  const onForeground = useCallback(async () => {
    const now = manilaDateKey();
    let r = roll;
    if (now !== dateKey) {
      setDateKey(now);
      try {
        r = Number((await AsyncStorage.getItem(rollKey(now))) ?? 0);
      } catch {
        r = 0;
      }
      setRoll(r);
    }
    if (reminderOn) refreshReminders(makeBuilder(appliedName, r, now));
  }, [dateKey, roll, reminderOn, appliedName]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') onForeground();
    });
    return () => sub.remove();
  }, [onForeground]);

  const onDraw = async () => {
    Keyboard.dismiss();

    const now = manilaDateKey();
    const newDay = now !== dateKey;
    if (newDay) setDateKey(now);

    const next = newDay ? 1 : roll + 1;
    setRoll(next);
    AsyncStorage.setItem(rollKey(now), String(next)).catch(() => {});

    const name = nameInput.trim();
    setAppliedName(name);
    AsyncStorage.setItem(NAME_KEY, name).catch(() => {});

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Keep scheduled notifications in sync with the new name/draw
    if (reminderOn) refreshReminders(makeBuilder(name, next, now));
  };

  const onToggleReminder = async (value: boolean) => {
    setNotice(null);
    if (value) {
      const result = await enableReminders(makeBuilder(appliedName, roll, dateKey));
      if (result.ok) {
        saveReminder(true);
        setNotice({
          text: "Reminder set for 8:00 AM, with that day's numbers for the games drawn that night.",
          showSettings: false,
          tone: 'info',
        });
      } else {
        saveReminder(false);
        setNotice(noticeFor(result));
      }
    } else {
      await disableReminders().catch(() => {});
      saveReminder(false);
    }
  };

  const onTest = async () => {
    setNotice(null);
    const result = await sendTestNotification(reminderFor(dateKey, appliedName, roll));
    setNotice(
      result.ok
        ? { text: 'Test sent with today\'s numbers. Lock your phone; it arrives in about 5 seconds.', showSettings: false, tone: 'info' }
        : noticeFor(result),
    );
  };

  const draws = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const g of GAMES) map[g.id] = pickForGame(g, dateKey, appliedName, roll);
    return map;
  }, [dateKey, appliedName, roll]);
  const drawKey = `${dateKey}|${appliedName}|${roll}`;

  const tonight = gamesDrawnOn(weekday);
  const others = gamesNotDrawnOn(weekday);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: theme.muted }]}>DAILY DRAW · PCSO LOTTO GAMES</Text>
          <Text style={[styles.h1, { color: theme.ink }]}>
            Feeling lucky today?{'\n'}
            <Text style={{ color: theme.accent }}>Here are your numbers.</Text>
          </Text>
          <Text style={[styles.date, { color: theme.muted }]}>{prettyDateFromKey(dateKey)}</Text>
        </View>

        <View style={styles.block}>
          <View style={styles.controls}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.muted }]}>Your name (makes the numbers yours)</Text>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="e.g. Zan"
                placeholderTextColor={theme.muted}
                maxLength={40}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                style={[
                  styles.input,
                  {
                    color: theme.ink,
                    backgroundColor: theme.surface,
                    borderColor: nameChanged ? theme.accent : theme.line,
                  },
                ]}
              />
            </View>
            <Pressable
              onPress={onDraw}
              style={({ pressed }) => [
                styles.drawBtn,
                {
                  backgroundColor: nameChanged ? theme.accent : theme.ink,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.drawText, { color: theme.buttonText }]}>
                {nameChanged ? 'Draw for me' : 'Draw again'}
              </Text>
            </Pressable>
          </View>
          {nameChanged && (
            <Text style={[styles.hint, { color: theme.accent }]}>
              Tap "Draw for me" to get numbers for this name.
            </Text>
          )}
        </View>

        <View style={styles.block}>
          <View style={[styles.reminder, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.reminderText}>
              <Text style={[styles.reminderTitle, { color: theme.ink }]}>Morning reminder</Text>
              <Text style={[styles.reminderSub, { color: theme.muted }]}>
                8:00 AM daily, with the numbers for that night's draws
              </Text>
              <Pressable onPress={onTest} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.testLink, { color: theme.accent }]}>Send a test notification</Text>
              </Pressable>
            </View>
            <Switch
              value={reminderOn}
              onValueChange={onToggleReminder}
              trackColor={{ true: theme.accent, false: theme.line }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Daily 8 AM reminder"
            />
          </View>
          {notice && (
            <View style={styles.noticeRow}>
              <Text
                style={[
                  styles.hint,
                  { color: notice.tone === 'error' ? theme.accent : theme.muted, flexShrink: 1 },
                ]}
              >
                {notice.text}
              </Text>
              {notice.showSettings && (
                <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
                  <Text style={[styles.settingsLink, { color: theme.ink }]}>Open Settings</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {loaded && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>
                Drawing tonight · {DRAW_TIME_LABEL}
              </Text>
              {tonight.map((g, i) => (
                <GameCard
                  key={g.id}
                  game={g}
                  numbers={draws[g.id]}
                  index={i}
                  drawKey={drawKey}
                  theme={theme}
                  variant="tonight"
                  drawLabel={`Tonight · ${DRAW_TIME_LABEL}`}
                />
              ))}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>Other games</Text>
              <Text style={[styles.sectionSub, { color: theme.muted }]}>
                Not drawn tonight. You can still buy tickets ahead for their next draw.
              </Text>
              {others.map((g, i) => (
                <GameCard
                  key={g.id}
                  game={g}
                  numbers={draws[g.id]}
                  index={tonight.length + i}
                  drawKey={drawKey}
                  theme={theme}
                  variant="other"
                  drawLabel={`Next draw: ${nextDrawLabel(g, weekday)}`}
                />
              ))}
            </View>
          </>
        )}

        <View style={[styles.note, { borderTopColor: theme.line }]}>
          <Text style={[styles.noteText, { color: theme.muted }]}>
            <Text style={[styles.bold, { color: theme.ink }]}>How it picks. </Text>
            Your numbers come from today's date (Philippine time) and your name, so they stay the
            same all day and change at midnight. Tap "Draw again" for a new set today.
          </Text>
          <Text style={[styles.noteText, { color: theme.muted }]}>
            <Text style={[styles.bold, { color: theme.ink }]}>Draw schedule. </Text>
            6/42 Tue, Thu, Sat · 6/45 Mon, Wed, Fri · 6/49 Tue, Thu, Sun · 6/55 Mon, Wed, Sat ·
            6/58 Tue, Fri, Sun. PCSO may change or skip draws on holidays like Holy Week,
            Christmas and New Year.
          </Text>
          <Text style={[styles.noteText, { color: theme.muted }]}>
            <Text style={[styles.bold, { color: theme.ink }]}>The honest part. </Text>
            Every combination has the same chance of winning. These picks are spread across the
            full range, with at least two numbers above 31 and no long runs. That doesn't help you
            win, but if you do, you're less likely to split the jackpot.
          </Text>
          <Text style={[styles.noteText, { color: theme.muted }]}>
            Play for fun, set a budget, and only buy from authorized PCSO outlets.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LuckyScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 22 },
  header: { gap: 6, paddingTop: 8 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  h1: { fontSize: 32, fontWeight: '900', lineHeight: 36 },
  date: { fontSize: 14, fontVariant: ['tabular-nums'] },
  block: { gap: 6 },
  controls: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  field: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  drawBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  drawText: { fontWeight: '800', fontSize: 15 },
  hint: { fontSize: 12, fontWeight: '600' },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reminderText: { flex: 1, gap: 2 },
  reminderTitle: { fontSize: 15, fontWeight: '700' },
  reminderSub: { fontSize: 12 },
  testLink: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  noticeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  settingsLink: { fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionSub: { fontSize: 12, marginTop: -6 },
  note: { borderTopWidth: 1, paddingTop: 16, gap: 8 },
  noteText: { fontSize: 13, lineHeight: 19 },
  bold: { fontWeight: '700' },
});