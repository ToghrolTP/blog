import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Upvotes {
  posts: string[];
  comments: number[];
}

interface UpvoteContextType {
  upvotes: Upvotes;
  togglePostUpvote: (postId: string) => Promise<{ upvotes: number; has_upvoted: boolean } | null>;
  toggleCommentUpvote: (commentId: number) => Promise<{ upvotes: number; has_upvoted: boolean } | null>;
  refreshUpvotes: () => Promise<void>;
}

export const UpvoteContext = createContext<UpvoteContextType | null>(null);

export function UpvoteProvider({ children }: { children: ReactNode }) {
  const [upvotes, setUpvotes] = useState<Upvotes>({ posts: [], comments: [] });

  const refreshUpvotes = async () => {
    try {
      const res = await fetch('/api/user/upvotes');
      if (res.ok) {
        setUpvotes(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshUpvotes();

    const handleAuthChange = () => {
      refreshUpvotes();
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const togglePostUpvote = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/upvote`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await refreshUpvotes();
        return data;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const toggleCommentUpvote = async (commentId: number) => {
    try {
      const res = await fetch(`/api/comments/${commentId}/upvote`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await refreshUpvotes();
        return data;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  return (
    <UpvoteContext.Provider value={{ upvotes, togglePostUpvote, toggleCommentUpvote, refreshUpvotes }}>
      {children}
    </UpvoteContext.Provider>
  );
}

export const useUpvotes = () => {
  const context = useContext(UpvoteContext);
  if (!context) throw new Error("useUpvotes must be used within an UpvoteProvider");
  return context;
};
