import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateTripDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  name!: string;
}
