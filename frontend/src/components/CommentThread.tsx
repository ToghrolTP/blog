import { useState } from 'react';
import { Comment, User } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { useUpvotes } from '../contexts/UpvoteContext';
import { ArrowUpIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';

interface CommentThreadProps {
  comment: Comment;
  postId: string;
  user: User | null;
  onReply: () => void;
}

export function CommentThread({ comment, postId, user, onReply }: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { upvotes: userUpvotes, toggleCommentUpvote } = useUpvotes();
  const [localUpvotes, setLocalUpvotes] = useState<number | null>(null);
  const { login } = useAuth();

  const handleUpvote = async () => {
    if (!user) {
      login();
      return;
    }
    const result = await toggleCommentUpvote(comment.id);
    if (result) {
      setLocalUpvotes(result.upvotes);
    }
  };

  const displayUpvotes = localUpvotes !== null ? localUpvotes : comment.upvotes;

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent, parent_id: comment.id })
      });
      if (res.ok) {
        setReplyContent('');
        setIsReplying(false);
        setIsPreviewMode(false);
        onReply();
      }
    } catch (err) {
      console.error(err);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <img src={comment.user.avatar_url} alt={comment.user.username} className="w-8 h-8 rounded mt-1" />
        {comment.children && comment.children.length > 0 && (
          <div className="w-px h-full bg-gb-fg-dark/30 my-2"></div>
        )}
      </div>
      
      <div className="flex-1 pb-6">
        <div className="mb-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-gb-aqua-light text-sm">{comment.user.username}</span>
            <span className="text-xs text-gb-fg-dark font-mono">{new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
          <div className="text-sm pt-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <MarkdownRenderer content={comment.content} />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2">
          <button 
            className={`flex items-center gap-1.5 transition-colors text-xs font-mono ${
              user && userUpvotes.comments.includes(comment.id) 
                ? 'text-gb-orange-light hover:text-gb-orange' 
                : 'text-gb-fg-dark hover:text-gb-fg'
            }`}
            onClick={handleUpvote}
          >
            <ArrowUpIcon size={14} />
            <span>{displayUpvotes}</span>
          </button>
          <button 
            onClick={() => {
              if (!user) {
                login();
              } else {
                setIsReplying(!isReplying);
                setIsPreviewMode(false);
              }
            }}
            className="text-gb-fg-dark hover:text-gb-aqua-light text-xs font-mono transition-colors"
          >
            {isReplying ? 'Cancel' : 'Reply'}
          </button>
        </div>

        {isReplying && (
          <form onSubmit={handleSubmitReply} className="mt-3 mb-2">
            <div className="flex justify-between items-end mb-1">
              <span className="block font-mono text-xs text-gb-fg-dark">Reply</span>
              <div className="flex bg-gb-bg-soft rounded overflow-hidden text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setIsPreviewMode(false)}
                  className={`px-2 py-0.5 ${!isPreviewMode ? 'bg-gb-aqua-light text-gb-bg' : 'text-gb-fg-dark hover:text-gb-fg'}`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewMode(true)}
                  className={`px-2 py-0.5 ${isPreviewMode ? 'bg-gb-aqua-light text-gb-bg' : 'text-gb-fg-dark hover:text-gb-fg'}`}
                >
                  Preview
                </button>
              </div>
            </div>
            {!isPreviewMode ? (
              <Textarea
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                rows={2}
                disabled={isSubmitting}
                autoFocus
              />
            ) : (
              <div className="w-full bg-gb-bg-light border border-gb-fg-dark/50 rounded px-3 py-2 min-h-[60px] overflow-y-auto text-sm">
                <MarkdownRenderer content={replyContent || '*No content*'} />
              </div>
            )}
            <div className="flex justify-end mt-2">
              <Button 
                type="submit" 
                variant="primary" size="sm"
                className="bg-gb-aqua-light hover:bg-gb-aqua"
                disabled={isSubmitting || !replyContent.trim()}
              >
                Post Reply
              </Button>
            </div>
          </form>
        )}

        {comment.children && comment.children.length > 0 && (
          <div className="mt-4 space-y-4">
            {comment.children.map(child => (
              <CommentThread key={child.id} comment={child} postId={postId} user={user} onReply={onReply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
