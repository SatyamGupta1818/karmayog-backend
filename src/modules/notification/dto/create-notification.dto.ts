import { Type } from 'class-transformer';
import { IsEmail, isEmail, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, isString, IsString, IsUUID, Min } from 'class-validator';

export class CreateNotificationDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    message: string;

    @IsString()
    @IsEmail()
    recipientEmail?: string;

    @IsNumber()
    mobileNumber?: number;
}
