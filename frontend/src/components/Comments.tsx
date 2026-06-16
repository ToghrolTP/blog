import { useState, useEffect } from 'react';
import { Comment, User } from '../types';
import { CommentThread } from './CommentThread';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { useAuth } from '../contexts/AuthContext';

interface CommentsProps {
  postId: string;
}

export function Comments({ postId }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const { user, login } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (res.ok) {
        const flatComments: Comment[] = await res.json();
        
        const commentMap = new Map<number, Comment>();
        flatComments.forEach(c => commentMap.set(c.id, { ...c, children: [] }));
        
        const rootComments: Comment[] = [];
        flatComments.forEach(c => {
          if (c.parent_id) {
            const parent = commentMap.get(c.parent_id);
            if (parent) {
              parent.children!.push(commentMap.get(c.id)!);
            }
          } else {
            rootComments.push(commentMap.get(c.id)!);
          }
        });
        setComments(rootComments);
      }
    } catch (err) {
      console.error("Failed to fetch comments", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment, parent_id: null })
      });
      if (res.ok) {
        setNewComment('');
        setIsPreviewMode(false);
        await fetchComments();
      }
    } catch (err) {
      console.error(err);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="mt-16 pt-8 border-t border-gb-fg-dark/30">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-mono text-gb-purple-light">Comments</h3>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-gb-fg-dark flex items-center gap-2">
              <img src={user.avatar_url} alt={user.username} className="w-5 h-5 rounded-full" />
              {user.username}
            </span>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={login}>
            Login with GitHub
          </Button>
        )}
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex justify-between items-end mb-1">
            <span className="block font-mono text-sm text-gb-fg-dark">Leave a comment</span>
            <div className="flex bg-gb-bg-soft rounded overflow-hidden text-sm font-mono">
              <button
                type="button"
                onClick={() => setIsPreviewMode(false)}
                className={`px-3 py-1 ${!isPreviewMode ? 'bg-gb-purple-light text-gb-bg' : 'text-gb-fg-dark hover:text-gb-fg'}`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewMode(true)}
                className={`px-3 py-1 ${isPreviewMode ? 'bg-gb-purple-light text-gb-bg' : 'text-gb-fg-dark hover:text-gb-fg'}`}
              >
                Preview
              </button>
            </div>
          </div>
          {!isPreviewMode ? (
            <Textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Leave a comment..."
              rows={3}
              disabled={isSubmitting}
            />
          ) : (
            <div className="w-full bg-gb-bg-light border border-gb-fg-dark/50 rounded px-3 py-2 min-h-[86px] overflow-y-auto">
              <MarkdownRenderer content={newComment || '*No content*'} />
            </div>
          )}
          <div className="flex justify-end mt-2">
            <Button 
              type="submit" 
              variant="primary"
              disabled={isSubmitting || !newComment.trim()}
            >
              Post Comment
            </Button>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 bg-gb-bg-light border border-gb-fg-dark/30 rounded text-center">
          <p className="text-gb-fg-dark font-mono text-sm mb-3">You must be logged in to comment.</p>
          <Button variant="primary" onClick={login}>
            Login with GitHub
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {comments.map(comment => (
          <CommentThread key={comment.id} comment={comment} postId={postId} user={user} onReply={fetchComments} />
        ))}
        {comments.length === 0 && (
          <p className="text-gb-fg-dark font-mono italic text-sm">No comments yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}
