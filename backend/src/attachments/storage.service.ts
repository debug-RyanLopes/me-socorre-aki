import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream, ReadStream } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { AppConfig } from '../config/env.validation';

@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(config: AppConfig) {
    this.root = resolve(config.settings.uploadDir);
  }

  async save(buffer: Buffer): Promise<string> {
    const key = randomUUID();
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, key), buffer, { flag: 'wx' });
    return key;
  }

  open(key: string): ReadStream {
    return createReadStream(join(this.root, key));
  }

  async remove(key: string): Promise<void> {
    await rm(join(this.root, key), { force: true });
  }
}
