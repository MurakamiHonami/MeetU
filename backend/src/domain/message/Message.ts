import { Location, LocationProps } from "../shared/Location";
import { ValidationError } from "../shared/DomainError";

export type MessageKind = "text" | "image" | "location";
export type ThreadType = "MATCH" | "GROUP";

export interface MessageProps {
  id: string;
  threadType: ThreadType;
  threadId: string;
  senderId: string;
  kind: MessageKind;
  text?: string;
  imageKey?: string;
  location?: LocationProps;
  createdAt: string;
}

const MAX_TEXT = 1000;

export class Message {
  constructor(private props: MessageProps) {}

  get id(): string {
    return this.props.id;
  }
  get threadType(): ThreadType {
    return this.props.threadType;
  }
  get threadId(): string {
    return this.props.threadId;
  }
  get senderId(): string {
    return this.props.senderId;
  }
  get kind(): MessageKind {
    return this.props.kind;
  }
  get text(): string | undefined {
    return this.props.text;
  }
  get imageKey(): string | undefined {
    return this.props.imageKey;
  }
  get location(): Location | undefined {
    return this.props.location ? new Location(this.props.location) : undefined;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }

  /** 一覧プレビュー用の短い要約。本文が無いメッセージ種別は種類のラベルを返す。 */
  preview(): string {
    if (this.props.kind === "image") return "[画像]";
    if (this.props.kind === "location") return "[位置情報]";
    return (this.props.text ?? "").slice(0, 60);
  }

  toProps(): MessageProps {
    return { ...this.props };
  }

  static create(input: {
    threadType: ThreadType;
    threadId: string;
    senderId: string;
    text?: string;
    imageKey?: string;
    location?: LocationProps;
  }): Message {
    const text = (input.text ?? "").trim();
    if (text.length > MAX_TEXT) {
      throw new ValidationError(`メッセージは${MAX_TEXT}文字以内にしてください`);
    }
    if (!text && !input.imageKey && !input.location) {
      throw new ValidationError("メッセージを入力してください");
    }

    const kind: MessageKind = input.imageKey ? "image" : input.location ? "location" : "text";

    return new Message({
      id: crypto.randomUUID(),
      threadType: input.threadType,
      threadId: input.threadId,
      senderId: input.senderId,
      kind,
      text: text || undefined,
      imageKey: input.imageKey,
      location: input.location,
      createdAt: new Date().toISOString(),
    });
  }
}
