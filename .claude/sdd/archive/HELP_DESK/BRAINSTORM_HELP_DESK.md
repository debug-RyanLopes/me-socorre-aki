# BRAINSTORM: Me Socorre Aki (Sistema Help Desk)

> Exploratory session to clarify intent and approach before requirements capture

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | HELP_DESK |
| **Date** | 2026-11-24 |
| **Author** | brainstorm-agent |
| **Status** | ✅ Shipped |

---

## Initial Idea

**Raw Input:** Ler `BRAINSTORM.md` na raiz do projeto: sistema web interno de Help Desk para uma empresa fictícia (projeto de portfólio), com perfis Funcionário, Técnico de TI e Administrador; chamados com ciclo de vida completo, comentários públicos e observações internas, anexos, equipamentos por Serial Number, notificações internas, prioridade sugerida por regras e relatórios simples.

**Context Gathered:**
- Projeto greenfield: o diretório contém apenas `BRAINSTORM.md` (documento de produto já consolidado, 19 seções) e a pasta `.claude`. Não há código nem `CLAUDE.md`.
- O `BRAINSTORM.md` original é a fonte de verdade de produto (escopo do MVP na seção 15, pendências na seção 17). Este documento adiciona as decisões técnicas e a poda de escopo desta sessão.
- As KBs do plugin AgentSpec cobrem engenharia de dados (dbt, Spark, Airflow etc.) e não se aplicam a um web app transacional. Nenhuma recomendação tem precedente na KB nem no código (confiança 0.70).

**Technical Context Observed (for Define):**

| Aspect | Observation | Implication |
|--------|-------------|-------------|
| Likely Location | Monorepo novo: `backend/` (NestJS), `frontend/` (React + Vite), `docker-compose.yml` na raiz | Dois projetos + infraestrutura local reprodutível |
| Relevant KB Domains | Nenhum aplicável (KBs focadas em dados) | `/define` e `/design` devem se apoiar na documentação oficial de NestJS, Prisma/TypeORM, React e PostgreSQL |
| IaC Patterns | N/A (somente Docker Compose local; deploy gratuito opcional) | Sem Terraform/CI complexo no MVP |

---

## Discovery Questions & Answers

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 1 | Qual a linguagem/preferência de backend? | JavaScript/TypeScript (Node + NestJS/Express) | Stack TypeScript ponta a ponta; NestJS é candidato natural |
| 2 | Como deve ser o front-end? | SPA separada (React + Vite) consumindo API REST | API REST bem definida; autenticação entre origens; dois projetos |
| 3 | Qual banco e onde roda? | PostgreSQL + Docker Compose (local), deploy gratuito opcional | Modelagem relacional forte; setup reproduzível com um comando |
| 4 | Há amostras e qual o critério de sucesso? | Nenhuma amostra ainda | Seed de dados fictícios gerado no projeto (usuários, setores, equipamentos, chamados) |

**Minimum Questions:** 3 (atendido: 4 perguntas + 3 de confirmação de abordagem, escopo e resumo)

---

## Sample Data Inventory

> Samples improve LLM accuracy through in-context learning and few-shot prompting.

| Type | Location | Count | Notes |
|------|----------|-------|-------|
| Input files | N/A | 0 | Nenhuma amostra fornecida |
| Output examples | N/A | 0 | Sem layouts ou wireframes de referência |
| Ground truth | N/A | 0 | Sem lista real de categorias ou equipamentos |
| Related code | N/A | 0 | Projeto greenfield |

**How samples will be used:**

- Não há amostras externas: um script de seed gerará setores fictícios (Financeiro, RH, Comercial, Operações, TI), usuários dos três perfis, categorias, equipamentos e chamados em vários status.
- O seed servirá de fixture para testes e para a demonstração do portfólio.
- A matriz de prioridade e as transições de status do `/define` serão a referência de validação dos testes de regra de negócio.

---

## Approaches Explored

### Approach A: Monólito modular NestJS + React SPA ⭐ Recommended

