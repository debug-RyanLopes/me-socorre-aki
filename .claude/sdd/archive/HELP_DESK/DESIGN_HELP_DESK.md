# DESIGN: Me Socorre Aki (Sistema Help Desk)

> Technical design for implementing Me Socorre Aki: monólito modular NestJS + SPA React + PostgreSQL, com autorização no backend, histórico auditável e execução com um comando.

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | HELP_DESK |
| **Date** | 2026-11-24 |
| **Author** | design-agent |
| **DEFINE** | [DEFINE_HELP_DESK.md](./DEFINE_HELP_DESK.md) |
| **Status** | ✅ Shipped |

**Confiança do design: 0.70.** Nenhuma KB do plugin cobre aplicações web transacionais (as KBs são de engenharia de dados) e o projeto é greenfield; não há agente especialista em TypeScript, Node ou React na biblioteca. Nenhuma ferramenta MCP de documentação estava disponível nesta sessão, então as escolhas de biblioteca **não foram validadas contra a documentação oficial**. A fase Build deve confirmar APIs e versões (NestJS, Prisma, React, Vite) nas docs oficiais antes de fixar o lockfile.

**Referências de produto:** telas em https://claude.ai/artifact/SnqZYNLTPUThcKUFgAC2Yj (12 artboards, nome "Me Socorre Aki").

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         ME SOCORRE AKI (docker compose)                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Navegador                                                               │
│  ┌──────────────┐   mesma origem    ┌────────────────────────────────┐   │
│  │ SPA React    │  /  → estáticos   │ nginx (frontend container)     │   │
│  │ (Vite build) │ ───────────────►  │  /api/* → proxy para backend   │   │
│  └──────────────┘  cookie httpOnly  └───────────────┬────────────────┘   │
│                                                     │                    │
│                                       ┌─────────────▼──────────────┐     │
│                                       │ NestJS (backend container) │     │
│                                       │ SessionAuthGuard → Roles   │     │
│                                       │ Guard → Controllers        │     │
│                                       │   │                        │     │
│                                       │   ▼  (AccessModule: policy)│     │
│                                       │ Auth  Users  Catalog       │     │
│                                       │ Tickets  Comments          │     │
│                                       │ Attachments Equipment      │     │
│                                       │ Notifications Reports      │     │
│                                       │ PriorityRules  Health      │     │
│                                       └───────┬──────────────┬─────┘     │
│                                               │ Prisma       │ fs        │
│                                       ┌───────▼──────┐  ┌────▼───────┐   │
│                                       │ PostgreSQL   │  │ volume     │   │
│                                       │ (dados,      │  │ /data/     │   │
│                                       │  sessões,    │  │ uploads    │   │
│                                       │  histórico)  │  │ (anexos)   │   │
│                                       └──────────────┘  └────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘

Dependências entre módulos (sem ciclos):
  common/prisma/access ← catalog, equipment, priority-rules, notifications, attachments
  attachments, equipment, priority-rules, notifications ← tickets, comments
  tickets e comments dependem de access; nenhum módulo de domínio depende de tickets
```

---

## Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| SPA (`frontend/`) | Telas dos três perfis, filtros, formulários, polling de notificações | React + Vite + TypeScript, React Router, TanStack Query, react-hook-form + zod |
| Proxy estático | Serve a SPA e encaminha `/api` ao backend na mesma origem | nginx (container do frontend); em dev, proxy do Vite |
| API (`backend/`) | Regras de negócio, autorização, validação, arquivos | NestJS + TypeScript, class-validator, @nestjs/swagger |
| AuthModule | Login, logout, sessão, troca de senha, bloqueio de contas inativas | Sessão opaca em tabela, cookie httpOnly, argon2id |
| UsersModule | CRUD de usuários, perfil, desativação/reativação, redefinição de senha pelo admin | Prisma |
| CatalogModule | Setores e categorias | Prisma |
| AccessModule | `TicketAccessPolicy`: única fonte de verdade de quem enxerga o quê | Serviço Nest compartilhado |
| TicketsModule | Abertura, fila, atribuição, triagem, prioridade, resolução, fechamento, reabertura, cancelamento, histórico | Máquina de estados + transações Prisma |
| CommentsModule | Comentários públicos e observações internas | Prisma |
| AttachmentsModule | Upload validado, armazenamento em disco, download autorizado | multer (memória) + validação por assinatura |
| EquipmentModule | Cadastro por serial, validação de seriais pendentes, vínculo retroativo de chamados | Prisma |
| PriorityRulesModule | Pontuação e limiares da prioridade sugerida (editáveis pelo admin) | Prisma |
| NotificationsModule | Notificações persistidas, contador de não lidas, marcar como lida | Prisma; consulta por polling |
| ReportsModule | Contadores e tabelas por período | Prisma `groupBy` + SQL agregado |
| PostgreSQL | Dados relacionais, sessões, histórico, notificações | PostgreSQL 16 |

### API REST (prefixo `/api`, JSON, documentada em `/api/docs`)

| Método e rota | Perfis | Descrição |
|---------------|--------|-----------|
| `POST /auth/login`, `POST /auth/logout` | público / autenticado | Abre e encerra a sessão |
| `GET /auth/me`, `POST /auth/change-password` | autenticado | Dados do usuário; troca de senha (única rota liberada com troca obrigatória) |
| `GET/POST /users`, `GET/PATCH /users/:id` | ADMIN | Lista (busca, perfil, setor, conta), cadastro, edição |
| `POST /users/:id/deactivate`, `/reactivate`, `/reset-password` | ADMIN | Desativa (encerra sessões), reativa, define senha temporária |
| `GET/POST/PATCH /sectors`, `/categories` | leitura: todos; escrita: ADMIN | Catálogos |
| `POST /tickets` | EMPLOYEE | Abre chamado (multipart: dados + anexos) |
| `GET /tickets` | todos | Funcionário: só os seus; TI/admin: fila com filtros e paginação |
| `GET /tickets/:id` | todos (com política) | Detalhe; funcionário não recebe campos nem eventos internos |
| `POST /tickets/:id/assume`, `/assign` | TECHNICIAN / ADMIN | Assumir; atribuir a um técnico |
| `POST /tickets/:id/triage`, `/priority` | TECHNICIAN / ADMIN | Confirmar prioridade; alterar (com justificativa) |
| `POST /tickets/:id/request-info`, `/resolve` | TECHNICIAN / ADMIN | Pedir informação; registrar solução |
| `POST /tickets/:id/confirm`, `/reject-resolution`, `/reopen` | EMPLOYEE (solicitante) | Confirmar; recusar a solução; reabrir (3 dias) |
| `POST /tickets/:id/cancel` | solicitante, TECHNICIAN, ADMIN | Cancelar com justificativa |
| `GET/POST /tickets/:id/comments` | todos (com política) | Lista e cria; `INTERNAL` só para TI/admin |
| `GET /attachments/:id` | todos (com política) | Download autorizado |
| `GET /equipment`, `POST/PATCH /equipment`, `GET /equipment/pending` | TECHNICIAN / ADMIN | Cadastro, listagem, seriais pendentes |
| `GET/PUT /priority-rules` | ADMIN | Pontos por resposta e limiares |
| `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all` | autenticado | Caixa de notificações do próprio usuário |
| `GET /reports/summary?period=today\|7d\|30d` | ADMIN | Contadores e tabelas |
| `GET /health` | público | Verificação de saúde |

### Modelo de dados (resumo)

| Tabela | Campos principais | Índices e restrições |
|--------|-------------------|----------------------|
| `sectors`, `categories` | `id`, `name`, `active` | `name` único |
| `users` | `id`, `name`, `email`, `login`, `password_hash`, `role`, `sector_id`, `is_active`, `must_change_password`, `deactivated_at/by` | `email` e `login` únicos (normalizados em minúsculas) |
| `sessions` | `id`, `token_hash`, `user_id`, `expires_at` | `token_hash` único; remoção na desativação e na redefinição de senha |
| `equipment` | `id`, `serial`, `type`, `manufacturer`, `model`, `sector_id`, `responsible_id?`, `acquired_at?`, `asset_tag?`, `notes?` | `serial` único (normalizado em maiúsculas, sem espaços nas pontas) |
| `tickets` | `id` (exibido como `CH-000123`), `requester_id`, `requester_name/email`, `sector_id`, `title?`, `description`, `category_id?`, `serial_informed`, `equipment_id?`, `assignee_id?`, `assigned_at?`, `impact_*` (3), `suggested_priority`, `priority`, `status`, `solution?`, `resolved_at?`, `closed_at?`, `cancelled_at?`, `created_at` | índices em `status`, `priority`, `assignee_id`, `requester_id`, `sector_id`, `equipment_id`, `created_at` |
| `ticket_events` | `id`, `ticket_id`, `type`, `actor_id`, `payload` (JSON), `requester_visible`, `created_at` | índice `(ticket_id, created_at)`; **somente inserção** |
| `ticket_comments` | `id`, `ticket_id`, `author_id`, `body`, `visibility` | índice `(ticket_id, created_at)` |
| `attachments` | `id`, `ticket_id`, `comment_id?`, `uploader_id`, `original_name`, `storage_key`, `mime`, `size`, `visibility` | `storage_key` único (UUID) |
| `notifications` | `id`, `user_id`, `ticket_id`, `type`, `message`, `read_at?`, `created_at` | índice `(user_id, read_at)` |
| `priority_weights`, `priority_thresholds` | pontos por pergunta/resposta; pontuação mínima por prioridade | `(question, option)` único |

---

## Key Decisions

### Decision 1: Monólito modular NestJS com SPA React separada

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** O BRAINSTORM exige demonstrar backend, modelagem relacional, autorização e regras de negócio para uma única empresa, sem multi-tenant.

**Choice:** Uma API NestJS organizada em módulos por domínio e uma SPA React + Vite em projeto separado, orquestrados por Docker Compose.

**Rationale:** Guards, decorators e módulos do Nest tornam o RBAC e a separação de domínios explícitos e testáveis. Um só processo e um só banco mantêm a operação simples.

**Alternatives Rejected:**
1. Express com camadas manuais - rejeitado: estrutura e RBAC dependeriam só de disciplina.
2. Next.js full-stack - rejeitado: contradiz a SPA escolhida e dilui a vitrine de backend.
3. Microsserviços - rejeitado: complexidade sem benefício para uma empresa e dezenas de usuários.

**Consequences:**
- Dois projetos para manter (`backend/`, `frontend/`), sem pacote compartilhado de código.
- Contrato entre eles documentado pelo OpenAPI do Swagger.

---

### Decision 2: Prisma como ORM

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** O DEFINE deixou "Prisma ou TypeORM" para o Design (questão aberta 5).

**Choice:** Prisma, com migrações versionadas em `prisma/migrations`.

**Rationale:** Esquema declarativo legível (útil no portfólio), tipos gerados para TypeScript, migrações simples e transações com `$transaction`.

**Alternatives Rejected:**
1. TypeORM - rejeitado: decorators nas entidades e migrações menos previsíveis.
2. SQL puro com `pg` - rejeitado: mais código e menos segurança de tipos.

**Consequences:**
- Consultas de relatório mais complexas podem usar `$queryRaw` parametrizado.
- Escolha reversível no início, cara depois do build.

---

### Decision 3: Sessão no servidor com cookie httpOnly (em vez de JWT)

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** Contas desativadas devem perder o acesso imediatamente e a redefinição de senha deve invalidar acessos anteriores. O DEFINE deixou "sessão ou JWT em cookie" para o Design (A-012).

**Choice:** Token opaco aleatório (32 bytes) em cookie `sid` (`httpOnly`, `SameSite=Lax`, `Secure` em produção); o banco guarda apenas o hash SHA-256 do token em `sessions`. A cada requisição o guard confere sessão e `is_active`. Mutações exigem o cabeçalho `X-Requested-With`, e a SPA fica na mesma origem via proxy.

**Rationale:** Revogação imediata (apagar sessões), nenhum segredo de longa duração no navegador e proteção contra XSS e CSRF sem biblioteca extra.

**Alternatives Rejected:**
1. JWT de acesso curto + refresh - rejeitado: revogação imediata exige lista de bloqueio, ou seja, estado no servidor de qualquer forma.
2. JWT em `localStorage` - rejeitado: exposto a XSS.

**Consequences:**
- Uma consulta ao banco por requisição autenticada (aceitável no volume previsto).
- A origem única (nginx em produção local, proxy do Vite em dev) dispensa CORS.

---

### Decision 4: Máquina de estados explícita com concorrência otimista

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** O ciclo do chamado tem muitas regras (quem pode, de qual status, com motivo) e deve ser auditável (pendências A-003, A-004, A-005).

**Choice:** Uma tabela única de transições em `ticket-state-machine.ts` (ação → status de origem, destino, perfis, se exige motivo). Cada ação roda em transação: `updateMany` com `where { id, status: statusLido }` (se nada mudou, responde 409) e grava o evento de histórico na mesma transação.

**Rationale:** Regras em um lugar só, testáveis sem banco, e proteção contra duas pessoas agindo ao mesmo tempo no mesmo chamado.

**Alternatives Rejected:**
1. `if/else` espalhado nos serviços - rejeitado: regras duplicadas e difíceis de testar.
2. Biblioteca de máquina de estados (XState) - rejeitado: dependência excessiva para 9 ações.

**Consequences:**
- Qualquer novo status passa por um único arquivo e seus testes.

**Transições definidas:**

| Ação | De | Para | Perfis | Motivo |
|------|----|------|--------|--------|
| `TRIAGE` (confirmar prioridade) | Aberto | Aguardando iniciar | TI, Admin | Não |
| `ASSIGN` (assumir/atribuir) | Aberto, Aguardando iniciar, Aguardando usuário | (mesmo) | TI, Admin | Não |
| `REQUEST_INFO` | Aberto, Aguardando iniciar | Aguardando usuário | TI, Admin | Não |
| `USER_REPLY` (automática ao comentar) | Aguardando usuário | Aguardando iniciar | Solicitante | Não |
| `RESOLVE` | Aberto, Aguardando iniciar, Aguardando usuário | Resolvido | TI, Admin | Solução obrigatória |
| `CONFIRM` | Resolvido | Fechado | Solicitante | Não |
| `REJECT_RESOLUTION` | Resolvido | Aberto | Solicitante | Sim |
| `REOPEN` (até 72 h do fechamento) | Fechado | Aberto | Solicitante | Sim |
| `CANCEL` | Aberto, Aguardando iniciar, Aguardando usuário | Cancelado | Solicitante, TI, Admin | Sim |

---

### Decision 5: Histórico automático separado dos comentários e somente de inserção

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** O histórico deve ser confiável, com autor e data/hora, e o funcionário não pode ver dados internos.

**Choice:** Tabela `ticket_events` (somente inserção) com `type`, `actor_id`, `payload` JSON e `requester_visible`. Comentários ficam em `ticket_comments` com `visibility` `PUBLIC` ou `INTERNAL`. O mapper de resposta remove eventos e campos internos para o funcionário (por exemplo, prioridade sugerida e justificativas de prioridade).

**Rationale:** Rastreabilidade imutável, e a filtragem acontece em um ponto único e testado.

**Alternatives Rejected:**
1. Misturar eventos e comentários numa tabela - rejeitado: confunde visibilidade e auditoria.
2. Auditoria por triggers no banco - rejeitado: menos legível e mais difícil de testar.

**Consequences:**
- Toda ação de chamado precisa gravar evento (garantido pelo método único `perform` e coberto por teste).

---

### Decision 6: Prioridade sugerida por pontuação configurável

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** A prioridade vem de 3 perguntas de impacto e as regras precisam ser editáveis na interface (mantidas no escopo), sem IA.

**Choice:** Cada resposta vale pontos (`priority_weights`) e a soma é comparada a limiares (`priority_thresholds`). Valores iniciais (seed):

| Pergunta | Respostas e pontos |
|----------|--------------------|
| Pessoas afetadas | Só eu 0 · Algumas 1 · Setor inteiro 2 · Vários setores/empresa 3 |
| Impede o trabalho | Não 0 · Com limitações 1 · Impossibilitado 2 |
| Alternativa temporária | Sim 0 · Não sei 1 · Não 1 |

| Prioridade | Pontuação mínima |
|------------|------------------|
| Baixa | 0 |
| Média | 1 |
| Alta | 3 |
| Crítica | 5 |

**Rationale:** Determinística, simples de testar e de editar (tela do admin altera pontos e limiares). Exemplos: só eu + impossibilitado + sem alternativa = 3 (Alta); setor inteiro + impossibilitado + sem alternativa = 5 (Crítica); só eu + sem impacto + alternativa = 0 (Baixa).

**Alternatives Rejected:**
1. Matriz completa de 36 combinações editável - rejeitado: tela e dados excessivos para o MVP.
2. Regras fixas no código - rejeitado: você manteve a tela de regras no escopo.

**Consequences:**
- A matriz inicial é uma proposta e deve ser validada com você (ver Decision 12).
- `suggested_priority` é gravada no chamado e nunca recalculada, preservando o histórico.

---

### Decision 7: Anexos em disco, validados por assinatura, com visibilidade herdada

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** O arquivo não pode ser confiado pelo nome ou extensão e anexos de observação interna não podem vazar.

**Choice:** Upload com multer em memória (limite de 5 MB por arquivo, 5 por envio). O backend confere a assinatura binária (PNG, JPEG, PDF) e a extensão, grava em `UPLOAD_DIR` (fora de qualquer pasta pública) com nome UUID e registra metadados. O download passa por `GET /attachments/:id`, que aplica a política do chamado e a `visibility` copiada do comentário, com `Content-Disposition: attachment` e `X-Content-Type-Options: nosniff`.

**Rationale:** Cumpre as diretrizes do BRAINSTORM sem serviço externo. A validação própria por assinatura evita dependência ESM que complica o Jest.

**Alternatives Rejected:**
1. Armazenamento em nuvem (S3) - rejeitado: custo e fora do escopo.
2. Arquivos no banco - rejeitado: crescimento e backup mais pesados.
3. Biblioteca de detecção de tipo - rejeitado: três formatos não justificam dependência.

**Consequences:**
- O volume de uploads precisa entrar na política de backup (README).
- Novos formatos exigem nova assinatura e teste.

---

### Decision 8: Notificações persistidas com polling

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** O MVP tem caixa de notificações no sino, sem e-mail.

**Choice:** Linhas em `notifications` criadas na mesma transação do evento. A SPA consulta `unread-count` a cada 30 s (TanStack Query com `refetchInterval`) e carrega a lista ao abrir o sino.

**Rationale:** Simples, robusto e sem infraestrutura de tempo real.

**Alternatives Rejected:**
1. WebSocket/SSE - rejeitado: complexidade sem necessidade (já decidido no brainstorm).

**Consequences:**
- Atraso de até 30 s na atualização do contador.

**Eventos e destinatários:** novo chamado → todos os técnicos e admins ativos; atribuição → técnico atribuído; comentário público da TI, mudança de status e resolução → solicitante; comentário do funcionário → responsável (ou toda a TI se não houver); reabertura e recusa da solução → responsável (ou toda a TI). Observações internas notificam só a TI. Quem faz a ação nunca é notificado dela.

---

### Decision 9: Serial informado sempre guardado, equipamento vinculado de forma opcional

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** O Serial é obrigatório em todo chamado, mas o equipamento pode não existir no cadastro.

**Choice:** O chamado guarda `serial_informed` (normalizado: espaços cortados, maiúsculas) e `equipment_id` opcional. Se o serial existe, o vínculo é automático. Ao cadastrar um equipamento, uma transação vincula todos os chamados abertos com aquele `serial_informed`. Chamado sem vínculo aparece como "pendente de validação"; a TI corrige o serial do chamado (gera evento) ou cadastra o equipamento.

**Rationale:** Nunca bloqueia a abertura e preserva o que a pessoa digitou, mesmo se estiver errado.

**Alternatives Rejected:**
1. Exigir cadastro prévio - rejeitado: contraria a decisão aprovada.
2. Deduplicação automática por similaridade - rejeitado: fora do escopo (A-010).

**Consequences:**
- A tela de equipamentos lista seriais pendentes agrupados por valor informado.

---

### Decision 10: Tempo em UTC e janelas em dias corridos

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** Reabertura em 3 dias (A-001), "hoje" e "últimos N dias" nos relatórios e tempo médio de resolução (A-006).

**Choice:** Todos os instantes em `timestamptz` (UTC). Reabertura aceita se `agora - closed_at <= 72 h` (limite inclusivo). Relatórios usam o fuso `APP_TIMEZONE` (padrão `America/Sao_Paulo`): "hoje" começa à 00:00 local; "7d" e "30d" contam dias corridos até agora. Tempo médio = média de `resolved_at - created_at` dos chamados resolvidos no período, com `resolved_at` sempre atualizado para a resolução mais recente.

**Rationale:** Evita ambiguidades de fuso e dá regra testável nos limites.

**Alternatives Rejected:**
1. Dias úteis - rejeitado: exige calendário de feriados, fora do MVP.

**Consequences:**
- Pedido fora do prazo recebe 409 com mensagem clara; o funcionário abre um novo chamado (A-002).

---

### Decision 11: Mesma origem via nginx e entrypoint com migração e seed

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-11-24 |

**Context:** O projeto deve subir com um comando e popular dados fictícios.

**Choice:** `docker compose up --build` sobe `db`, `backend` e `frontend`. O entrypoint do backend roda `prisma migrate deploy` e, se `SEED_ON_START=true` e o banco estiver vazio, executa o seed (setores, usuários dos 3 perfis, categorias, equipamentos, regras de prioridade e cerca de 500 chamados em vários status, com `@faker-js/faker` em pt_BR e semente fixa).

**Rationale:** Experiência de avaliador sem passos manuais e dados reprodutíveis para testes e demonstração.

**Alternatives Rejected:**
1. Passos manuais de migração e seed - rejeitado: contraria o critério de sucesso.

**Consequences:**
- O seed usa senha de desenvolvimento definida em `SEED_PASSWORD` e documentada no README; nunca deve ser usada fora da demo.

---

### Decision 12: Premissas de design a confirmar

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted (pendente de confirmação do responsável) |
| **Date** | 2026-11-24 |

**Context:** Dois pontos do fluxo não estavam definidos nos documentos e foram resolvidos com um padrão razoável.

**Choice:**
1. **Não existe status "Em atendimento".** Os seis status aprovados são mantidos: após a triagem o chamado fica em "Aguardando iniciar" enquanto o técnico trabalha, até pedir informação ou resolver.
2. **"O problema persiste" em chamado Resolvido** (botão que aparece nas telas): volta para Aberto com motivo, como evento `RESOLUTION_REJECTED`. A reabertura formal de 3 dias vale só depois de Fechado.
3. A matriz inicial de prioridade (Decision 6).
4. Não há fechamento automático de chamado Resolvido sem confirmação (SLA está fora do escopo).

**Rationale:** Evitar status ou regras que você não aprovou, registrando a lacuna.

**Alternatives Rejected:**
1. Criar o status "Em atendimento" - rejeitado: não foi aprovado e muda o relatório por status.

**Consequences:**
- Se você preferir um status "Em atendimento", só `ticket-state-machine.ts`, o enum e as telas mudam.

---

## File Manifest

| # | File | Action | Purpose | Agent | Dependencies |
|---|------|--------|---------|-------|--------------|
| 1 | `docker-compose.yml` | Create | Serviços db, backend, frontend, volumes | @ci-cd-specialist | 10, 109 |
| 2 | `.env.example` | Create | Variáveis do Compose | (general) | None |
| 3 | `.gitignore` | Create | Ignorar node_modules, dist, .env, uploads | (general) | None |
| 4 | `README.md` | Create | Execução, decisões, backup, usuários de demonstração | @code-documenter | 1, 2 |
| 5 | `.github/workflows/ci.yml` | Create | Lint, testes e build no CI | @ci-cd-specialist | 6, 105 |
| 6 | `backend/package.json` | Create | Dependências, scripts, config do Jest | (general) | None |
| 7 | `backend/tsconfig.json` | Create | Compilação TypeScript | (general) | None |
| 8 | `backend/nest-cli.json` | Create | Configuração do Nest CLI | (general) | None |
| 9 | `backend/.env.example` | Create | Variáveis do backend | (general) | None |
| 10 | `backend/Dockerfile` | Create | Imagem do backend em múltiplas etapas | @ci-cd-specialist | 6 |
| 11 | `backend/docker-entrypoint.sh` | Create | Migração e seed condicional na partida | @shell-script-specialist | 10 |
| 12 | `backend/prisma/schema.prisma` | Create | Modelo de dados e enums | @schema-designer | None |
| 13 | `backend/prisma/migrations/` | Create | Migração inicial gerada pelo Prisma | (general) | 12 |
| 14 | `backend/prisma/seed.ts` | Create | Dados fictícios e regras de prioridade iniciais | (general) | 12 |
| 15 | `backend/src/main.ts` | Create | Bootstrap, helmet, cookies, pipes, Swagger | (general) | 16 |
| 16 | `backend/src/app.module.ts` | Create | Composição de módulos e guards globais | (general) | 17-29 |
| 17 | `backend/src/config/env.validation.ts` | Create | Validação das variáveis de ambiente | (general) | None |
| 18 | `backend/src/prisma/prisma.module.ts` | Create | Módulo global do Prisma | (general) | 12 |
| 19 | `backend/src/prisma/prisma.service.ts` | Create | Cliente Prisma com ciclo de vida | (general) | 18 |
| 20 | `backend/src/common/decorators/public.decorator.ts` | Create | Marca rotas públicas | (general) | None |
| 21 | `backend/src/common/decorators/roles.decorator.ts` | Create | Declara perfis por rota | (general) | None |
| 22 | `backend/src/common/decorators/current-user.decorator.ts` | Create | Injeta o usuário autenticado | (general) | 28 |
| 23 | `backend/src/common/guards/session-auth.guard.ts` | Create | Autenticação por sessão e troca obrigatória | (general) | 20, 28, 34 |
| 24 | `backend/src/common/guards/roles.guard.ts` | Create | Autorização por perfil | (general) | 21 |
| 25 | `backend/src/common/middleware/csrf-header.middleware.ts` | Create | Exige `X-Requested-With` em mutações | (general) | None |
| 26 | `backend/src/common/filters/http-exception.filter.ts` | Create | Formato único de erro | (general) | None |
| 27 | `backend/src/common/dto/pagination.dto.ts` | Create | Página e tamanho com limites | (general) | None |
| 28 | `backend/src/common/types/auth-user.ts` | Create | Tipo do usuário na requisição | (general) | 12 |
| 29 | `backend/src/common/format-ticket-code.ts` | Create | `CH-000123` a partir do id | (general) | None |
| 30 | `backend/src/auth/auth.module.ts` | Create | Módulo de autenticação | (general) | 31-34 |
| 31 | `backend/src/auth/auth.controller.ts` | Create | Rotas de login, logout, me, troca de senha | (general) | 32, 35, 36 |
| 32 | `backend/src/auth/auth.service.ts` | Create | Regras de login e troca de senha | (general) | 19, 33, 34 |
| 33 | `backend/src/auth/password.service.ts` | Create | Hash e verificação com argon2id | (general) | None |
| 34 | `backend/src/auth/session.service.ts` | Create | Criar, validar e revogar sessões | (general) | 19 |
| 35 | `backend/src/auth/dto/login.dto.ts` | Create | Validação do login | (general) | None |
| 36 | `backend/src/auth/dto/change-password.dto.ts` | Create | Validação da nova senha | (general) | None |
| 37 | `backend/src/auth/auth.service.spec.ts` | Create | Testes unitários de autenticação | (general) | 32 |
| 38 | `backend/src/auth/password.service.spec.ts` | Create | Testes de hash | (general) | 33 |
| 39 | `backend/src/users/users.module.ts` | Create | Módulo de usuários | (general) | 40, 41 |
| 40 | `backend/src/users/users.controller.ts` | Create | Rotas de usuários (ADMIN) | (general) | 41-44 |
| 41 | `backend/src/users/users.service.ts` | Create | Cadastro, edição, desativação, redefinição | (general) | 19, 33, 34 |
| 42 | `backend/src/users/dto/create-user.dto.ts` | Create | Validação do cadastro | (general) | None |
| 43 | `backend/src/users/dto/update-user.dto.ts` | Create | Validação da edição | (general) | 42 |
| 44 | `backend/src/users/dto/list-users.query.ts` | Create | Filtros da listagem | (general) | 27 |
| 45 | `backend/src/users/users.service.spec.ts` | Create | Testes de usuários | (general) | 41 |
| 46 | `backend/src/catalog/catalog.module.ts` | Create | Módulo de setores e categorias | (general) | 47-49 |
| 47 | `backend/src/catalog/sectors.controller.ts` | Create | Rotas de setores | (general) | 49, 50 |
| 48 | `backend/src/catalog/categories.controller.ts` | Create | Rotas de categorias | (general) | 49, 50 |
| 49 | `backend/src/catalog/catalog.service.ts` | Create | Regras de setores e categorias | (general) | 19 |
| 50 | `backend/src/catalog/dto/catalog.dto.ts` | Create | Validação de nome e ativo | (general) | None |
| 51 | `backend/src/access/access.module.ts` | Create | Módulo da política de acesso | (general) | 52 |
| 52 | `backend/src/access/ticket-access.policy.ts` | Create | Quem vê chamado, comentário e anexo | (general) | 19, 28 |
| 53 | `backend/src/access/ticket-access.policy.spec.ts` | Create | Testes da política | (general) | 52 |
| 54 | `backend/src/priority-rules/priority-rules.module.ts` | Create | Módulo das regras de prioridade | (general) | 55, 56 |
| 55 | `backend/src/priority-rules/priority-rules.controller.ts` | Create | Rotas `GET/PUT /priority-rules` | (general) | 56, 57 |
| 56 | `backend/src/priority-rules/priority-rules.service.ts` | Create | Leitura, edição e cálculo da sugestão | (general) | 19, 58 |
| 57 | `backend/src/priority-rules/dto/priority-rules.dto.ts` | Create | Validação de pontos e limiares | (general) | None |
| 58 | `backend/src/priority-rules/priority.util.ts` | Create | Função pura de pontuação | (general) | None |
| 59 | `backend/src/priority-rules/priority.util.spec.ts` | Create | Testes da pontuação | (general) | 58 |
| 60 | `backend/src/equipment/equipment.module.ts` | Create | Módulo de equipamentos | (general) | 61, 62 |
| 61 | `backend/src/equipment/equipment.controller.ts` | Create | Rotas de equipamentos e pendentes | (general) | 62, 63 |
| 62 | `backend/src/equipment/equipment.service.ts` | Create | Cadastro e vínculo retroativo de chamados | (general) | 19 |
| 63 | `backend/src/equipment/dto/equipment.dto.ts` | Create | Validação do equipamento | (general) | None |
| 64 | `backend/src/equipment/equipment.service.spec.ts` | Create | Testes de equipamentos | (general) | 62 |
| 65 | `backend/src/attachments/attachments.module.ts` | Create | Módulo de anexos | (general) | 66-68 |
| 66 | `backend/src/attachments/attachments.controller.ts` | Create | Download autorizado | (general) | 67, 52 |
| 67 | `backend/src/attachments/attachments.service.ts` | Create | Salvar, listar e abrir anexos | (general) | 19, 68, 69 |
| 68 | `backend/src/attachments/storage.service.ts` | Create | Gravação e leitura no disco | (general) | None |
| 69 | `backend/src/attachments/file-validation.ts` | Create | Validação por assinatura, extensão e tamanho | (general) | None |
| 70 | `backend/src/attachments/file-validation.spec.ts` | Create | Testes de validação de arquivo | (general) | 69 |
| 71 | `backend/src/notifications/notifications.module.ts` | Create | Módulo de notificações | (general) | 72, 73 |
| 72 | `backend/src/notifications/notifications.controller.ts` | Create | Rotas de notificações | (general) | 73 |
| 73 | `backend/src/notifications/notifications.service.ts` | Create | Criar, listar e marcar como lida | (general) | 19 |
| 74 | `backend/src/notifications/notifications.service.spec.ts` | Create | Testes de notificações | (general) | 73 |
| 75 | `backend/src/tickets/tickets.module.ts` | Create | Módulo de chamados | (general) | 76, 77 |
| 76 | `backend/src/tickets/tickets.controller.ts` | Create | Rotas de chamados | (general) | 77, 81-83 |
| 77 | `backend/src/tickets/tickets.service.ts` | Create | Abertura, listagem e ação `perform` | (general) | 52, 56, 62, 67, 73, 78, 80, 84 |
| 78 | `backend/src/tickets/ticket-state-machine.ts` | Create | Tabela de transições e validação | (general) | None |
| 79 | `backend/src/tickets/ticket-state-machine.spec.ts` | Create | Testes de todas as transições | (general) | 78 |
| 80 | `backend/src/tickets/ticket-events.service.ts` | Create | Gravação do histórico | (general) | 19 |
| 81 | `backend/src/tickets/dto/create-ticket.dto.ts` | Create | Validação da abertura | (general) | None |
| 82 | `backend/src/tickets/dto/ticket-actions.dto.ts` | Create | Validação de motivo, solução, prioridade | (general) | None |
| 83 | `backend/src/tickets/dto/list-tickets.query.ts` | Create | Filtros e paginação da fila | (general) | 27 |
| 84 | `backend/src/tickets/ticket-view.mapper.ts` | Create | Remove campos e eventos internos para o funcionário | (general) | 29 |
| 85 | `backend/src/tickets/tickets.service.spec.ts` | Create | Testes de regras do chamado | (general) | 77 |
| 86 | `backend/src/comments/comments.module.ts` | Create | Módulo de comentários | (general) | 87, 88 |
| 87 | `backend/src/comments/comments.controller.ts` | Create | Rotas de comentários e anexos | (general) | 88, 89 |
| 88 | `backend/src/comments/comments.service.ts` | Create | Comentários, observações internas e notificações | (general) | 52, 67, 73, 78 |
| 89 | `backend/src/comments/dto/create-comment.dto.ts` | Create | Validação do comentário | (general) | None |
| 90 | `backend/src/comments/comments.service.spec.ts` | Create | Testes de comentários | (general) | 88 |
| 91 | `backend/src/reports/reports.module.ts` | Create | Módulo de relatórios | (general) | 92, 93 |
| 92 | `backend/src/reports/reports.controller.ts` | Create | Rota de resumo (ADMIN) | (general) | 93, 94 |
| 93 | `backend/src/reports/reports.service.ts` | Create | Contadores e tabelas por período | (general) | 19 |
| 94 | `backend/src/reports/dto/report-period.query.ts` | Create | Validação do período | (general) | None |
| 95 | `backend/src/reports/reports.service.spec.ts` | Create | Testes de relatórios | (general) | 93 |
| 96 | `backend/src/health/health.controller.ts` | Create | Verificação de saúde | (general) | 19 |
| 97 | `backend/test/jest-e2e.json` | Create | Configuração dos testes de integração | (general) | None |
| 98 | `backend/test/helpers/test-app.ts` | Create | App de teste com banco real e fábricas | (general) | 14, 16 |
| 99 | `backend/test/auth.e2e-spec.ts` | Create | AT-012 e fluxo de senha | (general) | 98 |
| 100 | `backend/test/access.e2e-spec.ts` | Create | AT-003, AT-004 | (general) | 98 |
| 101 | `backend/test/lifecycle.e2e-spec.ts` | Create | AT-001, 002, 005-011 | (general) | 98 |
| 102 | `backend/test/attachments.e2e-spec.ts` | Create | AT-013 e download autorizado | (general) | 98 |
| 103 | `backend/test/users-equipment.e2e-spec.ts` | Create | AT-014 e cadastro de usuário | (general) | 98 |
| 104 | `backend/test/notifications-reports.e2e-spec.ts` | Create | AT-015 e relatórios | (general) | 98 |
| 105 | `frontend/package.json` | Create | Dependências e scripts | (general) | None |
| 106 | `frontend/tsconfig.json` | Create | TypeScript do front | (general) | None |
| 107 | `frontend/vite.config.ts` | Create | Vite, proxy `/api`, Vitest | (general) | 105 |
| 108 | `frontend/index.html` | Create | Documento base | (general) | None |
| 109 | `frontend/Dockerfile` | Create | Build da SPA e nginx | @ci-cd-specialist | 105, 110 |
| 110 | `frontend/nginx.conf` | Create | Estáticos, fallback da SPA, proxy `/api` | @ci-cd-specialist | None |
| 111 | `frontend/src/main.tsx` | Create | Ponto de entrada e providers | (general) | 112 |
| 112 | `frontend/src/App.tsx` | Create | Rotas e proteção por perfil | (general) | 117, 118, 125 |
| 113 | `frontend/src/styles/tokens.css` | Create | Cores, tipografia e espaçamento do design | (general) | None |
| 114 | `frontend/src/styles/global.css` | Create | Estilos base | (general) | 113 |
| 115 | `frontend/src/lib/api-client.ts` | Create | `fetch` com cookie e cabeçalho `X-Requested-With` | (general) | None |
| 116 | `frontend/src/lib/labels.ts` | Create | Rótulos de status, prioridade, perfil | (general) | None |
| 117 | `frontend/src/auth/AuthProvider.tsx` | Create | Estado do usuário e logout | (general) | 115 |
| 118 | `frontend/src/auth/RequireRole.tsx` | Create | Guarda de rotas | (general) | 117 |
| 119 | `frontend/src/hooks/useTickets.ts` | Create | Consultas e ações de chamados | (general) | 115 |
| 120 | `frontend/src/hooks/useUsers.ts` | Create | Consultas e ações de usuários | (general) | 115 |
| 121 | `frontend/src/hooks/useEquipment.ts` | Create | Consultas e ações de equipamentos | (general) | 115 |
| 122 | `frontend/src/hooks/useReports.ts` | Create | Consulta de relatórios | (general) | 115 |
| 123 | `frontend/src/hooks/useNotifications.ts` | Create | Polling e leitura de notificações | (general) | 115 |
| 124 | `frontend/src/hooks/useCatalog.ts` | Create | Setores, categorias, regras de prioridade | (general) | 115 |
| 125 | `frontend/src/components/AppLayout.tsx` | Create | Cabeçalho e menu por perfil | (general) | 126 |
| 126 | `frontend/src/components/NotificationBell.tsx` | Create | Sino e caixa de notificações | (general) | 123 |
| 127 | `frontend/src/components/StatusChip.tsx` | Create | Etiqueta de status | (general) | 116 |
| 128 | `frontend/src/components/PriorityChip.tsx` | Create | Etiqueta de prioridade | (general) | 116 |
| 129 | `frontend/src/components/ReasonDialog.tsx` | Create | Diálogo de motivo (reabrir, cancelar, prioridade, solução) | (general) | 131 |
| 130 | `frontend/src/components/Pagination.tsx` | Create | Paginação das listas | (general) | None |
| 131 | `frontend/src/components/FormField.tsx` | Create | Campo com rótulo e erro acessíveis | (general) | None |
| 132 | `frontend/src/components/TicketThread.tsx` | Create | Conversa e observações internas | (general) | 133 |
| 133 | `frontend/src/components/AttachmentPicker.tsx` | Create | Seleção de arquivos com limites | (general) | None |
| 134 | `frontend/src/pages/LoginPage.tsx` | Create | Tela de login | (general) | 117, 131 |
| 135 | `frontend/src/pages/ChangePasswordPage.tsx` | Create | Troca de senha obrigatória | (general) | 117, 131 |
| 136 | `frontend/src/pages/NewTicketPage.tsx` | Create | Abertura de chamado | (general) | 119, 131, 133 |
| 137 | `frontend/src/pages/MyTicketsPage.tsx` | Create | Meus chamados | (general) | 119, 127, 130 |
| 138 | `frontend/src/pages/TicketQueuePage.tsx` | Create | Fila da TI | (general) | 119, 127, 128, 130 |
| 139 | `frontend/src/pages/TicketDetailPage.tsx` | Create | Detalhe com visão de funcionário ou da TI | (general) | 119, 129, 132 |
| 140 | `frontend/src/pages/UsersPage.tsx` | Create | Lista de usuários | (general) | 120, 130 |
| 141 | `frontend/src/pages/UserFormPage.tsx` | Create | Cadastro e edição de usuário | (general) | 120, 124, 131 |
| 142 | `frontend/src/pages/EquipmentPage.tsx` | Create | Equipamentos e seriais pendentes | (general) | 121, 131 |
| 143 | `frontend/src/pages/ReportsPage.tsx` | Create | Relatórios | (general) | 122 |
| 144 | `frontend/src/pages/CatalogPage.tsx` | Create | Setores e categorias | (general) | 124, 131 |
| 145 | `frontend/src/pages/PriorityRulesPage.tsx` | Create | Regras de prioridade | (general) | 124, 131 |
| 146 | `frontend/src/test/setup.ts` | Create | Configuração do Vitest | (general) | 107 |
| 147 | `frontend/src/components/ReasonDialog.test.tsx` | Create | Motivo obrigatório no diálogo | (general) | 129, 146 |
| 148 | `frontend/src/auth/RequireRole.test.tsx` | Create | Bloqueio de rota por perfil | (general) | 118, 146 |
| 149 | `frontend/src/pages/TicketDetailPage.test.tsx` | Create | Ações exibidas por perfil e status | (general) | 139, 146 |

**Total Files:** 149

---

## Agent Assignment Rationale

> Agents discovered from `${CLAUDE_PLUGIN_ROOT}/agents/` - Build phase invokes matched specialists.

| Agent | Files Assigned | Why This Agent |
|-------|----------------|----------------|
| @schema-designer | 12 | Modelagem relacional, restrições e evolução de esquema |
| @ci-cd-specialist | 1, 5, 10, 109, 110 | Docker, Compose, nginx e pipeline de CI |
| @shell-script-specialist | 11 | Script de entrypoint com tratamento de erro |
| @code-documenter | 4 | README de execução, decisões e backup |
| (general) | 2, 3, 6-9, 13-104, 105-108, 111-149 | Nenhum especialista em TypeScript, Node, NestJS ou React: @python-developer é específico de Python e @test-generator foca em pytest; o Build trata diretamente |

**Agent Discovery:**
- Scanned: `${CLAUDE_PLUGIN_ROOT}/agents/**/*.md` (listagem de agentes disponíveis na sessão)
- Matched by: tipo de arquivo, palavras-chave de propósito e padrões de caminho
- Recomendação pós-build: executar @code-reviewer sobre `backend/src/access`, `backend/src/auth` e `backend/src/attachments` (superfície de segurança).

---

## Code Patterns

### Pattern 1: Máquina de estados do chamado

```ts
// backend/src/tickets/ticket-state-machine.ts
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Role, TicketStatus } from '@prisma/client';

