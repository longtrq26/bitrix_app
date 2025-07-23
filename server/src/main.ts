import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const PORT = process.env.PORT || 3000;

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe());

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  await app.listen(PORT);
}
bootstrap();
