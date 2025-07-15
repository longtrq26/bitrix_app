import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  TITLE: string;

  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  EMAIL?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  PHONE?: string;

  @IsOptional()
  @IsString()
  STATUS_ID?: string;

  @IsOptional()
  @IsString()
  SOURCE_ID?: string;

  @IsOptional()
  @IsString()
  COMMENTS?: string;

  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}
