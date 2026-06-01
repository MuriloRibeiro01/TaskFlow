import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Fonts, Spacing  } from '@/theme';
import { TaskView } from '@/types/task-view.types';


interface TaskCardProps {
  task: TaskView;
  selected?: boolean;
  onPress?: () => void;
  onCheck?: () => void;
  onDelete?: () => void;
}

export function TaskCard({
  task,
  selected = false,
  onPress,
  onCheck,
  onDelete,
}: TaskCardProps) {

  const isDone = task.status === 'done';
  const isActive = task.status === 'in_progress';

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          borderWidth: selected ? 2 : 0,
          borderColor: Colors.vermelho,
        }}
      >
        {/* Checkbox */}
        <Pressable onPress={onCheck}>
          <Text>
            {isDone ? '✓' : '☐'}
          </Text>
        </Pressable>

        {/* Lixeira */}
        <Pressable onPress={onDelete}>
          <Text>🗑️</Text>
        </Pressable>

        <Text>{task.displayId}</Text>
        <Text>{task.title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 0,
    marginBottom: Spacing.sp5,
  },
  cardLeftBorder: {
    width: 2,
  },
  cardCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: Colors.tinta,
    alignSelf: 'flex-start',
    marginTop: Spacing.sp4,
    marginLeft: Spacing.sp3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cardCheckboxDone: {
    backgroundColor: Colors.tinta,
    borderColor: Colors.tinta,
  },
  cardCheckboxMark: {
    color: Colors.papel,
    fontSize: 13,
    lineHeight: 16,
  },
  cardBody: {
    flex: 1,
    padding: Spacing.sp4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sp2,
  },
  taskId: {
    fontSize: FontSize.taskId,
    color: Colors.cinza,
    letterSpacing: 0.3,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sp2,
    paddingVertical: 2,
  },
  priorityText: {
    fontSize: FontSize.label,
    letterSpacing: 0.3,
  },
  taskTitle: {
    fontSize: FontSize.taskTitle,
    color: Colors.tinta,
    marginBottom: Spacing.sp3,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.grafite,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sp2,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sp2,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: FontSize.label,
    letterSpacing: 0.3,
  },
  pipsRow: {
    flexDirection: 'row',
    gap: Spacing.sp1,
    alignItems: 'center',
  },
  pip: {
    width: 6,
    height: 6,
  },
  pipDone: {
    backgroundColor: Colors.vermelho,
  },
  pipCurrent: {
    backgroundColor: Colors.tinta,
  },
  pipPending: {
    borderWidth: 1,
    borderColor: '#D6D3CB',
    backgroundColor: 'transparent',
  },
  pipsLabel: {
    fontSize: FontSize.label,
    color: Colors.cinza,
  },
  timeText: {
    fontSize: FontSize.label,
    color: Colors.cinza,
    marginLeft: 'auto',
  },
});