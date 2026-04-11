const partnerAssetModules = import.meta.glob<string>(
  [
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.webp',
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.WEBP',
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.png',
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.PNG',
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.jpg',
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.JPG',
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.jpeg',
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.JPEG',
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.svg',
    '../../../../assets/PARCEIROSEARQUIVOS/**/*.SVG',
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
  normalized: normalizePartnerKey(assetPath),
}));

const findPartnerAsset = (...hints: string[]) => {
  const normalizedHints = hints.map(normalizePartnerKey).filter(Boolean);

  for (const entry of partnerAssetEntries) {
    if (normalizedHints.some((hint) => entry.normalized.includes(hint))) {
      return entry.assetUrl;
    }
  }

  return null;
};

export type PartnerPanelSectionId = 'institutional' | 'ecosystem' | 'food' | 'people';
export type PartnerPanelItemKind = 'brand' | 'person';
export type PartnerPanelVisualSurface = 'default' | 'dark';

export interface PartnerPanelItem {
  id: string;
  kind: PartnerPanelItemKind;
  name: string;
  subtitle: string;
  summary: string;
  badge: string;
  accent: string;
  imageSrc: string | null;
  visualSurface?: PartnerPanelVisualSurface;
}

export interface PartnerPanelSection {
  id: PartnerPanelSectionId;
  title: string;
  subtitle: string;
  items: PartnerPanelItem[];
}

const createBrandItem = ({
  id,
  name,
  subtitle,
  summary,
  badge,
  accent,
  hints,
  visualSurface = 'default',
}: {
  id: string;
  name: string;
  subtitle: string;
  summary: string;
  badge: string;
  accent: string;
  hints: string[];
  visualSurface?: PartnerPanelVisualSurface;
}): PartnerPanelItem => ({
  id,
  kind: 'brand',
  name,
  subtitle,
  summary,
  badge,
  accent,
  imageSrc: findPartnerAsset(...hints),
  visualSurface,
});

const createPersonItem = ({
  id,
  name,
  subtitle,
  summary,
  badge,
  accent,
  hints,
}: {
  id: string;
  name: string;
  subtitle: string;
  summary: string;
  badge: string;
  accent: string;
  hints: string[];
}): PartnerPanelItem => ({
  id,
  kind: 'person',
  name,
  subtitle,
  summary,
  badge,
  accent,
  imageSrc: findPartnerAsset(...hints),
});

