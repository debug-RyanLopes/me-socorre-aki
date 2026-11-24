# BRAINSTORM --- Sistema Help Desk

**Tipo de projeto:** aplicação interna de Help Desk para uma empresa
fictícia\
**Finalidade:** projeto de portfólio\
**Status do documento:** brainstorm consolidado após revisão das
decisões\
**Data:** 24/11/2026

------------------------------------------------------------------------

## 1. Visão geral

O projeto consiste em um sistema web interno para centralizar as
solicitações de suporte técnico de uma empresa fictícia.

Funcionários poderão abrir chamados, acompanhar o atendimento e
conversar com a equipe de TI. Técnicos poderão organizar a fila, assumir
chamados, registrar atendimentos e documentar soluções. Administradores
poderão gerenciar usuários, setores, equipamentos e configurações, além
de consultar relatórios simples.

O objetivo é construir um projeto de portfólio funcional e tecnicamente
consistente, demonstrando conhecimentos de desenvolvimento backend,
modelagem relacional, autenticação, autorização, regras de negócio,
tratamento de arquivos, notificações e rastreabilidade.

### 1.1 Limites do contexto

-   O sistema atende **uma única empresa fictícia**.
-   Não é um produto SaaS e não terá múltiplas empresas ou organizações.
-   Não há necessidade de cobrança, planos, isolamento multi-tenant ou
    administração global de clientes.
-   O foco é simular um ambiente corporativo interno de suporte de TI.
-   As tecnologias e a arquitetura ainda não foram escolhidas neste
    brainstorm.

## 2. Objetivos do produto

1.  Centralizar as solicitações de suporte técnico.
2.  Permitir que funcionários abram e acompanhem seus próprios chamados.
3.  Organizar a fila de atendimento da equipe de TI.
4.  Registrar comunicação, decisões e alterações durante o atendimento.
5.  Relacionar chamados a equipamentos por número de série.
6.  Manter histórico confiável mesmo quando contas de funcionários forem
    desativadas.
7.  Fornecer indicadores operacionais simples para a equipe e a
    administração.

## 3. Perfis de acesso

O sistema terá três perfis principais.

### 3.1 Funcionário

Poderá:

-   Acessar o sistema com sua própria conta.
-   Abrir chamados.
-   Consultar somente os próprios chamados.
-   Consultar detalhes, comentários, anexos e histórico que estejam
    disponíveis ao solicitante.
-   Responder a perguntas feitas pela equipe de TI.
-   Adicionar comentários e anexos.
-   Confirmar que um chamado foi resolvido.
-   Solicitar reabertura dentro do prazo permitido.
-   Cancelar o próprio chamado, informando o motivo.
-   Consultar suas notificações.

Não poderá consultar chamados de outros funcionários.

### 3.2 Técnico de TI

Poderá:

-   Consultar a fila de chamados da equipe.
-   Visualizar chamados e seus dados necessários ao atendimento.
-   Assumir manualmente um chamado.
-   Trabalhar em chamados atribuídos a si ou atribuídos pelo
    administrador.
-   Alterar o status e a prioridade durante o atendimento.
-   Registrar comentários públicos.
-   Criar observações internas, visíveis somente à equipe de TI.
-   Adicionar anexos aos comentários, respeitando a visibilidade do
    comentário.
-   Registrar a solução.
-   Consultar o histórico do chamado.
-   Validar e cadastrar equipamentos, conforme as permissões definidas.

### 3.3 Administrador

Poderá:

-   Gerenciar usuários, perfis e setores.
-   Cadastrar, editar, desativar e reativar contas.
-   Iniciar procedimentos de redefinição de senha.
-   Gerenciar categorias e configurações do sistema.
-   Cadastrar e manter equipamentos.
-   Atribuir chamados a técnicos.
-   Consultar todos os chamados.
-   Consultar relatórios administrativos.
-   Consultar registros administrativos e históricos pertinentes.

As permissões exatas de cada ação deverão ser formalizadas na etapa de
especificação.

## 4. Autenticação e gerenciamento de contas

### 4.1 Autenticação

**Decisão aprovada:** autenticação própria por login e senha.

-   As contas serão cadastradas pela administração; não haverá cadastro
    público livre.
