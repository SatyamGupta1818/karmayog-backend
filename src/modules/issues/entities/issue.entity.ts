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

export enum IssueType {
  ISSUE = 'ISSUE',
  BUG = 'BUG',
}

export enum IssueStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

export enum IssuePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IssueSeverity {
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
  BLOCKER = 'BLOCKER',
}

@Entity('issues')
@Index(['organizationId', 'projectId', 'featureId', 'taskId', 'subTaskId', 'isDeleted'])
export class Issue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Index()
  @Column({
    name: 'type',
    type: 'enum',
    enum: IssueType,
    default: IssueType.ISSUE,
  })
  type: IssueType;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: IssueStatus,
    default: IssueStatus.OPEN,
  })
  status: IssueStatus;

  @Index()
  @Column({
    name: 'priority',
    type: 'enum',
    enum: IssuePriority,
    default: IssuePriority.MEDIUM,
  })
  priority: IssuePriority;

  @Index()
  @Column({
    name: 'severity',
    type: 'enum',
    enum: IssueSeverity,
    default: IssueSeverity.MINOR,
  })
  severity: IssueSeverity;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate?: Date;

  @Index()
  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate?: Date;

  @Column({ name: 'budget_minutes', type: 'int', default: 0 })
  budgetMinutes: number;

  @Column({ name: 'resolution', type: 'text', nullable: true })
  resolution?: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

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

  @ManyToOne('Feature', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'feature_id' })
  feature?: any;

  @Index()
  @Column({ name: 'feature_id', type: 'uuid', nullable: true })
  featureId?: string;

  @ManyToOne('Task', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'task_id' })
  task?: any;

  @Index()
  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId?: string;

  @ManyToOne('SubTask', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sub_task_id' })
  subTask?: any;

  @Index()
  @Column({ name: 'sub_task_id', type: 'uuid', nullable: true })
  subTaskId?: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reported_by' })
  reportedBy?: any;

  @Column({ name: 'reported_by', type: 'uuid', nullable: true })
  reportedById?: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo?: any;

  @Index()
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedToId?: string;
}
