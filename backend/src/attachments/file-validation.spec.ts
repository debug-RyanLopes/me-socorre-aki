import { BadRequestException } from '@nestjs/common';
import { uploadLimits, validateUpload } from './file-validation';

const MAX = 5 * 1024 * 1024;
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const pdf = Buffer.from('%PDF-1.7\n', 'latin1');
const exe = Buffer.from('MZ\x90\x00', 'latin1');

function file(originalname: string, buffer: Buffer, size = buffer.length) {
  return { originalname, buffer, size };
}

describe('validateUpload', () => {
  it('aceita PNG, JPG, JPEG e PDF com assinatura e extensão coerentes', () => {
    expect(validateUpload(file('a.png', png), MAX).mime).toBe('image/png');
    expect(validateUpload(file('a.JPG', jpg), MAX).mime).toBe('image/jpeg');
    expect(validateUpload(file('a.jpeg', jpg), MAX).mime).toBe('image/jpeg');
    expect(validateUpload(file('a.pdf', pdf), MAX).mime).toBe('application/pdf');
  });

  it('rejeita executável renomeado para png (assinatura divergente)', () => {
    expect(() => validateUpload(file('foto.png', exe), MAX)).toThrow(BadRequestException);
  });

  it('rejeita extensão incompatível com o conteúdo', () => {
    expect(() => validateUpload(file('doc.pdf', png), MAX)).toThrow(BadRequestException);
  });

  it('rejeita extensão não permitida mesmo com conteúdo válido', () => {
    expect(() => validateUpload(file('a.gif', png), MAX)).toThrow(BadRequestException);
  });

  it('rejeita arquivo vazio e acima do limite', () => {
    expect(() => validateUpload(file('a.png', Buffer.alloc(0)), MAX)).toThrow(BadRequestException);
    expect(() => validateUpload(file('a.png', png, MAX + 1), MAX)).toThrow(BadRequestException);
  });

  it('aceita arquivo exatamente no limite', () => {
    expect(validateUpload(file('a.png', png, MAX), MAX).mime).toBe('image/png');
  });
});

describe('uploadLimits', () => {
  it('usa 5 MB e 5 arquivos por padrão', () => {
    expect(uploadLimits({})).toEqual({ maxBytes: MAX, maxFiles: 5 });
  });

  it('lê os limites do ambiente', () => {
    expect(uploadLimits({ MAX_UPLOAD_MB: '2', MAX_FILES_PER_REQUEST: '3' })).toEqual({
      maxBytes: 2 * 1024 * 1024,
      maxFiles: 3,
    });
  });
});
