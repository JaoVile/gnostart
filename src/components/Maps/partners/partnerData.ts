const partnerAssetModules = import.meta.glob<string>(
  [
    '../../../assets/PARCEIROSEARQUIVOS/*.png',
    '../../../assets/PARCEIROSEARQUIVOS/*.PNG',
    '../../../assets/PARCEIROSEARQUIVOS/*.jpg',
    '../../../assets/PARCEIROSEARQUIVOS/*.JPG',
    '../../../assets/PARCEIROSEARQUIVOS/*.jpeg',
    '../../../assets/PARCEIROSEARQUIVOS/*.JPEG',
    '../../../assets/PARCEIROSEARQUIVOS/*.svg',
    '../../../assets/PARCEIROSEARQUIVOS/*.SVG',
  ],
  { eager: true, import: 'default' },
);

const normalizePartnerKey = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

const partnerAssetEntries = Object.entries(partnerAssetModules).map(([assetPath, assetUrl]) => ({
  assetPath,
  assetUrl,
  normalized: normalizePartnerKey(assetPath.split('/').pop() ?? assetPath),
}));

const findPartnerAsset = (...hints: string[]) => {
  for (const hint of hints) {
    const normalizedHint = normalizePartnerKey(hint);
    const match = partnerAssetEntries.find((entry) => entry.normalized.includes(normalizedHint));
    if (match) return match.assetUrl;
  }
  return null;
};

export type PartnerPanelSectionId = 'institutional' | 'ecosystem' | 'food' | 'people';
export type PartnerPanelItemKind = 'brand' | 'person';

export interface PartnerPanelItem {
  id: string;
  kind: PartnerPanelItemKind;
  name: string;
  subtitle: string;
  summary: string;
  badge: string;
  accent: string;
  imageSrc: string | null;
}

export interface PartnerPanelSection {
  id: PartnerPanelSectionId;
  title: string;
  subtitle: string;
  items: PartnerPanelItem[];
}

const institutionalItems: PartnerPanelItem[] = [
  {
    id: 'porto-digital',
    kind: 'brand',
    name: 'Porto Digital | Armazem da Criatividade',
    subtitle: 'Hub anfitriao do Startup Day em Caruaru',
    summary: 'Base que conecta economia criativa, tecnologia e operacao do evento no agreste.',
    badge: 'Hub',
    accent: '#2850ff',
    imageSrc: findPartnerAsset('Portodigital'),
  },
  {
    id: 'prefeitura-caruaru',
    kind: 'brand',
    name: 'Prefeitura de Caruaru',
    subtitle: 'Apoio publico local e articulacao territorial',
    summary: 'Presenca institucional que fortalece a entrega do evento e aproxima o ecossistema da cidade.',
    badge: 'Cidade',
    accent: '#0f7a5d',
    imageSrc: findPartnerAsset('prefeituracaruaru1', 'prefeituracaruaru4', 'prefeituracaruaru'),
  },
  {
    id: 'comiciti',
    kind: 'brand',
    name: 'COMCITI Caruaru',
    subtitle: 'Conselho municipal de ciencia, tecnologia e inovacao',
    summary: 'Rede publica que ajuda a conectar estrategia, politica de inovacao e impacto regional.',
    badge: 'Conselho',
    accent: '#0d8f7a',
    imageSrc: findPartnerAsset('Comiciti'),
  },
  {
    id: 'acic',
    kind: 'brand',
    name: 'ACIC',
    subtitle: 'Associacao Comercial e Empresarial de Caruaru',
    summary: 'Ponte direta com o setor produtivo, negocios e liderancas empresariais da regiao.',
    badge: 'Negocios',
    accent: '#126c52',
    imageSrc: findPartnerAsset('ACICMARCA'),
  },
  {
    id: 'senai',
    kind: 'brand',
    name: 'SENAI',
    subtitle: 'Formacao tecnica e industria',
    summary: 'Referencia em qualificacao, tecnologia aplicada e aproximacao entre educacao e mercado.',
    badge: 'Industria',
    accent: '#1f55c8',
    imageSrc: findPartnerAsset('SENAIICONE2', 'SENAIICONE1', 'SENAIICONE'),
  },
  {
    id: 'senac',
    kind: 'brand',
    name: 'Senac Fecomercio Sesc',
    subtitle: 'Educacao, servicos e desenvolvimento',
    summary: 'Marca que reforca trilhas de capacitacao, comercio e conexoes com o ecossistema regional.',
    badge: 'Educacao',
    accent: '#24458f',
    imageSrc: findPartnerAsset('horizontal positivo', 'marca Senac fecomercio Sesc horizontal'),
  },
  {
    id: 'uninassau',
    kind: 'brand',
    name: 'UNINASSAU Caruaru',
    subtitle: 'Universidade conectada ao territorio',
    summary: 'Parceira importante para densidade academica, talentos locais e aproximacao com startups.',
    badge: 'Universidade',
    accent: '#1e2f88',
    imageSrc: findPartnerAsset('Uninassau2', 'Uninassau1', 'Uninassau'),
  },
  {
    id: 'asces-unita',
    kind: 'brand',
    name: 'Asces-Unita',
    subtitle: 'Centro universitario do agreste',
    summary: 'Instituicao que amplia repertorio academico, pesquisa aplicada e proximidade com jovens talentos.',
    badge: 'Academia',
    accent: '#214aa0',
    imageSrc: findPartnerAsset('Asces-Unita'),
  },
];

