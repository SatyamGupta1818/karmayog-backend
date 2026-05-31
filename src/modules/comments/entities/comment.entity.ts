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

export enum CommentTargetType {
  PROJECT = 'PROJECT',
  FEATURE = 'FEATURE',
  TASK = 'TASK',
  SUB_TASK = 'SUB_TASK',
  ISSUE = 'ISSUE',
}

@Entity('comments')
@Index(['organizationId', 'targetType', 'targetId', 'isDeleted'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'body', type: 'text' })
  body: string;

  @Index()
  @Column({
    name: 'target_type',
    type: 'enum',
    enum: CommentTargetType,
  })
  targetType: CommentTargetType;

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

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: any;

  @Index()
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;
}
