import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Fonts, Spacing } from '@/theme';
import { compareLists } from '@/database/services/prioritization.compare';
import { PrioritizationDecision, QUADRANT_META, Quadrant } from '@/types/prioritization.types';
import { Task } from '@/types/task.types';

interface Props {
  decisions: PrioritizationDecision[];
  tasks: Task[];
  source: 'ai' | 'model' | 'rules';
  onChoose: (taskId: number, quadrant: Quadrant) => void;
  onChooseAll: (side: 'user' | 'ai') => void;
  onContinue: () => void;
}

export function CompareLists({ decisions, tasks, source, onChoose, onChooseAll, onContinue }: Props) {
  const [showAgreements, setShowAgreements] = useState(false);
  const { agreements, divergences, agreementRate } = compareLists(decisions);
  const titleOf = (id: number) => tasks.find((t) => t.id === id)?.title ?? `Tarefa #${id}`;
  const chosenOf = (id: number) => decisions.find((d) => d.taskId === id)?.chosenQuadrant;

  const side = (taskId: number, quadrant: Quadrant, who: string) => {
    const selected = chosenOf(taskId) === quadrant;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Seguir ${who}: ${QUADRANT_META[quadrant].label}`}
        style={[styles.side, selected && styles.sideSelected]}
        onPress={() => onChoose(taskId, quadrant)}
      >
        <Text style={styles.sideWho}>{who.toUpperCase()}</Text>
        <Text style={styles.sideQuadrant}>{QUADRANT_META[quadrant].label}</Text>
      </Pressable>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.rate}>{agreementRate}% DE CONCORDÂNCIA</Text>
      {source === 'model' && (
        <Text style={styles.notice}>
          Esta sugestão vem do modelo treinado do TaskFlow (texto da tarefa, prazo e prioridade), não de uma IA externa.
        </Text>
      )}
      {source === 'rules' && (
        <Text style={styles.notice}>
          A IA estava indisponível; esta é uma estimativa por prazo e prioridade.
        </Text>
      )}

      <Text style={styles.section}>DIVERGÊNCIAS ({divergences.length})</Text>
      {divergences.length === 0 && <Text style={styles.empty}>Você e a IA concordaram em tudo.</Text>}
      {divergences.map((d) => (
        <View key={d.taskId} style={styles.card}>
          <Text style={styles.taskTitle}>{titleOf(d.taskId)}</Text>
          <View style={styles.sides}>
            {side(d.taskId, d.userQuadrant, 'Você')}
            {side(d.taskId, d.aiQuadrant, 'IA')}
          </View>
          {d.justification ? (
            <Text style={styles.justification}>
              {d.justification}
              {d.confidence != null ? ` (confiança ${d.confidence}%)` : ''}
            </Text>
          ) : null}
        </View>
      ))}

      {agreements.length > 0 && (
        <>
          <Pressable accessibilityRole="button" onPress={() => setShowAgreements((v) => !v)}>
            <Text style={styles.section}>
              CONCORDÂNCIAS ({agreements.length}) {showAgreements ? '▲' : '▼'}
            </Text>
          </Pressable>
          {showAgreements &&
            agreements.map((a) => (
              <Text key={a.taskId} style={styles.agreement}>
                {titleOf(a.taskId)} · {QUADRANT_META[a.chosenQuadrant].label}
              </Text>
            ))}
        </>
      )}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => onChooseAll('user')}>
          <Text style={styles.secondaryText}>SEGUIR A MINHA LISTA</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => onChooseAll('ai')}>
          <Text style={styles.secondaryText}>SEGUIR A DA IA</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.primary} onPress={onContinue}>
          <Text style={styles.primaryText}>CONTINUAR</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.sp5, gap: Spacing.sp3 },
  rate: { fontFamily: Fonts.barlowBold, fontSize: FontSize.headingMd, color: Colors.tinta },
  notice: { fontFamily: Fonts.mono, fontSize: FontSize.label, color: Colors.cinza },
  section: { fontFamily: Fonts.mono, fontSize: FontSize.label, color: Colors.cinza, marginTop: Spacing.sp3 },
  empty: { fontFamily: Fonts.barlow, fontSize: FontSize.body, color: Colors.grafite },
  card: { backgroundColor: Colors.papel2, padding: Spacing.sp3, gap: Spacing.sp2 },
  taskTitle: { fontFamily: Fonts.barlowBold, fontSize: FontSize.body, color: Colors.tinta },
  sides: { flexDirection: 'row', gap: Spacing.sp2 },
  side: { flex: 1, padding: Spacing.sp3, borderWidth: 1, borderColor: Colors.cinza },
  sideSelected: { borderColor: Colors.tinta, borderWidth: 2, backgroundColor: Colors.papel },
  sideWho: { fontFamily: Fonts.mono, fontSize: FontSize.label, color: Colors.cinza },
  sideQuadrant: { fontFamily: Fonts.barlowBold, fontSize: FontSize.body, color: Colors.tinta },
  justification: { fontFamily: Fonts.barlow, fontSize: FontSize.body, color: Colors.grafite },
  agreement: { fontFamily: Fonts.barlow, fontSize: FontSize.body, color: Colors.grafite },
  actions: { gap: Spacing.sp2, marginTop: Spacing.sp4 },
  secondary: { padding: Spacing.sp3, borderWidth: 1, borderColor: Colors.tinta, alignItems: 'center' },
  secondaryText: { fontFamily: Fonts.mono, fontSize: FontSize.label, color: Colors.tinta },
  primary: { padding: Spacing.sp3, backgroundColor: Colors.tinta, alignItems: 'center' },
  primaryText: { fontFamily: Fonts.mono, fontSize: FontSize.label, color: Colors.papel },
});