const institutionalItems: PartnerPanelItem[] = [
  createBrandItem({
    id: 'acic',
    name: 'ACIC',
    subtitle: 'Associacao Comercial e Empresarial de Caruaru',
    summary: 'Entidade que fortalece o setor empresarial da cidade e conecta negocios, liderancas e desenvolvimento regional.',
    badge: 'Negocios',
    accent: '#126c52',
    hints: ['ACICMARCA', 'ACIC'],
  }),
  createBrandItem({
    id: 'asces-unita',
    name: 'Asces-Unita',
    subtitle: 'Centro Universitario Tabosa de Almeida',
    summary: 'Instituicao de ensino superior que amplia repertorio academico, pesquisa aplicada e conexao com o territorio.',
    badge: 'Academia',
    accent: '#214aa0',
    hints: ['Asces-Unita', 'Asces Unita'],
  }),
  createBrandItem({
    id: 'comiciti',
    name: 'COMCITI Caruaru',
    subtitle: 'Conselho municipal de ciencia, tecnologia e inovacao',
    summary: 'Rede publica que aproxima governo, academia e setor produtivo para fortalecer politicas de inovacao em Caruaru.',
    badge: 'Conselho',
    accent: '#0d8f7a',
    hints: ['Comiciti', 'COMCITI'],
  }),
  createBrandItem({
    id: 'secretaria-pernambuco',
    name: 'Secretaria de Ciencia, Tecnologia e Inovacao de Pernambuco',
    subtitle: 'Inovacao, pesquisa e articulacao estadual',
    summary: 'Presenca institucional que conecta politicas publicas, pesquisa aplicada e fortalecimento do ecossistema pernambucano.',
    badge: 'Estado',
    accent: '#1d4f97',
    hints: ['Governodoestadocaruaru', 'Secretaria da Ciencia Tecnologia e Inovacao'],
  }),
  createBrandItem({
    id: 'jardim-digital',
    name: 'Jardim Digital',
    subtitle: 'Inovacao, educacao e inclusao digital',
    summary: 'Iniciativa que fortalece talentos, aprendizado e conexoes tecnicas dentro do ecossistema local.',
    badge: 'Comunidade',
    accent: '#4f8d42',
    hints: ['Jardimdigital'],
  }),
  createBrandItem({
    id: 'senac',
    name: 'Senac Fecomercio Sesc',
    subtitle: 'Educacao, servicos e desenvolvimento',
    summary: 'Marca que reforca trilhas de capacitacao, comercio, cultura e conexoes com o ecossistema regional.',
    badge: 'Educacao',
    accent: '#24458f',
    hints: ['marca Senac fecomercio Sesc horizontal', 'Senac Fecomercio Sesc'],
    visualSurface: 'dark',
  }),
  createBrandItem({
    id: 'playnambuco',
    name: 'Playnambuco',
    subtitle: 'Economia criativa e jogos digitais',
    summary: 'Programa que impulsiona formacao, rede criativa e crescimento de profissionais e estudios ligados a games.',
    badge: 'Games',
    accent: '#2b83c6',
    hints: ['Playnambuco'],
  }),
  createBrandItem({
    id: 'porto-digital',
    name: 'Porto Digital | Armazem da Criatividade',
    subtitle: 'Hub anfitriao e articulacao criativa',
    summary: 'Base que conecta economia criativa, tecnologia e operacao do evento no agreste.',
    badge: 'Hub',
    accent: '#2850ff',
    hints: ['Portodigital', 'Armazem da Criatividade'],
  }),
  createBrandItem({
    id: 'prefeitura-caruaru',
    name: 'Prefeitura de Caruaru',
    subtitle: 'Apoio publico local e articulacao territorial',
    summary: 'Presenca institucional que fortalece a entrega do evento e aproxima o ecossistema da cidade.',
    badge: 'Cidade',
    accent: '#0f7a5d',
    hints: ['prefeituracaruaru', 'caruaru prefeitura'],
  }),
  createBrandItem({
    id: 'senai',
    name: 'SENAI',
    subtitle: 'Formacao tecnica e industria',
    summary: 'Referencia em qualificacao, tecnologia aplicada e aproximacao entre educacao e mercado.',
    badge: 'Industria',
    accent: '#1f55c8',
    hints: ['SENAIICONE', 'SENAI'],
  }),
  createBrandItem({
    id: 'tapioca-valley',
    name: 'Tapioca Valley',
    subtitle: 'Comunidade de inovacao e startups',
    summary: 'Marca simbolica do ecossistema local, aproximando criadores, founders e novas ideias.',
    badge: 'Comunidade',
    accent: '#241b2f',
    hints: ['Tapioca Valley', 'Tapioca Logo Antiga'],
  }),
  createBrandItem({
    id: 'uninassau',
    name: 'UNINASSAU Caruaru',
    subtitle: 'Universidade conectada ao territorio',
    summary: 'Parceira importante para densidade academica, talentos locais e aproximacao com startups.',
    badge: 'Universidade',
    accent: '#1e2f88',
    hints: ['Uninassau'],
  }),
];

