import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AttachmentPicker } from '../components/AttachmentPicker';
import { PriorityChip } from '../components/PriorityChip';
import { ReasonDialog } from '../components/ReasonDialog';
import { StatusChip } from '../components/StatusChip';
import { AttachmentLinks, TicketThread } from '../components/TicketThread';
import { useUsers } from '../hooks/useUsers';
import { useCreateComment, useTicket, useTicketAction, useTicketComments } from '../hooks/useTickets';
import { errorMessage } from '../lib/api-client';
import {
  describeEvent,
  formatDate,
  formatDateTime,
  OPTION_LABEL,
  PRIORITY_LABEL,
  QUESTION_LABEL,
} from '../lib/labels';
import { availableActions, canComment, TicketActionKey } from '../lib/ticket-actions';
import type { Priority } from '../lib/types';

type DialogKind = 'reopen' | 'cancel' | 'reject-resolution' | 'resolve' | 'request-info' | 'priority';

interface DialogSpec {
  title: string;
  description?: string;
  label: string;
  confirmLabel: string;
  variant: 'primary' | 'danger' | 'success';
  build: (text: string, extra: string) => { path: string; body: Record<string, unknown> };
}

const DIALOGS: Record<DialogKind, DialogSpec> = {
  reopen: {
    title: 'Reabrir chamado',
    description: 'O chamado volta para Aberto e retorna à fila da TI.',
    label: 'Motivo da reabertura',
    confirmLabel: 'Reabrir chamado',
    variant: 'primary',
    build: (text) => ({ path: 'reopen', body: { reason: text } }),
  },
  cancel: {
    title: 'Cancelar chamado',
    description: 'O chamado será cancelado e não poderá mais receber atendimento. Autor, data e justificativa ficam no histórico.',
    label: 'Justificativa',
    confirmLabel: 'Cancelar chamado',
    variant: 'danger',
    build: (text) => ({ path: 'cancel', body: { reason: text } }),
  },
  'reject-resolution': {
    title: 'O problema persiste',
    description: 'O chamado volta para Aberto e retorna à fila da TI.',
    label: 'O que ainda não funciona?',
    confirmLabel: 'Enviar à TI',
    variant: 'primary',
    build: (text) => ({ path: 'reject-resolution', body: { reason: text } }),
  },
  resolve: {
    title: 'Registrar solução',
    description: 'O chamado passa para Resolvido e o funcionário recebe uma notificação para confirmar.',
    label: 'Descrição da solução',
    confirmLabel: 'Marcar como resolvido',
    variant: 'success',
    build: (text) => ({ path: 'resolve', body: { solution: text } }),
  },
  'request-info': {
    title: 'Pedir informações',
    description: 'A pergunta é enviada como comentário público e o chamado passa para Aguardando usuário.',
    label: 'Pergunta ao funcionário',
    confirmLabel: 'Enviar pergunta',
    variant: 'primary',
    build: (text) => ({ path: 'request-info', body: { message: text } }),
  },
  priority: {
    title: 'Alterar prioridade',
    description: 'O histórico guarda a prioridade anterior, a nova, o autor e o momento.',
    label: 'Justificativa',
    confirmLabel: 'Salvar prioridade',
    variant: 'primary',
    build: (text, extra) => ({ path: 'priority', body: { priority: extra, justification: text } }),
  },
};

const ACTION_DIALOG: Partial<Record<TicketActionKey, DialogKind>> = {
  cancel: 'cancel',
  reopen: 'reopen',
  'reject-resolution': 'reject-resolution',
  resolve: 'resolve',
  'request-info': 'request-info',
  priority: 'priority',
};

