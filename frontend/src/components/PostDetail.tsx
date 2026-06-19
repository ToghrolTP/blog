import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Post } from '../types';
import { ArrowLeftIcon, CalendarBlankIcon, ClockIcon, TagIcon } from './Icons';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Comments } from './Comments';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useUpvotes } from '../contexts/UpvoteContext';
import { ArrowUp, Bot } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { SEO } from './SEO';

export function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const { upvotes: userUpvotes, togglePostUpvote } = useUpvotes();
  const { language, t } = useLanguage();

  const handleUpvote = async () => {
    if (!post) return;
    const result = await togglePostUpvote(post.id);
    if (result) {
      setPost({ ...post, upvotes: result.upvotes });
    }
  };

  useEffect(() => {
    if (!id) return;
    fetch(`/api/posts/${id}`)
      .then(res => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(data => setPost(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="text-center font-mono text-gb-fg-dark py-12 animate-pulse">{t('mounting')}</div>;
  }

  if (!post) {
    return (
      <div className="text-center font-mono text-gb-fg-dark py-12">
        <p className="mb-4">{t('no_posts_found')}</p>
        <Button onClick={() => navigate(language === 'fa' ? '/fa' : '/')} variant="ghost">cd ~</Button>
      </div>
    );
  }

  const currentTranslation = post.translations?.find(t => t.language === language) || post.translations?.[0];

  if (!currentTranslation) {
    return (
      <div className="text-center font-mono text-gb-fg-dark py-12">
        <p className="mb-4">{t('no_posts_found')}</p>
        <Button onClick={() => navigate(language === 'fa' ? '/fa' : '/')} variant="ghost">cd ~</Button>
      </div>
    );
  }

  const excerpt = currentTranslation.content.replace(/[#*_\[\]\n`]/g, ' ').slice(0, 160).trim() + '...';

  return (
    <article className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SEO 
        title={`${currentTranslation.title} | Log40`}
        description={excerpt}
        image={post.thumbnailUrl}
        type="article"
        alternateLanguageUrls={post.translations?.map(trans => ({
          lang: trans.language,
          url: `${window.location.origin}${trans.language === 'fa' ? '/fa' : ''}/post/${post.id}`
        }))}
      >
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": currentTranslation.title,
            "image": post.thumbnailUrl ? [post.thumbnailUrl] : [],
            "datePublished": post.date,
            "author": [{
              "@type": "Person",
              "name": "Blog Author"
            }]
          })}
        </script>
      </SEO>
      <Button 
        variant="ghost"
        onClick={() => navigate(language === 'fa' ? '/fa' : '/')}
        className="mb-10 text-gb-fg-dark hover:text-gb-orange-light group gap-2"
        dir="ltr"
      >
        <ArrowLeftIcon className="group-hover:-translate-x-1 transition-transform text-lg" />
        cd ..
      </Button>

      <header className="mb-10">
        <h1 
          className="text-3xl md:text-4xl font-bold text-gb-fg mb-6 font-mono leading-tight"
          dir={currentTranslation.language === 'fa' ? 'rtl' : 'ltr'}
        >
          {currentTranslation.title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-6 text-sm text-gb-fg-dark font-mono border-b border-gb-bg-soft pb-6">
          <div className="flex items-center gap-2">
            <CalendarBlankIcon className="opacity-80 text-lg" />
            <time>{post.date}</time>
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
            onClick={handleUpvote}
          >
            <ArrowUp size={16} />
            <span>{post.upvotes}</span>
          </div>
          <div className="flex items-center gap-2">
            <TagIcon className="opacity-80 text-lg" />
            <div className="flex gap-2" dir="ltr">
              {(() => {
                const isPersian = (tText: string) => /^[\u0600-\u06FF]/.test(tText.trim());
                const persianTags = post.tags.filter(isPersian).sort();
                const englishTags = post.tags.filter(tText => !isPersian(tText)).sort();
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
          </div>
        </div>
      </header>

      {post.thumbnailUrl && (
        <div className="mb-12 w-full aspect-video rounded-lg border border-gb-fg-dark/20 shadow-lg overflow-hidden bg-gb-bg-soft">
          <img 
            src={post.thumbnailUrl} 
            alt={currentTranslation.title} 
            className="w-full h-full object-cover"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      )}

      <MarkdownRenderer content={currentTranslation.content} />
      <Comments postId={post.id} />
    </article>
  );
}
