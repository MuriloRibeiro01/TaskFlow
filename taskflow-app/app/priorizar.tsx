import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import AnimatedReanimated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';
import { useAuth } from '@/database/context/auth_context';
import { getAllTasks } from '@/database/tasks';
import {
  applyPrioritization,
  chooseAll,
  chooseFinal,
  decideTask,
  discardPrioritization,
  getDecisionsForSession,
  startSession,
} from '@/database/services/prioritization.service';
import { requestSuggestions, SuggestionsOutcome } from '@/database/services/ai-prioritizer';
import { quadrantFromAnswers } from '@/database/services/prioritization.compare';
import { CompareLists } from '@/components/prioritization/CompareLists';
import { Task } from '@/types/task.types';
import {
  PrioritizationDecision,
  PrioritizationSession,
  QUADRANT_META,
  Quadrant,
  SuggestionResult,
} from '@/types/prioritization.types';

type PriorizacaoStep =
  | 'no_connection'
  | 'privacy_notice'
  | 'syncing'
  | 'generating'
  | 'card'
  | 'compare'
  | 'result'
  | 'applied'
  | 'ai_failure';

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { symbol: string; label: string; color: string; bg: string }> = {
    high: { symbol: '▲', label: 'Alta', color: Colors.vermelho, bg: 'rgba(214,59,47,0.08)' },
    medium: { symbol: '—', label: 'Média', color: Colors.grafite, bg: 'rgba(14,14,15,0.06)' },
    low: { symbol: '▽', label: 'Baixa', color: Colors.cinza, bg: 'rgba(14,14,15,0.03)' },
    Alta: { symbol: '▲', label: 'Alta', color: Colors.vermelho, bg: 'rgba(214,59,47,0.08)' },
    Média: { symbol: '—', label: 'Média', color: Colors.grafite, bg: 'rgba(14,14,15,0.06)' },
    Baixa: { symbol: '▽', label: 'Baixa', color: Colors.cinza, bg: 'rgba(14,14,15,0.03)' },
  };
  const s = map[priority] ?? map.medium;
  return (
    <View style={[styles.priorityBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.priorityBadgeText, { color: s.color }]}>
        {s.symbol} {s.label}
      </Text>
    </View>
  );
}

