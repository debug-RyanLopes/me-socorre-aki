# DEFINE: Me Socorre Aki (Sistema Help Desk)

> Sistema web interno que centraliza, organiza e rastreia as solicitações de suporte de TI de uma empresa fictícia, como projeto de portfólio de backend.

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | HELP_DESK |
| **Date** | 2026-11-24 |
| **Author** | define-agent |
| **Status** | ✅ Shipped |
| **Clarity Score** | 14/15 |

---

## Problem Statement

Na empresa fictícia, funcionários não têm um canal único para abrir e acompanhar solicitações de suporte de TI, e a equipe de TI não tem fila, responsáveis, histórico nem indicadores confiáveis do atendimento. O projeto também precisa demonstrar, como portfólio, domínio de backend, modelagem relacional, autenticação, autorização e rastreabilidade.

---

## Target Users

| User | Role | Pain Point |
|------|------|------------|
| Funcionário | Solicitante de suporte | Não sabe o status do chamado nem consegue conversar com a TI em um só lugar |
| Técnico de TI | Atendente | Falta fila organizada, definição de responsável e registro de comunicação e solução |
| Administrador | Gestor do sistema e da TI | Falta gerir usuários, setores, equipamentos e ter visão de indicadores |
| Avaliador do portfólio | Recrutador ou revisor técnico | Precisa ver o sistema rodando facilmente e avaliar qualidade de backend, regras e testes |

---

## Goals

| Priority | Goal |
|----------|------|
| **MUST** | Autenticação própria por login e senha, com contas criadas somente pelo administrador e senhas com hash seguro |
| **MUST** | Três perfis (funcionário, técnico, administrador) com autorização verificada no backend |
| **MUST** | Abrir e acompanhar chamados com nome, e-mail e setor da conta, descrição e Serial Number obrigatórios (equipamento pode não estar cadastrado) |
| **MUST** | Ciclo de vida com status Aberto, Aguardando iniciar, Aguardando usuário, Resolvido, Fechado e Cancelado, incluindo confirmação do funcionário, reabertura em até 3 dias com motivo e cancelamento com justificativa |
| **MUST** | Fila geral para a TI, atribuição manual (técnico assume ou administrador atribui) e prioridade sugerida por regras de impacto, confirmada ou alterada por técnico com auditoria |
| **MUST** | Comentários públicos, observações internas (invisíveis ao funcionário) e histórico automático de eventos com autor e data/hora |
| **MUST** | Anexos na abertura e nos comentários, com validação e download autorizado conforme a visibilidade |
| **MUST** | Cadastro de equipamentos por Serial Number único, com validação posterior de seriais desconhecidos |
| **MUST** | Desativação e reativação de usuários preservando todo o histórico |
| **MUST** | Caixa de notificações interna (sino) persistida no banco, com contador de não lidas |
| **MUST** | Projeto executável com um comando (Docker Compose) e dados de seed fictícios |
| **SHOULD** | Painel operacional da TI com filtros por status, prioridade, setor, técnico e período |
| **SHOULD** | Painel administrativo (usuários, setores, categorias, equipamentos) e tela de regras de prioridade editáveis |
| **SHOULD** | Relatórios simples (total, por status, setor, categoria e técnico, tempo médio de resolução, equipamentos com mais chamados) com períodos rápidos: hoje, 7 e 30 dias |
| **SHOULD** | Testes automatizados das regras críticas de negócio e de autorização, e README com decisões |
| **COULD** | Deploy online gratuito para demonstração |

---

## Success Criteria

Measurable outcomes (must include numbers):

- [ ] 100% dos endpoints protegidos exigem autenticação e papel válido, comprovado por testes de autorização (0 acessos indevidos nos testes).
- [ ] 0 casos em que um funcionário acessa chamado de outro por troca de ID ou URL, e 0 casos em que observações internas ou seus anexos chegam ao funcionário (testes automatizados).
- [ ] 100% das mudanças de status, atribuição, prioridade, reabertura e cancelamento geram evento de histórico com autor, data/hora e dados relevantes.
- [ ] Reabertura aceita em até 3 dias após o fechamento e rejeitada após esse prazo, com testes nos limites (dia 3 e dia 4).
- [ ] Chamado com Serial não cadastrado é criado em 100% dos casos e fica sinalizado como pendente de validação.
- [ ] Anexos fora das regras (formato não permitido, acima de 5 MB, tipo real divergente da extensão) são rejeitados em 100% dos casos de teste.
- [ ] Listagens de chamados são paginadas e respondem em menos de 500 ms com o seed de demonstração (cerca de 500 chamados).
- [ ] O sistema sobe do zero com 1 comando (`docker compose up`) e o seed cria dados dos 3 perfis.
- [ ] Cobertura de testes automatizados de pelo menos 70% nos módulos de chamados, autenticação e autorização.

---

## Acceptance Tests

