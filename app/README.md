# TaskFlow — App mobile

App de tarefas com timer Pomodoro e priorização pela matriz de Eisenhower, para Android e iOS. Funciona offline (SQLite no aparelho) e sincroniza com a [API](../api/README.md) quando há conexão.

## Instalação e execução

### Pré-requisitos

- Node.js 22 LTS (ou 20.19+) e npm
- **Android:** Android Studio com um emulador criado (o JDK 17 vem junto) — ou um celular com depuração USB ativa
- **iOS (só macOS):** Xcode com um simulador
- A [API](../api/README.md) rodando (`docker compose up` na raiz)

O app roda no Expo Go: não é preciso compilar nada nativo.

### Dependências

```bash
cd app
npm install
```

### Variáveis de ambiente

Crie `app/.env` (o Expo não lê o `.env` da raiz):

| Variável | Obrigatória | Valor |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | sim | Endereço da API, sem barra no final (tabela abaixo) |
| `EXPO_PUBLIC_DEV_LOGIN_EMAIL` | não | Se definida, o app entra sozinho com esse e-mail pelo `dev-login` (exige `ENABLE_DEV_LOGIN=true` na API) |

| Onde o app roda | `EXPO_PUBLIC_API_URL` |
|---|---|
| Emulador Android | `http://10.0.2.2:3000` |
| Simulador iOS | `http://localhost:3000` |
| Celular físico (mesma rede Wi-Fi) | `http://<IP-da-máquina>:3000` (macOS: `ipconfig getifaddr en0`) |

```bash
echo "EXPO_PUBLIC_API_URL=http://10.0.2.2:3000" > .env
```

### Executar

| | Android | iOS (só macOS) |
|---|---|---|
| Abrir o app | `npx expo start` e tecle `a` | `npx expo start` e tecle `i` |
| Celular físico | `npx expo start` e leia o QR code com o Expo Go | idem |

Depois de mudar o `.env`, reinicie com `npx expo start --clear`.

### Testes

```bash
npm test
```

O SQLite é simulado em `__mocks__/expo-sqlite.ts`, então os testes não precisam de aparelho.

## Funcionalidades

| Tela | Arquivo | O que faz |
|---|---|---|
| Login | `app/login.tsx` | Entrar ou criar conta com e-mail e senha |
| Tarefas | `app/(tabs)/index.tsx` | Tarefas de hoje e de amanhã, com filtros; arrastar para concluir ou excluir; atalho para priorizar |
| Nova tarefa | `app/nova-tarefa.tsx` | Nome, descrição, data e hora, nível de prioridade e tempo estimado em pomodoros |
| Priorizar | `app/priorizar.tsx` | Matriz de Eisenhower sugerida pela API; aplicar ou desfazer as prioridades |
| Timer | `app/(tabs)/timer.tsx` | Pomodoro com intervalo, sobre as tarefas selecionadas do dia |
| Histórico | `app/historico.tsx` | Tarefas concluídas |
| Estatísticas | `app/estatisticas.tsx` | Últimos 7 dias: melhor dia, média, total de pomodoros, tarefas concluídas e tempo de foco |
| Perfil | `app/(tabs)/perfil.tsx` | Resumo de hoje, sincronização, rotina, duração do foco e da pausa, tema e saída |

**Offline-first:** toda gravação vai primeiro para o SQLite. A sincronização com a API roda ao entrar, ao voltar para o app, ao reconectar e logo após cada alteração local; conflitos são resolvidos em `database/sync/conflict.resolver.ts`. A sessão (JWT) fica no armazenamento seguro do aparelho.

## Estrutura (MVVM)

```
app/            telas (Expo Router: cada arquivo é uma rota)
hooks/          ViewModels das telas (useTimerViewModel, useProfileViewModel…) e tema
components/     componentes de interface reutilizáveis
database/
├── schemas.ts, tasks.ts, pomodoro.ts, daily_summary.ts   SQLite local
├── api/        cliente HTTP da API, mapeamento de dados e armazenamento seguro
├── sync/       sincronização e resolução de conflitos
├── services/   sessão, rede e priorização
├── context/    contexto de autenticação
└── __tests__/  testes (Jest)
types/          tipos compartilhados
theme.ts        cores, fontes e espaçamentos do Design System
```

Modelo de dados local e sincronização: [`docs/DADOS.pdf`](../docs/DADOS.pdf). Design System: [`docs/design/`](../docs/design/).
