import { IsBoolean } from 'class-validator';

export class UpdateSettlementTransferDto {
  @IsBoolean()
  isPaid!: boolean;
}
