export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PostAttachment {
  id: string;
  filename: string;
  sizeLabel: string;
  fileId: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  navLabel?: string;
  count: number;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  categoryId: string;
  categoryName: string;
  views: number;
  date: string;
  isPinned: boolean;
  readTimeMinutes?: number;
  stackLabel?: string;
  tagLine?: string;
  codeExample?: { title?: string; language?: string; code: string };
  sampleOutput?: string;
  attachments?: PostAttachment[];
  relatedSlugs?: string[];
}

export interface User {
  id: string;
  name: string;
}
export interface Chat {
  id: string;
  title: string;
}
export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  text: string;
  ts: number;
}
