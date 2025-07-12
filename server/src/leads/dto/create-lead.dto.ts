import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  TITLE: string;

  @IsOptional()
  EMAIL?: string;

  @IsOptional()
  PHONE?: string;

  @IsOptional()
  STATUS_ID?: string;

  @IsOptional()
  SOURCE_ID?: string;

  @IsOptional()
  COMMENTS?: string;

  @IsString()
  @IsNotEmpty()
  domain: string;
}
