import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  TITLE: string;

  @IsOptional()
  @IsString()
  NAME?: string;

  @IsOptional()
  @IsEmail()
  EMAIL?: string;

  @IsOptional()
  @IsString()
  PHONE?: string;

  @IsOptional()
  @IsString()
  STATUS_ID?: string;

  @IsOptional()
  @IsString()
  SOURCE_ID?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  COMMENTS?: string;

  @IsString()
  @IsNotEmpty()
  domain: string;
}
