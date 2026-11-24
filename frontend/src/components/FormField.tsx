import { cloneElement, isValidElement, ReactElement, ReactNode, useId } from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}

export function FormField({ label, required, hint, error, children }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
    : children;

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? <span className="required" aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {hint ? (
        <span id={hintId} className="hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
