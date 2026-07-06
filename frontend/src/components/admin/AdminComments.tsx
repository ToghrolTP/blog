import React from 'react';
import { Comment } from '../../types';
import { 
  TrashIcon, 
  CheckSquareIcon, 
  SquareIcon 
} from '../Icons';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface AdminCommentsProps {
  secret: string;
  comments: Comment[];
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  loading: boolean;
  setLoading: (l: boolean) => void;
  isSelectionMode: boolean;
  selectedItems: (string | number)[];
  toggleSelection: (id: string | number) => void;
  setSuccessMessage: (m: string | null) => void;
}

export function AdminComments({
  secret,
  comments,
  setComments,
  loading,
  setLoading,
  isSelectionMode,
  selectedItems,
  toggleSelection,
  setSuccessMessage
}: AdminCommentsProps) {

  const handleDeleteComment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${secret}`
        }
      });
      if (res.ok) {
        setComments(comments.filter(c => c.id !== id));
        setSuccessMessage('Deleted successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        alert('Failed to delete comment (Unauthorized?)');
      }
    } catch (err) {
      alert('Error deleting comment');
    }
  };

  return (
    <div className="space-y-4">
      {comments.map(comment => {
        const parentComment = comment.parent_id ? comments.find(c => c.id === comment.parent_id) : null;
        const isSelected = selectedItems.includes(comment.id);
        return (
          <Card 
            key={comment.id} 
            className={`group relative flex flex-col justify-between !p-5 transition-all duration-300 border-2 ${
              isSelectionMode 
                ? isSelected 
                  ? 'border-gb-red-light bg-gb-red-light/5 hover:border-gb-red-light' 
                  : 'border-gb-bg-soft hover:border-gb-red-light/50 cursor-pointer'
                : 'border-gb-bg-soft/60 hover:border-gb-orange-light'
            }`}
            onClick={() => {
              if (isSelectionMode) {
                toggleSelection(comment.id);
              }
            }}
          >
            <div className="flex gap-4 items-start">
              {isSelectionMode && (
                <div className="text-gb-red-light shrink-0 mt-1">
                  {isSelected ? <CheckSquareIcon size={20} /> : <SquareIcon size={20} className="text-gb-fg-dark/50" />}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <img src={comment.user.avatar_url} alt={comment.user.username} className="w-5 h-5 rounded-full border border-gb-bg-soft" />
                  <span className="font-mono text-sm font-bold text-gb-aqua-light">{comment.user.username}</span>
                  <span className="text-[10px] text-gb-fg-dark/60 font-mono">{new Date(comment.created_at).toLocaleString()}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-gb-purple-light/10 text-gb-purple-light border border-gb-purple-light/20 rounded-sm font-mono ml-auto">
                    Post: {comment.post_id}
                  </span>
                </div>

                {parentComment ? (
                  <div className="text-xs font-mono text-gb-fg-dark/70 mt-3 pl-3 border-l-2 border-gb-fg-dark/30 italic bg-gb-bg-soft/30 py-1.5 px-2 rounded-sm break-all line-clamp-1">
                    Replying to @{parentComment.user.username}: {parentComment.content}
                  </div>
                ) : comment.parent_id ? (
                  <div className="text-xs font-mono text-gb-fg-dark/70 mt-3 pl-3 border-l-2 border-gb-fg-dark/30 italic bg-gb-bg-soft/30 py-1.5 px-2 rounded-sm">
                    Replying to U#{comment.parent_id}
                  </div>
                ) : null}

                <div className="text-sm font-mono text-gb-fg mt-3 whitespace-pre-wrap leading-relaxed pl-2 border-l-2 border-gb-orange-light/20">
                  {comment.content}
                </div>
              </div>
            </div>

            {!isSelectionMode && (
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteComment(comment.id);
                  }}
                  className="text-gb-orange-light hover:text-gb-orange p-1.5"
                  title="Delete Comment"
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            )}
          </Card>
        );
      })}
      {comments.length === 0 && (
        <p className="font-mono text-gb-fg-dark italic text-center py-8 border-2 border-dashed border-gb-bg-soft rounded-lg">No comments found.</p>
      )}
    </div>
  );
}
