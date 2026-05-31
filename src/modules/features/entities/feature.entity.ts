import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FeatureStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum FeaturePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Entity('features')
@Index(['organizationId', 'projectId', 'isDeleted'])
export class Feature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: FeatureStatus,
    default: FeatureStatus.PLANNED,
  })
  status: FeatureStatus;

  @Index()
  @Column({
    name: 'priority',
    type: 'enum',
    enum: FeaturePriority,
    default: FeaturePriority.MEDIUM,
  })
  priority: FeaturePriority;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate?: Date;

  @Index()
  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate?: Date;

  @Column({ name: 'budget_minutes', type: 'int', default: 0 })
  budgetMinutes: number;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Index()
  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @ManyToOne('Organization', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: any;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne('Project', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: any;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner?: any;

  @Index()
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId?: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: any;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;
}
