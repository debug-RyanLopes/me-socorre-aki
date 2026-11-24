import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Attachment, Prisma, Visibility } from '@prisma/client';
import { ReadStream } from 'fs';
import { TicketAccessPolicy } from '../access/ticket-access.policy';
import { AuthUser } from '../common/types/auth-user';
import { AppConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { validateUpload } from './file-validation';
import { StorageService } from './storage.service';

export interface ValidatedFile {
  file: Express.Multer.File;
  mime: string;
}

export interface AttachmentContext {
  ticketId: number;
  commentId: number | null;
  uploaderId: number;
  visibility: Visibility;
}

export interface AttachmentView {
  id: number;
  originalName: string;
  mime: string;
  size: number;
}

export function toAttachmentView(attachment: Pick<Attachment, 'id' | 'originalName' | 'mime' | 'size'>): AttachmentView {
  return { id: attachment.id, originalName: attachment.originalName, mime: attachment.mime, size: attachment.size };
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly policy: TicketAccessPolicy,
    private readonly config: AppConfig,
  ) {}

  validateAll(files: Express.Multer.File[] | undefined): ValidatedFile[] {
    const list = files ?? [];
    const { maxFilesPerRequest, maxUploadMb } = this.config.settings;
    if (list.length > maxFilesPerRequest) {
      throw new BadRequestException(`Envie no máximo ${maxFilesPerRequest} arquivos por vez.`);
    }
    return list.map((file) => ({ file, mime: validateUpload(file, maxUploadMb * 1024 * 1024).mime }));
  }

  async saveAll(
    tx: Prisma.TransactionClient,
    files: ValidatedFile[],
    context: AttachmentContext,
    written: string[],
  ): Promise<Attachment[]> {
    const created: Attachment[] = [];
    for (const { file, mime } of files) {
      const storageKey = await this.storage.save(file.buffer);
      written.push(storageKey);
      created.push(
        await tx.attachment.create({
          data: {
            ticketId: context.ticketId,
            commentId: context.commentId,
            uploaderId: context.uploaderId,
            originalName: file.originalname.slice(0, 200),
            storageKey,
            mime,
            size: file.size,
            visibility: context.visibility,
          },
        }),
      );
    }
    return created;
  }

  async discard(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.storage.remove(key)));
  }

  async openForDownload(user: AuthUser, id: number): Promise<{ attachment: Attachment; stream: ReadStream }> {
    const attachment = await this.prisma.attachment.findUnique({ where: { id }, include: { ticket: true } });
    if (!attachment) throw new NotFoundException('Anexo não encontrado.');
    this.policy.assertCanSee(user, attachment.ticket);
    if (!this.policy.allowedVisibilities(user).includes(attachment.visibility)) {
      throw new NotFoundException('Anexo não encontrado.');
    }
    return { attachment, stream: this.storage.open(attachment.storageKey) };
  }
}
