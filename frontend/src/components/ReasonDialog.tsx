import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';

interface ReasonDialogProps {
  title: string;
  description?: string;
  label: string;
  confirmLabel: string;
  variant?: 'primary' | 'danger' | 'success';
  busy?: boolean;
  error?: string | null;
  children?: ReactNode;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const CONFIRM_CLASS = {
  primary: 'btn btn-primary',
  danger: 'btn btn-danger-solid',
  success: 'btn btn-success',
};

export function ReasonDialog({
  title,
  description,
  label,
  confirmLabel,
  variant = 'primary',
  busy = false,
  error,
  children,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  const titleId = useId();
  const fieldId = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const missing = reason.trim().length === 0;

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!missing) onConfirm(reason.trim());
  };

  return (
    <div className="overlay">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit} noValidate>
        <h2 id={titleId}>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
        {children}
        <div className="field">
          <label htmlFor={fieldId}>
            {label}
            <span className="required" aria-hidden="true"> *</span>
          </label>
          <textarea
            id={fieldId}
            ref={textareaRef}
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={touched && missing ? true : undefined}
          />
          {touched && missing ? (
            <span className="error" role="alert">
              Este campo é obrigatório.
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="btn-row end">
          <button type="button" className="btn" onClick={onCancel}>
            Voltar
          </button>
          <button type="submit" className={CONFIRM_CLASS[variant]} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