const ecosystemItems: PartnerPanelItem[] = [
  createBrandItem({
    id: 'carua-hub',
    name: 'Carua Hub',
    subtitle: 'Conexao de negocios e inovacao no agreste',
    summary: 'Espaco de articulacao para empreendedores, conexoes de mercado e cultura de colaboracao.',
    badge: 'Hub',
    accent: '#2358d8',
    hints: ['Carua hub', 'CaruaHub'],
  }),
  createBrandItem({
    id: 'aponti',
    name: 'APONTI',
    subtitle: 'Tecnologia, saude e crescimento',
    summary: 'Solucao com identidade forte para escalar servicos e aproximar inovacao de uso real.',
    badge: 'Healthtech',
    accent: '#6a2ce0',
    hints: ['APONTI', 'APONTI MARCA'],
  }),
  createBrandItem({
    id: 'fejepe',
    name: 'FEJEPE',
    subtitle: 'Federacao do movimento de empresas juniores',
    summary: 'Energia universitaria para formar liderancas, consultorias e cultura de protagonismo jovem.',
    badge: 'Jovem',
    accent: '#355fac',
    hints: ['FEJEPE'],
  }),
  createBrandItem({
    id: 'modal',
    name: 'Modall',
    subtitle: 'Mobilidade, servico e solucao urbana',
    summary: 'Marca com cara de produto enxuto, pensada para resolver jornada e usabilidade no dia a dia.',
    badge: 'Servico',
    accent: '#1481a8',
    hints: ['Modal'],
  }),
  createBrandItem({
    id: 'ecopeencil',
    name: 'EcoPencil',
    subtitle: 'Sustentabilidade com design de produto',
    summary: 'Projeto que combina consciencia ambiental, identidade visual memoravel e proposta educativa.',
    badge: 'Sustentavel',
    accent: '#4f8d42',
    hints: ['Ecopeencil', 'EcoPencil'],
  }),
  createBrandItem({
    id: 'rotae',
    name: 'Rotae',
    subtitle: 'Localizacao, percurso e experiencia',
    summary: 'Marca alinhada com navegacao, jornada e descoberta territorial de forma simples.',
    badge: 'Movimento',
    accent: '#1d7cb7',
    hints: ['Rotae', 'Rotae.jpeg', 'Rota'],
  }),
  createBrandItem({
    id: 'lab-cycle',
    name: 'Lab Cycle',
    subtitle: 'Solucoes sustentaveis e reaproveitamento',
    summary: 'Operacao com foco em economia circular e reaproveitamento aplicado ao mundo real.',
    badge: 'Circular',
    accent: '#0a6d5a',
    hints: ['LabCyble', 'Lab Cycle'],
  }),
  createBrandItem({
    id: 'tecinova',
    name: 'TecInova',
    subtitle: 'Incubadora Pesqueira IFPE',
    summary: 'Projeto que leva inovacao, incubacao e formacao para novos negocios de base regional.',
    badge: 'Incubadora',
    accent: '#0a60ae',
    hints: ['TecInova', 'TecInova Incubadora Pesqueira IFPE'],
  }),
  createBrandItem({
    id: 'brain',
    name: 'brAIn',
    subtitle: 'Tecnologia, criatividade e identidade forte',
    summary: 'Marca com apelo visual claro para quem trabalha com produto, IA e repertorio digital.',
    badge: 'IA',
    accent: '#116c52',
    hints: ['BrAin'],
  }),
  createBrandItem({
    id: 'katana',
    name: 'Katana Studio',
    subtitle: 'Criacao, audiovisual e linguagem gamer',
    summary: 'Presenca com cara de estudio autoral, forte em branding, conteudo e universo pop.',
    badge: 'Estudio',
    accent: '#163b54',
    hints: ['Katana'],
  }),
  createBrandItem({
    id: 'playmarques',
    name: 'Studio Playmarques',
    subtitle: 'Criacao visual, motion e presenca digital',
    summary: 'Marca voltada para narrativa visual, presenca online e acabamento de comunicacao.',
    badge: 'Criacao',
    accent: '#db3d4c',
    hints: ['Studio Playmarques'],
  }),
  createBrandItem({
    id: 'apollo',
    name: 'Apollo Nickolas',
    subtitle: 'Marca pessoal e posicionamento',
    summary: 'Presenca com identidade forte para conteudo, autoridade e construcao de audiencia.',
    badge: 'Branding',
    accent: '#5b5862',
    hints: ['Apollo Nickolas', 'Apollo'],
  }),
  createBrandItem({
    id: 'mesa-9',
    name: 'MESA 9 Studio',
    subtitle: 'Design, games e interacao',
    summary: 'Estudio com assinatura visual enxuta e linguagem conectada a experiencias digitais.',
    badge: 'Design',
    accent: '#1a1a1a',
    hints: ['MESA 9 Studio', 'Mesa 9'],
  }),
  createBrandItem({
    id: 'inovarc',
    name: 'INOVARC',
    subtitle: 'Comunidade de empreendedorismo e inovacao',
    summary: 'Grupo que fortalece encontros, repertorio coletivo e ativacao empreendedora fora dos grandes centros.',
    badge: 'Rede',
    accent: '#2543ff',
    hints: ['INOVARC'],
  }),
  createBrandItem({
    id: 'destino-verde',
    name: 'Destino Verde | ETE Ministro Fernando Lyra',
    subtitle: 'Educacao tecnica e protagonismo jovem',
    summary: 'Projeto escolar que mostra como formacao tecnica pode gerar impacto pratico e empreendedor.',
    badge: 'Escola',
    accent: '#149a5b',
    hints: ['Destino Verde', 'ETE Ministro Fernando Lyra'],
  }),
  createBrandItem({
    id: 'windrose',
    name: 'WINDROSE',
    subtitle: 'Automações e identidade digital',
    summary: 'Startup voltada para o desenvolvimento de soluções que automizam processos e escalam negócios com IA',
    badge: 'Automações',
    accent: '#0c1735',
    hints: ['windrose', 'WINDROSE'],
  }),
  createBrandItem({
    id: 'gnomon',
    name: 'Gnomon',
    subtitle: 'Mapeamento de eventos e navegacao indoor',
    summary: 'Startup responsavel pela experiencia digital de mapa, organizacao e visualizacao interativa do evento.',
    badge: 'Desenvolvido por',
    accent: '#7157ad',
    hints: ['Gnomon'],
  }),
];