const ecosystemItems: PartnerPanelItem[] = [
  {
    id: 'tapioca-valley',
    kind: 'brand',
    name: 'Tapioca Valley',
    subtitle: 'Comunidade de inovacao e startups',
    summary: 'Marca simbolica do ecossistema local, aproximando criadores, founders e novas ideias.',
    badge: 'Comunidade',
    accent: '#241b2f',
    imageSrc: findPartnerAsset('Tapioca Valley'),
  },
  {
    id: 'carua-hub',
    kind: 'brand',
    name: 'Carua Hub',
    subtitle: 'Conexao de negocios e inovacao no agreste',
    summary: 'Espaco de articulacao para empreendedores, conexoes de mercado e cultura de colaboracao.',
    badge: 'Hub',
    accent: '#2358d8',
    imageSrc: findPartnerAsset('Carua hub'),
  },
  {
    id: 'aponti',
    kind: 'brand',
    name: 'APONTI',
    subtitle: 'Tecnologia, saude e crescimento',
    summary: 'Solucao com identidade forte para escalar servicos e aproximar inovacao de uso real.',
    badge: 'Healthtech',
    accent: '#6a2ce0',
    imageSrc: findPartnerAsset('APONTI'),
  },
  {
    id: 'fejepe',
    kind: 'brand',
    name: 'FEJEPE',
    subtitle: 'Federacao do movimento de empresas juniores',
    summary: 'Energia universitariа para formar liderancas, consultorias e cultura de protagonismo jovem.',
    badge: 'Jovem',
    accent: '#355fac',
    imageSrc: findPartnerAsset('FEJEPE'),
  },
  {
    id: 'modal',
    kind: 'brand',
    name: 'Modal',
    subtitle: 'Mobilidade, servico e solucao urbana',
    summary: 'Marca com cara de produto enxuto, pensada para resolver jornada e usabilidade no dia a dia.',
    badge: 'Servico',
    accent: '#1481a8',
    imageSrc: findPartnerAsset('Modal'),
  },
  {
    id: 'ecopeencil',
    kind: 'brand',
    name: 'EcoPencil',
    subtitle: 'Sustentabilidade com design de produto',
    summary: 'Projeto que combina consciencia ambiental, identidade visual memoravel e proposta educativa.',
    badge: 'Sustentavel',
    accent: '#4f8d42',
    imageSrc: findPartnerAsset('Ecopeencil'),
  },
  {
    id: 'rotae',
    kind: 'brand',
    name: 'Rotae',
    subtitle: 'Localizacao, percurso e experiencia',
    summary: 'Marca alinhada com navegacao, jornada e descoberta territorial de forma simples.',
    badge: 'Movimento',
    accent: '#1d7cb7',
    imageSrc: findPartnerAsset('Rotae', 'Rotae.jpeg', 'Rota'),
  },
  {
    id: 'lab-cycle',
    kind: 'brand',
    name: 'Lab Cycle',
    subtitle: 'Solucoes sustentaveis e reaproveitamento',
    summary: 'Operacao com foco em economia circular e reaproveitamento aplicado ao mundo real.',
    badge: 'Circular',
    accent: '#0a6d5a',
    imageSrc: findPartnerAsset('LabCyble', 'Lab Cycle'),
  },
  {
    id: 'tecinova',
    kind: 'brand',
    name: 'TecInova',
    subtitle: 'Incubadora Pesqueira IFPE',
    summary: 'Projeto que leva inovacao, incubacao e formacao para novos negocios de base regional.',
    badge: 'Incubadora',
    accent: '#0a60ae',
    imageSrc: findPartnerAsset('TecInova'),
  },
  {
    id: 'brain',
    kind: 'brand',
    name: 'brAIn',
    subtitle: 'Tecnologia, criatividade e identidade forte',
    summary: 'Marca com apelo visual claro para quem trabalha com produto, IA e repertorio digital.',
    badge: 'IA',
    accent: '#116c52',
    imageSrc: findPartnerAsset('BrAin'),
  },
  {
    id: 'katana',
    kind: 'brand',
    name: 'Katana Studio',
    subtitle: 'Criacao, audiovisual e linguagem gamer',
    summary: 'Presenca com cara de estudio autoral, forte em branding, conteudo e universo pop.',
    badge: 'Estudio',
    accent: '#163b54',
    imageSrc: findPartnerAsset('Katana'),
  },
  {
    id: 'playmarques',
    kind: 'brand',
    name: 'Studio Playmarques',
    subtitle: 'Criacao visual, motion e presenca digital',
    summary: 'Marca voltada para narrativa visual, presenca online e acabamento de comunicacao.',
    badge: 'Criacao',
    accent: '#db3d4c',
    imageSrc: findPartnerAsset('Studio Playmarques'),
  },
  {
    id: 'apollo-nickolas',
    kind: 'brand',
    name: 'Apollo Nickolas',
    subtitle: 'Marca pessoal e posicionamento',
    summary: 'Presenca com identidade forte para conteudo, autoridade e construcao de audiencia.',
    badge: 'Branding',
    accent: '#5b5862',
    imageSrc: findPartnerAsset('Apollo Nickolas'),
  },
  {
    id: 'mesa-9',
    kind: 'brand',
    name: 'MESA 9 Studio',
    subtitle: 'Design, games e interacao',
    summary: 'Estudio com assinatura visual enxuta e linguagem conectada a experiencias digitais.',
    badge: 'Design',
    accent: '#1a1a1a',
    imageSrc: findPartnerAsset('MESA 9 Studio'),
  },
  {
    id: 'inovarc',
    kind: 'brand',
    name: 'INOVARC',
    subtitle: 'Comunidade de empreendedorismo e inovacao',
    summary: 'Grupo que fortalece encontros, repertorio coletivo e ativacao empreendedora fora dos grandes centros.',
    badge: 'Rede',
    accent: '#2543ff',
    imageSrc: findPartnerAsset('INOVARC'),
  },
  {
    id: 'destino-verde',
    kind: 'brand',
    name: 'Destino Verde | ETE Ministro Fernando Lyra',
    subtitle: 'Educacao tecnica e protagonismo jovem',
    summary: 'Projeto escolar que mostra como formacao tecnica pode gerar impacto pratico e empreendedor.',
    badge: 'Escola',
    accent: '#149a5b',
    imageSrc: findPartnerAsset('Destino Verde', 'ETE Ministro Fernando Lyra'),
  },
  {
    id: 'jardim-digital',
    kind: 'brand',
    name: 'Jardim Digital',
    subtitle: 'Presenca local conectada ao mapa do evento',
    summary: 'Ponto de referencia importante para orientar o publico e reforcar experiencia de circulacao.',
    badge: 'Espaco',
    accent: '#5d9f3c',
    imageSrc: findPartnerAsset('Jardimdigital1', 'Jardimdigital2', 'Jardimdigital'),
  },
];

