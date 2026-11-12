# Segurança do backend, Fases 1 a 5 (2026-11-12)

**Demanda:** `analises/demanda-seguranca-backend.md`. Branch `security/backend-hardening`. Testes escritos antes da implementação.

| Fase | O que mudou | O que o usuário sente |
|---|---|---|
| 1 | API não sobe com `ENABLE_DEV_LOGIN=true` e perfil `prod` (`DevLoginStartupCheck`) | Nada |
| 2 | Token de 7 dias (era 30), com `iss`/`aud`; token de usuário apagado dá 401 | Todos entram de novo uma vez; login a cada 7 dias |
| 3 | Sessão: duração máxima de 24h e `endedAt` não antes de `startedAt` | Praticamente nada |
| 4 | Limite de 20 logins/min por IP (429) e cabeçalhos CSP/Referrer-Policy | Nada no uso normal |
| 5 | Tomcat 11.0.25 e Jackson 3.1.7 (11 avisos); `npm audit fix` (35 para 15 avisos) | Nada |

## Verificação
Spring: suíte completa passa (135 testes). Jest do app: 12 suítes, 104 testes. Não testei no aparelho nem no emulador.

## Pendências
- Avisos altos de `expo-router`, que pedem upgrade maior (ver B6).
- Atrás de proxy, o limite de login precisa do IP real (`server.forward-headers-strategy=native`); está no documento do banco/Docker.
- O compose ainda não define `SPRING_PROFILES_ACTIVE=prod`, então a trava da Fase 1 só vale em produção quando ele definir.
