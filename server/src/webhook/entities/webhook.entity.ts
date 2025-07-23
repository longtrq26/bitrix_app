import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_logs')
export class WebhookLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  event: string;

  @Column('text')
  payload: string;

  @Column()
  memberId: string;

  @Column()
  createdAt: Date = new Date();
}