-   O sistema não dependerá de Microsoft 365, Active Directory ou outro
    provedor corporativo no MVP.
-   A integração com identidade corporativa poderá ser avaliada
    futuramente.
-   Senhas nunca deverão ser armazenadas em texto puro. Deverá ser
    utilizado um mecanismo apropriado de hash de senhas, como Argon2id
    ou bcrypt, conforme decisão técnica posterior.

### 4.2 Cadastro e manutenção de usuários

O administrador poderá cadastrar e editar funcionários, associá-los a
setores e definir seus perfis.

O fluxo de primeiro acesso com senha temporária e troca obrigatória de
senha foi sugerido como possibilidade, mas ainda não foi aprovado como
requisito definitivo.

### 4.3 Desativação de funcionários

**Decisão aprovada:** contas de funcionários desligados serão
desativadas, não excluídas permanentemente.

Ao desativar uma conta:

-   O usuário perde a capacidade de autenticar no sistema.
-   Seus chamados permanecem armazenados.
-   Comentários, anexos e demais registros permanecem preservados.
-   O histórico continua identificando o usuário original.
-   A desativação deve registrar quem realizou a ação e quando.
-   Uma conta poderá ser reativada por administrador autorizado.

Estados de conta previstos:

-   **Ativo:** pode acessar o sistema conforme suas permissões.
-   **Inativo:** não pode autenticar, mas seus registros históricos
    permanecem.

A redefinição de senha deverá ser disponibilizada por um procedimento
administrativo ou de recuperação seguro. O fluxo exato ainda será
detalhado.

## 5. Módulo de chamados

### 5.1 Abertura de chamados

O funcionário autenticado poderá abrir um chamado.

Os seguintes dados são obrigatórios para a abertura:

  ------------------------------------------------------------------------
  Dado                                   Obrigatório Regra
  --------------------- ---------------------------- ---------------------
  Nome do solicitante                            Sim Obtido da conta
                                                     autenticada

  E-mail do solicitante                          Sim Obtido da conta
                                                     autenticada

  Setor do solicitante                           Sim Obtido do cadastro do
                                                     usuário

  Descrição do problema                          Sim Informada pelo
                                                     funcionário

  Serial Number do                               Sim Pode ser de
  equipamento                                        equipamento ainda não
                                                     cadastrado
  ------------------------------------------------------------------------

Nome, e-mail e setor continuam sendo dados obrigatórios do chamado, mas
não precisam ser digitados novamente pelo funcionário: devem ser
preenchidos a partir da conta autenticada.

Outros campos discutidos:

  -----------------------------------------------------------------------
  Campo                               Situação no brainstorm
  ----------------------------------- -----------------------------------
  Título do chamado                   Proposto como opcional

  Categoria                           Proposta como opcional

  Anexos                              Opcionais

  Fabricante, modelo e tipo do        Dados do cadastro do equipamento,
  equipamento                         quando identificado

  Localização física                  Possível campo futuro ou opcional

  Prioridade                          Sugerida por regras com base nas
                                      respostas de impacto
  -----------------------------------------------------------------------

A lista final de categorias e os demais campos deverão ser refinados na
especificação.

### 5.2 Número de identificação

Foi sugerido que cada chamado tenha um identificador único e legível,
por exemplo `CH-000123`. O formato definitivo ainda não foi aprovado.

### 5.3 Visibilidade

**Decisão aprovada:**

-   Funcionários visualizam somente os próprios chamados.
-   Técnicos de TI autorizados visualizam a fila de chamados da equipe.
-   Administradores autorizados podem consultar todos os chamados.

A autorização deverá ser verificada no backend, não apenas escondendo
elementos da interface.

### 5.4 Atribuição de chamados

**Decisão aprovada: distribuição manual.**

-   Chamados entram na fila da equipe de TI.
-   Técnicos autorizados podem visualizar chamados disponíveis e assumir
    um atendimento.
-   O administrador poderá atribuir um chamado diretamente a um técnico.
-   O sistema deverá registrar responsável e momento da atribuição.
-   O sistema deverá deixar claro qual técnico é responsável pelo
    atendimento.

Distribuição automática entre técnicos não faz parte do MVP.