export type TicketAction =
  | 'TRIAGE' | 'ASSIGN' | 'REQUEST_INFO' | 'USER_REPLY' | 'RESOLVE'
  | 'CONFIRM' | 'REJECT_RESOLUTION' | 'REOPEN' | 'CANCEL';

interface Transition {
  from: TicketStatus[];
  to: TicketStatus | null; // null = o status não muda
  roles: Role[];
  requiresReason: boolean;
}

const STAFF: Role[] = ['TECHNICIAN', 'ADMIN'];
const OPEN_STATES: TicketStatus[] = ['OPEN', 'WAITING_START', 'WAITING_USER'];

export const TRANSITIONS: Record<TicketAction, Transition> = {
  TRIAGE: { from: ['OPEN'], to: 'WAITING_START', roles: STAFF, requiresReason: false },
  ASSIGN: { from: OPEN_STATES, to: null, roles: STAFF, requiresReason: false },
  REQUEST_INFO: { from: ['OPEN', 'WAITING_START'], to: 'WAITING_USER', roles: STAFF, requiresReason: false },
  USER_REPLY: { from: ['WAITING_USER'], to: 'WAITING_START', roles: ['EMPLOYEE'], requiresReason: false },
  RESOLVE: { from: OPEN_STATES, to: 'RESOLVED', roles: STAFF, requiresReason: true },
  CONFIRM: { from: ['RESOLVED'], to: 'CLOSED', roles: ['EMPLOYEE'], requiresReason: false },
  REJECT_RESOLUTION: { from: ['RESOLVED'], to: 'OPEN', roles: ['EMPLOYEE'], requiresReason: true },
  REOPEN: { from: ['CLOSED'], to: 'OPEN', roles: ['EMPLOYEE'], requiresReason: true },
  CANCEL: { from: OPEN_STATES, to: 'CANCELLED', roles: ['EMPLOYEE', ...STAFF], requiresReason: true },
};