**Description:** API NestJS organizada em módulos (auth, users, sectors, tickets, equipment, notifications, reports), PostgreSQL via ORM (Prisma ou TypeORM, decisão no `/design`), SPA React + Vite, tudo orquestrado por Docker Compose.

**Pros:**
- Guards e decorators do Nest implementam RBAC e autorização no backend de forma explícita e testável.
- Módulos demonstram boa arquitetura sem a complexidade de microsserviços.
- Um único deploy de backend e um único banco.

**Cons:**
- Curva de aprendizado do Nest (injeção de dependência, decorators).
- Dois projetos para manter (API e SPA).

**Why Recommended:** É o que mais demonstra backend, modelagem, autorização e regras de negócio dentro do escopo (uma empresa, sem multi-tenant). Confiança 0.70 (sem precedente na KB nem no código).

---

### Approach B: Express enxuto + React SPA

**Description:** Express com camadas manuais (rotas, serviços, repositórios) e PostgreSQL via Prisma.

**Pros:**
- Menos abstração e início mais rápido.
- Controle total da estrutura.

**Cons:**
- Estrutura, validação e RBAC dependem de disciplina própria e tendem a se dispersar.
- Mostra menos convenção profissional que o Nest.

---

### Approach C: Next.js full-stack

**Description:** Front e API no mesmo projeto Next.js.

**Pros:**
- Deploy simples e menos infraestrutura.

**Cons:**
- Contradiz a escolha de SPA separada e dilui a vitrine de backend.

---

## Data Engineering Context (if applicable)

Não aplicável: sistema transacional (OLTP) interno, sem pipelines de dados. Os relatórios são consultas SQL simples sobre o banco operacional.

---

## Selected Approach

| Attribute | Value |
|-----------|-------|
| **Chosen** | Approach A |
| **User Confirmation** | 2026-11-24 (confirmação explícita na sessão) |
| **Reasoning** | Maior valor de portfólio em backend/autorização; mantém a SPA React + Vite já escolhida; evita microsserviços desnecessários |

---

## Key Decisions Made

| # | Decision | Rationale | Alternative Rejected |
|---|----------|-----------|----------------------|
| 1 | Stack: NestJS + React/Vite + PostgreSQL + Docker Compose | Alinhado à preferência por TypeScript e aos objetivos de portfólio | Express enxuto; Next.js full-stack |
| 2 | Arquitetura de monólito modular | Simplicidade operacional com separação clara de domínios | Microsserviços |
| 3 | Notificações persistidas em tabela e consultadas por polling | MVP simples; evita infraestrutura de tempo real | WebSocket/SSE |
| 4 | Anexos em disco local fora da pasta pública, download via endpoint autorizado | Cumpre a diretriz de segurança de arquivos sem serviço externo | Armazenamento em nuvem (S3) |
| 5 | Dados de demonstração via seed fictício | Não há amostras reais | Dados reais de referência |
| 6 | Regras de prioridade editáveis ganham tela própria no painel administrativo | Foram mantidas no escopo mesmo sem painel de configurações geral | Matriz fixa no código |
| 7 | Decisões de produto do `BRAINSTORM.md` original permanecem válidas (perfis, status, reabertura de 3 dias, desativação de contas, Serial obrigatório etc.) | Já aprovadas pelo responsável do projeto | N/A |

---

## Features Removed (YAGNI)

| Feature Suggested | Reason Removed | Can Add Later? |
|-------------------|----------------|----------------|
| Intervalo de datas personalizado nos relatórios | Períodos rápidos (hoje, 7 e 30 dias) cobrem o uso do MVP | Yes |
| Painel de configurações gerais | Sem parâmetros reais definidos; reduz telas e escopo | Yes |
| Recuperação de senha self-service | Basta a redefinição feita pelo administrador | Yes |

Itens já fora do MVP no `BRAINSTORM.md` original (seção 15.2): notificações por e-mail, Microsoft 365/AD, IA, distribuição automática, SLA, exportação PDF/Excel, BI, base de conhecimento, patrimônio avançado.

---

## Incremental Validations