## 6. Status e ciclo de vida dos chamados

### 6.1 Status definidos

O usuário definiu os seguintes status operacionais:

  -----------------------------------------------------------------------
  Status                              Significado
  ----------------------------------- -----------------------------------
  **Aberto**                          Chamado recém-criado.

  **Aguardando iniciar**              Chamado recebido e disponível,
                                      aguardando o início do atendimento
                                      por um técnico.

  **Aguardando usuário**              A equipe de TI precisa que o
                                      funcionário responda uma dúvida ou
                                      forneça uma informação solicitada
                                      em comentário.

  **Resolvido**                       O técnico concluiu o atendimento e
                                      registrou a solução; aguarda
                                      confirmação do funcionário.

  **Cancelado**                       Chamado cancelado com justificativa
                                      registrada.

  **Fechado**                         Estado necessário após a
                                      confirmação da resolução pelo
                                      funcionário.
  -----------------------------------------------------------------------

O status **Fechado** não estava na lista inicial de cinco status, mas é
necessário para representar a regra aprovada de confirmação e o prazo de
reabertura após o fechamento.

### 6.2 Resolução e fechamento

**Decisão aprovada:**

1.  O técnico registra a solução e marca o chamado como **Resolvido**.
2.  O funcionário solicitante recebe uma notificação e pode confirmar a
    resolução.
3.  Após a confirmação, o chamado passa para **Fechado**.
4.  Se o problema persistir, o funcionário poderá solicitar a reabertura
    conforme as regras abaixo.

A confirmação do funcionário é necessária para o fechamento normal do
chamado.

### 6.3 Reabertura

**Decisão aprovada:**

-   O funcionário poderá reabrir um chamado fechado por até **3 dias
    após o fechamento**.
-   A reabertura exige um motivo.
-   O sistema registra a ação, o autor, a data e o motivo no histórico.
-   Após o prazo, o funcionário não poderá reabrir o chamado por esse
    mecanismo.
-   A proposta é que o chamado reaberto retorne ao status **Aberto** e
    volte à fila de atendimento.

Ainda deverá ser especificado como o prazo de três dias será contado
(dias corridos ou úteis) e qual será o tratamento administrativo de uma
solicitação fora do prazo.

### 6.4 Cancelamento

**Decisão aprovada:**

-   O funcionário poderá cancelar o próprio chamado.
-   A equipe de TI também poderá cancelar chamados, conforme as
    permissões definidas.
-   O cancelamento exige justificativa.
-   O status passa para **Cancelado**.
-   O sistema registra autor, data e motivo no histórico.

A regra exata sobre quais status permitem cancelamento deverá ser
formalizada na especificação.

## 7. Prioridade sugerida pelo sistema

**Decisão aprovada:** o sistema sugerirá uma prioridade com base no
impacto informado pelo funcionário, e o técnico poderá confirmar ou
alterar a classificação.

Não é necessário utilizar inteligência artificial para a primeira
versão. A sugestão poderá ser feita por regras de negócio
determinísticas.

### 7.1 Informações de impacto propostas

Durante a abertura, o funcionário poderá responder perguntas como:

1.  Quantas pessoas são afetadas?
    -   Apenas o próprio funcionário.
    -   Algumas pessoas.
    -   Um setor inteiro.
    -   Vários setores ou toda a empresa.
2.  O problema impede a continuidade do trabalho?
    -   Não, o trabalho continua normalmente.
    -   O trabalho continua com limitações.
    -   O funcionário está impossibilitado de trabalhar.
3.  Existe alternativa temporária?
    -   Sim.
    -   Não.
    -   Não sabe informar.

Essas perguntas são uma proposta inicial e poderão ser ajustadas.

### 7.2 Níveis de prioridade propostos

  -----------------------------------------------------------------------
  Prioridade                          Exemplo de critério
  ----------------------------------- -----------------------------------
  **Crítica**                         Vários setores ou toda a empresa
                                      afetados, com serviço essencial
                                      indisponível.

  **Alta**                            Trabalho impossibilitado ou impacto
                                      significativo em um grupo.

  **Média**                           Trabalho prejudicado, mas com
                                      alternativas disponíveis.

  **Baixa**                           Solicitação sem impacto relevante
                                      na operação.
  -----------------------------------------------------------------------

