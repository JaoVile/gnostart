import type { AgendaDayId, AgendaSession } from '../types';

export const AGENDA_EVENT_DATE_ISO = '2026-03-21';

export const agendaDays: { id: AgendaDayId; weekday: string; dateLabel: string }[] = [
  { id: '21', weekday: 'SAB', dateLabel: '21' },
];

const saturdayAgendaMeta: Pick<AgendaSession, 'dayId' | 'weekday' | 'dateLabel'> = {
  dayId: '21',
  weekday: 'SAB',
  dateLabel: '21',
};

const agendaCategoryAccents: Record<string, string> = {
  'Palco Principal': '#6a38d0',
  'Arena Experiencia': '#8d6fe7',
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
  'Laboratorio Game': 2,
  'Sala de Economia Criativa 01': 3,
  'Sala de Economia Criativa 02': 4,
  'Arena Experiencia': 5,
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
    summary:
      'Recepcao inicial, credenciamento e orientacoes de chegada para abrir o unico dia oficial do evento com fluxo organizado.',
    venue: 'Recepcao e Credenciamento',
    audience: 'Publico geral',
    startTime: '09:00',
    endTime: '09:45',
    linkedPoiId: 'credenciamento',
    speakers: [{ name: 'Equipe do evento', role: 'Credenciamento e recepcao' }],
  }),
  createAgendaSession({
    id: 'agenda_21_arena_experiencia',
    category: 'Arena Experiencia',
    title: 'Espacos dos parceiros abertos ao publico',
    summary:
      'Arena Experiencia com SENAI - Sistema FIEPE, SENAC, Jardim Digital, ASCES e UNINASSAU funcionando continuamente das 09h as 17h.',
    venue: 'Arena Experiencia',
    audience: 'Circulacao livre',
    startTime: '09:00',
    endTime: '17:00',
    linkedPoiId: 'arena_experiencia',
    speakers: [{ name: 'Parceiros do evento', role: 'Ativacoes abertas' }],
  }),
  createAgendaSession({
    id: 'agenda_21_oficina_gamelab_01',
    category: 'Oficina Game',
    title: 'Oficina 01: GameLab - Do zero ao jogo: criando experiencias na pratica',
    summary:
      'Oficina pratica na Arena Porto Digital com Gustavo Tenorio e Rafael Silva, da Playnambuco, focada em criacao de jogos do zero.',
    venue: 'Laboratorio Game',
    audience: 'Estudantes, devs e criadores',
    startTime: '09:00',
    endTime: '11:00',
    linkedPoiId: 'laboratorio_game',
    speakers: [
      { name: 'Gustavo Tenorio', role: 'Playnambuco' },
      { name: 'Rafael Silva', role: 'Playnambuco' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_abertura_institucional',
    category: 'Palco Principal',
    title: 'Abertura institucional',
    summary:
      'Boas-vindas oficiais ao Startup Day 2026 em Caruaru, com introducao do evento, contexto nacional e inicio da programacao do palco principal.',
    venue: 'Palco Principal',
    audience: 'Publico geral',
    startTime: '09:45',
    endTime: '10:00',
    linkedPoiId: 'palco_principal',
    speakers: [
      { name: 'Debora Florencio', role: 'Gerente da Unidade do Agreste Central e Setentrional do Sebrae' },
      { name: 'Pamela Dias', role: 'Gerente do Porto Digital' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_palestra_tempo_dinheiro_atencao',
    category: 'Palco Principal',
    title:
      'Palestra: Tempo, dinheiro e atencao - Acelere seus resultados financeiros dominando os tres recursos mais escassos do mundo',
    summary:
      'Gui Junqueira abre o conteudo do palco principal com uma reflexao sobre tempo, dinheiro e atencao. Os minutos finais do bloco ficam reservados para perguntas e transicao.',
    venue: 'Palco Principal',
    audience: 'Empreendedores, gestores e investidores',
    startTime: '10:00',
    endTime: '11:00',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Gui Junqueira', role: 'Palestrante' }],
  }),
  createAgendaSession({
    id: 'agenda_21_painel_agreste_transformacao',
    category: 'Palco Principal',
    title: 'Painel: Agreste em Transformacao - Inovacao, Desafios e Oportunidades',
    summary:
      'Debate estrategico sobre o presente e o futuro do Agreste pernambucano, conectando inovacao, educacao, politicas publicas, ambiente de negocios e desenvolvimento regional.',
    venue: 'Palco Principal',
    audience: 'Ecossistema de inovacao, poder publico e liderancas',
    startTime: '11:00',
    endTime: '12:00',
    linkedPoiId: 'palco_principal',
    speakers: [
      { name: 'Teresa Maciel', role: 'Secretaria Executiva da SECTI' },
      { name: 'Pamela Dias', role: 'Porto Digital Caruaru' },
      { name: 'Mendonca Filho', role: 'Deputado federal' },
      { name: 'Jaime Anselmo', role: 'SEDETEC Caruaru' },
      { name: 'Luverson Ferreira', role: 'Empresario e conselheiro da ACIC' },
      { name: 'Claudia Brainer', role: 'ASCES-UNITA' },
      { name: 'Dilson Cavalcanti', role: 'UFPE Campus Agreste' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_maturidade_digital',
    category: 'Hotseat',
    title: 'Hotseat: Maturidade digital no interior',
    summary:
      'Aprendendo com quem constroi empresas no ecossistema: como avaliar o estagio real da empresa antes de investir em novas ferramentas.',
    venue: 'Sala de Economia Criativa 01',
    audience: 'Empresas, consultores e liderancas',
    startTime: '11:00',
    endTime: '11:45',
    linkedPoiId: 'sala_economia_criativa_01',
    speakers: [
      { name: 'Rafael Soares', role: 'Tapioca Valley' },
      { name: 'Pamela Rita', role: 'Tapioca Valley' },
      { name: 'Fabio Moura', role: 'Carua Hub' },
      { name: 'Deivid Figueiroa', role: 'Carua Hub' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_erros_caros',
    category: 'Hotseat',
    title: 'Hotseat: Erros caros em projetos de tecnologia',
    summary:
      'Aprendendo com quem constroi empresas no ecossistema: aprendizados reais de quem ja enfrentou atrasos, retrabalho e baixo retorno em projetos de tecnologia.',
    venue: 'Sala de Economia Criativa 02',
    audience: 'Empresas, devs e gestores de projetos',
    startTime: '11:00',
    endTime: '11:45',
    linkedPoiId: 'sala_economia_criativa_02',
    speakers: [
      { name: 'Arthur Bessone', role: 'Tapioca Valley' },
      { name: 'Joao Moizes', role: 'Manguezal' },
      { name: 'Vandilma Benevides', role: 'Carua Hub' },
      { name: 'Inacio Ferreira', role: 'Carua Hub' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_intervalo_almoco',
    category: 'Intervalo',
    title: 'Intervalo para almoco',
    summary:
      'Pausa do palco principal para almoco, networking, Arena Foodtruck, mostra de startups, Feira das Mulheres Empreendedoras e circulacao pelos espacos parceiros.',
    venue: 'Area de Alimentacao',
    audience: 'Publico geral',
    startTime: '12:00',
    endTime: '13:00',
    linkedPoiId: 'barracas_prefeitura',
    speakers: [{ name: 'Arena Foodtruck', role: 'Funcionamento livre' }],
  }),
  createAgendaSession({
    id: 'agenda_21_pitch_open_mic',
    category: 'Palco Principal',
    title: 'Pitch de Startups / Open Mic - Espaco aberto para ideias, negocios e conexoes',
    summary:
      'Bloco dinamico de pitches no palco principal, com apresentacoes rapidas de startups e comunidades. Cada participante tem 3 minutos e nao ha rodada de perguntas neste momento.',
    venue: 'Palco Principal',
    audience: 'Empreendedores, comunidade e investidores',
    startTime: '13:00',
    endTime: '14:00',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Startups e comunidades expositoras', role: 'Pitches de 3 minutos' }],
  }),
  createAgendaSession({
    id: 'agenda_21_oficina_gamelab_02',
    category: 'Oficina Game',
    title: 'Oficina 02: GameLab - Do zero ao jogo: criando experiencias na pratica',
    summary:
      'Segunda rodada do laboratorio GameLab na Arena Porto Digital, mantendo a trilha pratica de criacao de jogos com a Playnambuco.',
    venue: 'Laboratorio Game',
    audience: 'Estudantes, devs e criadores',
    startTime: '13:00',
    endTime: '15:00',
    linkedPoiId: 'laboratorio_game',
    speakers: [
      { name: 'Gustavo Tenorio', role: 'Playnambuco' },
      { name: 'Rafael Silva', role: 'Playnambuco' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_painel_mobilidade_futuro',
    category: 'Palco Principal',
    title: 'Painel: Mobilidade do Futuro - Energia, IA e Veiculos Inteligentes no Brasil',
    summary:
      'Painel sobre como energia, inteligencia artificial e sistemas inteligentes estao transformando a mobilidade e abrindo novas oportunidades para industria, cidades e negocios.',
    venue: 'Palco Principal',
    audience: 'Industria, tecnologia e mobilidade',
    startTime: '14:00',
    endTime: '15:00',
    linkedPoiId: 'palco_principal',
    speakers: [
      { name: 'Joao Moizes', role: 'Voxar Labs e Comunidade Manguezal' },
      { name: 'Artur Bezerra', role: 'EPTAR e Tapioca Valley' },
      { name: 'Antonio Almeida', role: 'UNINASSAU Caruaru' },
      { name: 'Jackson Carvalho', role: 'ACIC' },
      { name: 'Bruno Brasil', role: 'SENAI' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_tecnologia_gestao',
    category: 'Hotseat',
    title: 'Hotseat: Tecnologia resolve gestao?',
    summary:
      'Aprendendo com quem constroi empresas no ecossistema: os limites entre ferramenta, processo e cultura nas empresas do Agreste.',
    venue: 'Sala de Economia Criativa 01',
    audience: 'Empresarios, gestores e consultores',
    startTime: '14:00',
    endTime: '14:45',
    linkedPoiId: 'sala_economia_criativa_01',
    speakers: [
      { name: 'Pamela Rita', role: 'Tapioca Valley' },
      { name: 'Arthur Bessone', role: 'Tapioca Valley' },
      { name: 'Felipe Belone', role: 'Tapioca Valley' },
      { name: 'Fabio Moura', role: 'Carua Hub' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_ecossistema_pratica',
    category: 'Hotseat',
    title: 'Hotseat: Ecossistema na pratica',
    summary:
      'Aprendendo com quem constroi empresas no ecossistema: como empresas, especialistas e empreendedores podem resolver gargalos estruturais de forma colaborativa.',
    venue: 'Sala de Economia Criativa 02',
    audience: 'Empreendedores e articuladores do ecossistema',
    startTime: '14:00',
    endTime: '14:45',
    linkedPoiId: 'sala_economia_criativa_02',
    speakers: [
      { name: 'Hildegard Assis', role: 'Tapioca Valley' },
      { name: 'Pamela Dias', role: 'Tapioca Valley' },
      { name: 'Inacio Ferreira', role: 'Carua Hub' },
      { name: 'Ana Amorim', role: 'Varejo Venture' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_palestra_ian_rochlin',
    category: 'Palco Principal',
    title: 'Palestra: De uma comunidade global de games ao Shark Tank',
    summary:
      'Ian Freitas Rochlin compartilha a trajetoria que conecta games, comunidade, criatividade e empreendedorismo. Os minutos finais ficam reservados para perguntas e transicao.',
    venue: 'Palco Principal',
    audience: 'Games, criadores e startups',
    startTime: '15:00',
    endTime: '16:00',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Ian Freitas Rochlin', role: 'Palestrante' }],
  }),
  createAgendaSession({
    id: 'agenda_21_jornada_inove_ai',
    category: 'Palco Principal',
    title: 'II Jornada INOVE AI',
    summary:
      'Bloco final do palco principal com abertura institucional, apresentacao dos squads, avaliacao da banca e anuncio dos 2 squads selecionados para a final estadual da Arena dos Squads da SECTI.',
    venue: 'Palco Principal',
    audience: 'Ecossistema, squads, banca e investidores',
    startTime: '16:00',
    endTime: '17:00',
    linkedPoiId: 'palco_principal',
    speakers: [
      { name: 'Fabio Moura', role: 'Banca avaliadora' },
      { name: 'Ana Amorim', role: 'Banca avaliadora' },
      { name: 'Tenorio', role: 'Banca avaliadora' },
      { name: 'Pamela Dias', role: 'Anuncio final' },
      { name: 'Manoel Guedes', role: 'Anuncio final' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_encerramento',
    category: 'Palco Principal',
    title: 'Encerramento geral',
    summary:
      'Fechamento do Startup Day 2026 em Caruaru com agradecimentos, reforco das conexoes construidas no dia e mensagem final ao publico.',
    venue: 'Palco Principal',
    audience: 'Publico geral',
    startTime: '17:00',
    endTime: '17:15',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Organizacao do evento', role: 'Fechamento oficial' }],
  }),
];
