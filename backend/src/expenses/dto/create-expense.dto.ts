import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateExpenseShareDto } from './create-expense-share.dto.js';
import { positiveMoneyPattern } from './positive-money-pattern.js';

export class CreateExpenseDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  description!: string;

  @IsUUID()
  payerId!: string;

  @IsString()
  @Matches(positiveMoneyPattern)
  amount!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateExpenseShareDto)
  shares!: CreateExpenseShareDto[];
}