| ID | Scenario | Given | When | Then |
|----|----------|-------|------|------|
| AT-001 | Abertura de chamado (caminho feliz) | Funcionário autenticado com setor definido | Informa descrição, Serial cadastrado e respostas de impacto | Chamado criado com nome, e-mail e setor da conta, equipamento associado, prioridade sugerida, evento de criação e notificação à TI |
| AT-002 | Serial desconhecido | Funcionário autenticado | Abre chamado com Serial inexistente no cadastro | Chamado é criado e sinalizado como equipamento pendente de validação |
| AT-003 | Isolamento de funcionário | Funcionários A e B, com chamado do B | A requisita o chamado do B por ID | Resposta 403 ou 404 e nenhum dado do chamado é exposto |
| AT-004 | Observação interna | Técnico registra observação interna com anexo | O funcionário solicitante consulta o chamado e baixa o anexo | A observação não aparece e o download do anexo é negado |
| AT-005 | Assumir chamado | Chamado sem responsável na fila | Técnico assume o chamado | Responsável e momento da atribuição registrados, status atualizado, evento no histórico |
| AT-006 | Resolver e fechar | Chamado em atendimento | Técnico registra solução e marca Resolvido, e o funcionário confirma | Funcionário notificado, status vai para Fechado e o fechamento é registrado |
| AT-007 | Reabertura no prazo | Chamado fechado há 2 dias | Funcionário solicita reabertura com motivo | Status volta a Aberto, retorna à fila e o histórico registra autor, data e motivo |
| AT-008 | Reabertura fora do prazo | Chamado fechado há mais de 3 dias | Funcionário solicita reabertura | Pedido rejeitado com mensagem de prazo expirado e sem alteração de status |
| AT-009 | Reabertura sem motivo | Chamado fechado dentro do prazo | Funcionário solicita reabertura sem motivo | Pedido rejeitado por validação |
| AT-010 | Cancelamento | Chamado em status que permite cancelamento | Funcionário cancela com justificativa | Status Cancelado, justificativa, autor e data registrados |
| AT-011 | Alteração de prioridade | Chamado com prioridade sugerida Média | Técnico altera para Alta com justificativa | Prioridade anterior, nova, autor, momento e justificativa registrados |
| AT-012 | Conta desativada | Funcionário com chamados e comentários | Administrador desativa a conta | Login passa a ser negado e os registros históricos continuam identificando o usuário |
| AT-013 | Anexo inválido | Funcionário em um chamado | Envia arquivo .exe renomeado para .png | Upload rejeitado pela validação do tipo real |
| AT-014 | Serial duplicado no cadastro | Equipamento com Serial X já cadastrado | Administrador cadastra outro equipamento com Serial X | Operação rejeitada por unicidade |
| AT-015 | Notificações | Técnico responde a um chamado | Funcionário abre o sino | Contador de não lidas aumenta, o clique leva ao chamado e a notificação é marcada como lida |

---

## Out of Scope

Explicitly NOT included in this feature:

- Notificações por e-mail.
- Integração com Microsoft 365, Active Directory ou outro provedor de identidade.
- Classificação de chamados e sugestão de soluções por IA.
- Distribuição automática de chamados.
- SLA, alertas e regras avançadas de prazo.
- Controle avançado de patrimônio e manutenção.
- Exportação de relatórios para PDF ou Excel, gráficos elaborados e BI.
- Base de conhecimento.
- Intervalo de datas personalizado nos relatórios.
- Painel de configurações gerais.
- Recuperação de senha self-service (somente redefinição pelo administrador).
- Multi-tenant, cobrança e administração de várias empresas.
- Notificações em tempo real (WebSocket) e armazenamento de arquivos em nuvem no MVP.

---

## Constraints

| Type | Constraint | Impact |
|------|------------|--------|
| Technical | Stack definida: NestJS, React + Vite (SPA separada), PostgreSQL, Docker Compose | Projeto em monorepo com `backend/` e `frontend/`; API REST |
| Technical | Autorização obrigatoriamente no backend, não só na interface | Guards e verificação de propriedade em toda rota protegida |
| Technical | Senhas somente com hash seguro (Argon2id ou bcrypt) | Sem armazenamento em texto puro |
| Technical | Anexos em disco local fora da pasta pública, com download via endpoint autorizado | Metadados no banco e nomes internos não previsíveis |
| Resource | Projeto individual de portfólio, sem orçamento de infraestrutura | Sem serviços pagos; deploy gratuito apenas opcional |
| Scope | Uma única empresa fictícia | Sem isolamento multi-tenant |

---

## Technical Context

> Essential context for Design phase - prevents misplaced files and missed infrastructure needs.

| Aspect | Value | Notes |
|--------|-------|-------|
| **Deployment Location** | Monorepo na raiz: `backend/` (NestJS), `frontend/` (React + Vite), `docker-compose.yml` | Projeto greenfield, sem estrutura prévia |
| **KB Domains** | Nenhum aplicável (as KBs do plugin cobrem engenharia de dados) | Design deve usar a documentação oficial de NestJS, ORM escolhido, React e PostgreSQL |
| **IaC Impact** | New resources (somente Docker Compose local: Postgres, backend e frontend) | Deploy online opcional, fora do MVP |

**Why This Matters:**

