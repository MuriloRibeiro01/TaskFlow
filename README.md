# TaskFlow

> Aplicativo móvel de produtividade que une gerenciamento de tarefas e técnica Pomodoro — *Foco com propósito*.

---

## Visão geral

| Parte | Tecnologia | Pasta |
|---|---|---|
| App mobile | Expo SDK 54, React Native 0.81, TypeScript, Expo Router, expo-sqlite (offline-first), Clean Architecture | `taskflow-app/` |
| Backend | TaskFlow API — NestJS + Prisma + PostgreSQL 16 (Clean Architecture) | `backend/` *(a criar)* |
| Infraestrutura | Docker + Docker Compose | `compose.yml` |

Autenticação exclusivamente por OAuth (Google e Apple): o app obtém o token do provedor, a TaskFlow API o valida e emite um JWT próprio.

> ⚠️ Em transição: o app ainda usa o Supabase para autenticação. A migração para a TaskFlow API está descrita no Documento de Arquitetura v2.0.

## Documentação

| Documento | Arquivo |
|---|---|
| Documento de Visão v2.0 | `Documents/TaskFlow_DocumentoDeVisao.docx` |
| Documento de Requisitos v2.0 | `Documents/TaskFlow_DocumentoDeRequisitos.docx` |
| Documento de Arquitetura v2.0 | `Documents/TaskFlow_DocumentoDeArquitetura.docx` |
| Design System v1.0 | `Documents/TaskFlow_DesignSystem_v1.0.pdf` |
| Protótipos de alta fidelidade | `Prototipos-Alta/` |
| Versões anteriores (v1.0) | `Documents/v1.0/` |

---

## Configuração do ambiente

### Pré-requisitos

- Node.js 20 LTS
- Docker e Docker Compose
- Android Studio (emulador) ou Xcode (simulador iOS)

### Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha os valores. O arquivo `.env` nunca deve ser versionado.

### Backend (API + banco)

```bash
docker compose up
```

Sobe a TaskFlow API na porta 3000 (documentação Swagger em `/docs`) e o PostgreSQL.

### App

```bash
cd taskflow-app
npm install
npx expo start --android
# ou
npx expo start --ios
```

> ⚠️ Não use `npx expo start` sem especificar a plataforma — o `expo-sqlite` não tem suporte para web e o bundler vai quebrar.

### Testes

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
