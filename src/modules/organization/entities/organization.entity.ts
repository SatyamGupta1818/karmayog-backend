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

export enum SubscriptionType {
    FREE = 'FREE',
    PRO = 'PRO',
    PREMIUM = 'PREMIUM',
}

@Entity('organizations')
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ name: 'organization_name', type: 'varchar', length: 100 })
    organizationName: string;

    @Column({ name: 'organization_type', type: 'varchar', length: 50 })
    organizationType: string;

    @Column({ name: 'organization_size', type: 'varchar', length: 20 })
    organizationSize: string;

    @Column({
        name: 'org_email',
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    orgEmail?: string;

    @Column({
        name: 'subscription_type',
        type: 'enum',
        enum: SubscriptionType,
        default: SubscriptionType.FREE,
    })
    subscriptionType: SubscriptionType;

    @Column({
        name: 'is_subscription_taken',
        type: 'boolean',
        default: false,
    })
    isSubscriptionTaken: boolean;

    @Column({
        name: 'is_active',
        type: 'boolean',
        default: true,
    })
    isActive: boolean;

    @Column({
        name: 'is_deleted',
        type: 'boolean',
        default: false,
    })
    isDeleted: boolean;

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

    // ✅ Added relationship to User
    @OneToMany(() => User, (user) => user.organization)
    users: User[];
}