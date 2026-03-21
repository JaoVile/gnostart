import type { AgendaDayId, AgendaSession } from '../types';

export const AGENDA_EVENT_DATE_ISO = '2026-03-21';

export const agendaDays: { id: AgendaDayId; weekday: string; dateLabel: string }[] = [
  { id: '21', weekday: 'SÁB', dateLabel: '21' },
];

const saturdayAgendaMeta: Pick<AgendaSession, 'dayId' | 'weekday' | 'dateLabel'> = {
  dayId: '21',
  weekday: 'SÁB',
  dateLabel: '21',
};

const agendaCategoryAccents: Record<string, string> = {
  'Palco Principal': '#6a38d0',
  'Arena Experiência': '#8d6fe7',
  'Oficina Game': '#5326b8',
  Hotseat: '#5c33ad',
  Intervalo: '#d9c8ff',
};

const getAgendaAccent = (category: string) => agendaCategoryAccents[category] ?? '#6a38d0';

const createAgendaSession = (
  session: Omit<AgendaSession, 'dayId' | 'weekday' | 'dateLabel' | 'accent'>,
): AgendaSession => ({
  ...saturdayAgendaMeta,
  ...session,
  accent: getAgendaAccent(session.category),
});

const agendaVenuePriority: Record<string, number> = {
  'Recepcao e Credenciamento': 0,
  'Palco Principal': 1,
  'Sala da Arena Gamer': 2,
  'Sala de Economia Criativa 02': 3,
  'Sala de Empreendedorismo': 4,
  'Area das Startups e Parceiros': 5,
  'Area de Alimentacao': 6,
};

export const parseAgendaTimeToMinutes = (timeLabel: string) => {
  const [hours, minutes] = timeLabel.split(':').map((value) => Number.parseInt(value, 10));
  return hours * 60 + minutes;
};

export const compareAgendaSessions = (left: AgendaSession, right: AgendaSession) => {
  const startDifference = parseAgendaTimeToMinutes(left.startTime) - parseAgendaTimeToMinutes(right.startTime);
  if (startDifference !== 0) return startDifference;

  const venueDifference = (agendaVenuePriority[left.venue] ?? 99) - (agendaVenuePriority[right.venue] ?? 99);
  if (venueDifference !== 0) return venueDifference;

  const endDifference = parseAgendaTimeToMinutes(left.endTime) - parseAgendaTimeToMinutes(right.endTime);
  if (endDifference !== 0) return endDifference;

  return left.title.localeCompare(right.title, 'pt-BR');
};

export const formatAgendaDuration = (startTime: string, endTime: string) => {
  const durationMinutes = Math.max(0, parseAgendaTimeToMinutes(endTime) - parseAgendaTimeToMinutes(startTime));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
};

