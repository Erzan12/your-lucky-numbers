import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ball } from './Ball';
import { combinations, formatNumbers, Game } from '../lucky';
import { Theme } from '../theme';

type Props = {
  game: Game;
  numbers: number[];
  index: number;
  drawKey: string;
  theme: Theme;
  variant: 'tonight' | 'other';
  drawLabel: string; // e.g. "Tonight · 9 PM" or "Next draw: Fri"
};

export function GameCard({ game, numbers, index, drawKey, theme, variant, drawLabel }: Props) {
  const [copied, setCopied] = useState(false);
  const compact = variant === 'other';

  const onCopy = async () => {
    await Clipboard.setStringAsync(`${game.name} ${game.id}: ${formatNumbers(numbers)}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: theme.surface, borderColor: theme.line },
      ]}
    >
      <View style={styles.top}>
        <View style={styles.nameRow}>
          <View style={[styles.tag, { backgroundColor: game.color }]}>
            <Text style={styles.tagText}>{game.id}</Text>
          </View>
          <Text style={[styles.name, compact && styles.nameCompact, { color: theme.ink }]}>
            {game.name}
          </Text>
        </View>
        <Text
          style={[
            styles.drawLabel,
            { color: compact ? theme.muted : theme.accent },
          ]}
        >
          {drawLabel}
        </Text>
      </View>

      <View style={[styles.balls, compact && styles.ballsCompact]}>
        {numbers.map((n, i) => (
          <Ball
            key={`${game.id}-${i}`}
            value={n}
            color={game.color}
            delay={index * 80 + i * 60}
            drawKey={drawKey}
            compact={compact}
          />
        ))}
      </View>

      <View style={styles.foot}>
        <Text style={[styles.odds, { color: theme.muted }]}>
          {copied ? 'Copied' : `1 in ${combinations(game.max, 6).toLocaleString('en-US')}`}
        </Text>
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => [
            styles.copyBtn,
            compact && styles.copyBtnCompact,
            { borderColor: theme.line, opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${game.name} numbers`}
        >
          <Text style={[styles.copyText, { color: theme.ink }]}>Copy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardCompact: {
    padding: 12,
    gap: 8,
    opacity: 0.72,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  tagText: { color: '#17203A', fontWeight: '800', fontSize: 12 },
  name: { fontSize: 16, fontWeight: '700' },
  nameCompact: { fontSize: 14 },
  drawLabel: { fontSize: 12, fontWeight: '700' },
  balls: { flexDirection: 'row', gap: 8 },
  ballsCompact: { gap: 6, width: '72%' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  odds: { fontSize: 12, fontVariant: ['tabular-nums'] },
  copyBtn: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14 },
  copyBtnCompact: { paddingVertical: 4, paddingHorizontal: 10 },
  copyText: { fontSize: 13, fontWeight: '700' },
});