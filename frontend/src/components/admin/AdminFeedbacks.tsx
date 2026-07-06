import React from 'react';
import { TrashIcon } from '../Icons';
import { Card } from '../ui/Card';

interface AdminFeedbacksProps {
  secret: string;
  feedbacks: any[];
  setFeedbacks: React.Dispatch<React.SetStateAction<any[]>>;
  loading: boolean;
  setLoading: (l: boolean) => void;
  setSuccessMessage: (m: string | null) => void;
}

export function AdminFeedbacks({
  secret,
  feedbacks,
  setFeedbacks,
  loading,
  setLoading,
  setSuccessMessage
}: AdminFeedbacksProps) {

  const handleDeleteFeedback = async (id: number) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/feedbacks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${secret}` }
      });
      if (res.ok) {
        setFeedbacks(feedbacks.filter(f => f.id !== id));
        setSuccessMessage('Feedback deleted successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        alert('Failed to delete feedback');
      }
    } catch (err) {
      alert('Error deleting feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {feedbacks.map(fb => {
        return (
          <Card 
            key={fb.id} 
            className="group relative flex flex-col justify-between !p-5 transition-all duration-300 border-2 border-gb-bg-soft/60 hover:border-gb-orange-light"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                {fb.user ? (
                  <>
                    <img src={fb.user.avatar_url} alt={fb.user.username} className="w-5 h-5 rounded-full border border-gb-bg-soft" />
                    <span className="font-mono text-sm font-bold text-gb-aqua-light">{fb.user.username}</span>
                  </>
                ) : (
                  <span className="font-mono text-sm font-bold text-gb-fg-dark italic">Anonymous</span>
                )}
                <span className="text-[10px] text-gb-fg-dark/60 font-mono">{new Date(fb.created_at).toLocaleString()}</span>
                <span className="text-[10px] px-2 py-0.5 bg-gb-orange-light/10 text-gb-orange-light border border-gb-orange-light/20 rounded-sm font-mono ml-auto">
                  Route: {fb.route}
                </span>
              </div>

              <p className="font-mono text-sm text-gb-fg mt-3 whitespace-pre-wrap break-all leading-relaxed bg-gb-bg-soft/30 p-3 border border-gb-bg-soft/50">
                {fb.content}
              </p>
            </div>

            {/* Delete button */}
            <div className="absolute right-4 bottom-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFeedback(fb.id);
                }}
                className="p-1.5 bg-gb-red/10 text-gb-red-light border-gb-red-light/20 hover:bg-gb-red-light hover:text-gb-bg hover:border-transparent transition-all rounded cursor-pointer"
                title="Delete Feedback"
              >
                <TrashIcon size={16} />
              </button>
            </div>
          </Card>
        );
      })}
      {feedbacks.length === 0 && (
        <p className="font-mono text-gb-fg-dark italic text-center py-8 border-2 border-dashed border-gb-bg-soft rounded-lg">No feedback found.</p>
      )}
    </div>
  );
}