/** Valida a ação e devolve o próximo status. A posse do chamado é verificada na política de acesso. */
export function applyTransition(
  current: TicketStatus,
  action: TicketAction,
  role: Role,
  reason?: string,
): TicketStatus {
  const t = TRANSITIONS[action];
  if (!t.roles.includes(role)) throw new ForbiddenException('Perfil sem permissão para esta ação.');
  if (!t.from.includes(current)) throw new ConflictException('Ação indisponível para o status atual.');
  if (t.requiresReason && !reason?.trim()) throw new BadRequestException('Informe o motivo.');
  return t.to ?? current;
}
```

### Pattern 2: Guards de sessão e de perfil

```ts
// backend/src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// backend/src/common/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: { role: Role } }>().user;
    return !!user && required.includes(user.role);
  }
}

// backend/src/common/guards/session-auth.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService, SESSION_COOKIE } from '../../auth/session.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../types/auth-user';

const ALLOWED_WHEN_PASSWORD_CHANGE_REQUIRED = ['/auth/change-password', '/auth/me', '/auth/logout'];

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly sessions: SessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    const user = token ? await this.sessions.validate(token) : null; // null se expirada ou conta inativa
    if (!user) throw new UnauthorizedException();

    const allowed = ALLOWED_WHEN_PASSWORD_CHANGE_REQUIRED.some((p) => req.path.endsWith(p));
    if (user.mustChangePassword && !allowed) throw new ForbiddenException('PASSWORD_CHANGE_REQUIRED');

    req.user = user;
    return true;
  }
}
```

### Pattern 3: Política de acesso (fonte única de visibilidade)

```ts
// backend/src/access/ticket-access.policy.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Ticket, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';