export function TicketDetailPage() {
  const params = useParams();
  const ticketId = Number(params.id);
  const { user } = useAuth();
  const ticket = useTicket(ticketId);
  const comments = useTicketComments(ticketId);
  const action = useTicketAction(ticketId);
  const createComment = useCreateComment(ticketId);
  const technicians = useUsers({ role: 'TECHNICIAN', active: 'true', pageSize: 100 }, user?.role === 'ADMIN');

  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [newPriority, setNewPriority] = useState<Priority>('HIGH');
  const [commentText, setCommentText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [serial, setSerial] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (!user) return null;
  if (ticket.isLoading) return <p className="muted" role="status" style={{ padding: 32 }}>Carregando…</p>;
  if (ticket.isError || !ticket.data) {
    return (
      <div className="container narrow">
        <p className="alert alert-error" role="alert">
          Chamado não encontrado.
        </p>
        <Link to="/">Voltar</Link>
      </div>
    );
  }

  const detail = ticket.data;
  const isStaff = user.role !== 'EMPLOYEE';
  const actions = availableActions(detail, user);
  const has = (key: TicketActionKey) => actions.includes(key);
  const backPath = isStaff ? '/queue' : '/my-tickets';

  const run = (path: string, body?: unknown) => {
    setMessage(null);
    action.mutate({ path, body }, { onSuccess: () => setDialog(null) });
  };

  const openDialog = (kind: DialogKind) => {
    action.reset();
    if (kind === 'priority') setNewPriority(detail.priority === 'HIGH' ? 'CRITICAL' : 'HIGH');
    setDialog(kind);
  };

  const submitComment = (visibility: 'PUBLIC' | 'INTERNAL') => (event: FormEvent) => {
    event.preventDefault();
    if (!commentText.trim()) {
      setMessage('Escreva o comentário antes de enviar.');
      return;
    }
    const form = new FormData();
    form.set('body', commentText.trim());
    form.set('visibility', visibility);
    files.forEach((file) => form.append('files', file));
    createComment.mutate(form, {
      onSuccess: () => {
        setCommentText('');
        setFiles([]);
        setMessage(null);
      },
      onError: (error) => setMessage(errorMessage(error)),
    });
  };

  const spec = dialog ? DIALOGS[dialog] : null;

  return (
    <div className="container medium" style={{ maxWidth: isStaff ? 1280 : 1000 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link to={backPath} style={{ fontSize: 14, textDecoration: 'none' }}>
          ← Voltar
        </Link>
        <div className="btn-row">
          <h1>
            {detail.code} · {detail.title ?? detail.summary.slice(0, 60)}
          </h1>
          <StatusChip status={detail.status} />
          {isStaff ? <PriorityChip priority={detail.priority} /> : null}
        </div>
        <p className="muted">
          {detail.serialInformed}
          {detail.equipment ? ` · ${detail.equipment.manufacturer} ${detail.equipment.model}` : ' · equipamento pendente de validação'}
          {detail.assignee ? ` · Responsável: ${detail.assignee.name}` : ' · sem responsável'}
        </p>
      </div>

      {action.isError && !dialog ? (
        <p className="alert alert-error" role="alert">
          {errorMessage(action.error)}
        </p>
      ) : null}

      {!isStaff && detail.status === 'RESOLVED' ? (
        <section className="card card-success" aria-labelledby="solution-title">
          <h2 id="solution-title">A TI registrou a solução</h2>
          <p>{detail.solution}</p>
          <p className="small">O problema foi resolvido? Sua confirmação fecha o chamado.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-success" disabled={action.isPending} onClick={() => run('confirm')}>
              Confirmar resolução
            </button>
            <button type="button" className="btn btn-outline-accent" onClick={() => openDialog('reject-resolution')}>
              O problema persiste
            </button>
          </div>
        </section>
      ) : null}

      {isStaff && detail.solution && detail.status === 'RESOLVED' ? (
        <section className="card card-success">
          <h2>Solução registrada</h2>
          <p>{detail.solution}</p>
        </section>
      ) : null}

      <div className="split">
        <div className="main">
          <section className="card">
            <h2>Descrição do problema</h2>
            <p style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{detail.description}</p>
            <AttachmentLinks attachments={detail.attachments} />
          </section>

          <h2>Conversa</h2>
          {comments.data ? <TicketThread comments={comments.data} /> : <p className="muted">Carregando conversa…</p>}

          {canComment(detail) ? (
            <form className="card" onSubmit={submitComment('PUBLIC')} noValidate>
              <label htmlFor="comment-body" style={{ fontSize: 14, fontWeight: 600 }}>
                {isStaff ? 'Novo comentário' : 'Adicionar comentário'}
              </label>
              <textarea
                id="comment-body"
                rows={3}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <AttachmentPicker files={files} onChange={setFiles} />
              {message ? (
                <p className="alert alert-error" role="alert">
                  {message}
                </p>
              ) : null}
              <div className="btn-row end">
                {isStaff ? (
                  <button type="button" className="btn" disabled={createComment.isPending} onClick={submitComment('INTERNAL')}>
                    Salvar observação interna
                  </button>
                ) : null}
                <button type="submit" className="btn btn-primary" disabled={createComment.isPending}>
                  {isStaff ? 'Enviar ao funcionário' : 'Enviar'}
                </button>
              </div>
            </form>
          ) : (
            <p className="muted">Este chamado está encerrado e não aceita novos comentários.</p>
          )}
        </div>

        <aside className="side">
          {isStaff ? (
            <section className="card" aria-labelledby="care-title">
              <h2 id="care-title">Atendimento</h2>
              <p className="muted small">
                {detail.suggestedPriority
                  ? `Prioridade sugerida: ${PRIORITY_LABEL[detail.suggestedPriority]}`
                  : null}
              </p>
              <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                {has('assume') ? (
                  <button type="button" className="btn btn-primary" disabled={action.isPending} onClick={() => run('assume')}>
                    Assumir chamado
                  </button>
                ) : null}
                {has('triage') ? (
                  <button type="button" className="btn btn-outline-accent" disabled={action.isPending} onClick={() => run('triage', {})}>
                    Confirmar prioridade e iniciar
                  </button>
                ) : null}
                {has('request-info') ? (
                  <button type="button" className="btn" onClick={() => openDialog('request-info')}>
                    Pedir informações
                  </button>
                ) : null}
                {has('resolve') ? (
                  <button type="button" className="btn btn-success" onClick={() => openDialog('resolve')}>
                    Registrar solução
                  </button>
                ) : null}
                {has('priority') ? (
                  <button type="button" className="btn" onClick={() => openDialog('priority')}>
                    Alterar prioridade
                  </button>
                ) : null}
                {has('cancel') ? (
                  <button type="button" className="btn btn-danger" onClick={() => openDialog('cancel')}>
                    Cancelar chamado
                  </button>
                ) : null}
              </div>
              {has('assign') ? (
                <div className="field">
                  <label htmlFor="assignee">Atribuir a um técnico</label>
                  <div className="btn-row">
                    <select id="assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                      <option value="">Selecione</option>
                      {(technicians.data?.items ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn"
                      disabled={!assigneeId || action.isPending}
                      onClick={() => run('assign', { assigneeId: Number(assigneeId) })}
                    >
                      Atribuir
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="card">
              <h2>Outras ações</h2>
              {has('reopen') ? (
                <>
                  <p className="muted small">Você pode reabrir este chamado até {formatDate(detail.reopenUntil)}.</p>
                  <button type="button" className="btn btn-primary" onClick={() => openDialog('reopen')}>
                    Reabrir chamado
                  </button>
                </>
              ) : null}
              {has('cancel') ? (
                <button type="button" className="btn btn-danger" onClick={() => openDialog('cancel')}>
                  Cancelar chamado
                </button>
              ) : null}
              {!has('reopen') && !has('cancel') ? (
                <p className="muted small">Depois de fechado, você pode reabrir o chamado por até 3 dias, informando o motivo.</p>
              ) : null}
            </section>
          )}

          {isStaff ? (
            <section className="card">
              <h2>Solicitante e equipamento</h2>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                {detail.requesterName}
                <br />
                {detail.requesterEmail}
                <br />
                Setor: {detail.sector.name}
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <span className="mono">{detail.serialInformed}</span>
                <br />
                {detail.equipment ? `${detail.equipment.manufacturer} ${detail.equipment.model}` : 'Pendente de validação'}
              </p>
              <p className="muted small">
                Impacto: {QUESTION_LABEL.AFFECTED}: {OPTION_LABEL[detail.impact.affected] ?? detail.impact.affected} ·{' '}
                {QUESTION_LABEL.BLOCKING}: {OPTION_LABEL[detail.impact.blocking] ?? detail.impact.blocking} ·{' '}
                {QUESTION_LABEL.ALTERNATIVE}: {OPTION_LABEL[detail.impact.alternative] ?? detail.impact.alternative}
              </p>
              {has('serial') ? (
                <form
                  className="field"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (serial.trim()) run('serial', { serial });
                  }}
                >
                  <label htmlFor="serial-fix">Corrigir serial do chamado</label>
                  <div className="btn-row">
                    <input id="serial-fix" type="text" className="mono" value={serial} onChange={(event) => setSerial(event.target.value)} />
                    <button type="submit" className="btn" disabled={action.isPending}>
                      Salvar
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          ) : null}

          <section className="card">
            <h2>Histórico</h2>
            <ul className="history">
              {detail.events.map((event) => (
                <li key={event.id}>
                  <span className="when">{formatDateTime(event.createdAt)}</span>
                  <br />
                  {describeEvent(event)}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {dialog && spec ? (
        <ReasonDialog
          title={spec.title}
          description={spec.description}
          label={spec.label}
          confirmLabel={spec.confirmLabel}
          variant={spec.variant}
          busy={action.isPending}
          error={action.isError ? errorMessage(action.error) : null}
          onCancel={() => setDialog(null)}
          onConfirm={(text) => {
            const request = spec.build(text, newPriority);
            run(request.path, request.body);
          }}
        >
          {dialog === 'priority' ? (
            <div className="field">
              <label htmlFor="new-priority">Nova prioridade</label>
              <select id="new-priority" value={newPriority} onChange={(event) => setNewPriority(event.target.value as Priority)}>
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((key) => (
                  <option key={key} value={key}>
                    {PRIORITY_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </ReasonDialog>
      ) : null}
    </div>
  );
}