Os critérios definitivos e a matriz de decisão deverão ser especificados
e testados.

### 7.3 Confirmação e auditoria

-   O sistema registra a prioridade sugerida.
-   O técnico confirma ou altera a prioridade durante a triagem.
-   Se houver alteração, o sistema registra a prioridade anterior, a
    nova prioridade, o autor e o momento.
-   A justificativa para alteração deverá ser registrada.

## 8. Comunicação e histórico

### 8.1 Comentários públicos

Funcionário e equipe de TI poderão trocar comentários dentro do chamado.

Os comentários serão visíveis aos participantes autorizados do chamado,
conforme as regras de acesso.

### 8.2 Observações internas

Técnicos poderão registrar observações internas para comunicação da
equipe.

-   São visíveis somente à equipe de TI e aos administradores
    autorizados.
-   Não devem aparecer para o funcionário solicitante.
-   Anexos de observações internas devem herdar a mesma restrição de
    visibilidade.

### 8.3 Histórico automático

O sistema deverá manter um histórico de eventos importantes, separado
dos comentários escritos pelos usuários.

Exemplos:

-   Criação do chamado.
-   Alteração de status.
-   Atribuição ou mudança de técnico responsável.
-   Alteração de prioridade.
-   Registro de resolução.
-   Confirmação de fechamento.
-   Reabertura.
-   Cancelamento e justificativa.

Cada evento deverá registrar, conforme aplicável, o autor, a data e
hora, o tipo de ação e os dados relevantes da alteração.

## 9. Anexos

**Decisão aprovada:** anexos estarão disponíveis no MVP.

### 9.1 Locais de envio

-   Na abertura do chamado.
-   Nos comentários públicos.
-   Nas observações internas da equipe de TI.

Funcionários e técnicos poderão anexar arquivos nas interações em que
tiverem permissão.

### 9.2 Regras propostas

As seguintes regras foram sugeridas inicialmente, mas ainda são
parâmetros técnicos sujeitos a confirmação:

-   Formatos iniciais: PNG, JPG, JPEG e PDF.
-   Tamanho máximo inicial sugerido: 5 MB por arquivo.
-   Permitir múltiplos arquivos.
-   Armazenar os arquivos fora do banco de dados.
-   Armazenar no banco metadados e referências aos arquivos.
-   Validar extensão, tipo real do arquivo e tamanho.
-   Proteger o acesso aos arquivos de acordo com as permissões do
    chamado e a visibilidade do comentário.

A estratégia de armazenamento, os limites finais e a política de
retenção serão definidos no planejamento técnico.

## 10. Equipamentos e patrimônio

### 10.1 Cadastro de equipamentos

O sistema terá um cadastro básico de equipamentos para relacioná-los aos
chamados.

Dados propostos:

  Campo                          Situação
  ------------------------------ ---------------------------------
  Serial Number                  Obrigatório e único no cadastro
  Tipo de equipamento            Obrigatório na proposta inicial
  Fabricante                     Obrigatório na proposta inicial
  Modelo                         Obrigatório na proposta inicial
  Setor vinculado                Obrigatório na proposta inicial
  Responsável pelo equipamento   Opcional
  Data de aquisição              Opcional
  Número de patrimônio           Opcional
  Descrição adicional            Opcional

Os campos do cadastro deverão ser confirmados na especificação.

### 10.2 Serial obrigatório no chamado

**Decisão aprovada: o Serial Number é obrigatório em todo chamado, mas o
equipamento não precisa estar previamente cadastrado.**

Comportamento:

1.  O funcionário informa o Serial Number.
2.  O sistema consulta o cadastro de equipamentos.
3.  Se encontrar o equipamento, associa o chamado ao registro existente.
4.  Se não encontrar, permite a abertura normalmente.
5.  O chamado fica sinalizado como equipamento não identificado ou
    pendente de validação.
6.  A equipe de TI poderá validar o número e cadastrar o equipamento
    posteriormente.

O sistema não deve bloquear a abertura de um chamado apenas porque o
equipamento ainda não foi cadastrado.

