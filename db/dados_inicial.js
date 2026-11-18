// =====================================================================
// ENSINO PLUS CONCURSOS — BANCO DE DADOS DA PÁGINA
// Tudo o que é conteúdo (áreas, matérias, edital, questões, flashcards)
// fica aqui, separado da lógica. Para incluir conteúdo novo, edite só este arquivo.
//
// IMPORTANTE: as questões abaixo são INÉDITAS (escritas pela Ensino Plus,
// não copiadas de provas). Antes do lançamento, cada uma deve ser conferida
// por um professor da matéria (campo "revisada": true quando conferida).
// =====================================================================

const MATERIAS = {
  // ---------- TRONCO COMUM (quase todo concurso cobra) ----------
  portugues: { nome: 'Língua Portuguesa', comum: true, topicos: ['Interpretação e compreensão de textos', 'Ortografia e acentuação', 'Crase', 'Concordância verbal e nominal', 'Regência verbal e nominal', 'Pontuação'] },
  rlm: { nome: 'Matemática e Raciocínio Lógico', comum: true, topicos: ['Proposições e conectivos', 'Negação e equivalências lógicas', 'Porcentagem', 'Razão e proporção', 'Problemas com as quatro operações'] },
  informatica: { nome: 'Informática', comum: true, topicos: ['Windows e atalhos', 'Editores de texto e planilhas', 'Internet e navegadores', 'Correio eletrônico', 'Segurança: vírus, golpes e backup'] },
  atualidades: { nome: 'Atualidades', comum: true, topicos: ['Política e economia nacional', 'Meio ambiente e sustentabilidade', 'Tecnologia e sociedade', 'Fatos internacionais recentes'] },

  // ---------- ESPECÍFICAS ----------
  constitucional: { nome: 'Direito Constitucional', topicos: ['Princípios fundamentais', 'Direitos e garantias fundamentais (art. 5º)', 'Nacionalidade', 'Organização do Estado', 'Remédios constitucionais'] },
  administrativo: { nome: 'Direito Administrativo', topicos: ['Princípios da Administração (art. 37)', 'Atos administrativos', 'Agentes públicos e Lei 8.112/90', 'Licitações (Lei 14.133/21)', 'Improbidade administrativa'] },
  processocivil: { nome: 'Direito Processual Civil', topicos: ['Normas fundamentais do CPC', 'Prazos processuais', 'Petição inicial e contestação', 'Sentença', 'Recursos'] },
  penal: { nome: 'Direito Penal', topicos: ['Aplicação da lei penal', 'Crime: fato típico, ilicitude e culpabilidade', 'Excludentes de ilicitude', 'Crimes contra a Administração Pública', 'Crimes contra a pessoa e o patrimônio'] },
  processopenal: { nome: 'Direito Processual Penal', topicos: ['Inquérito policial', 'Ação penal', 'Prisão em flagrante', 'Prisão preventiva e temporária', 'Provas'] },
  tributario: { nome: 'Direito Tributário', topicos: ['Conceito de tributo (art. 3º CTN)', 'Espécies tributárias', 'Competência tributária', 'Limitações ao poder de tributar', 'Crédito tributário'] },
  contabilidade: { nome: 'Contabilidade', topicos: ['Patrimônio e equação patrimonial', 'Contas de ativo, passivo e PL', 'Lançamentos e partidas dobradas', 'Balanço patrimonial', 'DRE'] },
  bancarios: { nome: 'Conhecimentos Bancários', topicos: ['Sistema Financeiro Nacional', 'CMN, Banco Central e CVM', 'Produtos bancários', 'Mercado de capitais', 'Prevenção à lavagem de dinheiro'] },
  matfinanceira: { nome: 'Matemática Financeira', topicos: ['Juros simples', 'Juros compostos', 'Descontos', 'Taxas equivalentes', 'Sistemas de amortização (SAC e Price)'] },
  sus: { nome: 'Legislação do SUS', topicos: ['Saúde na Constituição (arts. 196 a 200)', 'Lei 8.080/90', 'Lei 8.142/90 e controle social', 'Princípios e diretrizes do SUS', 'Política Nacional de Atenção Básica'] },
  saudepublica: { nome: 'Saúde Pública', topicos: ['Vigilância epidemiológica', 'Vigilância sanitária', 'Atenção Básica e Estratégia Saúde da Família', 'Indicadores de saúde', 'Imunização'] },
  legeducacional: { nome: 'Legislação Educacional', topicos: ['Educação na Constituição', 'LDB (Lei 9.394/96)', 'ECA (Lei 8.069/90)', 'BNCC', 'Plano Nacional de Educação'] },
  didatica: { nome: 'Didática e Pedagogia', topicos: ['Planejamento de ensino', 'Avaliação da aprendizagem', 'Teorias da aprendizagem', 'Educação inclusiva', 'Metodologias ativas'] },
  redes: { nome: 'Redes de Computadores', topicos: ['Modelo OSI e TCP/IP', 'Endereçamento IP', 'Protocolos e portas', 'Equipamentos de rede', 'Redes sem fio'] },
  seguranca: { nome: 'Segurança da Informação', topicos: ['Confidencialidade, integridade e disponibilidade', 'Ameaças e malwares', 'Criptografia', 'Backup', 'LGPD'] }
};

