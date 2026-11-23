export type Priority = 'Alta' | 'Média' | 'Baixa';

export type Status =
  | 'in_progress'
  | 'pending'
  | 'done';

export interface TaskView {
  id: number;
  displayId: string;
  title: string;
  priority: Priority;
  status: Status;
  minutes: number;
  totalPips: number;
  donePips: number;
}