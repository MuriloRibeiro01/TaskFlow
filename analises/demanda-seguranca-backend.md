# Demanda: segurança do backend (taskflow-api-spring)

Origem: revisão de segurança de 2026-11-12. Responsável: Murilo. Feito só por leitura do código; nada foi testado rodando nem explorado.
Itens de banco e Docker estão em `demanda-seguranca-banco-docker.md`.
Regra do projeto: teste antes da implementação (TDD) e log em `actions/` ao concluir.

## Fases (branch `security/backend-hardening`)

| Fase | Itens | Estado |
|---|---|---|
| 1 | B1 dev-login recusado com perfil `prod` | feita |
| 2 | B2 token: prazo, `iss`/`aud`, usuário apagado | a fazer |
| 3 | B4 tetos de validação + B7 testes de isolamento | a fazer |
| 4 | B3 limite de taxa + B8 cabeçalhos | a fazer |
| 5 | B6 auditoria de dependências + B5 aviso de privacidade da IA | a fazer |

## Prioridade alta

### B1. Dev-login permite tomar qualquer conta
- **Onde:** `auth/AuthController.java`, `auth/AuthService.java`, `application.yml` (`taskflow.dev-login-enabled`).
- **Problema:** com `ENABLE_DEV_LOGIN=true`, qualquer pessoa que alcance a API entra com o e-mail que quiser, inclusive o de um usuário real do Google, porque as contas são casadas por e-mail.
- **Fazer:**
  - A API recusa subir com dev-login ligado quando um perfil de produção estiver ativo (ex.: `SPRING_PROFILES_ACTIVE=prod`).
  - Escreve um aviso no log (`WARN`) toda vez que sobe com a flag ligada.
  - Opcional: o dev-login só cria contas com domínio de demo (ex.: `@demo.com`) e nunca loga em conta já criada pelo Google.
- **Pronto quando:** teste mostra que, com perfil `prod` e flag `true`, a aplicação não inicia.

### B2. Token de 30 dias, sem revogação
- **Onde:** `auth/AuthService.java` (`TOKEN_TTL`), `config/JwtConfig.java`.
- **Problema:** token vazado vale por um mês. Depois que o usuário é apagado, o token continua aceito, e criar tarefa com esse id deve falhar por violação de chave estrangeira (não confirmado).
- **Fazer:**
  - Reduzir o prazo (ex.: 7 dias) ou criar refresh token com rotação.
  - Rejeitar com 401 token de usuário que não existe mais.
  - Adicionar `iss` e `aud` próprios nos tokens e validá-los no `JwtDecoder`.
- **Atenção:** o app hoje não renova sozinho (`api/client.ts` volta ao login no 401). Se encurtar o prazo, o app pede login mais vezes; combine com a decisão sobre refresh.
- **Pronto quando:** testes para token expirado, de usuário apagado e com `iss`/`aud` errados, todos dando 401.

## Prioridade média

### B3. Sem limite de taxa nas rotas de login
- **Onde:** `/auth/google` e `/auth/dev-login`.
- **Problema:** dá para chamar sem limite. O dev-login cria usuários sem limite.
- **Fazer:** limite por IP na aplicação (ex.: Bucket4j) ou combinar com o amigo do Docker para fazer no proxy (item D2 do outro documento). Decidir um só lugar para não duplicar.

### B4. Tetos de validação que faltam
- **Onde:** `session/CreateSessionRequest.java`, `session/UpdateSessionRequest.java`, `task/UpdateTaskRequest.java`.
- **Problema:** `durationSeconds` só tem `@Min(0)`, sem máximo. Datas não têm limite. `completedPomodoros` precisa ser conferido.
- **Fazer:** adicionar `@Max` e validar que `endedAt` não vem antes de `startedAt`. Combinar os mesmos limites com o banco (item D5 do outro documento).

### B5. Privacidade da priorização com IA
- **Onde:** `prioritization/AnthropicAiClient.java`, tela de priorizar no app.
- **Problema:** título, descrição e rotina do usuário vão para a Anthropic, e o usuário não é avisado.
- **Fazer:**
  - Aviso claro no app antes do primeiro uso e uma opção para desligar.
  - Ver a política de retenção da API usada.
  - O `DailyLimit` em memória zera ao reiniciar; se houver mais de uma instância da API, mover a contagem para o banco.

### B6. Dependências sem auditoria
- **Onde:** `pom.xml`, `taskflow-app/package.json`.
- **Fazer:** rodar OWASP `dependency-check` (Maven) e `npm audit`, e ligar o Dependabot no GitHub. Anotar o que for encontrado e corrigir o crítico/alto.

## Prioridade baixa

### B7. Conferir os testes de isolamento entre usuários
- **Fazer:** garantir que existe teste de integração em que o usuário A recebe 404 ao ler, alterar e apagar tarefa, sessão e priorização do usuário B. Não conferi se já existe cobertura completa.

### B8. Cabeçalhos de segurança
- **Fazer:** conferir os cabeçalhos que o Spring Security já manda (`X-Content-Type-Options`, `Cache-Control`). Se a API ficar atrás de um proxy com TLS, adicionar `Strict-Transport-Security` lá.

## Fora do escopo desta demanda
Remover a pasta `taskflow-api/` (NestJS): depende da aprovação do grupo, conforme `PROXIMOS-PASSOS.md`.
