import { Message, ThreadType } from './Message';

export interface IMessageRepository {
  findById(id: string): Promise<Message | null>;
  findByThread(threadType: ThreadType, threadId: string, after?: string, limit?: number): Promise<Message[]>;
  save(message: Message): Promise<void>;
}