Quando um Serial já estiver cadastrado, a interface deverá apresentar os
dados encontrados para reduzir o risco de associação incorreta.

### 10.3 Histórico por equipamento

A relação entre chamados e equipamentos permitirá consultar:

-   Chamados anteriores de um equipamento.
-   Quantidade de chamados associados.
-   Problemas recorrentes.
-   Equipamentos com maior volume de solicitações.

Um controle avançado de patrimônio e manutenção fica fora do escopo
inicial.

## 11. Notificações internas

**Decisão aprovada:** o MVP terá uma caixa de notificações dentro do
sistema, acessada por um ícone de sino no cabeçalho.

### 11.1 Funcionalidades

-   Exibir notificações em uma caixa ou popover.
-   Mostrar contador de notificações não lidas.
-   Permitir marcar notificações como lidas.
-   Direcionar o usuário ao chamado relacionado ao clicar em uma
    notificação.
-   Persistir as notificações no banco de dados para que continuem
    disponíveis em acessos futuros.

### 11.2 Eventos que poderão gerar notificações

Proposta inicial:

  -----------------------------------------------------------------------
  Evento                              Destinatário
  ----------------------------------- -----------------------------------
  Técnico respondeu ao chamado        Funcionário solicitante

  Status do chamado foi alterado      Funcionário solicitante

  Chamado foi marcado como resolvido  Funcionário solicitante

  Funcionário adicionou comentário    Técnico responsável ou equipe
                                      pertinente

  Novo chamado foi aberto             Equipe de TI

  Chamado foi atribuído               Técnico responsável
  -----------------------------------------------------------------------

As notificações devem respeitar as permissões de acesso e não revelar
dados de chamados não autorizados.

Notificações por e-mail ficam para uma versão futura.

## 12. Painel da equipe de TI

O painel deverá apoiar a operação diária da equipe.

Funcionalidades propostas:

-   Visão geral dos chamados por status.
-   Fila geral de chamados.
-   Identificação de chamados ainda sem técnico responsável.
-   Visualização de chamados atribuídos ao técnico atual.
-   Filtros por status, prioridade, setor, técnico e período.
-   Abertura dos detalhes do chamado.
-   Ações para assumir ou atribuir chamados.
-   Alteração de status e prioridade conforme as permissões.
-   Comentários, observações internas e anexos.
-   Consulta do histórico.

A fila geral não significa que todos os técnicos sejam responsáveis
simultaneamente por todos os chamados. O sistema deve identificar
claramente o técnico responsável após a atribuição ou o aceite.

## 13. Painel administrativo

Áreas previstas:

### 13.1 Usuários e permissões

-   Cadastro e edição de usuários.
-   Definição de perfil.
-   Associação a setores.
-   Desativação e reativação.
-   Procedimento de redefinição de senha.

### 13.2 Setores

-   Cadastro e edição de setores.
-   Associação dos funcionários aos setores.

Exemplos fictícios: Financeiro, RH, Comercial, Operações e TI.

### 13.3 Categorias

-   Cadastro e manutenção de categorias de chamados.
-   Possibilidade de organizar tipos de problema, como hardware,
    software, rede, acesso, impressoras e periféricos.

A lista definitiva de categorias ainda será definida.

### 13.4 Equipamentos

-   Cadastro e edição de equipamentos.
-   Consulta por Serial Number.
-   Validação de equipamentos informados em chamados ainda não
    cadastrados.

### 13.5 Configurações

-   Configurações gerais necessárias à operação.
-   Parâmetros de prioridades e regras de atendimento, conforme forem
    definidos.

## 14. Relatórios simples

**Decisão aprovada: opção A --- relatórios simples.**

O MVP não terá uma plataforma de BI nem relatórios avançados.

Indicadores propostos:

-   Total de chamados.
-   Chamados por status.
-   Chamados por setor.
-   Chamados por categoria.
-   Chamados por técnico.
-   Tempo médio de resolução.
-   Equipamentos com maior quantidade de chamados.

### 14.1 Apresentação e filtros

-   Números e contadores.
-   Tabelas simples.
-   Filtro por período.
-   Períodos rápidos sugeridos: hoje, últimos 7 dias e últimos 30 dias.
-   Possibilidade de intervalo personalizado, se mantida no escopo da
    especificação.

