import { formatDateTime, formatFileSize, ROLE_LABEL } from '../lib/labels';
import type { AttachmentRef, TicketComment } from '../lib/types';

export function AttachmentLinks({ attachments }: { attachments: AttachmentRef[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="attachments">
      {attachments.map((attachment) => (
        <a key={attachment.id} className="attachment" href={`/api/attachments/${attachment.id}`}>
          {attachment.originalName} · {formatFileSize(attachment.size)}
        </a>
      ))}
    </div>
  );
}

export function TicketThread({ comments }: { comments: TicketComment[] }) {
  if (comments.length === 0) return <p className="muted">Ainda não há comentários neste chamado.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {comments.map((comment) => (
        <article key={comment.id} className={comment.visibility === 'INTERNAL' ? 'comment internal' : 'comment'}>
          <div className="comment-head">
            <span>
              <strong>{comment.author.name}</strong>{' '}
              <span className="muted">· {ROLE_LABEL[comment.author.role]}</span>
            </span>
            <span className="when">{formatDateTime(comment.createdAt)}</span>
          </div>
          {comment.visibility === 'INTERNAL' ? (
            <span className="internal-tag">Observação interna · visível só para a TI</span>
          ) : null}
          <p>{comment.body}</p>
          <AttachmentLinks attachments={comment.attachments} />
        </article>
      ))}
    </div>
  );
}
