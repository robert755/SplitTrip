import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateParticipantDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  name!: string;
}
