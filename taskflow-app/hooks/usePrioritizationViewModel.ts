import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Alert } from 'react-native';
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
import { Task } from '@/types/task.types';
import {
  PrioritizationDecision,
  PrioritizationSession,
  Quadrant,
  SuggestionResult,
} from '@/types/prioritization.types';
import { useAuth } from '@/database/context/auth_context';

export type PriorizacaoStep =
  | 'no_connection'
  | 'privacy_notice'
  | 'syncing'
  | 'generating'
  | 'card'
  | 'compare'
  | 'result'
  | 'applied'
  | 'ai_failure';

export function usePrioritizationViewModel() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [step, setStep] = useState<PriorizacaoStep>('privacy_notice');
  const [session, setSession] = useState<PrioritizationSession | null>(null);
  const [queue, setQueue] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [question, setQuestion] = useState<'important' | 'urgent'>('important');
  const [isImportant, setIsImportant] = useState(false);
  const [answers, setAnswers] = useState<{ taskId: number; quadrant: Quadrant }[]>([]);
  const [outcome, setOutcome] = useState<SuggestionsOutcome | null>(null);
  const [decisions, setDecisions] = useState<PrioritizationDecision[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const aiRequest = useRef<Promise<SuggestionsOutcome> | null>(null);

  const skeletonOpacity = useRef(new Animated.Value(0.4)).current;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

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

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        setAllTasks(getAllTasks(userId));
      }
    }, [userId])
  );

  useEffect(() => {
    if (step === 'syncing' || step === 'generating') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonOpacity, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.timing(skeletonOpacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [step, skeletonOpacity]);

  const handleRetryConnection = async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected !== false) {
      setStep('privacy_notice');
    }
  };

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
    aiRequest.current.catch(() => {});
    translateX.value = 0;
    translateY.value = 0;
    setStep('card');
  };

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
    const rotation = interpolate(translateX.value, [-150, 0, 150], [-15, 0, 15], Extrapolation.CLAMP);
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

  const applyResult = () => {
    if (session) {
      applyPrioritization(session.id);
      setStep('applied');
    }
  };

  const discardResult = () => {
    if (session) {
      discardPrioritization(session.id);
    }
    router.back();
  };

  const onChoose = (taskId: number, quadrant: Quadrant) => {
    if (!session) return;
    chooseFinal(session.id, taskId, quadrant);
    setDecisions(getDecisionsForSession(session.id));
  };

  const onChooseAll = (side: 'user' | 'ai') => {
    if (!session) return;
    chooseAll(session.id, side);
    setDecisions(getDecisionsForSession(session.id));
  };

  const currentTask = queue[currentIndex] ?? null;
  const adjustmentsCount = decisions.filter((d) => d.chosenQuadrant !== d.userQuadrant).length;
  const resultSubtitle =
    adjustmentsCount === 0
      ? 'NADA ALTERADO AINDA'
      : `${decisions.length} ${decisions.length === 1 ? 'TAREFA' : 'TAREFAS'} · ${adjustmentsCount} ${adjustmentsCount === 1 ? 'AJUSTE' : 'AJUSTES'}`;

  return {
    step,
    session,
    queue,
    currentIndex,
    question,
    answers,
    outcome,
    decisions,
    allTasks,
    skeletonOpacity,
    panResponder,
    cardAnimatedStyle,
    acceptBadgeStyle,
    rejectBadgeStyle,
    currentTask,
    adjustmentsCount,
    resultSubtitle,
    handleRetryConnection,
    iniciarPriorizacao,
    tentarIaDeNovo,
    responder,
    handleUndo,
    applyResult,
    discardResult,
    onChoose,
    onChooseAll,
    setStep,
  };
}
