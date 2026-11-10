import 'dotenv/config';

// Segredo só para os testes; a API real falha ao subir sem JWT_SECRET.
process.env.JWT_SECRET ||= 'e2e-'.repeat(10);
