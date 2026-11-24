import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CategoriesController } from './categories.controller';
import { SectorsController } from './sectors.controller';

@Module({ controllers: [SectorsController, CategoriesController], providers: [CatalogService] })
export class CatalogModule {}
