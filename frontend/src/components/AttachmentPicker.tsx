import { ChangeEvent, useId, useState } from 'react';
import { formatFileSize } from '../lib/labels';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 5;
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf'];

interface AttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
}

export function validateFiles(candidate: File[]): string | null {
  if (candidate.length > MAX_FILES) return `Envie no máximo ${MAX_FILES} arquivos por vez.`;
  for (const file of candidate) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(extension)) return `Formato não permitido: ${file.name}. Use PNG, JPG ou PDF.`;
    if (file.size > MAX_FILE_BYTES) return `${file.name} excede ${formatFileSize(MAX_FILE_BYTES)}.`;
    if (file.size === 0) return `${file.name} está vazio.`;
  }
  return null;
}

export function AttachmentPicker({ files, onChange }: AttachmentPickerProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    const next = [...files, ...selected];
    const problem = validateFiles(next);
    setError(problem);
    if (!problem) onChange(next);
  };

  return (
    <div className="field">
      <span className="label">Anexos <span className="muted small">(opcional)</span></span>
      <div className="btn-row">
        <label htmlFor={inputId} className="btn">
          Escolher arquivos
        </label>
        <input
          id={inputId}
          className="sr-only"
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.pdf"
          onChange={handleSelect}
        />
        <span className="hint">PNG, JPG ou PDF, até 5 MB por arquivo, no máximo 5 arquivos</span>
      </div>
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : null}
      {files.length > 0 ? (
        <ul className="attachments" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="attachment">
              {file.name} · {formatFileSize(file.size)}
              <button
                type="button"
                className="link-button"
                aria-label={`Remover ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
