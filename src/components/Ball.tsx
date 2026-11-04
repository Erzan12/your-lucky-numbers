import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type Props = {
  value: number;
  color: string;
  delay: number;
  drawKey: string;
  compact?: boolean;
};

export function Ball({ value, color, delay, drawKey, compact = false }: Props) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0.3);
    spin.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(spin, {
        toValue: 1,
        duration: 450,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawKey]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });

  return (
    <Animated.View
      style={[styles.ball, { backgroundColor: color, transform: [{ scale }, { rotate }] }]}
    >
      <View style={styles.shine} />
      <View style={styles.face}>
        <Text style={[styles.num, compact && styles.numCompact]}>{String(value).padStart(2, '0')}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ball: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  shine: {
    position: 'absolute',
    top: '10%',
    left: '14%',
    width: '28%',
    height: '28%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  face: {
    width: '60%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: {
    color: '#17203A',
    fontWeight: '800',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  numCompact: {
    fontSize: 12,
  },
});