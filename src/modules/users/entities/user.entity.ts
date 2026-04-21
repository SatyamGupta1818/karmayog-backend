import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';

export enum UserRole {
    SUPER_ADMIN = 'super-admin',
    ADMIN = 'admin',
    USER = 'user',
    MODERATOR = 'moderator',
    OWNER = 'owner', // ✅ Added OWNER role
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'first_name', type: 'varchar', length: 50 })
    firstName: string;

    @Column({ name: 'last_name', type: 'varchar', length: 50 })
    lastName: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', unique: true, length: 255 })
    email: string;

    // Made nullable assuming OTP-only users might not have a password initially
    @Column({ type: 'varchar', length: 255, select: false, nullable: true })
    password?: string;

    // ✅ Added missing fields referenced in the service
    @Column({ name: 'mobile_no', type: 'varchar', length: 20, nullable: true })
    mobileNo?: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    designation?: string;

    @Column({ type: 'simple-array', default: UserRole.USER })
    roles: string[];

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true, default: null })
    lastLoginAt: Date | null;

    @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
    failedLoginAttempts: number;

    @Column({ name: 'locked_until', type: 'timestamptz', nullable: true, default: null })
    lockedUntil: Date | null;

    @Column({ type: 'varchar', nullable: true, select: false })
    hashedRefreshToken: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;

    // ✅ Added relationship to Organization
    @ManyToOne(() => Organization, (organization) => organization.users, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;

    get fullName(): string {
        return `${this.firstName} ${this.lastName}`;
    }

    get isLocked(): boolean {
        if (!this.lockedUntil) return false;
        return new Date() < this.lockedUntil;
    }

    toSafeObject(): Partial<User> {
        const { password, hashedRefreshToken, ...safe } = this as any;
        return safe;
    }
}