Gráficos elaborados e exportação PDF/Excel não fazem parte do MVP.

### 14.2 Tempo de resolução

O sistema deverá registrar automaticamente data e hora de abertura e de
resolução.

A proposta inicial é medir o tempo total entre a abertura original e a
resolução mais recente, considerando reaberturas. A definição final do
cálculo deverá ser documentada na especificação para evitar
interpretações diferentes.

## 15. Escopo consolidado do MVP

A lista abaixo consolida as funcionalidades aprovadas para a primeira
versão, respeitando as regras e ressalvas deste documento.

### 15.1 Funcionalidades do MVP

-   [ ] Autenticação própria por login e senha.
-   [ ] Contas cadastradas pela administração.
-   [ ] Perfis de funcionário, técnico e administrador.
-   [ ] Controle de permissões no backend.
-   [ ] Cadastro, edição, desativação e reativação de usuários.
-   [ ] Cadastro e gerenciamento de setores.
-   [ ] Abertura e acompanhamento de chamados.
-   [ ] Nome, e-mail e setor obtidos da conta autenticada.
-   [ ] Descrição do problema obrigatória.
-   [ ] Serial Number obrigatório, mesmo quando ainda não cadastrado.
-   [ ] Identificador único de chamado.
-   [ ] Visibilidade restrita dos chamados para funcionários.
-   [ ] Fila geral para a equipe de TI.
-   [ ] Atribuição manual de chamados.
-   [ ] Prioridade sugerida por regras de impacto.
-   [ ] Confirmação ou alteração da prioridade por técnico.
-   [ ] Status e regras de transição definidos.
-   [ ] Confirmação do funcionário antes do fechamento.
-   [ ] Reabertura em até três dias após o fechamento, com motivo.
-   [ ] Cancelamento com motivo e registro no histórico.
-   [ ] Comentários públicos.
-   [ ] Observações internas.
-   [ ] Histórico automático de alterações.
-   [ ] Anexos na abertura e nos comentários, incluindo observações
    internas.
-   [ ] Caixa de notificações interna.
-   [ ] Cadastro básico de equipamentos.
-   [ ] Validação de Serial e sinalização de equipamento não cadastrado.
-   [ ] Painel operacional da equipe de TI.
-   [ ] Painel administrativo.
-   [ ] Relatórios simples com contadores, tabelas e filtros por
    período.

### 15.2 Itens para versões futuras

-   Notificações por e-mail.
-   Integração com Microsoft 365 ou Active Directory.
-   Classificação de chamados por inteligência artificial.
-   Sugestões de solução por IA.
-   Distribuição automática de chamados.
-   SLA, alertas e regras avançadas de prazo.
-   Controle avançado de patrimônio e manutenção.
-   Exportação de relatórios para PDF e Excel.
-   Indicadores e análises avançadas.
-   Base de conhecimento.

## 16. Segurança e considerações técnicas

Os itens abaixo são diretrizes e preocupações técnicas para orientar o
planejamento; não representam escolhas definitivas de stack ou
arquitetura.

### 16.1 Autenticação e autorização

-   Armazenar senhas somente como hashes seguros.
-   Validar permissões no servidor em todas as operações protegidas.
-   Garantir que funcionários não consigam consultar chamados de
    terceiros alterando IDs ou URLs.
-   Restringir observações internas e seus anexos à equipe autorizada.
-   Impedir autenticação de contas inativas.

### 16.2 Integridade e histórico

-   Preservar usuários históricos por desativação, não exclusão.
-   Registrar eventos relevantes com autor e data/hora.
-   Garantir unicidade do Serial Number no cadastro de equipamentos.
-   Definir regras consistentes para transições de status.
-   Evitar que alterações de dados apaguem a rastreabilidade.

### 16.3 Arquivos

-   Validar tipo, extensão e tamanho dos arquivos.
-   Não confiar apenas no nome ou na extensão enviados pelo cliente.
-   Proteger arquivos contra acesso público indevido.
-   Aplicar autorização também ao download.
-   Avaliar nomes internos não previsíveis e armazenamento fora da pasta
    pública.

### 16.4 Dados e operação

