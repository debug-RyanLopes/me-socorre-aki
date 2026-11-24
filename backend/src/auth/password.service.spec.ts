import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('gera hash argon2id diferente do texto puro', async () => {
    const hash = await service.hash('senha-segura-123');
    expect(hash).not.toContain('senha-segura-123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifica senha correta e rejeita incorreta', async () => {
    const hash = await service.hash('senha-segura-123');
    await expect(service.verify(hash, 'senha-segura-123')).resolves.toBe(true);
    await expect(service.verify(hash, 'outra-senha')).resolves.toBe(false);
  });

  it('retorna falso para hash inválido', async () => {
    await expect(service.verify('nao-e-um-hash', 'qualquer')).resolves.toBe(false);
  });
});