| Section | Presented | User Feedback | Adjusted? |
|---------|-----------|---------------|-----------|
| Architecture concept | ✅ | Aprovado: monólito modular, polling, anexos em disco com download autorizado | No |
| Scope and rules (YAGNI) | ✅ | Aprovado: 3 remoções; regras de prioridade editáveis mantidas com tela própria | Yes (tela própria de prioridade) |

**Minimum Validations:** 2 (atendido)

---

## Suggested Requirements for /define

### Problem Statement (Draft)
Centralizar e rastrear as solicitações de suporte de TI de uma empresa fictícia em um sistema web interno com controle de acesso por perfil, histórico confiável e relatórios simples, servindo como projeto de portfólio de backend.

### Target Users (Draft)
| User | Pain Point |
|------|------------|
| Funcionário | Não tem canal único para abrir e acompanhar chamados nem ver o status do atendimento |
| Técnico de TI | Falta organizar fila, assumir chamados e registrar comunicação e solução |
| Administrador | Falta gerir usuários, setores, equipamentos e ter visão de indicadores |
| Avaliador do portfólio | Precisa ver backend, modelagem, autorização e testes funcionando de forma simples |

### Success Criteria (Draft)
- [ ] Funcionário nunca acessa chamados de terceiros, nem alterando IDs ou URLs (verificado por testes).
- [ ] Observações internas e seus anexos nunca são expostos ao funcionário (verificado por testes).
- [ ] Ciclo Aberto → Resolvido → Fechado, com reabertura em até 3 dias e cancelamento com motivo, registra autor, data e motivo no histórico.
- [ ] Chamado com Serial não cadastrado é aberto normalmente e fica sinalizado como pendente de validação.
- [ ] Prioridade sugerida por regras determinísticas e toda alteração fica auditada.
- [ ] Conta desativada não autentica e preserva todo o histórico.
- [ ] O projeto sobe com um comando (Docker Compose) com dados de seed.
- [ ] Regras críticas de negócio e autorização cobertas por testes automatizados.

### Constraints Identified
- Uma única empresa fictícia; sem multi-tenant e sem SaaS.
- Stack definida: NestJS, React + Vite, PostgreSQL, Docker Compose.
- Autenticação própria; senhas com hash seguro (Argon2id ou bcrypt); contas criadas somente pelo administrador.
- Autorização verificada no backend em toda operação protegida.
- Arquivos validados por tipo real, extensão e tamanho; acesso sempre autorizado.
- Projeto de portfólio: foco em clareza de arquitetura, documentação e testes.

### Out of Scope (Confirmed)
- Notificações por e-mail, integração com Microsoft 365/AD, IA, distribuição automática, SLA, exportação PDF/Excel, BI, base de conhecimento, patrimônio avançado.
- Intervalo de datas personalizado nos relatórios.
- Painel de configurações gerais.
- Recuperação de senha self-service.
- WebSocket/tempo real e armazenamento de arquivos em nuvem no MVP.

### Open Items to Resolve in /define (from BRAINSTORM.md §17)
Nome do sistema e da empresa; formato do identificador do chamado; categorias; matriz de prioridade; transições de status permitidas; reabertura em dias corridos ou úteis e pedidos fora do prazo; status que permitem cancelamento; campos do cadastro de equipamentos e tratamento de Serial duplicado ou digitado errado; formatos, tamanho e quantidade de anexos e retenção; eventos de notificação e política de leitura; fluxo de primeiro acesso e redefinição de senha pelo administrador; cálculo do tempo médio de resolução; permissões por ação para técnico e administrador; ORM (Prisma ou TypeORM); autenticação por JWT em cookie httpOnly ou sessão.

---

## Session Summary

| Metric | Value |
|--------|-------|
| Questions Asked | 7 |
| Approaches Explored | 3 |
| Features Removed (YAGNI) | 3 |
| Validations Completed | 2 |
| Duration | ~1 sessão |

---

## Next Step

**Ready for:** `/define .claude/sdd/features/BRAINSTORM_HELP_DESK.md`
