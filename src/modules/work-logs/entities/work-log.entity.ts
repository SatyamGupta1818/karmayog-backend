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

export enum WorkLogTargetType {
  TASK = 'TASK',
  SUB_TASK = 'SUB_TASK',
  ISSUE = 'ISSUE',
}

@Entity('work_logs')
@Index(['organizationId', 'projectId', 'logDate', 'isDeleted'])
@Index(['organizationId', 'targetType', 'targetId', 'isDeleted'])
export class WorkLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Index()
  @Column({ name: 'log_date', type: 'date' })
  logDate: string;

  @Column({ name: 'minutes_spent', type: 'int' })
  minutesSpent: number;

  @Index()
  @Column({
    name: 'target_type',
    type: 'enum',
    enum: WorkLogTargetType,
  })
  targetType: WorkLogTargetType;

  @Index()
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

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

  @ManyToOne('Issue', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'issue_id' })
  issue?: any;

  @Index()
  @Column({ name: 'issue_id', type: 'uuid', nullable: true })
  issueId?: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: any;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;
}
