# Me Socorre Aki

Sistema web interno de Help Desk para uma empresa fictícia. Funcionários abrem chamados e conversam com a TI; técnicos organizam a fila, atendem e documentam soluções; administradores gerenciam usuários, setores, categorias, equipamentos e consultam relatórios simples.

Projeto de portfólio, focado em backend: autenticação, autorização por perfil no servidor, modelagem relacional, regras de negócio com máquina de estados, anexos seguros, notificações e histórico auditável.

## Stack

| Camada | Tecnologia |
|--------|------------|
| API | NestJS 11, TypeScript, class-validator, Swagger |
| Banco | PostgreSQL 16, Prisma 6 (migrações versionadas) |
| Front-end | React 19, Vite, React Router, TanStack Query, react-hook-form + zod |
| Execução | Docker Compose (db, backend, frontend com nginx) |
| Testes | Jest + Supertest (API com PostgreSQL real), Vitest + Testing Library |

## Executar com um comando

Requisitos: Docker com Docker Compose.

```bash
cp .env.example .env
# edite POSTGRES_PASSWORD e SEED_PASSWORD
docker compose up --build
```

Abra http://localhost:8080 (porta configurável em `WEB_PORT`). Na primeira partida, o backend aplica as migrações e, com `SEED_ON_START=true` e o banco vazio, cria dados fictícios: 5 setores, 15 usuários, 40 equipamentos e 500 chamados em todos os status.

A documentação interativa da API fica em http://localhost:8080/api/docs.

### Usuários de demonstração

Todos usam a senha definida em `SEED_PASSWORD`. Use apenas na demonstração.

| Login | Perfil | Observação |
|-------|--------|------------|
| `helena` | Administrador | Gerencia tudo e vê relatórios |
| `marcos`, `julia` | Técnico de TI | Atendem a fila |
| `paula`, `carlos`, `renata`, `diego` e outros | Funcionário | Abrem e acompanham os próprios chamados |
| `renato` | Funcionário | Conta desativada (não consegue entrar) |

Contas criadas pelo administrador exigem troca de senha no primeiro acesso.

## Desenvolvimento sem Docker

Requisitos: Node.js 22 ou superior e um PostgreSQL acessível.

```bash
cd backend
cp .env.example .env            # ajuste DATABASE_URL
npm install
npx prisma migrate deploy
npm run seed                    # opcional, exige SEED_PASSWORD
node --env-file=.env -r ts-node/register src/main.ts

cd ../frontend
npm install
npm run dev                     # http://localhost:5173, proxy de /api para localhost:3000
```

## Testes

```bash
cd backend
npm test            # unitários (Jest)
npm run test:e2e    # integração da API com PostgreSQL real
npm run lint        # verificação de tipos

cd ../frontend
npm test            # componentes e regras de tela (Vitest)
```

Os testes de integração sobem um PostgreSQL embutido (`embedded-postgres`) numa porta local (`TEST_DB_PORT`, padrão 15432). Para usar um banco já existente, defina `TEST_DATABASE_URL` (é o que a CI faz).

Cobertura dos 15 testes de aceitação do DEFINE: AT-001 a AT-015 estão em `backend/test/*.e2e-spec.ts` e nos testes unitários (mapeamento em `.claude/sdd/archive/HELP_DESK/BUILD_REPORT_HELP_DESK.md`).

## Decisões de arquitetura

- **Monólito modular**: um módulo por domínio, sem dependência circular. A regra de visibilidade fica em um único lugar (`access/ticket-access.policy.ts`).
- **Sessão no servidor**: cookie `httpOnly` com token opaco (só o hash fica no banco). Desativar conta ou redefinir senha encerra as sessões na hora. Mutações exigem o cabeçalho `X-Requested-With`.
- **Máquina de estados**: todas as transições em `tickets/ticket-state-machine.ts`, com concorrência otimista e histórico gravado na mesma transação.
- **Histórico separado dos comentários**: `ticket_events` é somente inserção; observações internas (`INTERNAL`) nunca chegam ao funcionário, nem seus anexos.
- **Prioridade sugerida por pontuação** editável na tela "Prioridades"; o técnico confirma ou altera com justificativa auditada.
- **Anexos**: PNG, JPG e PDF até 5 MB (5 por envio), validados pela assinatura binária e gravados fora de qualquer pasta pública; o download passa pela política de acesso.
- **Serial obrigatório, equipamento opcional**: chamado com serial desconhecido abre normalmente; ao cadastrar o equipamento, os chamados abertos com aquele serial são vinculados.
- **Datas em UTC**; reabertura em até 72 horas corridas após o fechamento; relatórios no fuso `APP_TIMEZONE`.

## Backup

Dois volumes guardam o estado e devem entrar juntos na rotina de backup:

- `pgdata`: banco PostgreSQL (`docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`).
- `uploads`: anexos dos chamados (`/data/uploads` no container do backend).

Restaure os dois do mesmo momento, pois o banco referencia os arquivos.

## Roteiro de verificação manual (E2E)

1. Entre como `paula`, abra um chamado com serial `NB-10000` (cadastrado) e outro com `XX-1` (desconhecido).
2. Entre como `marcos`: assuma o primeiro, faça a triagem, peça informações e depois registre a solução.
3. Volte como `paula`: responda à pergunta, confirme a resolução e tente reabrir o chamado fechado.
4. Como `helena`: cadastre um usuário (a senha temporária aparece uma vez), desative-o, cadastre o equipamento `XX-1` (o chamado pendente é vinculado) e abra os relatórios.

## Estrutura

```text
backend/    API NestJS (src/), esquema e migrações Prisma (prisma/), testes de integração (test/)
frontend/   SPA React (src/), configuração do Vite e do nginx
docker-compose.yml, .env.example
.claude/sdd/   documentos do fluxo SDD (arquivados em `archive/HELP_DESK/`)
```

## Fora do escopo do MVP

E-mail, SSO (Microsoft 365/Active Directory), IA, distribuição automática, SLA, exportação PDF/Excel, base de conhecimento, intervalo de datas personalizado nos relatórios, painel de configurações gerais e recuperação de senha self-service (a redefinição é feita pelo administrador).
