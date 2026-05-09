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
import { Role } from 'src/modules/rbac/entities/roles.entity';
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

    @Column({ type: 'varchar', length: 255, select: false, nullable: true })
    password?: string;

    @Column({ name: 'mobile_no', type: 'varchar', length: 20, nullable: true })
    mobileNo?: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    designation?: string;

    @ManyToOne(() => Role, (role) => role.users, {
        nullable: false,
        onDelete: 'RESTRICT',
    })
    @JoinColumn({ name: 'role_id' })
    role: Role;

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, hashedRefreshToken, ...safeUser } = this;
        return safeUser;
    }
}