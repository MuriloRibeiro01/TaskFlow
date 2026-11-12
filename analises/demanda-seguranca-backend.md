# Demanda: segurança do backend (taskflow-api-spring)

Origem: revisão de segurança de 2026-11-12. Responsável: Murilo. Feito só por leitura do código; nada foi testado rodando nem explorado.
Itens de banco e Docker estão em `demanda-seguranca-banco-docker.md`.
Regra do projeto: teste antes da implementação (TDD) e log em `actions/` ao concluir.

## Fases (branch `security/backend-hardening`)

| Fase | Itens | Estado |
|---|---|---|
| 1 | B1 dev-login recusado com perfil `prod` | feita |
| 2 | B2 token: prazo, `iss`/`aud`, usuário apagado | feita |
| 3 | B4 tetos de validação + B7 testes de isolamento (já existiam) | feita |
| 4 | B3 limite de taxa + B8 cabeçalhos | feita |
| 5 | B6 auditoria de dependências + B5 aviso de privacidade da IA | feita |

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
- **Correção:** a primeira versão desta demanda dizia que o usuário não era avisado. Estava errado: `taskflow-app/app/priorizar.tsx` já mostra a tela "ANTES DE COMEÇAR" em toda priorização, lista os campos enviados (título, descrição, prazo, estimativa e rotina), diz que vão a um serviço de IA externo e tem o botão CANCELAR. Nada a mudar no app.
- **Resta (não resolvido por código):** conferir a política de retenção do provedor da IA e, se o grupo quiser, citar o nome do provedor na tela. O `DailyLimit` em memória continua com o atalho registrado (zera ao reiniciar; mover para o banco se houver mais de uma instância).

### B6. Dependências sem auditoria
- **Feito em 2026-11-12:**
  - **Maven:** consulta ao OSV de 95 dependências de runtime. Havia 11 avisos em `tomcat-embed-core` 11.0.24 (4 críticos, em DIGEST/FORM auth, HTTP/2 SNI e controle de acesso) e `jackson-databind`/`jackson-core` 3.1.5 (DoS). Corrigido com `tomcat.version=11.0.25` e `jackson-bom.version=3.1.7` no `pom.xml`. Remover quando o Spring Boot atualizar.
  - **npm (`taskflow-app`):** `npm audit fix` baixou de 35 para 15 avisos (o crítico `shell-quote` saiu). Só o `package-lock.json` mudou; 12 suítes e 104 testes passam.
- **Resta:** 4 avisos altos no app (`expo-router`, `decode-uri-component`, `query-string`) só se resolvem subindo `expo-router` para a versão 58, que é mudança maior e precisa de teste no aparelho. Os outros 11 são baixos ou moderados. Ligar o Dependabot no GitHub (é configuração do repositório).

## Prioridade baixa

### B7. Conferir os testes de isolamento entre usuários
- **Fazer:** garantir que existe teste de integração em que o usuário A recebe 404 ao ler, alterar e apagar tarefa, sessão e priorização do usuário B. Não conferi se já existe cobertura completa.

### B8. Cabeçalhos de segurança
- **Fazer:** conferir os cabeçalhos que o Spring Security já manda (`X-Content-Type-Options`, `Cache-Control`). Se a API ficar atrás de um proxy com TLS, adicionar `Strict-Transport-Security` lá.

## Fora do escopo desta demanda
Remover a pasta `taskflow-api/` (NestJS): depende da aprovação do grupo, conforme `PROXIMOS-PASSOS.md`.
