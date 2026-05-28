import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';

const INTERVAL_MINUTES = 5;
const STEP_SECONDS = 30;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Timer() {
  const [durationSeconds, setDurationSeconds] = useState(30 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(30 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick do timer
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            setHasStarted(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Sincroniza remaining com duration quando o timer não iniciou
  useEffect(() => {
    if (!hasStarted) {
      setRemainingSeconds(durationSeconds);
    }
  }, [durationSeconds, hasStarted]);

  function handleIncrease() {
    if (isRunning) return;
    setDurationSeconds((prev) => prev + STEP_SECONDS);
  }

  function handleDecrease() {
    if (isRunning) return;
    setDurationSeconds((prev) => Math.max(STEP_SECONDS, prev - STEP_SECONDS));
  }

  function handleStartPause() {
    if (remainingSeconds === 0) {
      setRemainingSeconds(durationSeconds);
      setHasStarted(true);
      setIsRunning(true);
      return;
    }
    if (!isRunning) setHasStarted(true);
    setIsRunning((prev) => !prev);
  }

  function handleReset() {
    setIsRunning(false);
    setHasStarted(false);
    setRemainingSeconds(durationSeconds);
  }

  const isFinished = remainingSeconds === 0;
  const buttonLabel = isFinished
    ? 'Reiniciar timer'
    : isRunning
    ? 'Pausar timer'
    : hasStarted
    ? 'Retomar timer'
    : 'Iniciar timer';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontFamily: Fonts.barlowBold }]}>
          TIMER
        </Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Timer Display */}
        <View style={[styles.timerBox, isRunning && styles.timerBoxActive]}>
          <Text style={[styles.timerText, isFinished && styles.timerTextFinished]}>
            {formatTime(remainingSeconds)}
          </Text>
          {isRunning && <Text style={styles.timerSubLabel}>em andamento</Text>}
          {isFinished && <Text style={[styles.timerSubLabel, { color: '#C0392B' }]}>concluído!</Text>}
        </View>

        {/* Duration Controls */}
        <View style={styles.durationRow}>
          <TouchableOpacity
            style={[styles.durationBtn, isRunning && styles.durationBtnDisabled]}
            onPress={handleDecrease}
            disabled={isRunning}
          >
            <Text style={styles.durationBtnText}>−</Text>
          </TouchableOpacity>

          <View style={styles.durationDisplay}>
            <Text style={styles.durationText}>{formatTime(durationSeconds)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.durationBtn, isRunning && styles.durationBtnDisabled]}
            onPress={handleIncrease}
            disabled={isRunning}
          >
            <Text style={styles.durationBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.intervalLabel}>Intervalo:  {INTERVAL_MINUTES} minutos</Text>

        {/* Task Selection */}
        <Text style={styles.sectionTitle}>Selecionar tarefas</Text>

        <View style={styles.taskCard}>
          <View style={styles.taskCheckbox} />
          <View style={styles.taskInfo}>
            <View style={styles.taskTopRow}>
              <Text style={styles.taskId}>T-002</Text>
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityText}>− Média</Text>
              </View>
            </View>
            <Text style={styles.taskTitle}>Design das telas no Figma</Text>
            <View style={styles.taskBottomRow}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>− pendente</Text>
              </View>
              <View style={styles.squareRow}>
                <View style={styles.square} />
                <View style={styles.square} />
                <View style={styles.square} />
              </View>
              <Text style={styles.taskTime}>37 min</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.startButton, isRunning && styles.pauseButton]}
          onPress={handleStartPause}
        >
          <Text style={styles.startButtonText}>{buttonLabel}</Text>
        </TouchableOpacity>

        {hasStarted && !isFinished && (
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Resetar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EDEBE6',
  },
  container: {
    flex: 1,
    backgroundColor: '#EDEBE6',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sp12,
    paddingBottom: Spacing.sp5,
    paddingHorizontal: Spacing.sp5,
    backgroundColor: Colors.tinta,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.papel,
  },

  timerBox: {
    backgroundColor: '#EDEBE6',
    borderWidth: 2,
    borderColor: '#1A1A1A',
    borderRadius: 4,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  timerBoxActive: {
    borderColor: '#C0392B',
  },
  timerText: {
    fontSize: 52,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: 2,
  },
  timerTextFinished: {
    color: '#C0392B',
  },
  timerSubLabel: {
    fontSize: 12,
    color: '#C0392B',
    marginTop: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '500',
  },

  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 10,
  },
  durationBtn: {
    backgroundColor: '#8A8A7A',
    width: 60,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBtnDisabled: {
    opacity: 0.4,
  },
  durationBtnText: {
    fontSize: 24,
    color: '#EDEBE6',
    fontWeight: '400',
  },
  durationDisplay: {
    backgroundColor: '#5A5A4A',
    width: 110,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#EDEBE6',
    letterSpacing: 1,
  },
  intervalLabel: {
    textAlign: 'center',
    color: '#7A7A6A',
    fontSize: 13,
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 14,
  },

  taskCard: {
    backgroundColor: '#E2E0D8',
    borderRadius: 6,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#5A5A4A',
    borderRadius: 3,
    marginTop: 2,
  },
  taskInfo: {
    flex: 1,
  },
  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskId: {
    fontSize: 12,
    color: '#8A8A7A',
    fontWeight: '500',
  },
  priorityBadge: {
    backgroundColor: '#D4D2CA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 12,
    color: '#5A5A4A',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  taskBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    backgroundColor: '#D4D2CA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    color: '#5A5A4A',
  },
  squareRow: {
    flexDirection: 'row',
    gap: 4,
  },
  square: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: '#8A8A7A',
    borderRadius: 2,
  },
  taskTime: {
    fontSize: 13,
    color: '#5A5A4A',
    fontWeight: '500',
  },

  startButton: {
    backgroundColor: '#C0392B',
    borderRadius: 6,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 10,
  },
  pauseButton: {
    backgroundColor: '#5A5A4A',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  resetButton: {
    borderWidth: 1.5,
    borderColor: '#8A8A7A',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#5A5A4A',
    fontSize: 15,
    fontWeight: '500',
  },
});