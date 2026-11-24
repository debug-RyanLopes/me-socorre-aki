import { STATUS_LABEL } from '../lib/labels';
import type { TicketStatus } from '../lib/types';

export function StatusChip({ status }: { status: TicketStatus }) {
  return <span className={`chip chip-${status}`}>{STATUS_LABEL[status]}</span>;
}
