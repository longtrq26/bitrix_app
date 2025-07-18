import { IsOptional, IsString } from 'class-validator';

export class QueryLeadDto {
  @IsOptional()
  @IsString()
  find?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  domain?: string;
}
