import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
}

@Entity('projects')
export class Project {
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
    enum: ProjectStatus,
    default: ProjectStatus.PLANNING,
  })
  status: ProjectStatus;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate?: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate?: Date;

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

  // Relations

  @ManyToOne('Organization', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: any;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne('Department', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'department_id' })
  department?: any;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId?: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: any;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;

  @ManyToMany('Team')
  @JoinTable({
    name: 'project_teams',
    joinColumn: { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'team_id', referencedColumnName: 'id' },
  })
  teams: any[];

  @ManyToMany('User')
  @JoinTable({
    name: 'project_members',
    joinColumn: { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  members: any[];
}
