# 14/10/2026 — Correções de segurança no Docker (banco exposto e `.dockerignore`)

- **Branch:** `develop` (alterações não commitadas)
- **Base:** riscos 1 e 2 de [2026-10-14-api-passo1-conexao-banco.md](2026-10-14-api-passo1-conexao-banco.md)
- **Metodologia:** são mudanças de configuração, sem lógica para teste unitário. No lugar do "teste vermelho", o problema foi **medido antes** da correção, e a mesma medição foi repetida **depois**.

## Resumo

O Postgres deixou de aceitar conexões vindas da rede: agora só a própria máquina chega nele. A imagem da API deixou de levar o `node_modules` e possíveis arquivos `.env` da sua máquina. Os dados do banco não foram afetados.

## O que foi feito

| Item | O que foi feito | Arquivo |
|---|---|---|
| Banco só em localhost | `ports: "5435:5432"` → `"127.0.0.1:5435:5432"`, com comentário explicando. A API não muda nada, porque já acessa o banco pela rede interna do Docker (`db:5432`). | `compose.yml` |
| `.dockerignore` | Exclui `node_modules`, `dist`, `src/generated`, `coverage`, `*.tsbuildinfo`, `.env` / `.env.*`, `.git`, `.claude` e `.windsurf`. A imagem continua gerando tudo isso sozinha (`npm ci`, `prisma generate`, `nest build`). | `taskflow-api/.dockerignore` (novo) |

## Antes × depois

| Verificação | Antes | Depois |
|---|---|---|
| `ss -ltn` porta 5435 | `0.0.0.0:5435` e `[::]:5435` (todas as interfaces) | só `127.0.0.1:5435` |
| Conexão em `10.2.41.177:5435` (IP da máquina na rede) | aceitava | **conexão recusada** |
| Origem do `node_modules` na imagem | cópia do host: `.package-lock.json` com o mesmo horário do local (18:44 UTC) | gerado pelo `npm ci` da imagem |
| Arquivos extras na imagem | `.windsurf`, `tsconfig.build.tsbuildinfo` do host | ausentes. O `tsbuildinfo` que aparece agora é o criado pelo `nest build` dentro do container. |
| `.env` na imagem | nenhum (por sorte; nada impedia) | bloqueado pelo `.dockerignore` |

## Validação

| Comando | Resultado |
|---|---|
| `docker compose up --build -d` | os dois containers recriados; `Nest application successfully started` |
| `curl localhost:3000` | `Hello World!` |
| `select count(*) from _prisma_migrations` antes e depois | `1` e `1`: o volume foi preservado |
| `npm test` | 8/8 passando |
| `npm run test:e2e` (via `localhost:5435`) | 2/2 passando: o acesso local ao banco continua funcionando |

## Riscos e possíveis soluções

| # | Risco | Impacto | Solução |
|---|---|---|---|
| 1 | **A porta 3000 (API) continua aberta na rede**, de propósito: o app rodando no celular precisa alcançar a API pelo IP do PC. | Hoje baixo: só existe o `GET /`. A partir do passo 2, qualquer pessoa na rede pode chamar os endpoints. O que protege é a auth, e o `dev-login` é o ponto fraco. | Manter `ENABLE_DEV_LOGIN` desligado quando não estiver testando. Se não for testar no celular, dá para usar `"127.0.0.1:3000:3000"`. |
| 2 | **Ferramentas de fora do Docker** (DBeaver em outra máquina, um colega acessando o seu banco) não conectam mais. | Só afeta quem acessava pela rede, o que era justamente o risco. | Acessar pela própria máquina (`localhost:5435`) ou por túnel SSH (`ssh -L 5435:localhost:5435 usuario@maquina`). |
| 3 | **A porta mudou de 5432 para 5435 e o bind agora é localhost.** Colegas do grupo recebem essa mudança no `compose.yml` quando você commitar. | Algum colega que tinha `DATABASE_URL` com `localhost:5432` para rodar a API fora do Docker vai precisar ajustar. | Avisar o grupo e documentar a porta no README e no `.env.example`. |
| 4 | **Imagens antigas ainda contêm o `node_modules` do host.** | Só ocupam espaço; nenhuma está em uso. | `docker image prune` para remover as camadas sem tag. |
| 5 | **Segredos fora da imagem não significa segredos seguros.** As variáveis continuam visíveis com `docker inspect taskflow-nestjs`. | Normal em ambiente local. | Em produção, usar o gerenciador de segredos da plataforma de deploy. |
