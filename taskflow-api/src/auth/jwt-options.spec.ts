import { jwtOptionsFactory } from './jwt-options';

describe('jwtOptionsFactory', () => {
  const original = process.env.JWT_SECRET;
  afterEach(() => {
    process.env.JWT_SECRET = original;
  });

  it('lança erro quando JWT_SECRET não está definida', () => {
    delete process.env.JWT_SECRET;
    expect(() => jwtOptionsFactory()).toThrow('JWT_SECRET');
  });

  it('lança erro quando JWT_SECRET é curta demais (< 32 caracteres)', () => {
    process.env.JWT_SECRET = 'curta';
    expect(() => jwtOptionsFactory()).toThrow('JWT_SECRET');
  });

  it('usa o segredo e define expiração', () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    const options = jwtOptionsFactory();
    expect(options.secret).toBe('x'.repeat(32));
    expect(options.signOptions?.expiresIn).toBeDefined();
  });
});