@Injectable()
export class TicketAccessPolicy {
  constructor(private readonly prisma: PrismaService) {}

  /** Funcionário só acessa os próprios chamados; para os demais responde 404 (não revela existência). */
  async loadVisibleTicket(user: AuthUser, id: number): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException();
    if (user.role === 'EMPLOYEE' && ticket.requesterId !== user.id) throw new NotFoundException();
    return ticket;
  }

  allowedVisibilities(user: AuthUser): Visibility[] {
    return user.role === 'EMPLOYEE' ? ['PUBLIC'] : ['PUBLIC', 'INTERNAL'];
  }
}
```

### Pattern 4: Ação do chamado em transação (status + histórico + notificação)

```ts
// backend/src/tickets/tickets.service.ts (trecho)
async perform(user: AuthUser, id: number, action: TicketAction, dto: { reason?: string }) {
  const ticket = await this.access.loadVisibleTicket(user, id);
  const next = applyTransition(ticket.status, action, user.role, dto.reason);

  if (action === 'REOPEN') {
    assertReopenWindow(ticket.closedAt, new Date(), this.config.reopenWindowHours);
  }

  return this.prisma.$transaction(async (tx) => {
    // concorrência otimista: só atualiza se o status não mudou desde a leitura
    const res = await tx.ticket.updateMany({
      where: { id, status: ticket.status },
      data: { status: next, ...this.timestampsFor(action) },
    });
    if (res.count === 0) throw new ConflictException('O chamado foi alterado por outra pessoa. Recarregue.');

    await this.events.record(tx, {
      ticketId: id,
      type: EVENT_BY_ACTION[action],
      actorId: user.id,
      payload: { from: ticket.status, to: next, reason: dto.reason ?? null },
    });
    await this.notifications.fanOut(tx, ticket, action, user);
    return tx.ticket.findUniqueOrThrow({ where: { id } });
  });
}

