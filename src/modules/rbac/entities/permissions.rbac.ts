import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('permissions')
export class Permission {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 80 })
    name: string;

    @Index({ unique: true })
    @Column({ length: 80 })
    key: string;

    @Column({ length: 255, nullable: true })
    description: string;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @Column({ name: 'is_deleted', default: false })
    isDeleted: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}