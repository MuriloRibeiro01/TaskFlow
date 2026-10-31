import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const PG_INT_MAX = 2147483647;

// O ParseIntPipe aceita qualquer inteiro; acima do INT do Postgres o Prisma responderia 500.
@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = /^\d+$/.test(value) ? Number(value) : NaN;
    if (!(id >= 1 && id <= PG_INT_MAX))
      throw new BadRequestException('id inválido');
    return id;
  }
}
