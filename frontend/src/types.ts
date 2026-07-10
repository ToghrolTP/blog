export interface PostTranslation {
  language: string;
  title: string;
  summary: string;
  readTime: number;
  content: string;
  isMachineTranslated?: boolean;
}

export interface Post {
  id: string;
  date: string;
  tags: string[];
  upvotes: number;
  thumbnailUrl?: string;
  translations: PostTranslation[];
  type?: string;
  isDraft?: boolean;
}

export interface User {
  id: number;
  username: string;
  avatar_url: string;
  email?: string;
  displayName?: string;
  bio?: string;
  savedPostIds: string[];
  purchasedTemplateIds: string[];
}


export interface Comment {
  id: number;
  post_id: string;
  parent_id: number | null;
  content: string;
  created_at: string;
  user: User;
  upvotes: number;
  children?: Comment[];
}

export interface ProductTranslation {
  language: string;
  title: string;
  description: string;
  features: string[];
  price: number;
}

export interface Product {
  id: string;
  type?: string;
  metadata?: {
    author?: string;
    pageCount?: number;
    format?: string;
  };
  tags: string[];
  thumbnailUrl?: string;
  photos?: string[];
  translations: ProductTranslation[];
}

export interface Category {
  id: string;
  name: string;
  metaDomain: string;
  icon: string;
  description: string;
}
