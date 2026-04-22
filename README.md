# TaskFlow — Branch Frontend

> Documentação técnica da camada de interface gráfica do TaskFlow.

---

## Sobre esta branch

Esta branch especifica o desenvolvimento de interfaces para o projeto TaskFlow.

---

## Configuração do ambiente

### Pré-requisitos


# Confirme a versão ativa
node -v  # deve exibir v25.7.0
```

### Instalação

```bash
# Entre na pasta do app
cd taskflow-app

# Instale as dependências
npm install
```

### Rodando o projeto

```bash
# Inicie o servidor Expo apontando para uma plataforma móvel
npx expo start --android
# ou
npx expo start --ios
```

> ⚠️ Não use `npx expo start` sem especificar a plataforma — o `expo-sqlite` não tem suporte para web e o bundler vai quebrar.

### Rodando os testes

```bash
npx jest
```

---

## Fluxo de trabalho com Git

### Sincronizando com a branch principal

Antes de começar qualquer trabalho, sincronize sua branch com a `Frontend` para garantir que está trabalhando com o código mais atualizado:

```bash
git pull origin Frontend
```

### Criando uma branch para nova funcionalidade

Cada nova funcionalidade deve ter sua própria branch, criada a partir da `Frontend`. Isso mantém o histórico organizado e facilita revisões de código:

```bash
# Crie e mude para a nova branch
git checkout -b feature/nome-da-funcionalidade

# Exemplos:
git checkout -b feature/crud-pomodoro
git checkout -b feature/daily-summary
git checkout -b feature/sync-supabase
```

Ao concluir, abra um Pull Request da sua branch para a `Frontend`.

## WIP ...


## Créditos

| Nome | Papel |
|---|---|
| Murilo Ribeiro da Silveira | Desenvolvimento Backend |
| Pedro Henrique Borges Carvalho Braga | Desenvolvimento Backend |
| Micael Martins | Desenvolvimento Frontent e desing de interfaces|
| Vinícius de Oliveira | Desenvolvimento Frontent e desing de interfaces|