const foodItems: PartnerPanelItem[] = [
  {
    id: 'versado',
    kind: 'brand',
    name: 'Versado Cafes Especiais',
    subtitle: 'Cafe especial para a jornada do dia',
    summary: 'Operacao pensada para sustentar conversas, networking e pausas com identidade propria.',
    badge: 'Cafe',
    accent: '#231e1a',
    imageSrc: findPartnerAsset('VERSADO - Logotipo PRETO', 'VERSADO - Logotipo BRANCO', 'VERSADO'),
  },
  {
    id: 'acaideli',
    kind: 'brand',
    name: 'Delifrio Acai Truck',
    subtitle: 'Acai e sorveteria no mapa do evento',
    summary: 'Parada leve e rapida para quem precisa continuar circulando durante a programacao.',
    badge: 'Food',
    accent: '#7b2b81',
    imageSrc: findPartnerAsset('Acaideli'),
  },
  {
    id: 'crocants',
    kind: 'brand',
    name: "Crocant's",
    subtitle: 'Lanche doce e identidade marcante',
    summary: 'Marca com forte apelo visual para snacks e consumo rapido ao longo do dia.',
    badge: 'Snack',
    accent: '#ff7900',
    imageSrc: findPartnerAsset('Crocant'),
  },
  {
    id: 'deco-lanches',
    kind: 'brand',
    name: 'Deco Lanches',
    subtitle: 'Opcao de refeicao pratica durante o evento',
    summary: 'Ponto de apoio para segurar a experiencia presencial sem tirar o publico da rota.',
    badge: 'Lanches',
    accent: '#ef5a2f',
    imageSrc: findPartnerAsset('Deco Lanches'),
  },
];

