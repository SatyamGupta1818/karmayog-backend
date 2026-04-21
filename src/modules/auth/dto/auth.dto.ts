import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class OTPDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'The email address of the user',
    })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email!: string;
}


export class RegisterOrganizationDto {
    @ApiProperty({ example: 'STACKTECH' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    organizationName: string;

    @ApiProperty({ example: 'TECHNOLOGY' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    organizationType: string;

    @ApiProperty({ example: '51-200' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    organizationSize: string;

    @ApiProperty({ example: 'https://stacktech.com' })
    @IsString()
    @IsOptional()
    website?: string;

    @ApiProperty({ example: 'Satyam' })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({ example: 'Gupta' })
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({ example: 'satyam@gmail.com' })
    @IsEmail()
    @IsNotEmpty()
    workEmail: string;

    @ApiProperty({ example: '9876543210' })
    @IsString()
    @IsNotEmpty()
    mobileNo: string;

    @ApiProperty({ example: 'Backend Developer' })
    @IsString()
    @IsNotEmpty()
    designation: string;
}