# TaskFlow

> Aplicativo móvel de produtividade que une gerenciamento de tarefas e técnica Pomodoro — *Foco com propósito*.

---

## Visão geral

| Parte | Tecnologia | Pasta |
|---|---|---|
| App mobile | Expo SDK 54, React Native 0.81, TypeScript, Expo Router, expo-sqlite (offline-first) | `taskflow-app/` |
| Backend | Spring Boot 3, PostgreSQL 15, Flyway, JWT | `taskflow-api-spring/` |
| Priorização ML | Python, scikit-learn (TF-IDF + regressão logística) | `taskflow-ml/` |
| Infraestrutura | Docker + Docker Compose | `compose.yml` |

Autenticação via OAuth Google: o app obtém o ID token do Google, a API valida e emite um JWT próprio.

## Documentação

| Documento | Arquivo |
|---|---|
| Documento de Visão v2.1 | `Documents/TaskFlow_DocumentoDeVisao.docx` |
| Documento de Requisitos v2.1 | `Documents/TaskFlow_DocumentoDeRequisitos.docx` |
| Documento de Arquitetura v2.1 | `Documents/TaskFlow_DocumentoDeArquitetura.docx` |
| Design System v1.0 | `Documents/TaskFlow_DesignSystem_v1.0.pdf` |
| Protótipos de alta fidelidade | `Prototipos-Alta/` |
| Versões anteriores (v1.0) | `Documents/v1.0/` |

---

## Configuração do ambiente

### Pré-requisitos

- Node.js 20 LTS
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (inclui Docker Compose)
- Xcode (iOS) ou Android Studio (Android)
- Python 3.11+ (apenas para treinar o modelo de priorização)

---

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

Gere o `JWT_SECRET` e preencha no `.env`:

```bash
openssl rand -hex 32
```

Para testes locais sem Google, habilite o login de desenvolvimento:

```
ENABLE_DEV_LOGIN=true
```

Para ativar a priorização com IA da Anthropic (opcional — sem a chave a API usa o modelo treinado localmente ou regras por prazo e prioridade):

```
ANTHROPIC_API_KEY=sk-ant-...
```

O arquivo `.env` nunca deve ser versionado.

---

### 2. Backend (API + banco)

**Primeira vez** (compila o JAR e sobe tudo):

```bash
docker compose up --build
```

**Nas próximas vezes** (já compilado):

```bash
docker compose up
```

A API sobe em `http://localhost:3000`. O Flyway aplica as migrations automaticamente.

> Se o Docker não for encontrado após instalar o Docker Desktop, reabra o terminal. Se persistir: `echo 'export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc`

---

### 3. Modelo de priorização (ML)

O modelo TF-IDF + regressão logística é treinado a partir de `taskflow-ml/tarefas_treino.xlsx` e exportado como JSON para o classpath do Spring Boot.

```bash
cd taskflow-ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python treinar.py
```

O relatório de acurácia é salvo em `taskflow-ml/relatorio.txt`.

Após treinar, reconstrua o backend para incluir o novo modelo no JAR:

```bash
docker compose build --no-cache && docker compose up
```

---

### 4. App mobile

**Instalar dependências:**

```bash
cd taskflow-app
npm install
```

**Variáveis de ambiente do app** (`taskflow-app/.env`):

| Variável | Valor |
|---|---|
| `EXPO_PUBLIC_API_URL` | `http://<IP-DA-MÁQUINA>:3000` (dispositivo físico) ou `http://localhost:3000` (simulador iOS) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Client ID Web do Google Cloud Console |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Client ID iOS do Google Cloud Console (bundle ID: `br.edu.ucb.taskflow`) |

> No emulador Android use `http://10.0.2.2:3000`. Para descobrir o IP da máquina: `ipconfig getifaddr en0`

**Primeira build nativa** (necessária para módulos nativos como Google Sign-In):

```bash
# Simulador iOS
npx expo run:ios

# Dispositivo físico iOS (conectado via USB com Modo Desenvolvedor ativo)
npx expo run:ios --device

# Emulador Android
npx expo run:android
```

**Nas próximas vezes** (apenas mudanças em JS/TS):

```bash
npx expo start
```

> Só rode `npx expo prebuild --clean` quando `app.json` ou dependências nativas mudarem — isso descarta o cache do Xcode e a build demora muito mais.

---

### 5. Testes

```bash
cd taskflow-app
npx jest
```

---

## Fluxo de trabalho com Git

A branch de integração é a `develop`. A `main` recebe apenas versões estáveis.

```bash
# Sincronize antes de começar
git checkout develop
git pull origin develop

# Crie uma branch por funcionalidade a partir da develop
git checkout -b feature/nome-da-funcionalidade
```

Ao concluir, abra um Pull Request da sua branch para a `develop`.

---

## Créditos

| Nome | Papel |
|---|---|
| Micael Martins | Desenvolvimento Frontend e design de interfaces |
| Murilo Ribeiro da Silveira | Desenvolvimento Backend |
| Paulo Henrique | Desenvolvedor |
| Pedro Henrique Borges Carvalho Braga | Desenvolvimento Backend |
| Pedro Rodrigues Teixeira | Desenvolvedor |
| Vinícius de Oliveira | Desenvolvimento Frontend e design de interfaces |
| Vinicius Ryosuke Otsuka | Desenvolvedor |
