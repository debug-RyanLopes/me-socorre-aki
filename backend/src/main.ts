import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadSettings } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const settings = loadSettings();
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Me Socorre Aki').setVersion('1.0').build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(settings.port);
}

void bootstrap();