const AREAS = [
  { id: 'administrativa', nome: 'Administrativa', icone: 'briefcase', cor: 'blue', descricao: 'INSS, prefeituras, câmaras, agências e órgãos públicos em geral.', cargos: ['Técnico/Assistente Administrativo (nível médio)', 'Analista Administrativo (nível superior)'], materias: ['constitucional', 'administrativo'] },
  { id: 'juridica', nome: 'Jurídica e Tribunais', icone: 'scale', cor: 'indigo', descricao: 'Tribunais (TJ, TRF, TRT), Ministério Público e Defensoria.', cargos: ['Técnico Judiciário (nível médio)', 'Analista Judiciário (nível superior)'], materias: ['constitucional', 'administrativo', 'processocivil'] },
  { id: 'policial', nome: 'Policial e Segurança', icone: 'shield', cor: 'slate', descricao: 'Polícia Federal, PRF, Polícias Civil e Militar, guardas municipais.', cargos: ['Soldado/Agente (nível médio)', 'Agente/Escrivão/Delegado (nível superior)'], materias: ['penal', 'processopenal', 'constitucional'] },
  { id: 'fiscal', nome: 'Fiscal e Controle', icone: 'landmark', cor: 'emerald', descricao: 'Receita Federal, Secretarias de Fazenda (SEFAZ), fiscos municipais e tribunais de contas.', cargos: ['Técnico/Agente Fiscal', 'Auditor/Analista Fiscal (nível superior)'], materias: ['tributario', 'contabilidade'] },
  { id: 'bancaria', nome: 'Bancária', icone: 'piggy-bank', cor: 'amber', descricao: 'Banco do Brasil, Caixa, Banco do Nordeste, Banrisul e outros.', cargos: ['Escriturário/Técnico Bancário (nível médio)'], materias: ['bancarios', 'matfinanceira'] },
  { id: 'saude', nome: 'Saúde', icone: 'heart-pulse', cor: 'rose', descricao: 'Secretarias de Saúde, hospitais, EBSERH e cargos do SUS.', cargos: ['Técnico de Enfermagem e técnicos (nível médio)', 'Enfermeiro, médico e demais profissões (nível superior)'], materias: ['sus', 'saudepublica'] },
  { id: 'educacao', nome: 'Educação', icone: 'graduation-cap', cor: 'violet', descricao: 'Professores e cargos das redes municipais, estaduais e federal.', cargos: ['Professor da Educação Básica', 'Pedagogo / Coordenador Pedagógico'], materias: ['legeducacional', 'didatica'] },
  { id: 'ti', nome: 'Tecnologia da Informação', icone: 'cpu', cor: 'cyan', descricao: 'Cargos de TI em tribunais, bancos, agências e órgãos federais.', cargos: ['Técnico em TI (nível médio)', 'Analista de TI (nível superior)'], materias: ['redes', 'seguranca'] }
];

// Matérias que valem para todas as áreas
const MATERIAS_COMUNS = ['portugues', 'rlm', 'informatica', 'atualidades'];