const peopleItems: PartnerPanelItem[] = [
  {
    id: 'dilson',
    kind: 'person',
    name: 'Dilson',
    subtitle: 'Diretor do CAA/UFPE',
    summary: 'Professor, pesquisador e gestor academico com atuacao forte na conexao entre universidade, pesquisa e inovacao regional.',
    badge: 'Lideranca',
    accent: '#2248a0',
    imageSrc: findPartnerAsset('Dilson.jpeg'),
  },
  {
    id: 'guilherme-junqueira',
    kind: 'person',
    name: 'Guilherme Junqueira',
    subtitle: 'CEO da Delta Academy',
    summary: 'Executivo focado em IA aplicada, educacao executiva e novas formas de escalar conhecimento.',
    badge: 'IA',
    accent: '#1a1a1a',
    imageSrc: findPartnerAsset('Guijunqueira.jpeg'),
  },
  {
    id: 'ian',
    kind: 'person',
    name: 'Ian',
    subtitle: 'Criador do GameJamPlus',
    summary: 'Articulador de comunidades criativas, games e experiencias colaborativas com alcance nacional.',
    badge: 'Games',
    accent: '#111111',
    imageSrc: findPartnerAsset('Ian.jpeg'),
  },
  {
    id: 'jackson-carvalho',
    kind: 'person',
    name: 'Jackson Carvalho',
    subtitle: 'IA, arte digital e fotografia fine art',
    summary: 'Profissional com repertorio em inteligencia artificial, imagem e direcao criativa aplicada a negocios.',
    badge: 'Criativo',
    accent: '#2d2f74',
    imageSrc: findPartnerAsset('JacksonCarvalho'),
  },
  {
    id: 'luverson-ferreira',
    kind: 'person',
    name: 'Luverson Ferreira',
    subtitle: 'Empresario e conselheiro da ACIC',
    summary: 'Lider empresarial com forte articulacao no setor produtivo e visao pratica para desenvolvimento local.',
    badge: 'Mercado',
    accent: '#0d5c6d',
    imageSrc: findPartnerAsset('Luverson Ferreira'),
  },
];

export const partnerSections: PartnerPanelSection[] = [
  {
    id: 'institutional',
    title: 'Rede que sustenta a entrega',
    subtitle: 'Instituicoes, hubs e organizacoes que ancoram a realizacao do evento em Caruaru.',
    items: institutionalItems,
  },
  {
    id: 'ecosystem',
    title: 'Startups, comunidades e expositores',
    subtitle: 'Marcas, projetos e coletivos que levam demonstracao, repertorio e conversa para o mapa.',
    items: ecosystemItems,
  },
  {
    id: 'food',
    title: 'Pontos de pausa e alimentacao',
    subtitle: 'Operacoes de cafe, acai e lanches para manter o fluxo do dia sem sair da experiencia.',
    items: foodItems,
  },
  {
    id: 'people',
    title: 'Pessoas em destaque',
    subtitle: 'Fotos e mini bios para reconhecer liderancas, convidados e vozes importantes do dia.',
    items: peopleItems,
  },
];

export const partnerPanelSummary = {
  institutionalCount: institutionalItems.length,
  ecosystemCount: ecosystemItems.length,
  foodCount: foodItems.length,
  peopleCount: peopleItems.length,
};
