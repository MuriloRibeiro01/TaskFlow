import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';
import { createTask } from '@/database/tasks';

type Priority = 'low' | 'medium' | 'high';

const PRIORITY_OPTIONS: { value: Priority; label: string; symbol: string }[] = [
  { value: 'low', label: 'Baixa', symbol: '▽' },
  { value: 'medium', label: 'Média', symbol: '—' },
  { value: 'high', label: 'Alta', symbol: '▲' },
];

function Checkbox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Text style={styles.checkboxMark}>✓</Text>}
    </Pressable>
  );
}

export default function NovaTarefa() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [useDate, setUseDate] = useState(false);
  const [useHour, setUseHour] = useState(false);
  const [dateText, setDateText] = useState('');
  const [hourText, setHourText] = useState('');
  const [usePomodoro, setUsePomodoro] = useState(false);
  const [pomodoroMins, setPomodoroMins] = useState(25);

  const today = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase();

  function decreaseMins() {
    setPomodoroMins(prev => Math.max(25, prev - 25));
  }

  function increaseMins() {
    setPomodoroMins(prev => Math.min(200, prev + 25));
  }

  function handleCreate() {
    if (!title.trim()) return;

    const dueDateParts: string[] = [];
    if (useDate && dateText.trim()) dueDateParts.push(dateText.trim());
    if (useHour && hourText.trim()) dueDateParts.push(hourText.trim());

    createTask({
      title: title.trim(),
      description: description.trim(),
      priority: priority ?? 'low',
      estimated_pomodoros: usePomodoro ? Math.round(pomodoroMins / 25) : undefined,
      due_date: dueDateParts.length > 0 ? dueDateParts.join(' ') : undefined,
    });

    router.back();
  }

  const canCreate = title.trim().length > 0;

  return (
    <View style={styles.root}>
      {/* Header dark */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { fontFamily: Fonts.barlowBold }]}>NOVA TAREFA</Text>
          <Text style={[styles.headerDate, { fontFamily: Fonts.mono }]}>{today}</Text>
        </View>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={[styles.closeText, { fontFamily: Fonts.barlowBold }]}>✕</Text>
        </Pressable>
      </View>

      {/* Card content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nome */}
          <Text style={[styles.fieldLabel, { fontFamily: Fonts.barlowBold }]}>Nome da tarefa</Text>
          <TextInput
            style={[styles.input, { fontFamily: Fonts.mono }]}
            placeholder="EX: Passear com o cachorro"
            placeholderTextColor={Colors.cinza}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          {/* Descrição */}
          <Text style={[styles.fieldLabel, { fontFamily: Fonts.barlowBold }]}>Descrição da tarefa</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { fontFamily: Fonts.mono }]}
            placeholder="Ex: Lembrar de pegar a coleira azul..."
            placeholderTextColor={Colors.cinza}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          {/* Data e Hora */}
          <Text style={[styles.fieldLabel, { fontFamily: Fonts.barlowBold }]}>Data e Hora</Text>
          <View style={styles.checkRow}>
            <Checkbox checked={useDate} onPress={() => setUseDate(v => !v)} />
            <Text style={[styles.checkLabel, { fontFamily: Fonts.mono }]}>Data</Text>
            <Checkbox checked={useHour} onPress={() => setUseHour(v => !v)} />
            <Text style={[styles.checkLabel, { fontFamily: Fonts.mono }]}>Hora</Text>
          </View>

          {(useDate || useHour) && (
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={20} color={Colors.grafite} style={styles.calIcon} />
              {useDate ? (
                <TextInput
                  style={[styles.dateInput, { fontFamily: Fonts.mono }]}
                  placeholder="18 de abril"
                  placeholderTextColor={Colors.cinza}
                  value={dateText}
                  onChangeText={setDateText}
                />
              ) : (
                <Text style={[styles.dateInputEmpty, { fontFamily: Fonts.mono }]}>—</Text>
              )}
              <View style={styles.dateVertDivider} />
              {useHour ? (
                <TextInput
                  style={[styles.dateInputHour, { fontFamily: Fonts.mono, color: Colors.vermelho }]}
                  placeholder="20 : 00"
                  placeholderTextColor={Colors.cinza}
                  value={hourText}
                  onChangeText={setHourText}
                  keyboardType="numeric"
                />
              ) : (
                <Text style={[styles.dateInputEmpty, { fontFamily: Fonts.mono }]}>—</Text>
              )}
            </View>
          )}

          {/* Prioridade */}
          <Text style={[styles.fieldLabel, { fontFamily: Fonts.barlowBold }]}>Nível de prioridade</Text>
          <View style={styles.priorityRow}>
            {PRIORITY_OPTIONS.map(opt => {
              const isSelected = priority === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.priorityBtn,
                    isSelected && styles.priorityBtnSelected,
                  ]}
                  onPress={() => setPriority(opt.value)}
                >
                  <Text
                    style={[
                      styles.priorityBtnText,
                      { fontFamily: Fonts.mono },
                      isSelected && styles.priorityBtnTextSelected,
                    ]}
                  >
                    {opt.label} {opt.symbol}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Pomodoro */}
          <Text style={[styles.fieldLabel, { fontFamily: Fonts.barlowBold }]}>Pomodoro</Text>
          <View style={styles.checkRow}>
            <Checkbox checked={usePomodoro} onPress={() => setUsePomodoro(v => !v)} />
            <Text style={[styles.checkLabel, { fontFamily: Fonts.mono }]}>Utilizar pomodoro</Text>
          </View>

          {usePomodoro && (
            <>
              <Text style={[styles.tempoLabel, { fontFamily: Fonts.barlowSemiBold }]}>Tempo:</Text>
              <View style={styles.stepperRow}>
                <Pressable onPress={increaseMins} hitSlop={12}>
                  <Text style={[styles.stepperSymbol, { fontFamily: Fonts.barlowBold }]}>+</Text>
                </Pressable>
                <Text style={[styles.stepperValue, { fontFamily: Fonts.mono }]}>{pomodoroMins} min</Text>
                <Pressable onPress={decreaseMins} hitSlop={12}>
                  <Text style={[styles.stepperSymbol, { fontFamily: Fonts.barlowBold }]}>—</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={{ height: Spacing.sp8 }} />
        </ScrollView>

        <Pressable
          style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canCreate}
        >
          <Text style={[styles.createButtonText, { fontFamily: Fonts.barlowSemiBold }]}>Criar tarefa</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.tinta,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: Spacing.sp12,
    paddingBottom: Spacing.sp5,
    paddingHorizontal: Spacing.sp5,
  },
  headerTitle: {
    fontSize: FontSize.headingXl,
    color: Colors.papel,
    letterSpacing: 0.5,
  },
  headerDate: {
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginTop: Spacing.sp1,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.papel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: Colors.papel,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.papel,
  },
  cardContent: {
    paddingHorizontal: Spacing.sp5,
    paddingTop: Spacing.sp6,
  },
  fieldLabel: {
    fontSize: FontSize.headingLg,
    color: Colors.tinta,
    marginBottom: Spacing.sp3,
    marginTop: Spacing.sp5,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.tinta,
    padding: Spacing.sp4,
    fontSize: FontSize.body,
    color: Colors.tinta,
    backgroundColor: Colors.papel,
  },
  inputMultiline: {
    height: 100,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sp2,
    marginBottom: Spacing.sp3,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: Colors.tinta,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.papel,
  },
  checkboxChecked: {
    backgroundColor: Colors.vermelho,
    borderColor: Colors.vermelho,
  },
  checkboxMark: {
    color: Colors.papel,
    fontSize: 14,
    lineHeight: 18,
  },
  checkLabel: {
    fontSize: FontSize.body,
    color: Colors.tinta,
    marginRight: Spacing.sp5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.tinta,
    marginBottom: Spacing.sp3,
    height: 48,
  },
  calIcon: {
    paddingHorizontal: Spacing.sp3,
  },
  dateInput: {
    flex: 1,
    paddingHorizontal: Spacing.sp2,
    fontSize: FontSize.body,
    color: Colors.tinta,
  },
  dateInputHour: {
    width: 80,
    paddingHorizontal: Spacing.sp3,
    fontSize: FontSize.body,
    textAlign: 'center',
  },
  dateInputEmpty: {
    flex: 1,
    paddingHorizontal: Spacing.sp3,
    fontSize: FontSize.body,
    color: Colors.cinza,
    textAlignVertical: 'center',
  },
  dateVertDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.tinta,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: Spacing.sp2,
  },
  priorityBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.papel3,
    paddingVertical: Spacing.sp3,
    alignItems: 'center',
    backgroundColor: Colors.papel2,
  },
  priorityBtnSelected: {
    borderColor: Colors.vermelho,
    backgroundColor: Colors.papel,
  },
  priorityBtnText: {
    fontSize: FontSize.body,
    color: Colors.cinza,
    letterSpacing: 0.3,
  },
  priorityBtnTextSelected: {
    color: Colors.vermelho,
  },
  tempoLabel: {
    fontSize: FontSize.headingMd,
    color: Colors.tinta,
    marginTop: Spacing.sp3,
    marginBottom: Spacing.sp3,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sp10,
  },
  stepperSymbol: {
    fontSize: FontSize.headingLg,
    color: Colors.vermelho,
    lineHeight: 32,
  },
  stepperValue: {
    fontSize: FontSize.headingMd,
    color: Colors.vermelho,
    minWidth: 70,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: Colors.vermelho,
    paddingVertical: Spacing.sp5,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    fontSize: FontSize.headingMd,
    color: Colors.papel,
    letterSpacing: 0.5,
  },
});
