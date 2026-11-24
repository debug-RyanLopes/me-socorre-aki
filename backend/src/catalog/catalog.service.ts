import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Category, Sector } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listSectors(includeInactive: boolean): Promise<Sector[]> {
    return this.prisma.sector.findMany({ where: includeInactive ? {} : { active: true }, orderBy: { name: 'asc' } });
  }

  listCategories(includeInactive: boolean): Promise<Category[]> {
    return this.prisma.category.findMany({ where: includeInactive ? {} : { active: true }, orderBy: { name: 'asc' } });
  }

  async createSector(dto: CreateCatalogItemDto): Promise<Sector> {
    await this.assertNameFree('sector', dto.name.trim());
    return this.prisma.sector.create({ data: { name: dto.name.trim() } });
  }

  async createCategory(dto: CreateCatalogItemDto): Promise<Category> {
    await this.assertNameFree('category', dto.name.trim());
    return this.prisma.category.create({ data: { name: dto.name.trim() } });
  }

  async updateSector(id: number, dto: UpdateCatalogItemDto): Promise<Sector> {
    const current = await this.prisma.sector.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Setor não encontrado.');
    if (dto.name && dto.name.trim() !== current.name) await this.assertNameFree('sector', dto.name.trim());
    return this.prisma.sector.update({ where: { id }, data: { name: dto.name?.trim(), active: dto.active } });
  }

  async updateCategory(id: number, dto: UpdateCatalogItemDto): Promise<Category> {
    const current = await this.prisma.category.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Categoria não encontrada.');
    if (dto.name && dto.name.trim() !== current.name) await this.assertNameFree('category', dto.name.trim());
    return this.prisma.category.update({ where: { id }, data: { name: dto.name?.trim(), active: dto.active } });
  }

  private async assertNameFree(kind: 'sector' | 'category', name: string): Promise<void> {
    const existing =
      kind === 'sector'
        ? await this.prisma.sector.findUnique({ where: { name } })
        : await this.prisma.category.findUnique({ where: { name } });
    if (existing) throw new ConflictException('Já existe um registro com este nome.');
  }
}
