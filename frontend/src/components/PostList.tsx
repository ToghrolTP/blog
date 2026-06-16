import { Post } from '../types';
import { CalendarBlankIcon, ClockIcon, ArrowRightIcon } from './Icons';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { useNavigate } from 'react-router-dom';
import { useUpvotes } from '../contexts/UpvoteContext';
import { ArrowUp, Bot } from 'lucide-react';
import { useState, ReactNode } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface PostListProps {
  posts: Post[];
}

export function PostList({ posts }: PostListProps) {
  const navigate = useNavigate();
  const { upvotes: userUpvotes, togglePostUpvote } = useUpvotes();
  const [localUpvoteCounts, setLocalUpvoteCounts] = useState<Record<string, number>>({});
  const { language, t } = useLanguage();

  const handleUpvote = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    const result = await togglePostUpvote(postId);
    if (result) {
      setLocalUpvoteCounts(prev => ({ ...prev, [postId]: result.upvotes }));
    }
  };

  return (
    <div className="space-y-12">
      {posts.map((post) => {
        const displayUpvotes = localUpvoteCounts[post.id] !== undefined ? localUpvoteCounts[post.id] : post.upvotes;
        const currentTranslation = post.translations?.find(t => t.language === language) || post.translations?.[0];
        if (!currentTranslation) return null;
        return (
        <Card 
          key={post.id} 
          className="group cursor-pointer relative"
          onClick={() => navigate(language === 'fa' ? `/fa/post/${post.id}` : `/post/${post.id}`)}
          dir={currentTranslation.language === 'fa' ? 'rtl' : 'ltr'}
        >
          {/* Accent bar on the left */}
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gb-orange-light opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gb-fg-dark mb-3 font-mono">
            <div className="flex items-center gap-2">
              <CalendarBlankIcon className="opacity-80 text-lg" />
              <span>{post.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <ClockIcon className="opacity-80 text-lg" />
              <span>{currentTranslation.readTime} {t('min_read')}</span>
            </div>
            {currentTranslation.isMachineTranslated && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gb-purple-light/20 text-gb-purple-light text-xs font-mono" title="Machine Translated">
                <Bot size={14} />
                <span>Auto</span>
              </div>
            )}
            <div 
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition-colors ${
                userUpvotes.posts.includes(post.id) 
                  ? 'bg-gb-orange-light/20 text-gb-orange-light hover:bg-gb-orange-light/30' 
                  : 'hover:bg-gb-bg-soft text-gb-fg-dark'
              }`}
              onClick={(e) => handleUpvote(e, post.id)}
            >
              <ArrowUp size={16} />
              <span>{displayUpvotes}</span>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-3 text-gb-fg group-hover:text-gb-orange-light transition-colors font-mono">
            {currentTranslation.title}
          </h2>

          {post.thumbnailUrl && (
            <div className="mb-4 w-full h-48 md:h-64 overflow-hidden rounded-md border border-gb-fg-dark/20">
              <img 
                src={post.thumbnailUrl} 
                alt={currentTranslation.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              />
            </div>
          )}
          
          <p className="text-gb-fg-dark leading-relaxed mb-4 line-clamp-2">
            {currentTranslation.summary}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap" dir="ltr">
              {(() => {
                const isPersian = (t: string) => /^[\u0600-\u06FF]/.test(t.trim());
                const persianTags = post.tags.filter(isPersian).sort();
                const englishTags = post.tags.filter(t => !isPersian(t)).sort();
                const elements: ReactNode[] = [];
                
                englishTags.forEach(tag => 
                  elements.push(<Badge key={tag}>{tag}</Badge>)
                );
                
                if (englishTags.length > 0 && persianTags.length > 0) {
                  elements.push(<span key="divider" className="w-px h-5 bg-gb-fg-dark/30 self-center mx-1"></span>);
                }
                
                persianTags.forEach(tag => 
                  elements.push(<Badge key={tag} dir="rtl">{tag}</Badge>)
                );
                
                return elements;
              })()}
            </div>
            
            <div className={`flex items-center gap-2 text-sm text-gb-orange-light font-mono opacity-0 group-hover:opacity-100 transition-opacity transform duration-300 ${currentTranslation.language === 'fa' ? 'translate-x-[10px] group-hover:translate-x-0' : 'translate-x-[-10px] group-hover:translate-x-0'}`}>
              <span>{t('read_more')}</span>
              <ArrowRightIcon className={`text-lg ${currentTranslation.language === 'fa' ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </Card>
        );
      })}
    </div>
  );
}
