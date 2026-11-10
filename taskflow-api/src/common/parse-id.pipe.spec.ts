import { BadRequestException } from '@nestjs/common';
import { ParseIdPipe } from './parse-id.pipe';

describe('ParseIdPipe', () => {
  const pipe = new ParseIdPipe();

  it.each([
    ['1', 1],
    ['2147483647', 2147483647],
  ])('converte %p em %p', (input, expected) => {
    expect(pipe.transform(input)).toBe(expected);
  });

  // 2147483648 estoura o INT do Postgres; sem o limite o Prisma devolveria 500.
  it.each(['0', '-1', '1.5', 'abc', '', '1e3', '2147483648', '99999999999'])(
    'rejeita %p com 400',
    (input) => {
      expect(() => pipe.transform(input)).toThrow(BadRequestException);
    },
  );
});
