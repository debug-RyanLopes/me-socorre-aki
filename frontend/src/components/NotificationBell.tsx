import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarkAllRead, useMarkRead, useNotificationList, useUnreadCount } from '../hooks/useNotifications';
import { formatDateTime } from '../lib/labels';
import type { NotificationItem } from '../lib/types';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const list = useNotificationList(open);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const count = unread.data?.count ?? 0;

  const openNotification = async (item: NotificationItem) => {
    if (!item.readAt) await markRead.mutateAsync(item.id);
    setOpen(false);
    navigate(`/tickets/${item.ticketId}`);
  };

  return (
    <div className="bell">
      <button
        type="button"
        className="bell-button"
        aria-label={count > 0 ? `Notificações, ${count} não lidas` : 'Notificações'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 ? <span className="bell-badge" aria-hidden="true">{count}</span> : null}
      </button>
      {open ? (
        <div className="bell-panel" role="region" aria-label="Caixa de notificações">
          <header>
            <h2>Notificações</h2>
            <button type="button" className="link-button" disabled={count === 0} onClick={() => markAll.mutate()}>
              Marcar todas como lidas
            </button>
          </header>
          {list.isLoading ? <p className="bell-empty">Carregando…</p> : null}
          {list.data && list.data.length === 0 ? <p className="bell-empty">Nenhuma notificação.</p> : null}
          <ul>
            {(list.data ?? []).map((item) => (
              <li key={item.id} className={item.readAt ? '' : 'unread'}>
                <button type="button" onClick={() => void openNotification(item)}>
                  {item.message}
                  <br />
                  <span className="muted small">{formatDateTime(item.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