// ---------------------------------------------------------------------
// QUESTÕES INÉDITAS (alternativas A–D, uma correta)
// ---------------------------------------------------------------------
const QUESTOES = [
  // Língua Portuguesa
  { id: 'pt1', materia: 'portugues', enunciado: 'Assinale a alternativa que completa corretamente a frase: "O servidor entregou o relatório ___ diretora do departamento."', alternativas: { A: 'a', B: 'à', C: 'há', D: 'ah' }, correta: 'B', comentario: 'Ocorre crase: o verbo "entregar" pede a preposição "a" (entregar algo a alguém) e o substantivo feminino "diretora" vem com o artigo "a". Preposição + artigo = "à".' },
  { id: 'pt2', materia: 'portugues', enunciado: 'Assinale a frase escrita de acordo com a norma-padrão:', alternativas: { A: 'Fazem dois anos que não vejo meu irmão.', B: 'Faz dois anos que não vejo meu irmão.', C: 'Fizeram dois anos que não vejo meu irmão.', D: 'Houveram dois anos que não vejo meu irmão.' }, correta: 'B', comentario: 'O verbo "fazer" indicando tempo decorrido é impessoal: fica sempre no singular ("Faz dois anos"). O mesmo vale para "haver" com sentido de existir ou de tempo.' },
  { id: 'pt3', materia: 'portugues', enunciado: 'Qual frase está correta quanto à concordância verbal?', alternativas: { A: 'Haviam muitos candidatos na sala.', B: 'Existia muitos candidatos na sala.', C: 'Havia muitos candidatos na sala.', D: 'Houveram muitos candidatos na sala.' }, correta: 'C', comentario: '"Haver" com sentido de "existir" é impessoal e fica no singular: "Havia muitos candidatos". Já "existir" é pessoal e concorda com o sujeito: "Existiam muitos candidatos".' },

  // Matemática e Raciocínio Lógico
  { id: 'rl1', materia: 'rlm', enunciado: 'A negação lógica da proposição "Todos os candidatos estudaram" é:', alternativas: { A: 'Nenhum candidato estudou.', B: 'Algum candidato não estudou.', C: 'Todos os candidatos não estudaram.', D: 'Algum candidato estudou.' }, correta: 'B', comentario: 'Para negar "todos", basta mostrar que pelo menos um não cumpre a condição: "Algum candidato não estudou". "Nenhum estudou" é uma afirmação mais forte e não é a negação.' },
  { id: 'rl2', materia: 'rlm', enunciado: 'Uma proposição equivalente a "Se chove, então a rua fica molhada" é:', alternativas: { A: 'Se a rua fica molhada, então chove.', B: 'Se não chove, então a rua não fica molhada.', C: 'Se a rua não fica molhada, então não chove.', D: 'Chove e a rua não fica molhada.' }, correta: 'C', comentario: 'A condicional "Se P, então Q" é equivalente à sua contrapositiva "Se não Q, então não P". As alternativas A e B são erros clássicos (recíproca e inversa).' },
  { id: 'rl3', materia: 'rlm', enunciado: 'Um produto custava R$ 200,00, teve aumento de 10% e, depois, desconto de 10% sobre o novo preço. O preço final é:', alternativas: { A: 'R$ 200,00', B: 'R$ 198,00', C: 'R$ 202,00', D: 'R$ 180,00' }, correta: 'B', comentario: 'Aumento: 200 × 1,10 = 220. Desconto de 10% sobre 220: 220 × 0,90 = 198. Aumento e desconto de mesma porcentagem não se anulam.' },

  // Informática
  { id: 'in1', materia: 'informatica', enunciado: 'Em programas do Windows, como o Word e o Excel, o atalho Ctrl + Z serve para:', alternativas: { A: 'Salvar o arquivo.', B: 'Desfazer a última ação.', C: 'Refazer a última ação.', D: 'Fechar a janela.' }, correta: 'B', comentario: 'Ctrl + Z desfaz a última ação. Ctrl + Y refaz, Ctrl + S (ou Ctrl + B no Word em português) salva e Alt + F4 fecha a janela.' },
  { id: 'in2', materia: 'informatica', enunciado: 'O golpe em que o criminoso envia uma mensagem falsa, imitando um banco ou órgão público, para levar a vítima a informar senhas ou dados pessoais é chamado de:', alternativas: { A: 'Phishing', B: 'Backup', C: 'Firewall', D: 'Spam legítimo' }, correta: 'A', comentario: 'Phishing é a "pescaria" de dados: mensagens e páginas falsas que imitam instituições confiáveis para roubar informações.' },
  { id: 'in3', materia: 'informatica', enunciado: 'Em uma planilha, as células A1, A2 e A3 contêm 2, 3 e 5. O resultado da fórmula =SOMA(A1:A3) é:', alternativas: { A: '5', B: '7', C: '10', D: '30' }, correta: 'C', comentario: 'O intervalo A1:A3 inclui as três células: 2 + 3 + 5 = 10.' },

  // Direito Constitucional
  { id: 'dc1', materia: 'constitucional', enunciado: 'De acordo com o art. 12, § 3º, da Constituição Federal, NÃO é cargo privativo de brasileiro nato:', alternativas: { A: 'Ministro do Supremo Tribunal Federal', B: 'Presidente da Câmara dos Deputados', C: 'Senador da República', D: 'Oficial das Forças Armadas' }, correta: 'C', comentario: 'São privativos de brasileiro nato: Presidente e Vice, Presidente da Câmara, Presidente do Senado, Ministro do STF, carreira diplomática, oficial das Forças Armadas e Ministro de Estado da Defesa. O cargo de Senador pode ser ocupado por naturalizado; só a presidência do Senado é privativa.' },
  { id: 'dc2', materia: 'constitucional', enunciado: 'O remédio constitucional adequado para proteger a liberdade de locomoção ameaçada por ilegalidade ou abuso de poder é:', alternativas: { A: 'Habeas corpus', B: 'Habeas data', C: 'Mandado de segurança', D: 'Mandado de injunção' }, correta: 'A', comentario: 'Habeas corpus (art. 5º, LXVIII) protege o direito de ir e vir. Habeas data trata de informações pessoais; mandado de segurança, de direito líquido e certo não amparado por HC ou HD; mandado de injunção, da falta de norma regulamentadora.' },

  // Direito Administrativo
  { id: 'da1', materia: 'administrativo', enunciado: 'Qual princípio NÃO está expresso no caput do art. 37 da Constituição Federal?', alternativas: { A: 'Legalidade', B: 'Moralidade', C: 'Eficiência', D: 'Razoabilidade' }, correta: 'D', comentario: 'O caput do art. 37 traz cinco princípios expressos (LIMPE): Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência. Razoabilidade é princípio implícito na Constituição.' },
  { id: 'da2', materia: 'administrativo', enunciado: 'Pela Lei 8.112/90, a posse do servidor nomeado deve ocorrer no prazo de:', alternativas: { A: '15 dias da publicação do ato de provimento', B: '30 dias da publicação do ato de provimento', C: '30 dias da entrada em exercício', D: '60 dias da homologação do concurso' }, correta: 'B', comentario: 'Art. 13, § 1º: a posse ocorre em até 30 dias da publicação do ato de provimento. Depois da posse, o servidor tem 15 dias para entrar em exercício (art. 15, § 1º).' },

  // Direito Processual Civil
  { id: 'pc1', materia: 'processocivil', enunciado: 'No procedimento comum do CPC/2015, o prazo para o réu apresentar contestação é, em regra, de:', alternativas: { A: '5 dias úteis', B: '10 dias úteis', C: '15 dias úteis', D: '30 dias corridos' }, correta: 'C', comentario: 'Art. 335 do CPC: o réu pode oferecer contestação no prazo de 15 dias. Pelo art. 219, os prazos processuais em dias são contados apenas em dias úteis.' },
  { id: 'pc2', materia: 'processocivil', enunciado: 'Segundo o CPC/2015, o recurso cabível contra a sentença é:', alternativas: { A: 'Agravo de instrumento', B: 'Apelação', C: 'Embargos de declaração, exclusivamente', D: 'Recurso especial' }, correta: 'B', comentario: 'Art. 1.009: da sentença cabe apelação. Embargos de declaração cabem contra qualquer decisão com obscuridade, contradição, omissão ou erro material, mas não são "o" recurso próprio contra a sentença.' },

  // Direito Penal
  { id: 'dp1', materia: 'penal', enunciado: 'O funcionário público que EXIGE, para si, vantagem indevida em razão da função comete o crime de:', alternativas: { A: 'Corrupção passiva', B: 'Peculato', C: 'Concussão', D: 'Prevaricação' }, correta: 'C', comentario: 'Exigir é concussão (art. 316 do CP). Na corrupção passiva (art. 317) o verbo é solicitar, receber ou aceitar promessa. Essa troca de verbos é uma das pegadinhas mais comuns.' },
  { id: 'dp2', materia: 'penal', enunciado: 'Entre as opções abaixo, é causa de exclusão da ilicitude prevista no art. 23 do Código Penal:', alternativas: { A: 'Legítima defesa', B: 'Coação moral irresistível', C: 'Arrependimento posterior', D: 'Embriaguez completa por caso fortuito' }, correta: 'A', comentario: 'O art. 23 lista estado de necessidade, legítima defesa, estrito cumprimento de dever legal e exercício regular de direito. Coação moral irresistível e embriaguez fortuita completa afastam a culpabilidade; arrependimento posterior apenas reduz a pena.' },

  // Direito Processual Penal
  { id: 'pp1', materia: 'processopenal', enunciado: 'Sobre a prisão em flagrante, o art. 301 do Código de Processo Penal estabelece que:', alternativas: { A: 'Apenas a autoridade policial pode prender em flagrante.', B: 'Qualquer do povo poderá, e as autoridades policiais e seus agentes deverão, prender quem for encontrado em flagrante delito.', C: 'Qualquer do povo deverá prender quem for encontrado em flagrante delito.', D: 'A prisão em flagrante depende sempre de ordem judicial.' }, correta: 'B', comentario: 'É o flagrante facultativo (qualquer pessoa "poderá") e o obrigatório (autoridades policiais e agentes "deverão"). A banca costuma trocar "poderá" por "deverá".' },
  { id: 'pp2', materia: 'processopenal', enunciado: 'Assinale a alternativa correta sobre o inquérito policial:', alternativas: { A: 'É processo judicial com contraditório pleno.', B: 'É indispensável para o oferecimento da denúncia.', C: 'É procedimento administrativo e pode ser dispensado se o Ministério Público já tiver elementos suficientes para a denúncia.', D: 'Só pode ser instaurado por requisição do juiz.' }, correta: 'C', comentario: 'O inquérito é procedimento administrativo, inquisitivo e dispensável: se o titular da ação já tiver elementos de autoria e materialidade, pode oferecer a denúncia sem ele.' },

  // Direito Tributário
  { id: 'dt1', materia: 'tributario', enunciado: 'De acordo com o art. 3º do Código Tributário Nacional, assinale a alternativa correta:', alternativas: { A: 'A multa de trânsito é um tributo.', B: 'Tributo pode ser instituído por decreto.', C: 'Tributo não constitui sanção de ato ilícito.', D: 'Tributo é prestação voluntária.' }, correta: 'C', comentario: 'Tributo é prestação pecuniária compulsória, em moeda, que não constitui sanção de ato ilícito, instituída em lei e cobrada por atividade administrativa plenamente vinculada. Multa é sanção, por isso não é tributo.' },
  { id: 'dt2', materia: 'tributario', enunciado: 'Pelo art. 77 do CTN, as taxas têm como fato gerador:', alternativas: { A: 'A obtenção de renda pelo contribuinte.', B: 'O exercício regular do poder de polícia ou a utilização de serviço público específico e divisível.', C: 'A valorização de imóvel decorrente de obra pública.', D: 'Qualquer situação independente de atividade estatal.' }, correta: 'B', comentario: 'Taxa é tributo vinculado a uma atuação do Estado: poder de polícia ou serviço público específico e divisível. Valorização por obra pública gera contribuição de melhoria; situação independente de atividade estatal é característica do imposto.' },

  // Contabilidade
  { id: 'ct1', materia: 'contabilidade', enunciado: 'Uma empresa tem Ativo de R$ 500.000 e Passivo (exigível) de R$ 300.000. Seu Patrimônio Líquido é:', alternativas: { A: 'R$ 800.000', B: 'R$ 300.000', C: 'R$ 200.000', D: 'R$ 500.000' }, correta: 'C', comentario: 'Equação patrimonial: Ativo = Passivo + Patrimônio Líquido. Logo, PL = 500.000 − 300.000 = 200.000.' },
  { id: 'ct2', materia: 'contabilidade', enunciado: 'Qual das contas abaixo pertence ao Passivo?', alternativas: { A: 'Caixa', B: 'Estoques', C: 'Clientes (duplicatas a receber)', D: 'Fornecedores' }, correta: 'D', comentario: 'Fornecedores é uma obrigação da empresa (valor a pagar), por isso fica no Passivo. Caixa, Estoques e Clientes são bens e direitos (Ativo).' },

  // Conhecimentos Bancários
  { id: 'cb1', materia: 'bancarios', enunciado: 'O órgão normativo máximo do Sistema Financeiro Nacional é:', alternativas: { A: 'Banco Central do Brasil', B: 'Conselho Monetário Nacional', C: 'Comissão de Valores Mobiliários', D: 'Federação Brasileira de Bancos' }, correta: 'B', comentario: 'O CMN é o órgão normativo máximo: define as diretrizes do sistema. O Banco Central executa e fiscaliza essas normas; a CVM cuida do mercado de valores mobiliários.' },
  { id: 'cb2', materia: 'bancarios', enunciado: 'A entidade responsável por regular e fiscalizar o mercado de valores mobiliários (como as ações negociadas em bolsa) é:', alternativas: { A: 'Comissão de Valores Mobiliários (CVM)', B: 'Superintendência de Seguros Privados (Susep)', C: 'Receita Federal', D: 'Conselho Monetário Nacional' }, correta: 'A', comentario: 'A CVM regula e fiscaliza o mercado de valores mobiliários. A Susep cuida de seguros e previdência aberta.' },

  // Matemática Financeira
  { id: 'mf1', materia: 'matfinanceira', enunciado: 'Um capital de R$ 1.000,00 foi aplicado a juros simples de 2% ao mês durante 6 meses. O montante ao final é:', alternativas: { A: 'R$ 1.012,00', B: 'R$ 1.120,00', C: 'R$ 1.126,16', D: 'R$ 1.200,00' }, correta: 'B', comentario: 'Juros simples: J = C × i × t = 1.000 × 0,02 × 6 = 120. Montante = 1.000 + 120 = 1.120. O valor 1.126,16 seria o resultado com juros compostos.' },
  { id: 'mf2', materia: 'matfinanceira', enunciado: 'Um capital de R$ 1.000,00 aplicado a juros compostos de 10% ao ano, por 2 anos, gera montante de:', alternativas: { A: 'R$ 1.200,00', B: 'R$ 1.210,00', C: 'R$ 1.100,00', D: 'R$ 1.020,00' }, correta: 'B', comentario: 'Juros compostos: M = C × (1 + i)^t = 1.000 × 1,1² = 1.000 × 1,21 = 1.210.' },

  // Legislação do SUS
  { id: 'su1', materia: 'sus', enunciado: 'O princípio do SUS que garante o acesso aos serviços de saúde a todas as pessoas, sem distinção, é o da:', alternativas: { A: 'Universalidade', B: 'Regionalização', C: 'Hierarquização', D: 'Descentralização' }, correta: 'A', comentario: 'Universalidade é o acesso de todos às ações e serviços de saúde. Regionalização, hierarquização e descentralização são diretrizes de organização do sistema.' },
  { id: 'su2', materia: 'sus', enunciado: 'A Lei 8.142/90, que trata da participação da comunidade na gestão do SUS, prevê como instâncias colegiadas em cada esfera de governo:', alternativas: { A: 'O Ministério da Saúde e as Secretarias de Saúde', B: 'A Conferência de Saúde e o Conselho de Saúde', C: 'A ANVISA e a ANS', D: 'Os hospitais universitários e as UBS' }, correta: 'B', comentario: 'Art. 1º da Lei 8.142/90: em cada esfera de governo, o SUS conta com a Conferência de Saúde e o Conselho de Saúde, instrumentos do controle social.' },

  // Saúde Pública
  { id: 'sp1', materia: 'saudepublica', enunciado: 'Segundo a Lei 8.080/90, o conjunto de ações capaz de eliminar, diminuir ou prevenir riscos à saúde, incluindo o controle de bens de consumo e da prestação de serviços relacionados à saúde, é a:', alternativas: { A: 'Vigilância epidemiológica', B: 'Vigilância sanitária', C: 'Saúde do trabalhador', D: 'Assistência farmacêutica' }, correta: 'B', comentario: 'É a definição de vigilância sanitária (art. 6º, § 1º). A vigilância epidemiológica (§ 2º) trata do conhecimento, detecção e prevenção de mudanças nos fatores que determinam a saúde, para orientar medidas de controle de doenças.' },
  { id: 'sp2', materia: 'saudepublica', enunciado: 'Pela Política Nacional de Atenção Básica, a principal porta de entrada e centro de comunicação da Rede de Atenção à Saúde é:', alternativas: { A: 'O hospital de referência', B: 'A Unidade de Pronto Atendimento (UPA)', C: 'A Atenção Básica', D: 'O ambulatório de especialidades' }, correta: 'C', comentario: 'A Atenção Básica (por exemplo, as Unidades Básicas de Saúde e a Estratégia Saúde da Família) é a porta de entrada preferencial e coordena o cuidado na rede.' },

  // Legislação Educacional
  { id: 'le1', materia: 'legeducacional', enunciado: 'Segundo a LDB (Lei 9.394/96), a educação básica é formada por:', alternativas: { A: 'Educação infantil, ensino fundamental e ensino médio', B: 'Ensino fundamental e ensino médio, apenas', C: 'Ensino fundamental, ensino médio e ensino superior', D: 'Educação infantil e ensino fundamental, apenas' }, correta: 'A', comentario: 'Art. 21 da LDB: a educação escolar compõe-se de educação básica (educação infantil, ensino fundamental e ensino médio) e educação superior.' },
  { id: 'le2', materia: 'legeducacional', enunciado: 'Para o Estatuto da Criança e do Adolescente (ECA), considera-se criança a pessoa:', alternativas: { A: 'Até 10 anos de idade', B: 'Até 12 anos de idade incompletos', C: 'Até 14 anos de idade', D: 'Até 18 anos de idade incompletos' }, correta: 'B', comentario: 'Art. 2º do ECA: criança é a pessoa até 12 anos incompletos; adolescente, entre 12 e 18 anos.' },

  // Didática
  { id: 'di1', materia: 'didatica', enunciado: 'A avaliação realizada ao longo do processo de ensino, com o objetivo de acompanhar a aprendizagem e ajustar as estratégias do professor, é chamada de avaliação:', alternativas: { A: 'Somativa', B: 'Classificatória', C: 'Formativa', D: 'Seletiva' }, correta: 'C', comentario: 'A avaliação formativa é contínua e serve para regular o ensino. A somativa acontece ao final de um período para verificar resultados.' },
  { id: 'di2', materia: 'didatica', enunciado: 'O conceito de "zona de desenvolvimento proximal", que trata da distância entre o que o aluno faz sozinho e o que faz com ajuda, é atribuído a:', alternativas: { A: 'Jean Piaget', B: 'Lev Vygotsky', C: 'Paulo Freire', D: 'Maria Montessori' }, correta: 'B', comentario: 'A zona de desenvolvimento proximal é um conceito central da teoria sociointeracionista de Lev Vygotsky.' },

  // Redes
  { id: 're1', materia: 'redes', enunciado: 'A porta padrão do protocolo HTTPS é:', alternativas: { A: '21', B: '25', C: '80', D: '443' }, correta: 'D', comentario: 'HTTPS usa a porta 443. HTTP usa a 80, SMTP a 25 e FTP a 21.' },
  { id: 're2', materia: 'redes', enunciado: 'No modelo OSI, a camada responsável pelo endereçamento lógico e pelo roteamento dos pacotes é a camada:', alternativas: { A: 'Física', B: 'De enlace', C: 'De rede', D: 'De aplicação' }, correta: 'C', comentario: 'A camada de rede (camada 3) cuida do endereçamento lógico (como o IP) e do roteamento entre redes.' },

  // Segurança da Informação
  { id: 'si1', materia: 'seguranca', enunciado: 'O princípio da segurança da informação que garante que a informação não foi alterada de forma indevida é a:', alternativas: { A: 'Confidencialidade', B: 'Integridade', C: 'Disponibilidade', D: 'Autenticidade' }, correta: 'B', comentario: 'Integridade é a garantia de que a informação não foi modificada indevidamente. Confidencialidade é o acesso só por quem tem permissão; disponibilidade é estar acessível quando necessário.' },
  { id: 'si2', materia: 'seguranca', enunciado: 'O software malicioso que criptografa os arquivos da vítima e exige pagamento para liberá-los é o:', alternativas: { A: 'Ransomware', B: 'Spyware', C: 'Adware', D: 'Worm' }, correta: 'A', comentario: 'Ransomware "sequestra" os dados e pede resgate. Spyware espiona, adware exibe propaganda e worm se espalha sozinho pela rede.' }
];