export default function PriorizarModal() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [step, setStep] = useState<PriorizacaoStep>('privacy_notice');
  const [session, setSession] = useState<PrioritizationSession | null>(null);
  const [queue, setQueue] = useState<Task[]>([]); // tarefas pendentes a priorizar
  const [currentIndex, setCurrentIndex] = useState(0);
  const [question, setQuestion] = useState<'important' | 'urgent'>('important');
  const [isImportant, setIsImportant] = useState(false);
  const [answers, setAnswers] = useState<{ taskId: number; quadrant: Quadrant }[]>([]);
  const [outcome, setOutcome] = useState<SuggestionsOutcome | null>(null);
  const [decisions, setDecisions] = useState<PrioritizationDecision[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  // Pedido à IA disparado ao sair do aviso de privacidade; só é aguardado quando os swipes acabam.
  const aiRequest = useRef<Promise<SuggestionsOutcome> | null>(null);

  // Skeleton pulse animation
  const skeletonOpacity = useRef(new Animated.Value(0.4)).current;

  // Reanimated values for card swipe gesture
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Check connection on mount
  useEffect(() => {
    async function checkConnection() {
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected === false) {
          setStep('no_connection');
        } else {
          setStep('privacy_notice');
        }
      } catch {
        setStep('privacy_notice');
      }
    }
    checkConnection();
  }, []);

  // Load tasks on focus
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        setAllTasks(getAllTasks(userId));
      }
    }, [userId])
  );

  // Skeleton loop animation
  useEffect(() => {
    if (step === 'syncing' || step === 'generating') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonOpacity, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonOpacity, {
            toValue: 0.4,
            duration: 650,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [step, skeletonOpacity]);

  // Retry connection
  const handleRetryConnection = async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected !== false) {
      setStep('privacy_notice');
    }
  };

  // Start prioritization flow
  const iniciarPriorizacao = async () => {
    setStep('syncing');
    await new Promise((resolve) => setTimeout(resolve, 400));
    const tasks = getAllTasks(userId).filter((t) => t.status !== 'done');
    setAllTasks(getAllTasks(userId));

    if (tasks.length === 0) {
      Alert.alert('Sem tarefas pendentes', 'Você não possui tarefas pendentes para priorizar.');
      router.back();
      return;
    }

    setSession(startSession(userId));
    setQueue(tasks);
    setCurrentIndex(0);
    setQuestion('important');
    setAnswers([]);
    setDecisions([]);
    setOutcome(null);
    aiRequest.current = requestSuggestions(tasks);
    aiRequest.current.catch(() => {}); // o erro é tratado quando a promessa for aguardada
    translateX.value = 0;
    translateY.value = 0;
    setStep('card');
  };

  // Espera a IA, grava as decisões (swipe + sugestão) e abre a comparação.
  const finalizarSwipes = async (finalAnswers: { taskId: number; quadrant: Quadrant }[]) => {
    if (!session) return;
    setStep('generating');
    try {
      const result = await aiRequest.current!;
      finalAnswers.forEach((a) => {
        const ai = result.suggestions.find((s) => s.taskId === a.taskId) ?? null;
        decideTask(session.id, a.taskId, a.quadrant, ai);
      });
      setOutcome(result);
      setDecisions(getDecisionsForSession(session.id));
      setStep('compare');
    } catch {
      setStep('ai_failure');
    }
  };

  const tentarIaDeNovo = async () => {
    aiRequest.current = requestSuggestions(queue);
    aiRequest.current.catch(() => {});
    await finalizarSwipes(answers);
  };

  // Responde a pergunta atual (sim/não). Na segunda pergunta fecha a tarefa.
  const responder = useCallback(
    (yes: boolean) => {
      const current = queue[currentIndex];
      if (!current) return;
      translateX.value = 0;
      translateY.value = 0;

      if (question === 'important') {
        setIsImportant(yes);
        setQuestion('urgent');
        return;
      }

      const nextAnswers = [...answers, { taskId: current.id, quadrant: quadrantFromAnswers(isImportant, yes) }];
      setAnswers(nextAnswers);
      if (currentIndex + 1 >= queue.length) {
        finalizarSwipes(nextAnswers);
      } else {
        setCurrentIndex(currentIndex + 1);
        setQuestion('important');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, currentIndex, question, isImportant, answers, session]
  );

  // Desfazer: volta uma pergunta (ou uma tarefa, para a pergunta "urgente" dela).
  const handleUndo = () => {
    translateX.value = 0;
    translateY.value = 0;
    if (question === 'urgent') {
      setQuestion('important');
    } else if (answers.length > 0) {
      const last = answers[answers.length - 1];
      setAnswers(answers.slice(0, -1));
      setCurrentIndex(currentIndex - 1);
      setIsImportant(last.quadrant === 'fazer_agora' || last.quadrant === 'agendar');
      setQuestion('urgent');
    }
  };

  const handleSwipeRight = useCallback(() => responder(true), [responder]);
  const handleSwipeLeft = useCallback(() => responder(false), [responder]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10,
        onPanResponderMove: (_, gesture) => {
          translateX.value = gesture.dx;
          translateY.value = gesture.dy;
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 80) {
            runOnJS(handleSwipeRight)();
          } else if (gesture.dx < -80) {
            runOnJS(handleSwipeLeft)();
          } else {
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
          }
        },
      }),
    [handleSwipeRight, handleSwipeLeft, translateX, translateY]
  );

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-150, 0, 150],
      [-15, 0, 15],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  const acceptBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const rejectBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-80, -20], [1, 0], Extrapolation.CLAMP),
  }));

  // Current suggestion data
  const currentTask = queue[currentIndex] ?? null;
  const estimatedPomodoros = currentTask?.estimated_pomodoros ?? 1;

  // Header Subtitle for Result
  const adjustmentsCount = decisions.filter(
    (d) => d.chosenQuadrant !== d.userQuadrant
  ).length;
  const resultSubtitle =
    adjustmentsCount === 0
      ? 'NADA ALTERADO AINDA'
      : `${decisions.length} ${decisions.length === 1 ? 'TAREFA' : 'TAREFAS'} · ${adjustmentsCount} ${adjustmentsCount === 1 ? 'AJUSTE' : 'AJUSTES'}`;

  // Helper to render quadrant cell in 2x2 matrix
  const renderMatrixQuadrantCell = (q: Quadrant) => {
    const meta = QUADRANT_META[q];
    const cellDecisions = decisions.filter((d) => d.chosenQuadrant === q);

    return (
      <View key={q} style={styles.matrixCell}>
        <Text style={styles.matrixCellTitle}>{meta.label.toUpperCase()}</Text>
        <Text style={styles.matrixCellAxes}>{meta.axes}</Text>

        <View style={styles.matrixTasksList}>
          {cellDecisions.length === 0 ? (
            <Text style={styles.matrixEmptyText}>Nenhuma</Text>
          ) : (
            cellDecisions.map((d) => {
              const t = allTasks.find((task) => task.id === d.taskId);
              const displayId = `T-${String(d.taskId).padStart(3, '0')}`;
              const title = t?.title ?? `Tarefa #${d.taskId}`;

              return (
                <View key={d.taskId} style={styles.matrixTaskItem}>
                  <Text style={styles.matrixTaskId}>{displayId}</Text>
                  <Text style={styles.matrixTaskTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  {step === 'applied' && q === 'fazer_agora' && (
                    <Pressable
                      style={styles.focusButton}
                      onPress={() => router.replace('/(tabs)/timer')}
                    >
                      <Text style={styles.focusButtonText}>▶ INICIAR FOCO</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header Fixo */}
      {step === 'applied' ? (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PRIORIDADES APLICADAS</Text>
          <Text style={styles.headerSubtitle}>MATRIZ DE EISENHOWER</Text>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              hitSlop={16}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
          </View>
          <Text style={styles.headerTitle}>
            {step === 'result' ? 'RESULTADO' : 'PRIORIZAR COM IA'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {step === 'result' ? resultSubtitle : 'MATRIZ DE EISENHOWER'}
          </Text>
        </View>
      )}

      {/* 1. no_connection */}
      {step === 'no_connection' && (
        <View style={styles.centeredContainer}>
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>⚡</Text>
          </View>
          <Text style={styles.stateTitle}>SEM CONEXÃO</Text>
          <Text style={styles.stateDescription}>
            A PRIORIZAÇÃO COM IA PRECISA DE INTERNET.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.primaryButton}
            onPress={handleRetryConnection}
          >
            <Text style={styles.primaryButtonText}>TENTAR NOVAMENTE</Text>
          </Pressable>
        </View>
      )}

      {/* 2. privacy_notice */}
      {step === 'privacy_notice' && (
        <View style={styles.privacyContainer}>
          <Text style={styles.privacyHeading}>ANTES DE COMEÇAR</Text>
          <Text style={styles.privacyDescription}>
            Os campos enviados à IA do TaskFlow são:
          </Text>
          <Text style={styles.privacyBullets}>
            · TÍTULO  · DESCRIÇÃO  · PRAZO  · ESTIMATIVA  · SUA ROTINA
          </Text>
          <Text style={styles.privacyNoticeText}>
            Esses dados são enviados a um serviço de IA externo. Antes, você responde sozinho a duas perguntas por tarefa (é importante? é urgente?); só depois vê a sugestão da IA.
          </Text>
          <Text style={styles.privacyNoticeText}>
            Suas decisões são usadas apenas para personalizar suas sugestões. Nenhuma tarefa é alterada antes de você tocar em Aplicar.
          </Text>

          <View style={styles.privacyButtons}>
            <Pressable
              accessibilityRole="button"
              style={styles.darkButton}
              onPress={iniciarPriorizacao}
            >
              <Text style={styles.darkButtonText}>CONTINUAR</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>CANCELAR</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 3. syncing / generating */}
      {(step === 'syncing' || step === 'generating') && (
        <View style={styles.skeletonContainer}>
          <Text style={styles.skeletonLabel}>
            {step === 'syncing'
              ? 'SINCRONIZANDO PENDÊNCIAS...'
              : 'GERANDO SUGESTÕES...'}
          </Text>
          <Animated.View style={[styles.skeletonTrack, { opacity: skeletonOpacity }]}>
            <View style={[styles.skeletonBar, { height: 16 }]} />
            <View style={[styles.skeletonBar, { height: 48 }]} />
            <View style={[styles.skeletonBar, { height: 24 }]} />
          </Animated.View>
        </View>
      )}

      {/* 4. card: swipe cego (duas perguntas por tarefa) */}
      {step === 'card' && currentTask && (
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={styles.cardScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressContainer}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressText}>
                TAREFA {currentIndex + 1} DE {queue.length} · PERGUNTA {question === 'important' ? 1 : 2} DE 2
              </Text>
              {(answers.length > 0 || question === 'urgent') && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Desfazer última resposta"
                  hitSlop={12}
                  onPress={handleUndo}
                >
                  <Text style={styles.undoLink}>DESFAZER</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((currentIndex + (question === 'urgent' ? 0.5 : 0)) / queue.length) * 100}%` },
                ]}
              />
            </View>
          </View>

          <AnimatedReanimated.View
            {...panResponder.panHandlers}
            style={[styles.cardWrapper, cardAnimatedStyle]}
          >
            <AnimatedReanimated.View style={[styles.stampAccept, acceptBadgeStyle]}>
              <Text style={styles.stampAcceptText}>✓ SIM</Text>
            </AnimatedReanimated.View>
            <AnimatedReanimated.View style={[styles.stampReject, rejectBadgeStyle]}>
              <Text style={styles.stampRejectText}>✗ NÃO</Text>
            </AnimatedReanimated.View>

            <View style={styles.cardHeader}>
              <Text style={styles.cardTaskId}>
                T-{String(currentTask.id).padStart(3, '0')}
              </Text>
              <PriorityBadge priority={currentTask.priority ?? 'medium'} />
            </View>

            <Text style={styles.cardTaskTitle}>{currentTask.title}</Text>

            <Text style={styles.cardTaskMeta}>
              {estimatedPomodoros} pom · {estimatedPomodoros * 25} min
            </Text>

            <View style={styles.aiSection}>
              <Text style={styles.quadrantTitle}>
                {question === 'important' ? 'É importante?' : 'É urgente?'}
              </Text>
              <Text style={styles.quadrantAxes}>
                ← NÃO · SIM →
              </Text>
            </View>
          </AnimatedReanimated.View>

          <View style={styles.cardActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={question === 'important' ? 'Não é importante' : 'Não é urgente'}
              style={styles.rejectButton}
              onPress={() => responder(false)}
            >
              <Text style={styles.rejectButtonText}>← NÃO</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={question === 'important' ? 'Sim, é importante' : 'Sim, é urgente'}
              style={styles.acceptButton}
              onPress={() => responder(true)}
            >
              <Text style={styles.acceptButtonText}>SIM →</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* 4b. compare: minha lista × lista da IA */}
      {step === 'compare' && (
        <CompareLists
          decisions={decisions}
          tasks={allTasks}
          source={outcome?.source ?? 'rules'}
          onChoose={(taskId, quadrant) => {
            if (!session) return;
            chooseFinal(session.id, taskId, quadrant);
            setDecisions(getDecisionsForSession(session.id));
          }}
          onChooseAll={(side) => {
            if (!session) return;
            chooseAll(session.id, side);
            setDecisions(getDecisionsForSession(session.id));
          }}
          onContinue={() => setStep('result')}
        />
      )}

      {/* 5. result & applied */}
      {(step === 'result' || step === 'applied') && (
        <ScrollView
          style={styles.resultScroll}
          contentContainerStyle={styles.resultScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Eisenhower Matrix 2x2 */}
          <View style={styles.matrixWrapper}>
            {/* Headers de colunas */}
            <View style={styles.matrixColHeaders}>
              <View style={styles.matrixCorner} />
              <View style={styles.matrixColHeader}>
                <Text style={styles.matrixColLabel}>URGENTE</Text>
              </View>
              <View style={styles.matrixColHeader}>
                <Text style={styles.matrixColLabel}>NÃO URGENTE</Text>
              </View>
            </View>

            {/* Linha 0: IMPORTANTE */}
            <View style={styles.matrixRow}>
              <View style={styles.matrixRowHeader}>
                <Text style={styles.matrixRowLabel}>IMPORTANTE</Text>
              </View>
              {renderMatrixQuadrantCell('fazer_agora')}
              {renderMatrixQuadrantCell('agendar')}
            </View>

            {/* Linha 1: POUCO IMPORTANTE */}
            <View style={styles.matrixRow}>
              <View style={styles.matrixRowHeader}>
                <Text style={styles.matrixRowLabel}>POUCO{'\n'}IMPORTANTE</Text>
              </View>
              {renderMatrixQuadrantCell('delegar')}
              {renderMatrixQuadrantCell('eliminar')}
            </View>
          </View>

          {/* Action buttons */}
          {step === 'result' ? (
            <View style={styles.resultActions}>
              <Pressable
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => {
                  if (session) {
                    applyPrioritization(session.id);
                    setStep('applied');
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>APLICAR</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => setStep('compare')}
              >
                <Text style={styles.secondaryButtonText}>REVISAR</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.discardButton}
                onPress={() => {
                  if (session) {
                    discardPrioritization(session.id);
                  }
                  router.back();
                }}
              >
                <Text style={styles.discardButtonText}>DESCARTAR</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.resultActions}>
              <Pressable
                accessibilityRole="button"
                style={styles.darkButton}
                onPress={() => router.replace('/(tabs)')}
              >
                <Text style={styles.darkButtonText}>VOLTAR PARA TAREFAS</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* 6. ai_failure */}
      {step === 'ai_failure' && (
        <View style={styles.centeredContainer}>
          <View style={[styles.iconBox, { borderColor: Colors.vermelho }]}>
            <Text style={[styles.iconText, { color: Colors.vermelho }]}>!</Text>
          </View>
          <Text style={styles.stateTitle}>FALHA AO GERAR SUGESTÕES</Text>
          <Text style={styles.stateDescription}>
            NENHUMA TAREFA FOI ALTERADA.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.primaryButton}
            onPress={tentarIaDeNovo}
          >
            <Text style={styles.primaryButtonText}>TENTAR NOVAMENTE</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.papel,
  },
  header: {
    backgroundColor: Colors.tinta,
    paddingTop: Spacing.sp12,
    paddingHorizontal: Spacing.sp5,
    paddingBottom: Spacing.sp4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sp2,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginRight: 'auto',
    paddingVertical: Spacing.sp1,
  },
  backText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.body,
    color: Colors.papel,
  },
  headerTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.headingMd,
    color: Colors.papel,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginTop: Spacing.sp1,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sp6,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.grafite,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sp4,
    borderRadius: 0,
  },
  iconText: {
    fontFamily: Fonts.mono,
    fontSize: 26,
    color: Colors.grafite,
  },
  stateTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.headingLg,
    color: Colors.tinta,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  stateDescription: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.grafite,
    marginTop: Spacing.sp2,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: Colors.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sp6,
    paddingHorizontal: Spacing.sp6,
    width: '100%',
    borderRadius: 0,
  },
  primaryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.papel,
    letterSpacing: 0.5,
  },
  darkButton: {
    minHeight: 48,
    backgroundColor: Colors.tinta,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 0,
  },
  darkButtonText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.papel,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.papel3,
    backgroundColor: Colors.papel2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 0,
  },
  secondaryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.grafite,
    letterSpacing: 0.5,
  },
  privacyContainer: {
    flex: 1,
    paddingHorizontal: Spacing.sp5,
    paddingTop: Spacing.sp6,
    paddingBottom: Spacing.sp8,
  },
  privacyHeading: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.headingXl,
    color: Colors.tinta,
    letterSpacing: 0.5,
  },
  privacyDescription: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.body,
    color: Colors.grafite,
    marginTop: Spacing.sp3,
  },
  privacyBullets: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.tinta,
    marginTop: Spacing.sp2,
    letterSpacing: 0.5,
  },
  privacyNoticeText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.grafite,
    marginTop: Spacing.sp4,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  privacyButtons: {
    marginTop: 'auto',
    gap: Spacing.sp3,
  },
  skeletonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sp5,
  },
  skeletonLabel: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.cinza,
    letterSpacing: 0.5,
    marginBottom: Spacing.sp6,
    textAlign: 'center',
  },
  skeletonTrack: {
    width: '100%',
    gap: Spacing.sp3,
  },
  skeletonBar: {
    width: '100%',
    backgroundColor: Colors.papel3,
    borderRadius: 0,
  },
  cardScroll: {
    flex: 1,
  },
  cardScrollContent: {
    paddingBottom: Spacing.sp8,
  },
  progressContainer: {
    paddingHorizontal: Spacing.sp4,
    paddingTop: Spacing.sp3,
    paddingBottom: Spacing.sp2,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sp1,
  },
  progressText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    letterSpacing: 0.3,
  },
  undoLink: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.vermelho,
    letterSpacing: 0.3,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.papel3,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.vermelho,
  },
  cardWrapper: {
    marginHorizontal: Spacing.sp4,
    marginTop: Spacing.sp3,
    backgroundColor: Colors.papel2,
    borderWidth: 1,
    borderColor: Colors.papel3,
    padding: Spacing.sp4,
    borderRadius: 0,
  },
  stampAccept: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderWidth: 2,
    borderColor: Colors.vermelho,
    paddingHorizontal: 8,
    paddingVertical: 4,
    transform: [{ rotate: '12deg' }],
    zIndex: 10,
  },
  stampAcceptText: {
    fontFamily: Fonts.barlowBold,
    fontSize: 16,
    color: Colors.vermelho,
  },
  stampReject: {
    position: 'absolute',
    top: 16,
    left: 16,
    borderWidth: 2,
    borderColor: Colors.grafite,
    paddingHorizontal: 8,
    paddingVertical: 4,
    transform: [{ rotate: '-12deg' }],
    zIndex: 10,
  },
  stampRejectText: {
    fontFamily: Fonts.barlowBold,
    fontSize: 16,
    color: Colors.grafite,
  },
  stampUp: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: Colors.tinta,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
  stampUpText: {
    fontFamily: Fonts.barlowBold,
    fontSize: 16,
    color: Colors.tinta,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sp2,
  },
  cardTaskId: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.cinza,
    letterSpacing: 0.3,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sp2,
    paddingVertical: 2,
  },
  priorityBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    letterSpacing: 0.3,
  },
  cardTaskTitle: {
    fontFamily: Fonts.barlowSemiBold,
    fontSize: FontSize.taskTitle,
    color: Colors.tinta,
    marginBottom: Spacing.sp2,
  },
  cardTaskMeta: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginBottom: Spacing.sp4,
  },
  aiSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.papel3,
    paddingTop: Spacing.sp4,
  },
  aiLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sp2,
  },
  aiLabel: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    letterSpacing: 0.5,
  },
  aiAdjustedText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.vermelho,
    letterSpacing: 0.3,
  },
  quadrantTitle: {
    fontFamily: Fonts.barlowBlackItalic,
    fontSize: 34,
    color: Colors.tinta,
    lineHeight: 38,
  },
  quadrantAxes: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    letterSpacing: 0.4,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  aiJustification: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.body,
    color: Colors.grafite,
    marginTop: Spacing.sp3,
    lineHeight: 20,
  },
  aiConfidence: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginTop: Spacing.sp2,
    letterSpacing: 0.3,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sp2,
    marginTop: Spacing.sp4,
    paddingHorizontal: Spacing.sp4,
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.papel3,
    backgroundColor: Colors.papel2,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  rejectButtonText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.grafite,
  },
  nowButton: {
    flex: 1,
    backgroundColor: Colors.tinta,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  nowButtonText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.papel,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: Colors.vermelho,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  acceptButtonText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.papel,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14,14,15,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.papel,
    padding: Spacing.sp5,
    borderTopWidth: 2,
    borderTopColor: Colors.tinta,
  },
  modalTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.headingMd,
    color: Colors.tinta,
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.cinza,
    marginTop: Spacing.sp1,
    marginBottom: Spacing.sp4,
    letterSpacing: 0.3,
  },
  quadrantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sp2,
    marginBottom: Spacing.sp4,
  },
  quadrantGridCell: {
    width: '48.5%',
    minHeight: 80,
    backgroundColor: Colors.papel2,
    borderWidth: 1,
    borderColor: Colors.papel3,
    padding: Spacing.sp3,
    justifyContent: 'center',
  },
  quadrantGridCellOriginal: {
    borderColor: Colors.vermelho,
  },
  originalBadge: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.vermelho,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  gridCellTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.taskTitle,
    color: Colors.tinta,
  },
  gridCellAxes: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.cinza,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  resultScroll: {
    flex: 1,
  },
  resultScrollContent: {
    padding: Spacing.sp4,
    paddingBottom: Spacing.sp8,
  },
  matrixWrapper: {
    borderWidth: 1,
    borderColor: Colors.papel3,
    backgroundColor: Colors.papel,
    marginBottom: Spacing.sp5,
  },
  matrixColHeaders: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.papel3,
  },
  matrixCorner: {
    width: 64,
    borderRightWidth: 1,
    borderRightColor: Colors.papel3,
    backgroundColor: Colors.papel2,
  },
  matrixColHeader: {
    flex: 1,
    paddingVertical: Spacing.sp2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.papel2,
  },
  matrixColLabel: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.cinza,
    letterSpacing: 0.5,
  },
  matrixRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.papel3,
  },
  matrixRowHeader: {
    width: 64,
    borderRightWidth: 1,
    borderRightColor: Colors.papel3,
    backgroundColor: Colors.papel2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  matrixRowLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: Colors.cinza,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  matrixCell: {
    flex: 1,
    minHeight: 110,
    padding: Spacing.sp2,
    backgroundColor: Colors.papel2,
    borderRightWidth: 1,
    borderRightColor: Colors.papel3,
  },
  matrixCellTitle: {
    fontFamily: Fonts.barlowBold,
    fontSize: FontSize.caption,
    color: Colors.tinta,
    letterSpacing: 0.3,
  },
  matrixCellAxes: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: Colors.cinza,
    marginBottom: Spacing.sp1,
  },
  matrixTasksList: {
    marginTop: Spacing.sp1,
    gap: Spacing.sp1,
  },
  matrixEmptyText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.cinza,
    fontStyle: 'italic',
  },
  matrixTaskItem: {
    borderTopWidth: 1,
    borderTopColor: Colors.papel3,
    paddingTop: 2,
  },
  matrixTaskId: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: Colors.cinza,
  },
  matrixTaskTitle: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.taskId,
    color: Colors.grafite,
  },
  focusButton: {
    backgroundColor: Colors.vermelho,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sp1,
    paddingHorizontal: Spacing.sp2,
    borderRadius: 0,
  },
  focusButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.papel,
    letterSpacing: 0.3,
  },
  resultActions: {
    gap: Spacing.sp3,
  },
  discardButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardButtonText: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.caption,
    color: Colors.cinza,
    letterSpacing: 0.5,
  },
});
