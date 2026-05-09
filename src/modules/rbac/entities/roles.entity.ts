import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    Index,
    OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
    OWNER = 'OWNER',
    MANAGER = 'MANAGER',
    MODERATOR = 'MODERATOR',
    TEAM_LEADER = 'TEAM_LEADER',
    USER = 'USER',
}

@Entity('roles')
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({
        name: 'name',
        type: 'enum',
        enum: UserRole,
        unique: true,
    })
    name: UserRole;

    @Column({
        name: 'description',
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    description?: string;

    @Column({
        name: 'is_active',
        type: 'boolean',
        default: true,
    })
    isActive: boolean;

    // ✅ Soft delete support
    @DeleteDateColumn({
        name: 'deleted_at',
        type: 'timestamptz',
        nullable: true,
    })
    deletedAt?: Date;

    @CreateDateColumn({
        name: 'created_at',
        type: 'timestamptz',
    })
    createdAt: Date;

    @UpdateDateColumn({
        name: 'updated_at',
        type: 'timestamptz',
    })
    updatedAt: Date;

    @OneToMany(() => User, (user) => user.role)
    users: User[];
}