import { IsString, Matches } from 'class-validator';

export class AuthRedirectDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9.-]+\.bitrix24\.vn$/, {
    message: 'Domain must end with .bitrix24.vn',
  })
  domain: string;
}
