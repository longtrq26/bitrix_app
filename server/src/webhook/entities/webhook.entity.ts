import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_logs')
export class WebhookLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  event: string;

  @Column('text')
  payload: string;

  @Index()
  @Column()
  memberId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