const foodItems: PartnerPanelItem[] = [
  createBrandItem({
    id: 'alvery',
    name: 'Alvery Cafes Especiais',
    subtitle: 'Cafe especial com identidade propria',
    summary: 'Marca voltada a experiencia do cafe, conversas longas e pausas de qualidade no meio da programacao.',
    badge: 'Cafe',
    accent: '#1c1c1c',
    hints: ['Alverycafes', 'Alvery'],
  }),
  createBrandItem({
    id: 'versado',
    name: 'Versado Cafes Especiais',
    subtitle: 'Cafe especial para a jornada do dia',
    summary: 'Operacao pensada para sustentar conversas, networking e pausas com identidade propria.',
    badge: 'Cafe',
    accent: '#231e1a',
    hints: ['VERSADO - Logotipo BRANCO', 'VERSADO', 'Versado'],
    visualSurface: 'dark',
  }),
  createBrandItem({
    id: 'acaideli',
    name: 'Delifrio Acai Truck',
    subtitle: 'Acai e sorveteria no mapa do evento',
    summary: 'Parada leve e rapida para quem precisa continuar circulando durante a programacao.',
    badge: 'Food',
    accent: '#7b2b81',
    hints: ['Acaideli', 'Acai Deli', 'Delifrio'],
  }),
  createBrandItem({
    id: 'crocants',
    name: "Crocant's",
    subtitle: 'Lanche doce e identidade marcante',
    summary: 'Marca com forte apelo visual para snacks e consumo rapido ao longo do dia.',
    badge: 'Snack',
    accent: '#ff7900',
    hints: ['crocants', 'crocant'],
  }),
  createBrandItem({
    id: 'deco-lanches',
    name: 'Deco Lanches',
    subtitle: 'Opcao de refeicao pratica durante o evento',
    summary: 'Ponto de apoio para segurar a experiencia presencial sem tirar o publico da rota.',
    badge: 'Lanches',
    accent: '#ef5a2f',
    hints: ['Deco Lanches'],
  }),
];

const peopleItems: PartnerPanelItem[] = [
  createPersonItem({
    id: 'dilson',
    name: 'Dilson',
    subtitle: 'Diretor do CAA/UFPE',
    summary: 'Professor, pesquisador e gestor academico com atuacao forte na conexao entre universidade, pesquisa e inovacao regional.',
    badge: 'Lideranca',
    accent: '#2248a0',
    hints: ['Dilson'],
  }),
  createPersonItem({
    id: 'guilherme-junqueira',
    name: 'Guilherme Junqueira',
    subtitle: 'CEO da Delta Academy',
    summary: 'Executivo focado em IA aplicada, educacao executiva e novas formas de escalar conhecimento.',
    badge: 'IA',
    accent: '#1a1a1a',
    hints: ['Guijunqueira'],
  }),
  createPersonItem({
    id: 'ian',
    name: 'Ian',
    subtitle: 'Criador do GameJamPlus',
    summary: 'Articulador de comunidades criativas, games e experiencias colaborativas com alcance nacional.',
    badge: 'Games',
    accent: '#111111',
    hints: ['Ian'],
  }),
  createPersonItem({
    id: 'jackson-carvalho',
    name: 'Jackson Carvalho',
    subtitle: 'IA, arte digital e fotografia fine art',
    summary: 'Profissional com repertorio em inteligencia artificial, imagem e direcao criativa aplicada a negocios.',
    badge: 'Criativo',
    accent: '#2d2f74',
    hints: ['JacksonCarvalho'],
  }),
  createPersonItem({
    id: 'luverson-ferreira',
    name: 'Luverson Ferreira',
    subtitle: 'Empresario e conselheiro da ACIC',
    summary: 'Lider empresarial com forte articulacao no setor produtivo e visao pratica para desenvolvimento local.',
    badge: 'Mercado',
    accent: '#0d5c6d',
    hints: ['Luverson Ferreira'],
  }),
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