- **Location** → Design phase uses correct project structure, prevents misplaced files
- **KB Domains** → Sem KB aplicável, o Design precisa registrar suas fontes de documentação
- **IaC Impact** → Docker Compose deve garantir execução reprodutível

---

## Assumptions

Assumptions that if wrong could invalidate the design:

| ID | Assumption | If Wrong, Impact | Validated? |
|----|------------|------------------|------------|
| A-001 | O prazo de reabertura de 3 dias é contado em dias corridos a partir do momento do fechamento | Com dias úteis, a regra e os testes de limite mudam | [ ] |
| A-002 | Pedidos de reabertura fora do prazo são simplesmente rejeitados; o usuário abre um novo chamado | Seria preciso um fluxo de exceção para o administrador | [ ] |
| A-003 | Cancelamento é permitido enquanto o chamado não está Resolvido, Fechado ou Cancelado | Outras regras alteram a máquina de estados | [ ] |
| A-004 | Fluxo de status: Aberto → Aguardando iniciar → (Aguardando usuário ↔ em atendimento) → Resolvido → Fechado; reabertura volta a Aberto | A matriz de transições do Design muda | [ ] |
| A-005 | Prioridade pode ser alterada pelo técnico enquanto o chamado não está Fechado ou Cancelado, sempre com justificativa | Mudança nas regras de auditoria | [ ] |
| A-006 | O tempo médio de resolução mede da abertura original até a resolução mais recente, incluindo reaberturas | Os relatórios exibiriam números diferentes | [ ] |
| A-007 | Anexos: PNG, JPG, JPEG e PDF, até 5 MB por arquivo, até 5 arquivos por envio | Limites técnicos e validações mudam | [ ] |
| A-008 | O identificador do chamado segue o formato `CH-000123` (sequencial) | Impacta geração de chave e exibição | [ ] |
| A-009 | Primeiro acesso: o administrador cria a conta com senha temporária e a troca é obrigatória no primeiro login | Altera o fluxo de autenticação e o cadastro | [ ] |
| A-010 | Um Serial desconhecido duplicado ou digitado errado é tratado pela TI na validação, com a possibilidade de corrigir o Serial do chamado e vincular ao equipamento | Exigiria deduplicação automática | [ ] |
| A-011 | O volume do projeto é pequeno (dezenas de usuários e cerca de 500 chamados no seed), sem necessidade de cache ou filas | Exigiria otimização e infraestrutura adicionais | [ ] |
| A-012 | A SPA e a API usam autenticação por sessão ou JWT em cookie httpOnly, decisão final no Design | Impacta CORS, CSRF e fluxo de login | [ ] |
| A-013 | Campos obrigatórios do equipamento: Serial, tipo, fabricante, modelo e setor; os demais são opcionais | Altera o esquema e a validação de cadastro | [ ] |
| A-014 | O técnico acessa a fila completa; o administrador tem todas as permissões do técnico mais gestão de cadastros | A matriz de permissões do Design muda | [ ] |

**Note:** Várias suposições resolvem pendências da seção 17 do BRAINSTORM com padrões razoáveis. Elas devem ser validadas antes do DESIGN, senão viram riscos.

---

## Clarity Score Breakdown

| Element | Score (0-3) | Notes |
|---------|-------------|-------|
| Problem | 3 | Problema, impacto e finalidade de portfólio claros |
| Users | 3 | Quatro personas com dores identificadas |
| Goals | 3 | Metas priorizadas por MoSCoW e derivadas de decisões aprovadas |
| Success | 2 | Critérios mensuráveis, mas metas numéricas (500 ms, 70%) são propostas, não confirmadas pelo responsável |
| Scope | 3 | Dentro e fora do escopo explícitos, com remoções YAGNI documentadas |
| **Total** | **14/15** | |

**Scoring Guide:**
- 0 = Missing entirely
- 1 = Vague or incomplete
- 2 = Clear but missing details
- 3 = Crystal clear, actionable

**Minimum to proceed: 12/15**

---

## Open Questions

Nenhuma bloqueia o Design. Itens a confirmar com o responsável (cobertos por suposições):

1. Nome da empresa fictícia (o nome do sistema está definido: "Me Socorre Aki").
2. Lista final de categorias (sugestão inicial: hardware, software, rede, acesso, impressoras e periféricos).
3. Matriz de perguntas e regras da prioridade sugerida (será definida no Design e validada com testes).
4. Confirmação das suposições A-001 a A-014.
5. Escolha do ORM (Prisma ou TypeORM) e do mecanismo de autenticação (sessão ou JWT em cookie), a decidir no Design.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-24 | define-agent | Initial version, derivada de BRAINSTORM_HELP_DESK.md e BRAINSTORM.md |
| 1.1 | 2026-11-24 | iterate | Nome do sistema definido como "Me Socorre Aki"; pendência de nome reduzida à empresa fictícia |
| 1.2 | 2026-11-24 | ship-agent | Shipped and archived |

---

## Next Step

**Ready for:** `/ship .claude/sdd/features/DEFINE_HELP_DESK.md`
