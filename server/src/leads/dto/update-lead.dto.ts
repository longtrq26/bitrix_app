import { PartialType } from '@nestjs/swagger';
import { IsNotEmptyObject, ValidateIf } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ValidateIf((o) => Object.keys(o).length > 0)
  @IsNotEmptyObject()
  fields?: Record<string, any>;
}
