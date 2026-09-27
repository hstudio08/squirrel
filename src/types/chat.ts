import { Timestamp } from "firebase/firestore";

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp | null;
  seen: boolean;
  seenAt?: Timestamp | null;
  isEdited?: boolean;
  editedAt?: Timestamp | null;
  isPinned?: boolean;
  deletedFor?: string[];
  isDeletedForEveryone?: boolean;
  replyToId?: string;
  replyToText?: string;
  replyToSenderId?: string;
  reactions?: Record<string, string>;
  imageUrl?: string;
  imageUrls?: string[];
  audioUrl?: string;
}
