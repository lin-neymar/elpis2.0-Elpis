import { IsNotEmpty, IsString } from 'class-validator';

export class GetProjectDto {
  @IsString()
  @IsNotEmpty()
  proj_key: string;
}
