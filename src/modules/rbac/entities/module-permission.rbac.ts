import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Modules } from './modules.rbac';
import { Permission } from './permissions.rbac';

@Entity('module_permissions')
@Index(['moduleId', 'permissionId'], { unique: true })

export class ModulePermission {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'module_id', type: 'uuid' })
    moduleId: string;

    @Column({ name: 'permission_id', type: 'uuid' })
    permissionId: string;

    @ManyToOne(() => Modules, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'module_id' })
    module: Modules;

    @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'permission_id' })
    permission: Permission;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @CreateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}