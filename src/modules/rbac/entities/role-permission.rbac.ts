// src/modules/rbac/entities/role-permission.entity.ts

import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from './roles.entity';
import { ModulePermission } from './module-permission.rbac';

@Entity('role_permissions')
@Index(['roleId', 'modulePermissionId'], { unique: true })
export class RolePermission {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'role_id', type: 'uuid' })
    roleId: string;

    @Column({ name: 'menu_permission_id', type: 'uuid' })
    modulePermissionId: string;

    @ManyToOne(() => Role, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_id' })
    role: Role;

    @ManyToOne(() => ModulePermission, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'menu_permission_id' })
    modulePermission: ModulePermission;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @CreateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}