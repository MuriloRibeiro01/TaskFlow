import { IsEnum, IsOptional } from 'class-validator';
import { TaskStatus } from '../../generated/prisma/enums';

export class ListTasksQuery {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
