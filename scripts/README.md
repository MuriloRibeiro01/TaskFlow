# TaskFlow — Scripts de diagnóstico e demonstração

Atalhos para preparar a máquina e a apresentação. São opcionais: o caminho padrão para rodar o projeto está no [README da raiz](../README.md).

## Instalação e execução

**Pré-requisitos:** Node.js 22 LTS (ou 20.19+), Docker Desktop, Android Studio (emulador ou celular com depuração USB) e os dois `.env` preenchidos (`.env` na raiz e `app/.env`; veja [api/](../api/README.md) e [app/](../app/README.md)). Não há dependências para instalar: os scripts usam só o Node.

Rode da raiz do projeto:

| Comando | O que faz |
|---|---|
| `npm run doctor` | Confere ferramentas, `.env`, IP da máquina, Docker, banco, API, aparelho e APK, e diz como corrigir cada problema |
| `npm run doctor -- --fix` | Corrige o que é seguro: abre o Docker e o emulador, sobe os containers, reconstrói a imagem desatualizada da API e atualiza `EXPO_PUBLIC_API_URL` quando o IP muda |
| `npm run apk` | Gera o APK de apresentação (release, com o JavaScript embutido, sem Metro) em `dist/` e instala no aparelho |
| `npm run demo` | Roteiro do dia: `doctor --fix`, sobe banco e API, instala o APK (ou gera de novo se o endereço da API mudou) e abre o app |
| `npm run demo:dev` | Plano B: build de desenvolvimento + Metro |
| `npm run test:doctor` | Testes do doctor |

**Celular físico:** depuração USB ativa, mesma rede Wi-Fi da máquina e porta 3000 liberada no firewall. O endereço da API vai dentro do APK: se o IP da máquina mudar, gere o APK de novo.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `doctor.mjs` | Verificações e correções automáticas |
| `doctor/lib.mjs` | Funções puras do doctor (leitura de `.env`, checagem de variáveis), testadas em `doctor/lib.test.mjs` |
| `apk.mjs` | Build e instalação do APK de apresentação |
| `demo.mjs` | Roteiro de demonstração |
