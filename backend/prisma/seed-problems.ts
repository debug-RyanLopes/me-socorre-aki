export interface DemoProblem {
  title: string;
  category: string;
  affected: string[];
  descriptions: string[];
  solution: string;
  question: string;
  internalNote: string;
}

export const PROBLEMS: DemoProblem[] = [
  {
    title: 'Sem acesso ao sistema financeiro',
    category: 'Acesso',
    affected: ['SELF', 'SELF', 'FEW'],
    descriptions: [
      'Desde hoje cedo, ao tentar entrar no sistema financeiro, aparece a mensagem "usuário sem permissão". Ontem funcionava normalmente. Preciso lançar as notas fiscais do mês até o fim do dia.',
      'Meu login no sistema financeiro foi bloqueado depois que troquei a senha do computador. Já tentei a senha antiga e a nova, e as duas dão erro. Estou com pagamentos de fornecedores parados.',
      'O sistema financeiro abre, mas o módulo de contas a pagar não aparece mais no menu. Acho que alguma permissão foi removida. Outros colegas do setor continuam acessando.',
    ],
    solution: 'O perfil do usuário tinha perdido o grupo de acesso ao financeiro após a troca de senha. O grupo foi restaurado e o acesso testado junto com o solicitante.',
    question: 'Você consegue me enviar um print da mensagem de erro que aparece ao entrar?',
    internalNote: 'Verificar no AD se o grupo FIN-USUARIOS foi removido pela rotina de sincronização.',
  },
  {
    title: 'Impressora não imprime',
    category: 'Impressoras e periféricos',
    affected: ['FEW', 'SECTOR', 'SECTOR'],
    descriptions: [
      'A impressora do corredor mostra "pronta" no painel, mas os documentos ficam parados na fila de impressão. Já desliguei e liguei de novo e não resolveu. Ninguém do setor consegue imprimir.',
      'A impressora está puxando o papel e travando no meio. Aparece "atolamento na bandeja 2", mas não há nenhum papel preso que eu consiga ver.',
      'Ao imprimir, sai uma página em branco e depois a impressora para. Preciso imprimir contratos para assinatura ainda hoje.',
    ],
    solution: 'A fila de impressão no servidor estava travada por um documento corrompido. O documento foi removido, o spooler reiniciado e a impressão testada com o setor.',
    question: 'Qual é o número de patrimônio que aparece na etiqueta da impressora?',
    internalNote: 'Toner com 8%. Pedir reposição junto com o atendimento.',
  },
  {
    title: 'Notebook reinicia sozinho',
    category: 'Hardware',
    affected: ['SELF'],
    descriptions: [
      'O notebook reinicia sozinho várias vezes ao dia, sempre sem aviso. Já perdi trabalho duas vezes. Percebi que acontece mais quando estou em chamada de vídeo.',
      'Depois da última atualização do Windows, o notebook desliga e liga de novo umas três vezes por dia. Às vezes aparece uma tela azul rapidamente antes de reiniciar.',
    ],
    solution: 'O cooler estava obstruído e o processador superaquecia. Foi feita limpeza interna e troca da pasta térmica; o equipamento ficou 24 horas em teste sem reinícios.',
    question: 'O notebook fica ligado na tomada ou na bateria quando reinicia?',
    internalNote: 'Temperatura da CPU passando de 95 °C nos logs. Provável limpeza do cooler.',
  },
  {
    title: 'Mouse sem resposta',
    category: 'Impressoras e periféricos',
    affected: ['SELF'],
    descriptions: [
      'O mouse sem fio parou de responder. Troquei as pilhas e mudei o receptor de porta USB, mas o cursor continua parado.',
      'O cursor do mouse fica travando e pulando pela tela. Está quase impossível trabalhar com planilhas.',
    ],
    solution: 'O receptor USB estava com defeito. O mouse foi substituído por um novo do estoque.',
    question: 'O mouse é com fio ou sem fio?',
    internalNote: 'Há 6 mouses M170 no estoque do almoxarifado.',
  },
  {
    title: 'Lentidão na rede do setor',
    category: 'Rede',
    affected: ['SECTOR', 'SECTOR', 'COMPANY'],
    descriptions: [
      'Desde a manhã a internet e as pastas compartilhadas estão muito lentas para todo o setor. Abrir um arquivo da rede leva mais de um minuto.',
      'Os sistemas que usam a rede estão travando a cada poucos minutos. As chamadas de vídeo caem e os arquivos demoram para salvar no servidor.',
    ],
    solution: 'Um switch do andar estava com uma porta em loop, o que congestionava a rede. A porta foi isolada, o cabo substituído e a velocidade voltou ao normal.',
    question: 'A lentidão acontece também no Wi-Fi ou só nos computadores com cabo?',
    internalNote: 'Monitoramento mostra tráfego anormal no switch SW-2A desde as 8h.',
  },
  {
    title: 'Instalar leitor de PDF',
    category: 'Software',
    affected: ['SELF'],
    descriptions: [
      'Preciso de um leitor de PDF que permita assinar documentos digitalmente. O computador não deixa instalar programas sem senha de administrador.',
      'Os PDFs estão abrindo no navegador e não consigo preencher os formulários do RH. Gostaria de instalar o leitor padrão da empresa.',
    ],
    solution: 'O leitor de PDF homologado pela empresa foi instalado e configurado como programa padrão. A assinatura digital foi testada com o solicitante.',
    question: 'Você vai precisar assinar com certificado digital ou só preencher formulários?',
    internalNote: 'Usar o pacote homologado da pasta de instaladores, versão corporativa.',
  },
  {
    title: 'Teclado com teclas falhando',
    category: 'Impressoras e periféricos',
    affected: ['SELF'],
    descriptions: [
      'As teclas A, S e a barra de espaço falham com frequência; é preciso apertar com força. Atrapalha bastante na digitação dos relatórios.',
      'Caiu café no teclado ontem e agora algumas teclas digitam letras repetidas.',
    ],
    solution: 'O teclado foi substituído por um novo. O antigo foi descartado por dano causado por líquido.',
    question: 'É o teclado do notebook ou um teclado externo?',
    internalNote: 'Teclado externo K120, sem conserto viável.',
  },
  {
    title: 'Monitor sem imagem',
    category: 'Hardware',
    affected: ['SELF'],
    descriptions: [
      'O monitor liga (a luz fica azul), mas a tela continua preta. O computador parece estar funcionando, porque escuto o som de inicialização.',
      'O segundo monitor parou de ser reconhecido. Ele aparece como "sem sinal" mesmo com o cabo conectado.',
    ],
    solution: 'O cabo HDMI estava danificado. Após a troca do cabo, o monitor voltou a exibir imagem normalmente.',
    question: 'Você consegue testar o monitor com outro cabo ou em outro computador?',
    internalNote: 'Levar cabo HDMI reserva na visita.',
  },
  {
    title: 'Esqueci a senha do e-mail',
    category: 'Acesso',
    affected: ['SELF'],
    descriptions: [
      'Voltei de férias e não lembro mais a senha do e-mail. Depois de várias tentativas, a conta foi bloqueada.',
      'Troquei a senha do e-mail pelo celular e agora o computador não aceita mais nenhuma senha.',
    ],
    solution: 'A conta foi desbloqueada e uma senha temporária foi definida. O usuário trocou a senha no primeiro acesso e o celular foi reconfigurado.',
    question: 'Você ainda tem acesso ao e-mail pelo celular?',
    internalNote: 'Confirmar identidade pelo ramal antes de redefinir a senha.',
  },
  {
    title: 'Wi-Fi caindo na sala de reunião',
    category: 'Rede',
    affected: ['FEW', 'SECTOR'],
    descriptions: [
      'O Wi-Fi da sala de reunião 2 cai a cada poucos minutos, principalmente durante as chamadas com clientes. Já perdemos duas reuniões esta semana.',
      'Na sala de reunião o sinal aparece cheio, mas a conexão não funciona. Em outras salas o Wi-Fi está normal.',
    ],
    solution: 'O ponto de acesso da sala estava com firmware desatualizado e reiniciava sozinho. O firmware foi atualizado e o canal ajustado para evitar interferência.',
    question: 'Quantas pessoas costumam se conectar ao mesmo tempo na sala?',
    internalNote: 'AP-SALA2 reiniciou 14 vezes nas últimas 24 h segundo a controladora.',
  },
  {
    title: 'Planilha de custos não abre',
    category: 'Software',
    affected: ['SELF', 'FEW'],
    descriptions: [
      'A planilha de custos do trimestre, que fica na pasta compartilhada, dá erro "arquivo corrompido" ao abrir. Várias pessoas dependem dela para o fechamento.',
      'Ao abrir a planilha de custos, o programa trava e fecha sozinho. Outras planilhas abrem normalmente.',
    ],
    solution: 'O arquivo foi restaurado a partir do backup da noite anterior. As alterações do dia foram refeitas com o solicitante.',
    question: 'Você sabe qual foi a última pessoa que salvou a planilha?',
    internalNote: 'Restaurar a versão das 23h do backup do servidor de arquivos.',
  },
  {
    title: 'Bateria do notebook não carrega',
    category: 'Hardware',
    affected: ['SELF'],
    descriptions: [
      'O notebook mostra "conectado, não carregando". A bateria dura poucos minutos fora da tomada, o que impede usar o notebook nas visitas a clientes.',
      'O carregador esquenta muito e a bateria não passa de 40%.',
    ],
    solution: 'A bateria estava com a vida útil esgotada. Ela foi substituída e o carregamento testado até 100%.',
    question: 'O notebook é usado mais na tomada ou fora dela?',
    internalNote: 'Relatório da bateria indica 31% da capacidade original. Trocar.',
  },
  {
    title: 'VPN não conecta em home office',
    category: 'Rede',
    affected: ['SELF', 'FEW'],
    descriptions: [
      'Em home office, a VPN fica em "conectando" e depois mostra erro de tempo esgotado. Sem ela não consigo acessar os sistemas internos.',
      'A VPN conecta, mas cai a cada 10 minutos, e preciso digitar a senha de novo toda vez.',
    ],
    solution: 'O certificado da VPN no notebook estava vencido. Ele foi renovado remotamente e a conexão ficou estável.',
    question: 'Você está usando a internet de casa ou o celular para conectar?',
    internalNote: 'Certificado do cliente VPN vencido; renovar pelo console.',
  },
  {
    title: 'Sistema de RH fora do ar',
    category: 'Software',
    affected: ['SECTOR', 'COMPANY'],
    descriptions: [
      'O sistema de ponto e férias não abre para ninguém do RH. Aparece "serviço indisponível". Hoje é o dia de fechamento da folha.',
      'Ninguém consegue registrar o ponto: o sistema de RH fica carregando e não termina.',
    ],
    solution: 'O serviço do sistema de RH parou após falta de espaço em disco no servidor. Os logs antigos foram arquivados, o serviço reiniciado e o monitoramento de disco ajustado.',
    question: 'O erro aparece para todos do setor ou só em alguns computadores?',
    internalNote: 'Disco do servidor RH-APP com 100% de uso. Limpar os logs.',
  },
];

export const PUBLIC_GREETINGS = [
  'Olá! Já estou verificando o seu chamado e retorno em breve.',
  'Bom dia! Recebi o chamado e já comecei a análise.',
  'Oi! Vou passar na sua mesa ainda hoje para olhar isso de perto.',
  'Obrigado pelos detalhes. Estou analisando remotamente e aviso assim que tiver novidades.',
];

export const CANCEL_REASONS = [
  'O problema se resolveu sozinho depois de reiniciar o computador.',
  'Abri o chamado em duplicidade, por engano.',
  'Não é mais necessário; um colega já me ajudou.',
];
