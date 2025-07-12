import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class WebhookDto {
  @IsNotEmpty()
  @IsString()
  event: string;

  @IsNotEmpty()
  @IsObject()
  data: {
    FIELDS: Record<string, any>;
  };

  @IsString()
  @IsNotEmpty()
  auth: string;

  @IsString()
  @IsNotEmpty()
  memberId: string;
}
