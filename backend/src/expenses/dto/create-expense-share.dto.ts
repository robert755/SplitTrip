import { IsString, IsUUID, Matches } from 'class-validator';
import { positiveMoneyPattern } from './positive-money-pattern.js';

export class CreateExpenseShareDto {
  @IsUUID()
  participantId!: string;

  @IsString()
  @Matches(positiveMoneyPattern)
  amount!: string;
}
