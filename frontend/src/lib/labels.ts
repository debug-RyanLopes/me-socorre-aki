import type { EquipmentType, Priority, Role, TicketEvent, TicketStatus } from './types';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  WAITING_START: 'Aguardando iniciar',
  WAITING_USER: 'Aguardando usuário',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: 'Funcionário',
  TECHNICIAN: 'Técnico de TI',
  ADMIN: 'Administrador',
};

export const EQUIPMENT_TYPE_LABEL: Record<EquipmentType, string> = {
  NOTEBOOK: 'Notebook',
  DESKTOP: 'Desktop',
  PRINTER: 'Impressora',
  PERIPHERAL: 'Periférico',
  OTHER: 'Outro',
};

export const AFFECTED_OPTIONS = [
  { value: 'SELF', label: 'Apenas eu' },
  { value: 'FEW', label: 'Algumas pessoas' },
  { value: 'SECTOR', label: 'Um setor inteiro' },
  { value: 'COMPANY', label: 'Vários setores ou a empresa toda' },
];

export const BLOCKING_OPTIONS = [
  { value: 'NONE', label: 'Não, o trabalho continua normalmente' },
  { value: 'LIMITED', label: 'Continua com limitações' },
  { value: 'BLOCKED', label: 'Estou impossibilitado de trabalhar' },
];

export const ALTERNATIVE_OPTIONS = [
  { value: 'YES', label: 'Sim' },
  { value: 'NO', label: 'Não' },
  { value: 'UNKNOWN', label: 'Não sei informar' },
];

export const QUESTION_LABEL: Record<string, string> = {
  AFFECTED: 'Pessoas afetadas',
  BLOCKING: 'Impede o trabalho',
  ALTERNATIVE: 'Alternativa temporária',
};

export const OPTION_LABEL: Record<string, string> = Object.fromEntries(
  [...AFFECTED_OPTIONS, ...BLOCKING_OPTIONS, ...ALTERNATIVE_OPTIONS].map((o) => [o.value, o.label]),
);

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : '-';
}

export function formatDate(value: string | null | undefined): string {
  return value ? dateOnly.format(new Date(value)) : '-';
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h ${Math.floor((seconds % 3600) / 60)}min`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function payloadText(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value ? value : null;
}

export function describeEvent(event: TicketEvent): string {
  const actor = event.actor?.name ?? 'Sistema';
  const reason = payloadText(event.payload, 'reason');
  const justification = payloadText(event.payload, 'justification');
  switch (event.type) {
    case 'CREATED':
      return `Chamado criado por ${actor}`;
    case 'ASSIGNED':
      return `Atribuído a ${payloadText(event.payload, 'assigneeName') ?? 'um técnico'}`;
    case 'TRIAGED':
      return `Triagem feita por ${actor}; status Aguardando iniciar`;
    case 'PRIORITY_CHANGED': {
      const from = PRIORITY_LABEL[event.payload.from as Priority] ?? '-';
      const to = PRIORITY_LABEL[event.payload.to as Priority] ?? '-';
      return `${actor} alterou a prioridade de ${from} para ${to}${justification ? `: ${justification}` : ''}`;
    }
    case 'INFO_REQUESTED':
      return `${actor} pediu informações; status Aguardando usuário`;
    case 'USER_REPLIED':
      return `${actor} respondeu; status Aguardando iniciar`;
    case 'RESOLVED':
      return `${actor} registrou a solução; status Resolvido`;
    case 'CLOSED':
      return `${actor} confirmou a resolução; status Fechado`;
    case 'RESOLUTION_REJECTED':
      return `${actor} informou que o problema persiste${reason ? `: ${reason}` : ''}`;
    case 'REOPENED':
      return `${actor} reabriu o chamado${reason ? `: ${reason}` : ''}`;
    case 'CANCELLED':
      return `${actor} cancelou o chamado${reason ? `: ${reason}` : ''}`;
    case 'SERIAL_CORRECTED':
      return `${actor} corrigiu o serial para ${payloadText(event.payload, 'to') ?? '-'}`;
    case 'EQUIPMENT_LINKED':
      return `Equipamento ${payloadText(event.payload, 'serial') ?? ''} vinculado ao chamado`;
    default:
      return event.type;
  }
}

export function homePathFor(role: Role): string {
  return role === 'EMPLOYEE' ? '/my-tickets' : '/queue';
}
