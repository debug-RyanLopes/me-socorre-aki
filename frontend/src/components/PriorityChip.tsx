import { PRIORITY_LABEL } from '../lib/labels';
import type { Priority } from '../lib/types';

export function PriorityChip({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  return <span className={`chip chip-${priority}`}>{PRIORITY_LABEL[priority]}</span>;
}
