import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('modules')
export class Modules {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 120 })
    name: string;

    @Index({ unique: true })
    @Column({ length: 120 })
    key: string;

    @Column({ length: 200, nullable: true })
    path: string;

    @Column({ length: 80, nullable: true })
    icon: string;

    @Column({ name: 'parent_id', type: 'uuid', nullable: true })
    parentId: string | null;

    @Column({ name: 'sort_order', default: 0 })
    sortOrder: number;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @Column({ name: 'is_deleted', default: false })
    isDeleted: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}