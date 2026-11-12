# Demanda: segurança do banco e do Docker

Origem: revisão de segurança de 2026-11-12. Responsável: colega que cuida do banco e do Docker. Feito só por leitura de `compose.yml`, `taskflow-api-spring/Dockerfile`, `application.yml` e das migrations `V1` a `V3`; nada foi testado rodando.
Itens de código da API estão em `demanda-seguranca-backend.md`.
Regra do projeto: o Flyway é o único dono do schema. Mudança de banco entra só como migration `V4__...sql` em `taskflow-api-spring/src/main/resources/db/migration/`. Nunca `ddl-auto=update`. Antes de qualquer migration com dados reais, faça `pg_dump`.

## Prioridade alta

### D1. Porta da API aberta para a rede inteira
- **Onde:** `compose.yml`, serviço `api`, `ports: "3000:3000"`.
- **Problema:** a porta fica em todas as interfaces. Combinado com `ENABLE_DEV_LOGIN=true`, qualquer pessoa na rede entra como qualquer usuário (veja B1 no outro documento).
- **Fazer:**
  - Publicar em `127.0.0.1:3000:3000` por padrão.
  - Para a demo no celular pela rede local, usar um override separado (`compose.demo.yml`) que o time liga conscientemente e desliga depois.
- **Pronto quando:** `ss -tlnp` mostra a 3000 só em 127.0.0.1 no compose padrão.

### D2. Sem HTTPS
- **Problema:** o token de acesso viaja em HTTP puro.
- **Fazer:** colocar um proxy reverso com TLS (Caddy ou nginx) como único serviço exposto; a API fica só na rede interna do compose. No mesmo proxy, limite de requisições por IP para `/auth/*` (combinar com B3 do outro documento: decidir se o limite fica aqui ou na aplicação) e o cabeçalho `Strict-Transport-Security`.
- **Atualização (Fase 4 do backend):** a API já limita `POST /auth/*` a 20 por minuto por IP (variável `taskflow.auth-rate-limit.per-minute`). Atrás do proxy, o IP que a API enxerga é o do proxy; para ela ver o IP real, ligue `server.forward-headers-strategy=native` (só com o proxy confiável) e repasse `X-Forwarded-For`. Os outros cabeçalhos de segurança já saem da API; só o HSTS fica por conta do proxy.

### D3. A API usa o superusuário do Postgres
- **Onde:** `compose.yml` passa `POSTGRES_USER` para `SPRING_DATASOURCE_USERNAME`.
- **Problema:** se a API for comprometida, o atacante tem dono total do banco, inclusive DDL.
- **Fazer:** dois papéis.
  - Um papel de migração (dono do schema) usado só pelo Flyway.
  - Um papel da aplicação, só com `SELECT/INSERT/UPDATE/DELETE` nas tabelas e `USAGE` nas sequences.
  - No Spring: `spring.flyway.user/password` separados de `spring.datasource.*`. Combinar a mudança com o Murilo, porque mexe em `application.yml`.
- **Pronto quando:** a API sobe com o papel limitado e `DROP TABLE` por ela falha.

### D4. Tarefas órfãs quando o usuário é apagado
- **Onde:** `V1__init.sql`: `user_id` nulo permitido e `ON DELETE SET NULL` em `tasks` e `pomodoro_sessions`.
- **Problema:** apagar um usuário deixa título e descrição das tarefas no banco sem dono. Também permite linhas sem dono, que a API nunca lê.
- **Fazer (V4):**
  1. `pg_dump` antes.
  2. Contar linhas com `user_id IS NULL`. Se houver, decidir com o time se apaga ou atribui.
  3. `user_id SET NOT NULL` e trocar as chaves estrangeiras para `ON DELETE CASCADE` em `tasks` e `pomodoro_sessions`.
  4. Em `pomodoro_sessions.task_id`, manter `SET NULL` (a sessão sobrevive à tarefa) ou decidir diferente com o time.
- **Atenção:** a entidade JPA e `ddl-auto: validate` precisam continuar batendo; avisar o Murilo para ajustar `Task`/`PomodoroSession` se mudar a nulidade.

## Prioridade média

### D5. Restrições só na aplicação
- **Problema:** o banco só tem `CHECK` para `quadrant`. Os limites de tamanho e valor existem só nos DTOs da API.
- **Fazer (V4 ou V5):** `CHECK` para `estimated_pomodoros BETWEEN 1 AND 100`, `completed_pomodoros >= 0`, `duration_seconds >= 0`, `ended_at >= started_at`; limites de tamanho para `title` (200), `description` (2000) e `routine_text` (2000). Alinhar os números com B4 do outro documento. Testar com dados existentes antes, porque a migration falha se alguma linha violar.

### D6. `baseline-on-migrate: true`
- **Onde:** `application.yml`.
- **Problema:** apontada para um banco não vazio errado, a API marca a V1 como aplicada sem rodar nada.
- **Fazer:** quando todos os ambientes (seus e dos colegas) já tiverem a tabela `flyway_schema_history`, remover a opção.

### D7. Senhas e segredos do compose
- **Fazer:** confirmar que `POSTGRES_PASSWORD` e `JWT_SECRET` do `.env` de cada pessoa são longos e aleatórios (`openssl rand -base64 32`), e que o `.env` não é versionado (hoje não é). Para produção, usar secrets do Docker ou do provedor, em vez de variáveis de ambiente em texto.

### D8. Backup e restauração
- **Fazer:** script de `pg_dump` agendado e um teste de restauração documentado. Hoje o único dado fica no volume `taskflow-pgdata`, sem cópia.

## Prioridade baixa

### D9. Imagens
- **Fazer:** fixar as versões (`postgres:15` e `eclipse-temurin:17-*` por tag exata ou digest) e rodar scan de vulnerabilidades (Trivy ou `docker scout`) no CI. O Dockerfile já roda como usuário não-root, o que está certo.

### D10. Endurecer o container da API
- **Fazer:** `read_only: true` com `tmpfs` para `/tmp`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, e limites de memória/CPU. Testar se a API sobe assim.

### D11. Rede e healthchecks
- **Fazer:** o banco já só aceita conexão local (`127.0.0.1:5435`), mas conferir se essa porta publicada é necessária fora do desenvolvimento; em produção, não publicar. Adicionar healthcheck para a API.