-   Definir política de backup.
-   Tratar erros de forma consistente.
-   Validar dados no backend.
-   Evitar duplicidade e inconsistência de registros.
-   Considerar paginação e filtros nas listagens.
-   Registrar datas e horários de maneira consistente.

## 17. Decisões ainda pendentes para a especificação

O brainstorm consolidou as decisões de produto, mas alguns detalhes
deverão ser decididos antes ou durante a etapa de especificação:

1.  Nome definitivo do sistema e da empresa fictícia.
2.  Stack, banco de dados, bibliotecas e infraestrutura.
3.  Formato definitivo do identificador dos chamados.
4.  Lista final de categorias e subcategorias.
5.  Matriz detalhada de perguntas e regras para sugerir prioridade.
6.  Se a prioridade poderá ser alterada em qualquer etapa ou somente em
    etapas específicas.
7.  Quais transições entre status serão permitidas.
8.  Se dias para reabertura serão corridos ou úteis e como será aplicado
    o limite de três dias.
9.  Tratamento de pedidos de reabertura fora do prazo.
10. Em quais status o cancelamento será permitido.
11. Campos definitivos do cadastro de equipamentos.
12. Como tratar um Serial desconhecido duplicado ou digitado
    incorretamente.
13. Formatos, limites de tamanho e quantidade de anexos.
14. Estratégia de armazenamento e retenção dos arquivos.
15. Eventos definitivos que geram notificações e política de leitura.
16. Fluxo de primeiro acesso e redefinição de senha.
17. Definição precisa do cálculo do tempo médio de resolução.
18. Quais filtros de período estarão disponíveis no primeiro lançamento.
19. Permissões específicas para técnicos e administradores em cada ação.

Esses pontos não devem ser tratados como decisões já aprovadas.
Recomendações técnicas poderão ser apresentadas durante a especificação,
distinguindo claramente o que foi decidido pelo responsável pelo
projeto.

## 18. Preparação para o SpecKit

Este documento registra a visão e as decisões do brainstorm. Ele não
substitui os documentos formais do SpecKit.

Quando o brainstorm estiver encerrado e os pontos pendentes relevantes
forem resolvidos, o projeto poderá seguir o fluxo acordado:

1.  **Constitution:** princípios e regras que orientarão o
    desenvolvimento.
2.  **Specify:** problema, usuários, necessidades, requisitos funcionais
    e critérios de aceitação.
3.  **Plan:** tecnologias, arquitetura, estrutura, integrações e
    estratégia de implementação.
4.  **Tasks:** tarefas técnicas pequenas, ordenadas, verificáveis e
    relacionadas aos requisitos.

Os documentos deverão permanecer consistentes entre si: as tarefas
implementam o plano, o plano atende à especificação e a Constitution
estabelece os princípios do projeto.

------------------------------------------------------------------------

## 19. Resumo das decisões aprovadas

-   Projeto interno para uma única empresa fictícia, com finalidade de
    portfólio.
-   Autenticação por login e senha próprios.
-   Três perfis: funcionário, técnico de TI e administrador.
-   Funcionário visualiza somente os próprios chamados.
-   Distribuição manual dos chamados.
-   Comentários públicos, observações internas e histórico automático.
-   Funcionário confirma a resolução antes do fechamento.
-   Status operacionais: Aberto, Aguardando iniciar, Aguardando usuário,
    Resolvido e Cancelado; Fechado é necessário para representar a
    confirmação e a janela de reabertura.
-   Reabertura pelo funcionário em até três dias após o fechamento, com
    motivo.
-   Cancelamento com motivo e registro no histórico.
-   Contas de funcionários desligados são desativadas, preservando
    registros.
-   Relatórios simples, com números, tabelas e filtros por período.
-   Prioridade sugerida por regras com base no impacto e confirmada ou
    alterada por técnico.
-   Notificações em uma caixa interna do sistema; e-mail fica para o
    futuro.
-   Anexos na abertura e nos comentários, inclusive observações
    internas.
-   Serial Number obrigatório em todo chamado.
-   Serial não precisa estar previamente cadastrado; chamados com
    equipamento desconhecido podem ser abertos e ficam pendentes de
    validação pela TI.

**Fim do documento.**
