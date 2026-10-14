import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ColorTheme, FontSize, Fonts, Spacing } from '@/theme';
import { useTheme } from '@/hooks/useTheme';
import { createTask, editTask, getTaskById } from '@/database/tasks';
import { useAuth } from '@/database/context/auth_context';

type Priority = 'low' | 'medium' | 'high';

const PRIORITY_OPTIONS: { value: Priority; label: string; symbol: string }[] = [
  { value: 'low', label: 'Baixa', symbol: '▽' },
  { value: 'medium', label: 'Média', symbol: '—' },
  { value: 'high', label: 'Alta', symbol: '▲' },
];

function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkControl}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkboxMark}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export default function NovaTarefa() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const isEditing = editingId !== null && !isNaN(editingId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [useDate, setUseDate] = useState(false);
  const [useHour, setUseHour] = useState(false);
  const [deadline, setDeadline] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [usePomodoro, setUsePomodoro] = useState(false);
  const [estimatedPomodoros, setEstimatedPomodoros] = useState(2);
  const [showTitleError, setShowTitleError] = useState(false);

  useEffect(() => {
    if (!isEditing || !editingId) return;
    const task = getTaskById(editingId);
    if (!task) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(task.title);
    setDescription(task.description ?? '');
    if (task.priority === 'low' || task.priority === 'medium' || task.priority === 'high') {
      setPriority(task.priority);
    }
    if (task.estimated_pomodoros && task.estimated_pomodoros > 0) {
      setUsePomodoro(true);
      setEstimatedPomodoros(task.estimated_pomodoros);
    }
    if (task.due_date) {
      const parsedDate = new Date(task.due_date);
      if (!isNaN(parsedDate.getTime())) {
        setUseDate(true);
        setDeadline(parsedDate);
      }
    }
  }, [editingId, isEditing]);

  const now = new Date();
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
  const day = now.toLocaleDateString('pt-BR', { day: '2-digit' });
  const month = now.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  const year = now.getFullYear();
  const today = `${weekday}, ${day} ${month} ${year}`;

  const changeTitle = (value: string) => {
    setTitle(value);
    if (value.trim()) setShowTitleError(false);
  };

  const formatDate = (value: Date) => value.toLocaleDateString('pt-BR');
  const formatTime = (value: Date) => value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const updateDeadline = (mode: 'date' | 'time') => (_event: DateTimePickerEvent, selectedValue?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }

    if (!selectedValue) return;

    setDeadline((current) => {
      const next = new Date(current);
      if (mode === 'date') {
        next.setFullYear(selectedValue.getFullYear(), selectedValue.getMonth(), selectedValue.getDate());
      } else {
        next.setHours(selectedValue.getHours(), selectedValue.getMinutes(), 0, 0);
      }
      return next;
    });
  };

  const handleCreate = () => {
    if (!title.trim()) {
      setShowTitleError(true);
      return;
    }

    if (isEditing && editingId) {
      editTask(editingId, {
        title: title.trim(),
        description: description.trim(),
        priority,
        estimated_pomodoros: usePomodoro ? estimatedPomodoros : undefined,
        due_date: useDate || useHour ? deadline.toISOString() : null,
      });
    } else {
      createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        estimated_pomodoros: usePomodoro ? estimatedPomodoros : undefined,
        due_date: useDate || useHour ? deadline.toISOString() : undefined,
        user_id: user?.id ?? '',
      });
    }

    router.back();
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.tinta} />
      <View style={styles.root}>
        <View style={styles.header}>
          <View>
            <Text accessibilityRole="header" style={styles.headerTitle}>{isEditing ? 'EDITAR TAREFA' : 'NOVA TAREFA'}</Text>
            <Text style={styles.headerDate}>{today}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={isEditing ? 'Fechar editar tarefa' : 'Fechar nova tarefa'} hitSlop={16} onPress={() => router.back()}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Nome da tarefa</Text>
            <TextInput
              accessibilityLabel="Nome da tarefa"
              style={[styles.input, showTitleError && styles.inputError]}
              placeholder="Ex: Revisar protótipo no Figma"
              placeholderTextColor={colors.cinza}
              value={title}
              onChangeText={changeTitle}
              maxLength={80}
              returnKeyType="next"
            />
            {showTitleError && <Text style={styles.errorText}>▲ Informe o nome da tarefa.</Text>}

            <Text style={styles.fieldLabel}>Descrição da tarefa</Text>
            <TextInput
              accessibilityLabel="Descrição da tarefa"
              style={[styles.input, styles.descriptionInput]}
              placeholder="Ex: Revisar fluxo de criação e coleta de feedback"
              placeholderTextColor={colors.cinza}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Data e Hora</Text>
            <View style={styles.checkRow}>
              <Checkbox
                checked={useDate}
                onPress={() => {
                  setUseDate((value) => !value);
                  setShowDatePicker(false);
                }}
                label="Data"
              />
              <Checkbox
                checked={useHour}
                onPress={() => {
                  setUseHour((value) => !value);
                  setShowTimePicker(false);
                }}
                label="Hora"
              />
            </View>

            {(useDate || useHour) && (
              <View style={styles.deadlineRow}>
                {useDate && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Selecionar data"
                    style={styles.deadlineInput}
                    onPress={() => {
                      setShowTimePicker(false);
                      setShowDatePicker((visible) => !visible);
                    }}
                  >
                    <Text
                      accessibilityLabel="Data da tarefa"
                      style={styles.deadlineText}
                    >
                      {formatDate(deadline)}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color={colors.grafite} />
                  </Pressable>
                )}
                {useHour && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Selecionar hora"
                    style={styles.deadlineInput}
                    onPress={() => {
                      setShowDatePicker(false);
                      setShowTimePicker((visible) => !visible);
                    }}
                  >
                    <Text
                      accessibilityLabel="Hora da tarefa"
                      style={styles.deadlineText}
                    >
                      {formatTime(deadline)}
                    </Text>
                    <Ionicons name="time-outline" size={16} color={colors.grafite} />
                  </Pressable>
                )}
              </View>
            )}
            {showDatePicker && useDate && (
              <DateTimePicker
                value={deadline}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={updateDeadline('date')}
                locale="pt-BR"
              />
            )}
            {showTimePicker && useHour && (
              <DateTimePicker
                value={deadline}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={updateDeadline('time')}
                is24Hour
                locale="pt-BR"
              />
            )}

            <Text style={styles.fieldLabel}>Nível de prioridade</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map((option) => {
                const selected = priority === option.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={option.value}
                    onPress={() => setPriority(option.value)}
                    style={[
                      styles.priorityButton,
                      selected && styles.priorityButtonSelected,
                    ]}
                  >
                    <Text style={[
                      styles.priorityText,
                      selected && styles.priorityTextSelected,
                    ]}>
                      {option.label} {option.symbol}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Pomodoro</Text>
            <Checkbox checked={usePomodoro} onPress={() => setUsePomodoro((value) => !value)} label="Utilizar pomodoro" />

            {usePomodoro && (
              <View style={styles.estimate}>
                <Text style={styles.estimateLabel}>Tempo estimado</Text>
                <View style={styles.stepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Diminuir Pomodoros"
                    style={styles.stepperButton}
                    onPress={() => setEstimatedPomodoros((value) => Math.max(1, value - 1))}
                  >
                    <Text style={styles.stepperSymbol}>−</Text>
                  </Pressable>
                  <Text style={styles.pomodoroValue}>{estimatedPomodoros} pom.</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar Pomodoros"
                    style={styles.stepperButton}
                    onPress={() => setEstimatedPomodoros((value) => Math.min(8, value + 1))}
                  >
                    <Text style={styles.stepperSymbol}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.estimateCaption}>≈ {estimatedPomodoros * 25} MIN DE FOCO</Text>
              </View>
            )}

          </ScrollView>
          <View style={styles.floatingAction}>
            <Pressable accessibilityRole="button" style={styles.createButton} onPress={handleCreate}>
              <Text style={styles.createButtonText}>{isEditing ? 'Salvar alterações' : 'Criar tarefa'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.tinta },
    root: { flex: 1, backgroundColor: colors.papel },
    header: {
      alignItems: 'flex-start',
      backgroundColor: colors.tinta,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: Spacing.sp5,
      paddingHorizontal: Spacing.sp5,
      paddingTop: 60,
    },
    headerTitle: { color: colors.textoClaro, fontFamily: Fonts.barlowBold, fontSize: 28, letterSpacing: 0.35, lineHeight: 32 },
    headerDate: { color: colors.cinza, fontFamily: Fonts.mono, fontSize: FontSize.label, letterSpacing: 0.5, marginTop: 2 },
    closeText: { color: colors.textoClaro, fontFamily: Fonts.barlowSemiBold, fontSize: 28, lineHeight: 30 },
    keyboardContainer: { flex: 1 },
    form: { paddingBottom: 132, paddingHorizontal: Spacing.sp5, paddingTop: Spacing.sp5 },
    fieldLabel: { color: colors.tinta, fontFamily: Fonts.barlowBold, fontSize: 18, lineHeight: 22, marginBottom: Spacing.sp2, marginTop: Spacing.sp5 },
    input: {
      backgroundColor: colors.papel2,
      borderColor: colors.papel3,
      borderWidth: 1,
      color: colors.tinta,
      fontFamily: 'DMSans_400Regular',
      fontSize: FontSize.body,
      minHeight: 56,
      paddingHorizontal: Spacing.sp4,
      paddingVertical: Spacing.sp3,
    },
    inputError: { borderColor: colors.vermelho },
    descriptionInput: { height: 94 },
    errorText: { color: colors.vermelho, fontFamily: Fonts.mono, fontSize: FontSize.label, letterSpacing: 0.25, marginTop: Spacing.sp2 },
    checkRow: { flexDirection: 'row', gap: Spacing.sp6 },
    checkControl: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sp2 },
    checkbox: { alignItems: 'center', borderColor: colors.tinta, borderWidth: 1, height: 22, justifyContent: 'center', width: 22 },
    checkboxChecked: { backgroundColor: colors.vermelho, borderColor: colors.vermelho },
    checkboxMark: { color: colors.textoClaro, fontFamily: Fonts.barlowBold, fontSize: 15, lineHeight: 18 },
    checkLabel: { color: colors.tinta, fontFamily: 'DMSans_400Regular', fontSize: FontSize.body },
    deadlineRow: { flexDirection: 'row', gap: Spacing.sp3, marginTop: Spacing.sp3 },
    deadlineInput: {
      alignItems: 'center',
      backgroundColor: colors.papel2,
      borderColor: colors.papel3,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      height: 50,
      paddingHorizontal: Spacing.sp3,
    },
    deadlineText: { color: colors.tinta, flex: 1, fontFamily: Fonts.mono, fontSize: 12 },
    priorityRow: { flexDirection: 'row', gap: Spacing.sp2 },
    priorityButton: { alignItems: 'center', backgroundColor: colors.papel, borderColor: colors.papel3, borderWidth: 1, flex: 1, height: 48, justifyContent: 'center' },
    priorityButtonSelected: { backgroundColor: colors.vermelho, borderColor: colors.vermelho },
    priorityText: { color: colors.cinza, fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 0.2 },
    priorityTextSelected: { color: colors.textoClaro },
    estimate: { marginTop: Spacing.sp4 },
    estimateLabel: { color: colors.tinta, fontFamily: Fonts.barlowBold, fontSize: 16, marginBottom: Spacing.sp2 },
    stepperRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    stepperButton: { alignItems: 'center', borderColor: colors.tinta, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 },
    stepperSymbol: { color: colors.tinta, fontFamily: Fonts.mono, fontSize: 20 },
    pomodoroValue: { color: colors.tinta, fontFamily: Fonts.barlowBold, fontSize: 22 },
    estimateCaption: { color: colors.cinza, fontFamily: Fonts.mono, fontSize: FontSize.label, letterSpacing: 1, marginTop: Spacing.sp2, textAlign: 'center' },
    floatingAction: { bottom: 24, left: Spacing.sp5, position: 'absolute', right: Spacing.sp5 },
    createButton: { alignItems: 'center', backgroundColor: colors.vermelho, height: 60, justifyContent: 'center' },
    createButtonText: { color: colors.textoClaro, fontFamily: Fonts.barlowBold, fontSize: 21, lineHeight: 24 },
  });
}

let cachedStyles: ReturnType<typeof createStyles> | null = null;
let cachedTheme: ColorTheme | null = null;

function getStyles(colors: ColorTheme) {
  if (cachedStyles && cachedTheme === colors) return cachedStyles;
  cachedTheme = colors;
  cachedStyles = createStyles(colors);
  return cachedStyles;
}

