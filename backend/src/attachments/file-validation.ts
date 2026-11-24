import { BadRequestException } from '@nestjs/common';

interface Signature {
  mime: string;
  exts: string[];
  bytes: number[];
}

const SIGNATURES: Signature[] = [
  { mime: 'image/png', exts: ['png'], bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', exts: ['jpg', 'jpeg'], bytes: [0xff, 0xd8, 0xff] },
  { mime: 'application/pdf', exts: ['pdf'], bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

export interface UploadLimits {
  maxBytes: number;
  maxFiles: number;
}

export function uploadLimits(env: NodeJS.ProcessEnv = process.env): UploadLimits {
  return {
    maxBytes: Number(env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024,
    maxFiles: Number(env.MAX_FILES_PER_REQUEST ?? 5),
  };
}

export function validateUpload(
  file: { originalname: string; buffer: Buffer; size: number },
  maxBytes: number,
): { mime: string } {
  if (file.size === 0 || file.size > maxBytes) {
    throw new BadRequestException('Arquivo vazio ou acima do tamanho máximo.');
  }
  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  const sig = SIGNATURES.find((s) => s.bytes.every((b, i) => file.buffer[i] === b));
  if (!sig || !sig.exts.includes(ext)) {
    throw new BadRequestException('Tipo de arquivo não permitido.');
  }
  return { mime: sig.mime };
}
