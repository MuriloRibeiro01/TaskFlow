# TaskFlow

> Aplicativo móvel de produtividade que une gerenciamento de tarefas, técnica Pomodoro e priorização pela matriz de Eisenhower — *Foco com propósito*.

## Como executar (resumo)

**Pré-requisitos:** Docker Desktop (com Docker Compose), Node.js 22 LTS (ou 20.19+) e, para o app, **Android Studio com um emulador** ou **Xcode com um simulador** (só macOS).

```bash
# 1. Variáveis da API (na raiz)
cp .env.example .env            # preencha POSTGRES_* e JWT_SECRET (veja api/README.md)

# 2. Banco + API em http://localhost:3000
docker compose up --build

# 3. App (em outro terminal)
cd app
npm install
```

Depois escolha a plataforma:

| | Android (emulador) | iOS (simulador, só macOS) |
|---|---|---|
| `app/.env` | `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` | `EXPO_PUBLIC_API_URL=http://localhost:3000` |
| Executar | `npx expo start` e tecle `a` | `npx expo start` e tecle `i` |

Num celular físico (Android ou iPhone), use `http://<IP-da-máquina>:3000`, com o celular na mesma rede Wi-Fi. Detalhes em [app/README.md](app/README.md).

**Modelo de priorização:** já vem treinado (`api/src/main/resources/modelo-prioridade.json`) e entra na API no `docker compose up --build`, então não é preciso treinar nada para rodar o projeto. Para treinar de novo, veja [ml/README.md](ml/README.md).

Cada parte tem o próprio README com pré-requisitos, dependências, variáveis e comandos:

| Pasta | Conteúdo | README |
|---|---|---|
| `api/` | API REST (Spring Boot 4, Java 17, PostgreSQL 15, Flyway, JWT) | [api/README.md](api/README.md) |
| `app/` | App mobile (Expo, React Native, TypeScript, SQLite offline-first) | [app/README.md](app/README.md) |
| `ml/` | Treino do modelo de priorização (Python, scikit-learn) | [ml/README.md](ml/README.md) |
| `docs/` | Integrantes, vídeo, BMC, modelo de dados e demais documentos | [docs/README.md](docs/README.md) |
| `scripts/` | Atalhos de diagnóstico e demonstração (`doctor`, `demo`, `apk`) | [scripts/README.md](scripts/README.md) |

## Estrutura

```
TaskFlow/
├── docs/          documentação v3.0 (Visão, Requisitos, Arquitetura, DADOS, BMC, diagramas) e histórico
├── api/           API Spring Boot: única API, consumida pelo app
├── app/           app mobile (Android e iOS)
├── ml/            treino do modelo de prioridade (gera um JSON usado pela API)
├── scripts/       doctor, demo e apk
├── compose.yml    PostgreSQL + API
└── .env.example   variáveis da API (copie para .env)
```

## Como as partes se ligam

```
app (SQLite local) ──HTTP + JWT──> api (Spring Boot) ──JPA/Flyway──> PostgreSQL
                                     │
                                     └─ priorização: Claude (opcional) → modelo do ml/ → regras por prazo
```

- O app funciona offline: grava no SQLite e sincroniza com a API quando há conexão e sessão.
- O login é por e-mail e senha (`/auth/register` e `/auth/login`); a API devolve um JWT válido por 7 dias.
- A priorização usa a API da Anthropic se `ANTHROPIC_API_KEY` estiver definida; sem ela, usa o modelo treinado em `ml/` (embutido no JAR) e, por fim, regras por prazo e prioridade.

## Fluxo de trabalho com Git

A branch de integração é a `develop`; a `main` recebe só versões estáveis. Crie uma branch por funcionalidade a partir da `develop` e abra o Pull Request para ela.

## Entrega (.zip)

Não inclua `node_modules/` (penalidade de –3 pontos) nem `app/android/`, `app/ios/` ou `api/target/`. Da pasta acima do projeto:

```bash
zip -r TaskFlow.zip TaskFlow -x "*/node_modules/*" "*/.git/*" "*/target/*" "*/android/*" "*/ios/*" "*/.expo/*" "*/.venv/*" "*/.maestri/*" "*.DS_Store"
```

## Créditos

| Nome | Matrícula | Papel |
|---|---|---|
| Micael Martins de Moura | UC23101275 | Desenvolvimento Frontend e design de interfaces |
| Murilo Ribeiro da Silveira | UC23102602 | Desenvolvimento Backend |
| Paulo Henrique Costa Alves | UC23101336 | Desenvolvedor |
| Pedro Henrique Borges Carvalho Braga | UC23102093 | Desenvolvimento Backend |
| Pedro Rodrigues Teixeira | UC23102185 | Desenvolvedor |
| Vinícius de Oliveira | UC23101429 | Desenvolvimento Frontend e design de interfaces |
| Vinicius Ryosuke Otsuka | UC23101612 | Desenvolvedor |