// ---------------------------------------------------------------------
// FLASHCARDS (frente = pergunta, verso = resposta)
// ---------------------------------------------------------------------
const FLASHCARDS = [
  { materia: 'portugues', frente: 'Quando o verbo "haver" fica sempre no singular?', verso: 'Quando significa <strong>existir</strong> ou indica <strong>tempo decorrido</strong>: "Havia muitos candidatos"; "Há dois anos".' },
  { materia: 'portugues', frente: 'Qual é a regra básica da crase?', verso: 'Crase = preposição <strong>a</strong> + artigo feminino <strong>a</strong>. Dica: troque por uma palavra masculina; se virar "ao", tem crase.' },
  { materia: 'rlm', frente: 'Como se nega "Todos são X"?', verso: '"<strong>Algum não é X</strong>" (ou "Pelo menos um não é X"). Nunca "Nenhum é X".' },
  { materia: 'rlm', frente: 'Qual a equivalência mais cobrada de "Se P, então Q"?', verso: 'A contrapositiva: "<strong>Se não Q, então não P</strong>". Também equivale a "não P ou Q".' },
  { materia: 'informatica', frente: 'Ctrl + Z, Ctrl + Y e Ctrl + C fazem o quê?', verso: 'Ctrl + Z <strong>desfaz</strong>, Ctrl + Y <strong>refaz</strong>, Ctrl + C <strong>copia</strong>.' },
  { materia: 'constitucional', frente: 'Quais cargos são privativos de brasileiro nato (art. 12, § 3º)?', verso: 'Presidente e Vice, Presidente da Câmara, Presidente do Senado, Ministro do STF, carreira diplomática, oficial das Forças Armadas e Ministro da Defesa.' },
  { materia: 'administrativo', frente: 'Quais são os princípios expressos no caput do art. 37 da CF?', verso: '<strong>LIMPE</strong>: Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência.' },
  { materia: 'administrativo', frente: 'Prazos de posse e exercício na Lei 8.112/90?', verso: 'Posse: até <strong>30 dias</strong> da publicação do ato. Exercício: até <strong>15 dias</strong> da posse.' },
  { materia: 'processocivil', frente: 'Como se contam os prazos processuais no CPC/2015?', verso: 'Em <strong>dias úteis</strong> (art. 219), quando fixados em dias.' },
  { materia: 'penal', frente: 'Concussão x Corrupção passiva: qual a diferença?', verso: 'Concussão: <strong>exigir</strong> (art. 316). Corrupção passiva: <strong>solicitar, receber ou aceitar promessa</strong> (art. 317).' },
  { materia: 'processopenal', frente: 'Quem pode e quem deve prender em flagrante?', verso: 'Qualquer do povo <strong>pode</strong>; autoridades policiais e seus agentes <strong>devem</strong> (art. 301 do CPP).' },
  { materia: 'tributario', frente: 'Por que multa não é tributo?', verso: 'Porque tributo <strong>não constitui sanção de ato ilícito</strong> (art. 3º do CTN). Multa é sanção.' },
  { materia: 'contabilidade', frente: 'Qual é a equação patrimonial?', verso: '<strong>Ativo = Passivo + Patrimônio Líquido</strong>.' },
  { materia: 'bancarios', frente: 'CMN x Banco Central: quem faz o quê?', verso: 'CMN <strong>normatiza</strong> (órgão normativo máximo). Banco Central <strong>executa e fiscaliza</strong>.' },
  { materia: 'matfinanceira', frente: 'Fórmulas de juros simples e compostos?', verso: 'Simples: <strong>J = C × i × t</strong>. Compostos: <strong>M = C × (1 + i)<sup>t</sup></strong>.' },
  { materia: 'sus', frente: 'Quais são os princípios doutrinários do SUS?', verso: '<strong>Universalidade, integralidade e equidade</strong>.' },
  { materia: 'saudepublica', frente: 'Vigilância sanitária x epidemiológica?', verso: 'Sanitária: controla <strong>riscos de produtos, serviços e ambientes</strong>. Epidemiológica: acompanha <strong>doenças e seus fatores</strong> para orientar o controle.' },
  { materia: 'legeducacional', frente: 'Idades de criança e adolescente no ECA?', verso: 'Criança: até <strong>12 anos incompletos</strong>. Adolescente: de <strong>12 a 18 anos</strong>.' },
  { materia: 'didatica', frente: 'Avaliação formativa x somativa?', verso: 'Formativa: <strong>durante</strong> o processo, para ajustar o ensino. Somativa: <strong>ao final</strong>, para medir resultados.' },
  { materia: 'redes', frente: 'Portas padrão de HTTP, HTTPS, SMTP e FTP?', verso: 'HTTP <strong>80</strong>, HTTPS <strong>443</strong>, SMTP <strong>25</strong>, FTP <strong>21</strong>.' },
  { materia: 'seguranca', frente: 'O que é a tríade CID?', verso: '<strong>Confidencialidade, Integridade e Disponibilidade</strong>: os três pilares da segurança da informação.' }
];