export const agendaSessions: AgendaSession[] = [
  createAgendaSession({
    id: 'agenda_21_credenciamento',
    category: 'Palco Principal',
    title: 'Credenciamento',
    summary: 'Recepção dos participantes e entrega de credenciais. O momento ideal para as primeiras conexões antes da abertura oficial do evento.',
    venue: 'Recepcao e Credenciamento',
    audience: 'Público geral',
    startTime: '09:00',
    endTime: '09:45',
    speakers: [{ name: 'Equipe do Evento', role: 'Recepção e Boas-vindas' }],
  }),
  createAgendaSession({
    id: 'agenda_21_arena_experiencia',
    category: 'Arena Experiência',
    title: 'Espaços de Inovação e Parceiros',
    summary: 'Espaço contínuo de inovação e interatividade. Visite as ativações e estandes do SENAI, SENAC, Jardim Digital, ASCES e UNINASSAU ao longo de todo o dia.',
    venue: 'Area das Startups e Parceiros',
    audience: 'Circulação livre',
    startTime: '09:00',
    endTime: '17:00',
    speakers: [{ name: 'Parceiros do Ecossistema', role: 'Exposições e Experiências' }],
  }),
  createAgendaSession({
    id: 'agenda_21_oficina_gamelab_01',
    category: 'Oficina Game',
    title: 'Oficina 01: GameLab — Do zero ao jogo na prática',
    summary: 'Imersão prática focada na criação de jogos a partir do zero. Conduzida por especialistas da Playnambuco, voltada para quem quer colocar a mão na massa.',
    venue: 'Sala da Arena Gamer',
    audience: 'Estudantes, devs e criadores',
    startTime: '09:00',
    endTime: '11:00',
    speakers: [
      { name: 'Gustavo Tenório', role: 'Playnambuco' },
      { name: 'Rafael Silva', role: 'Playnambuco' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_abertura_institucional',
    category: 'Palco Principal',
    title: 'Abertura Institucional',
    summary: 'Boas-vindas oficiais ao Startup Day 2026. Uma introdução ao impacto do evento no ecossistema local e nacional, marcando o início da programação do palco principal.',
    venue: 'Palco Principal',
    audience: 'Público geral',
    startTime: '09:45',
    endTime: '10:00',
    speakers: [
      { name: 'Débora Florêncio', role: 'Gerente do Sebrae (Agreste Central/Setentrional)' },
      { name: 'Pâmela Dias', role: 'Gerente do Porto Digital Caruaru' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_palestra_tempo_dinheiro_atencao',
    category: 'Palco Principal',
    title: 'Tempo, Dinheiro e Atenção: Como acelerar resultados',
    summary: 'Uma reflexão estratégica e de alto impacto sobre como dominar os três recursos mais escassos do mundo para acelerar resultados financeiros e liderar com eficiência.',
    venue: 'Palco Principal',
    audience: 'Empreendedores, gestores e investidores',
    startTime: '10:00',
    endTime: '11:00',
    speakers: [{ name: 'Gui Junqueira', role: 'Sócio da Link School of Business' }],
  }),
  createAgendaSession({
    id: 'agenda_21_painel_agreste_transformacao',
    category: 'Palco Principal',
    title: 'Painel: Agreste em Transformação — Inovação e Oportunidades',
    summary: 'Um olhar estratégico sobre o presente e o futuro do Agreste pernambucano, debatendo a sinergia entre inovação, educação e políticas públicas para o desenvolvimento regional.',
    venue: 'Palco Principal',
    audience: 'Ecossistema, poder público e lideranças',
    startTime: '11:00',
    endTime: '12:00',
    speakers: [
      { name: 'Teresa Maciel', role: 'Secretaria Executiva da SECTI' },
      { name: 'Pâmela Dias', role: 'Gestora do Porto Digital Caruaru' },
      { name: 'Mendonça Filho', role: 'Deputado Federal' },
      { name: 'Jaime Anselmo', role: 'SEDETEC Caruaru' },
      { name: 'Luverson Ferreira', role: 'Empresário e Conselheiro da ACIC' },
      { name: 'Profª Drª Claudia Brainer', role: 'Pesquisa ASCES-UNITA' },
      { name: 'Dilson Cavalcanti', role: 'Diretor UFPE Campus Agreste' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_maturidade_digital',
    category: 'Hotseat',
    title: 'Hotseat: Maturidade Digital no Interior',
    summary: 'Um bate-papo direto com construtores do ecossistema sobre como avaliar o real estágio da sua empresa antes de investir em novas ferramentas tecnológicas.',
    venue: 'Sala de Economia Criativa 02',
    audience: 'Empresas, consultores e lideranças',
    startTime: '11:00',
    endTime: '11:45',
    speakers: [
      { name: 'Rafael Soares', role: 'Tapioca Valley' },
      { name: 'Pamela Rita', role: 'Tapioca Valley' },
      { name: 'Fábio Moura', role: 'Caruá Hub' },
      { name: 'Deivid Figueiroa', role: 'Carua Hub' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_erros_caros',
    category: 'Hotseat',
    title: 'Hotseat: Erros Caros em Projetos de Tecnologia',
    summary: 'Lições práticas e reais de quem já enfrentou atrasos e retrabalhos. Descubra como evitar armadilhas e otimizar o retorno em seus projetos de inovação.',
    venue: 'Sala de Empreendedorismo',
    audience: 'Empresas, devs e gestores de projetos',
    startTime: '11:00',
    endTime: '11:45',
    speakers: [
      { name: 'Arthur Bessone', role: 'Tapioca Valley' },
      { name: 'João Moisés', role: 'Manguezal' },
      { name: 'Vandilma Benevides', role: 'Caruá Hub' },
      { name: 'Inácio Ferreira', role: 'Caruá Hub' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_intervalo_almoco',
    category: 'Intervalo',
    title: 'Intervalo Livre e Almoço',
    summary: 'Momento reservado para almoço e networking na Arena Foodtruck. Aproveite para visitar a Mostra de Startups, a Feira das Mulheres Empreendedoras e circular pelo evento.',
    venue: 'Area de Alimentacao',
    audience: 'Público geral',
    startTime: '12:00',
    endTime: '13:00',
    speakers: [{ name: 'Arena Foodtruck & Startups', role: 'Funcionamento Livre' }],
  }),
  createAgendaSession({
    id: 'agenda_21_pitch_open_mic',
    category: 'Palco Principal',
    title: 'Pitch de Startups & Open Mic',
    summary: 'Sessão dinâmica e empolgante de apresentações rápidas. Startups e comunidades ganham o palco para expor soluções inovadoras que estão movimentando a região.',
    venue: 'Palco Principal',
    audience: 'Empreendedores, comunidade e investidores',
    startTime: '13:00',
    endTime: '14:00',
    speakers: [{ name: 'Startups e Comunidades', role: 'Pitches Rápidos de 3 minutos' }],
  }),
  createAgendaSession({
    id: 'agenda_21_oficina_gamelab_02',
    category: 'Oficina Game',
    title: 'Oficina 02: GameLab — Do zero ao jogo na prática',
    summary: 'Segunda rodada de imersão no laboratório de criação de jogos. Continuação da trilha prática conduzida pela Playnambuco na Arena Porto Digital.',
    venue: 'Sala da Arena Gamer',
    audience: 'Estudantes, devs e criadores',
    startTime: '13:00',
    endTime: '15:00',
    speakers: [
      { name: 'Gustavo Tenório', role: 'Playnambuco' },
      { name: 'Rafael Silva', role: 'Playnambuco' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_painel_mobilidade_futuro',
    category: 'Palco Principal',
    title: 'Mobilidade do Futuro: Energia, IA e Veículos Inteligentes',
    summary: 'Descubra como a inteligência artificial, a transição energética e os sistemas inteligentes estão redesenhando a mobilidade e criando novas cadeias produtivas no Brasil.',
    venue: 'Palco Principal',
    audience: 'Indústria, tecnologia e inovação',
    startTime: '14:00',
    endTime: '15:00',
    speakers: [
      { name: 'João Moisés', role: 'Voxar Labs / Manguezal' },
      { name: 'Artur Bezerra', role: 'EPTAR e Tapioca Valley' },
      { name: 'Prof. Antônio Almeida', role: 'UNINASSAU Caruaru' },
      { name: 'Jackson Carvalho', role: 'ACIC' },
      { name: 'Bruno Brasil', role: 'Inovação SENAI' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_tecnologia_gestao',
    category: 'Hotseat',
    title: 'Hotseat: Tecnologia resolve gestão?',
    summary: 'Uma discussão franca e objetiva sobre os limites práticos entre adotar novas ferramentas, aprimorar processos e mudar a cultura organizacional nas empresas do Agreste.',
    venue: 'Sala de Economia Criativa 02',
    audience: 'Empresários, gestores e consultores',
    startTime: '14:00',
    endTime: '14:45',
    speakers: [
      { name: 'Pamela Rita', role: 'Tapioca Valley' },
      { name: 'Arthur Bessone', role: 'Tapioca Valley' },
      { name: 'Felipe Belone', role: 'Tapioca Valley' },
      { name: 'Fábio Moura', role: 'Caruá Hub' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_ecossistema_pratica',
    category: 'Hotseat',
    title: 'Hotseat: Ecossistema na Prática',
    summary: 'Insights valiosos sobre como empresas, especialistas e empreendedores podem atuar de forma colaborativa para solucionar gargalos estruturais no desenvolvimento de negócios.',
    venue: 'Sala de Empreendedorismo',
    audience: 'Empreendedores e articuladores do ecossistema',
    startTime: '14:00',
    endTime: '14:45',
    speakers: [
      { name: 'Hildegard Assis', role: 'Tapioca Valley' },
      { name: 'Pâmela Dias', role: 'Tapioca Valley' },
      { name: 'Inácio Ferreira', role: 'Caruá Hub' },
      { name: 'Ana Amorim', role: 'Varejo Venture' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_palestra_ian_rochlin',
    category: 'Palco Principal',
    title: 'De uma Comunidade Global de Games ao Shark Tank',
    summary: 'A inspiradora trajetória do fundador da GameJamPlus. Descubra como a união autêntica entre games, criatividade e comunidade gerou um negócio de projeção internacional.',
    venue: 'Palco Principal',
    audience: 'Games, criadores, startups e investidores',
    startTime: '15:00',
    endTime: '16:00',
    speakers: [{ name: 'Ian Freitas Rochlin', role: 'Fundador da GameJamPlus' }],
  }),
  createAgendaSession({
    id: 'agenda_21_jornada_inove_ai',
    category: 'Palco Principal',
    title: 'II Jornada INOVE AI',
    summary: 'O ápice da inovação aplicada. Apresentação das soluções criadas pelos Squads, avaliação técnica da banca e o grande anúncio dos selecionados para a final estadual da SECTI.',
    venue: 'Palco Principal',
    audience: 'Ecossistema, squads, banca e investidores',
    startTime: '16:00',
    endTime: '17:00',
    speakers: [
      { name: 'Fábio Moura', role: 'Banca Avaliadora' },
      { name: 'Ana Amorim', role: 'Banca avaliadora' },
      { name: 'Tenório', role: 'Banca avaliadora' },
      { name: 'Pâmela Dias', role: 'Institucional' },
      { name: 'Manoel Guedes', role: 'Institucional' },
      { name: 'Squads Participantes', role: 'CAIS, Flow+, Sinapse, ServeWIN, Queer' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_encerramento',
    category: 'Palco Principal',
    title: 'Encerramento Geral',
    summary: 'Celebração das conexões geradas durante o Startup Day 2026. Agradecimentos oficiais e a mensagem final de incentivo ao ecossistema de inovação do Agreste.',
    venue: 'Palco Principal',
    audience: 'Público geral',
    startTime: '17:00',
    endTime: '17:15',
    speakers: [{ name: 'Sebrae e Parceiros', role: 'Agradecimento e Fechamento' }],
  }),
];
