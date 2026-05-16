import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, IsNumber } from 'class-validator';

export class CreateModuleDto {
    @IsString()
    @MaxLength(120)
    name: string;

    @IsString()
    @MaxLength(120)
    key: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    path?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    icon?: string;

    @IsOptional()
    @IsUUID()
    parentId?: string;

    @IsOptional()
    @IsNumber()
    sortOrder?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateModuleDto extends PartialType(CreateModuleDto) { }
