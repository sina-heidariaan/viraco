import { IsBoolean, IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IfPresent, Trim } from '../../../common/decorators/validation.decorators';
import { Role } from '../role.enum';

/** Only the fields sent are changed. Email and password are not editable (plan §1). */
export class UpdateUserDto {
  @IfPresent()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IfPresent()
  @IsEnum(Role)
  role?: Role;

  @IfPresent()
  @IsBoolean()
  isActive?: boolean;
}
