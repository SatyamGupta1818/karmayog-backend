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

export enum SubTaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SubTaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Entity('sub_tasks')
@Index(['organizationId', 'projectId', 'featureId', 'taskId', 'isDeleted'])
export class SubTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: SubTaskStatus,
    default: SubTaskStatus.TODO,
  })
  status: SubTaskStatus;

  @Index()
  @Column({
    name: 'priority',
    type: 'enum',
    enum: SubTaskPriority,
    default: SubTaskPriority.MEDIUM,
  })
  priority: SubTaskPriority;

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

  @ManyToOne('Feature', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feature_id' })
  feature: any;

  @Index()
  @Column({ name: 'feature_id', type: 'uuid' })
  featureId: string;

  @ManyToOne('Task', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: any;

  @Index()
  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo?: any;

  @Index()
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedToId?: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: any;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;
}
