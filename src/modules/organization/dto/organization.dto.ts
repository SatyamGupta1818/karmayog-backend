import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    MaxLength,
    Matches,
    IsOptional,
    IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';


export class CreateOrganizationDto {
    @ApiProperty({ example: 'STACKTECH' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    organizationName: String

    @ApiProperty({ example: 'TECHNOLOGY' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    organizationType: String

    @ApiProperty({ example: '51-200' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    organizationSize: String

    @ApiProperty({ example: 'TECHNOLOGY' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    website: String
}

export class UpdateOrganizationDto {

}