// backend/src/tickets/reopen-window.ts (ou no mesmo arquivo)
export function assertReopenWindow(closedAt: Date | null, now: Date, hours: number): void {
  if (!closedAt || now.getTime() - closedAt.getTime() > hours * 3_600_000) {
    throw new ConflictException('Prazo de reabertura expirado. Abra um novo chamado.');
  }
}
```

### Pattern 5: Pontuação da prioridade sugerida

```ts
// backend/src/priority-rules/priority.util.ts
import { Priority } from '@prisma/client';

export interface Threshold { priority: Priority; minScore: number }

export function suggestPriority(score: number, thresholds: Threshold[]): Priority {
  const ordered = [...thresholds].sort((a, b) => b.minScore - a.minScore);
  const hit = ordered.find((t) => score >= t.minScore) ?? ordered[ordered.length - 1];
  return hit.priority;
}
```

### Pattern 6: Validação de anexos por assinatura

```ts
// backend/src/attachments/file-validation.ts
import { BadRequestException } from '@nestjs/common';

interface Signature { mime: string; exts: string[]; bytes: number[] }

const SIGNATURES: Signature[] = [
  { mime: 'image/png', exts: ['png'], bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', exts: ['jpg', 'jpeg'], bytes: [0xff, 0xd8, 0xff] },
  { mime: 'application/pdf', exts: ['pdf'], bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

export function validateUpload(
  file: { originalname: string; buffer: Buffer; size: number },
  maxBytes: number,
): { mime: string } {
  if (file.size === 0 || file.size > maxBytes) {
    throw new BadRequestException('Arquivo vazio ou acima do tamanho máximo.');
  }
  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  const sig = SIGNATURES.find((s) => s.bytes.every((b, i) => file.buffer[i] === b));
  if (!sig || !sig.exts.includes(ext)) {
    throw new BadRequestException('Tipo de arquivo não permitido.');
  }
  return { mime: sig.mime };
}
```

### Pattern 7: Esquema Prisma (núcleo)

```prisma
// backend/prisma/schema.prisma (trecho)
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role { EMPLOYEE TECHNICIAN ADMIN }
enum TicketStatus { OPEN WAITING_START WAITING_USER RESOLVED CLOSED CANCELLED }
enum Priority { LOW MEDIUM HIGH CRITICAL }
enum Visibility { PUBLIC INTERNAL }

model User {
  id                 Int       @id @default(autoincrement())
  name               String
  email              String    @unique
  login              String    @unique
  passwordHash       String    @map("password_hash")
  role               Role
  sectorId           Int       @map("sector_id")
  isActive           Boolean   @default(true) @map("is_active")
  mustChangePassword Boolean   @default(true) @map("must_change_password")
  deactivatedAt      DateTime? @map("deactivated_at")
  deactivatedById    Int?      @map("deactivated_by")
  createdAt          DateTime  @default(now()) @map("created_at")
  sector             Sector    @relation(fields: [sectorId], references: [id])

  @@map("users")
}

model Ticket {
  id                Int          @id @default(autoincrement())
  requesterId       Int          @map("requester_id")
  requesterName     String       @map("requester_name")
  requesterEmail    String       @map("requester_email")
  sectorId          Int          @map("sector_id")
  title             String?
  description       String
  categoryId        Int?         @map("category_id")
  serialInformed    String       @map("serial_informed")
  equipmentId       Int?         @map("equipment_id")
  assigneeId        Int?         @map("assignee_id")
  assignedAt        DateTime?    @map("assigned_at")
  impactAffected    String       @map("impact_affected")
  impactBlocking    String       @map("impact_blocking")
  impactAlternative String       @map("impact_alternative")
  suggestedPriority Priority     @map("suggested_priority")
  priority          Priority
  status            TicketStatus @default(OPEN)
  solution          String?
  resolvedAt        DateTime?    @map("resolved_at")
  closedAt          DateTime?    @map("closed_at")
  cancelledAt       DateTime?    @map("cancelled_at")
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")

  @@index([status])
  @@index([priority])
  @@index([assigneeId])
  @@index([requesterId])
  @@index([equipmentId])
  @@index([createdAt])
  @@map("tickets")
}
```

### Pattern 8: Bootstrap seguro da API

```ts
// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Me Socorre Aki').setVersion('1.0').build());
  SwaggerModule.setup('api/docs', app, doc);

  await app.listen(Number(process.env.PORT ?? 3000));
}
void bootstrap();
```

### Pattern 9: Docker Compose

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      UPLOAD_DIR: /data/uploads
      SEED_ON_START: ${SEED_ON_START:-true}
      SEED_PASSWORD: ${SEED_PASSWORD}
      COOKIE_SECURE: "false"
    volumes:
      - uploads:/data/uploads
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    depends_on:
      - backend

volumes:
  pgdata:
  uploads:
```

### Pattern 10: Configuration Structure

```env
# backend/.env.example
DATABASE_URL=postgresql://helpdesk:helpdesk@localhost:5432/mesocorreaki
PORT=3000
SESSION_TTL_HOURS=8
COOKIE_SECURE=false
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=5
MAX_FILES_PER_REQUEST=5
REOPEN_WINDOW_HOURS=72
PASSWORD_MIN_LENGTH=10
APP_TIMEZONE=America/Sao_Paulo
SEED_ON_START=true
SEED_PASSWORD=troque-esta-senha-de-demo
```

---

## Data Flow

```text
Abertura de chamado
1. Funcionário envia formulário (descrição, serial, 3 respostas de impacto, anexos)
   │  POST /api/tickets (cookie sid + X-Requested-With)
   ▼
2. SessionAuthGuard valida sessão e conta ativa; RolesGuard exige EMPLOYEE
   │
   ▼
3. TicketsService (transação):
   ├─ copia nome, e-mail e setor da conta
   ├─ normaliza o serial e procura equipamento (vincula ou deixa pendente)
   ├─ calcula suggested_priority (pontos + limiares) e define priority = sugerida
   ├─ valida e grava anexos (assinatura, extensão, tamanho) em disco + metadados
   ├─ grava evento CREATED e notificações para a TI
   ▼
4. Resposta com o chamado (CH-000123) sem campos internos

Download de anexo
1. GET /api/attachments/:id → sessão válida
   ▼
2. TicketAccessPolicy: funcionário só do próprio chamado e só visibility PUBLIC
   ▼
3. Stream do arquivo com Content-Disposition: attachment e nosniff
```

---

## Integration Points

| External System | Integration Type | Authentication |
|-----------------|-----------------|----------------|
| PostgreSQL 16 | Prisma (TCP) | Usuário e senha do ambiente |
| Sistema de arquivos local | Volume Docker (`/data/uploads`) | Permissão do processo do container |
| Nenhum serviço externo (e-mail, SSO, nuvem) | N/A (fora do escopo do MVP) | N/A |

---

## Testing Strategy

| Test Type | Scope | Files | Tools | Coverage Goal |
|-----------|-------|-------|-------|---------------|
| Unit | Máquina de estados, pontuação, validação de arquivo, política, serviços | 37, 38, 45, 53, 59, 64, 70, 74, 79, 85, 90, 95 | Jest | 70% nos módulos tickets, auth e access (critério do DEFINE) |
| Integration | API completa com PostgreSQL real (serviço do Compose/CI) | 97-104 | Jest + Supertest | Todos os 15 testes de aceitação |
| Component | Diálogo de motivo, guarda de rota, ações por perfil | 147-149 | Vitest + Testing Library | Caminhos críticos |
| E2E | Fluxo completo no navegador | Manual (roteiro no README) | - | Caminho feliz dos 3 perfis |

**Cobertura dos testes de aceitação do DEFINE:**

| Teste | Verificado em |
|-------|---------------|
| AT-001 abertura | 101 (e 85) |
| AT-002 serial desconhecido | 101 |
| AT-003 isolamento de funcionário | 100 (e 53) |
| AT-004 observação interna e anexo | 100, 102 |
| AT-005 assumir chamado | 101 |
| AT-006 resolver e fechar | 101, 79 |
| AT-007 reabertura no prazo (2 dias) | 101, 85 |
| AT-008 reabertura fora do prazo (limites de 72 h e acima) | 101, 85 |
| AT-009 reabertura sem motivo | 79, 101 |
| AT-010 cancelamento | 101, 79 |
| AT-011 alteração de prioridade | 101, 85 |
| AT-012 conta desativada | 99, 45 |
| AT-013 anexo inválido | 70, 102 |
| AT-014 serial duplicado | 64, 103 |
| AT-015 notificações | 104, 74 |

Critérios de sucesso do DEFINE além dos testes: listagens abaixo de 500 ms com o seed (teste de carga simples no 104, com 500 chamados); `docker compose up` do zero com seed (verificado na CI e no roteiro do README).

---

## Error Handling

| Error Type | Handling Strategy | Retry? |
|------------|-------------------|--------|
| Validação de entrada (DTO) | 400 com lista de campos inválidos | No |
| Não autenticado ou sessão expirada | 401; a SPA volta ao login | No |
| Troca de senha obrigatória | 403 `PASSWORD_CHANGE_REQUIRED`; a SPA abre a tela de troca | No |
| Perfil sem permissão | 403 | No |
| Chamado de outra pessoa (funcionário) | 404 (não revela existência) | No |
| Transição inválida, prazo de reabertura expirado | 409 com mensagem clara | No |
| Conflito de concorrência no chamado | 409 "alterado por outra pessoa"; a SPA recarrega | Sim, após recarregar |
| Serial, e-mail ou login duplicado | 409 | No |
| Arquivo inválido ou grande demais | 400; nada é gravado (validação antes da gravação) | No |
| Falha ao gravar anexo após criar chamado | Transação desfeita e arquivos já gravados removidos | Sim, pelo usuário |
| Erro inesperado | 500 com identificador de correlação; detalhes só no log | No |

---

## Configuration

| Config Key | Type | Default | Description |
|------------|------|---------|-------------|
| `DATABASE_URL` | string | (obrigatória) | Conexão PostgreSQL |
| `SESSION_TTL_HOURS` | int | `8` | Duração da sessão |
| `COOKIE_SECURE` | bool | `false` (dev) | `true` em produção com HTTPS |
| `UPLOAD_DIR` | string | `./uploads` | Pasta dos anexos, fora de qualquer pasta pública |
| `MAX_UPLOAD_MB` | int | `5` | Tamanho máximo por arquivo |
| `MAX_FILES_PER_REQUEST` | int | `5` | Arquivos por envio |
| `REOPEN_WINDOW_HOURS` | int | `72` | Prazo de reabertura após fechar |
| `PASSWORD_MIN_LENGTH` | int | `10` | Tamanho mínimo da senha |
| `APP_TIMEZONE` | string | `America/Sao_Paulo` | Fuso dos relatórios |
| `SEED_ON_START` | bool | `true` | Popula dados fictícios se o banco estiver vazio |
| `SEED_PASSWORD` | string | (sem padrão) | Senha dos usuários de demonstração |

---

## Security Considerations

- Autorização sempre no backend: `SessionAuthGuard` global, `RolesGuard` por rota e `TicketAccessPolicy` em toda leitura de chamado, comentário e anexo (teste de IDOR obrigatório).
- Senhas somente com argon2id; sessões guardadas como hash; tentativas de login limitadas (`@nestjs/throttler`) por IP e login; mensagem genérica para credenciais inválidas.
- Desativar conta e redefinir senha apagam as sessões do usuário; conta inativa nunca autentica.
- Cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção; mutações exigem `X-Requested-With`; helmet ativo.
- Anexos: validação por assinatura, nome UUID, fora da pasta pública, download autorizado, `nosniff`, sem execução; nunca servir a pasta de uploads estaticamente.
- Observações internas e seus anexos: filtradas na consulta (`visibility`) e no mapper de resposta; notificações de observação interna vão só à TI.
- Entrada validada com `class-validator` (`whitelist` e `forbidNonWhitelisted`); consultas sempre parametrizadas (Prisma e `$queryRaw` com parâmetros).
- Segredos só por variável de ambiente; `.env` no `.gitignore`; senha de seed documentada como exclusiva da demonstração.
- Backup: volumes `pgdata` e `uploads` precisam de rotina conjunta (instruções no README).

---

## Observability

| Aspect | Implementation |
|--------|----------------|
| Logging | Logger do Nest em JSON, com id de correlação por requisição; senhas, tokens e cookies nunca são registrados |
| Metrics | Fora do MVP; contadores operacionais ficam nos relatórios do próprio sistema |
| Tracing | Fora do MVP |
| Health | `GET /api/health` verifica o banco; usado no healthcheck do Compose |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-24 | design-agent | Initial version, derivada de DEFINE_HELP_DESK.md v1.1 |
| 1.1 | 2026-11-24 | ship-agent | Shipped and archived |

---

## Next Step

**Ready for:** `/ship .claude/sdd/features/DEFINE_HELP_DESK.md`
