export function formatTicketCode(id: number): string {
  return `CH-${String(id).padStart(6, '0')}`;
}
