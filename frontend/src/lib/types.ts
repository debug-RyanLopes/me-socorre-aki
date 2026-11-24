export type Role = 'EMPLOYEE' | 'TECHNICIAN' | 'ADMIN';
export type TicketStatus = 'OPEN' | 'WAITING_START' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Visibility = 'PUBLIC' | 'INTERNAL';
export type EquipmentType = 'NOTEBOOK' | 'DESKTOP' | 'PRINTER' | 'PERIPHERAL' | 'OTHER';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  login: string;
  role: Role;
  sectorId: number;
  mustChangePassword: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NamedRef {
  id: number;
  name: string;
}

export interface TicketListItem {
  id: number;
  code: string;
  title: string | null;
  summary: string;
  status: TicketStatus;
  priority: Priority | null;
  requesterId: number;
  requesterName: string;
  sector: NamedRef;
  category: NamedRef | null;
  serialInformed: string;
  equipment: { id: number; serial: string; manufacturer: string; model: string } | null;
  equipmentPending: boolean;
  assignee: NamedRef | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface TicketEvent {
  id: number;
  type: string;
  actor: NamedRef | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AttachmentRef {
  id: number;
  originalName: string;
  mime: string;
  size: number;
}

export interface TicketDetail extends TicketListItem {
  description: string;
  requesterEmail: string;
  solution: string | null;
  cancelledAt: string | null;
  assignedAt: string | null;
  impact: { affected: string; blocking: string; alternative: string };
  suggestedPriority: Priority | null;
  reopenUntil: string | null;
  events: TicketEvent[];
  attachments: AttachmentRef[];
}

export interface TicketComment {
  id: number;
  ticketId: number;
  body: string;
  visibility: Visibility;
  createdAt: string;
  author: { id: number; name: string; role: Role };
  attachments: AttachmentRef[];
}

export interface UserView {
  id: number;
  name: string;
  email: string;
  login: string;
  role: Role;
  sectorId: number;
  sectorName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  temporaryPassword?: string;
}

export interface CatalogItem {
  id: number;
  name: string;
  active: boolean;
}

export interface EquipmentView {
  id: number;
  serial: string;
  type: EquipmentType;
  manufacturer: string;
  model: string;
  sectorId: number;
  sectorName: string;
  assetTag: string | null;
  notes: string | null;
  ticketCount: number;
  linkedTickets?: number;
}

export interface PendingSerial {
  serial: string;
  ticketCount: number;
  tickets: { id: number; requesterName: string; createdAt: string }[];
}

export interface NotificationItem {
  id: number;
  ticketId: number;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface CountRow {
  key: string;
  name: string;
  count: number;
}

export interface ReportSummary {
  period: string;
  from: string;
  to: string;
  totals: { total: number; resolvedOrClosed: number; unassignedNow: number; avgResolutionSeconds: number | null };
  byStatus: CountRow[];
  bySector: CountRow[];
  byCategory: CountRow[];
  byTechnician: CountRow[];
  topEquipment: CountRow[];
}

export interface PriorityRules {
  weights: { question: 'AFFECTED' | 'BLOCKING' | 'ALTERNATIVE'; option: string; points: number }[];
  thresholds: { priority: Priority; minScore: number }[];
}
