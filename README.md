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

## Rodar rápido: doctor e demo

Com os dois `.env` preenchidos (veja [Configuração do ambiente](#configuração-do-ambiente)), tudo roda da raiz do projeto:

| Comando | O que faz |
|---|---|
| `npm run doctor` | Confere ferramentas, `.env`, IP da máquina, Docker, banco, API, aparelho e APK, e diz como corrigir cada problema |
| `npm run doctor -- --fix` | Corrige sozinho o que é seguro: abre o Docker e o emulador, sobe os containers (e recria a API se travar), reconstrói a imagem desatualizada, atualiza `EXPO_PUBLIC_API_URL` quando o IP muda e desinstala o app antigo `com.taskflow.app` |
| `npm run apk` | Gera o **APK de apresentação** (release, com o JavaScript dentro, sem Metro) em `dist/` e instala no aparelho |
| `npm run demo` | Roteiro do dia: doctor `--fix`, sobe banco e API, instala o APK (ou gera de novo, se o IP ou o ID do Google mudaram) e abre o app |
| `npm run demo:dev` | Plano B: build de desenvolvimento + Metro, com o JavaScript compilado antes de abrir o app |
| `npm run test:doctor` | Testes do doctor |

### Dia da apresentação

**Na véspera**, na rede onde vai apresentar (ou com o hotspot do celular que será usado):

1. `npm run doctor -- --fix`: tudo verde, ou só avisos.
2. `npm run apk`: gera e instala o APK. O IP da API vai **dentro** do APK.
3. Abra o app, entre com Google, crie uma tarefa e confira se ela sincroniza.

**No dia:**

1. Conecte na **mesma rede** da véspera. Se o IP mudar, o `demo` gera o APK de novo (10 a 20 min).
2. `npm run demo`.
3. Se algo falhar no APK: `npm run demo:dev`.

**Checklist do login com Google:**

- A conta que vai entrar está em **usuários de teste** na tela de consentimento OAuth do Google Cloud.
- O APK é assinado com a chave de debug padrão, cujo SHA-1 (`5E:8F:16:...:F6:25`) já está no Client ID Android `br.edu.ucb.taskflow`. Não precisa de outro cadastro.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app) e `GOOGLE_CLIENT_IDS` (raiz) têm o mesmo ID, do cliente **Aplicativo da Web**. O doctor confere.

**Celular físico** em vez de emulador: depuração USB ativa, mesma rede Wi-Fi da máquina e porta 3000 liberada no Firewall do Windows (`netsh advfirewall firewall add rule name="TaskFlow API" dir=in action=allow protocol=TCP localport=3000`, como administrador).

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
