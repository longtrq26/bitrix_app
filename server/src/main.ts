import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { AppModule } from './app.module';

async function bootstrap() {
  const PORT = process.env.PORT || 3000;
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: '*',
    credentials: true,
  });
  app.use(cookieParser());

  const swaggerDoc = yaml.load(fs.readFileSync('./openapi.yaml', 'utf8'));

  const config = new DocumentBuilder()
    .setTitle('Bitrix24 CRM Automation Suite API')
    .setDescription(
      'API for managing leads, webhooks, analytics, and OAuth 2.0 authentication with Bitrix24.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description: 'Requires x-member-id header',
      },
      'bearerAuth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  Object.assign(document, swaggerDoc);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(PORT);
  console.log(`Application is running on: http://localhost:${PORT}`);
  console.log(`Swagger UI is available at: http://localhost:${PORT}/api-docs`);
}
bootstrap();
