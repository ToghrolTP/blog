import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Post } from '../types';
import { ArrowLeftIcon, CalendarBlankIcon, ClockIcon, TagIcon } from './Icons';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Comments } from './Comments';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useUpvotes } from '../contexts/UpvoteContext';
import { ArrowUp, Bot, Wrench } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { SEO } from './SEO';

export function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlogMaintenance, setIsBlogMaintenance] = useState(false);
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
    const adminSecret = localStorage.getItem('adminSecret');
    const isParamAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isAdmin = !!adminSecret || isParamAdmin;

    const headers: HeadersInit = {};
    if (adminSecret) {
      headers['Authorization'] = `Bearer ${adminSecret}`;
    }

    fetch('/api/settings')
      .then(res => res.json())
      .then(settings => {
        if (settings.blog_maintenance && !isAdmin) {
          setIsBlogMaintenance(true);
          setLoading(false);
          return;
        }

        fetch(`/api/posts/${id}`, { headers })
          .then(res => {
            if (res.status === 503) {
              setIsBlogMaintenance(true);
              return null;
            }
            if (!res.ok) throw new Error("Not found");
            return res.json();
          })
          .then(data => {
            if (data) setPost(data);
            setLoading(false);
          })
          .catch(err => {
            console.error(err);
            setLoading(false);
          });
      })
      .catch(err => {
        console.error("Failed to fetch settings:", err);
        fetch(`/api/posts/${id}`, { headers })
          .then(res => {
            if (!res.ok) throw new Error("Not found");
            return res.json();
          })
          .then(data => setPost(data))
          .catch(postErr => console.error(postErr))
          .finally(() => setLoading(false));
      });
  }, [id]);

  if (loading) {
    return <div className="text-center font-mono text-gb-fg-dark py-12 animate-pulse">{t('mounting')}</div>;
  }

  if (isBlogMaintenance) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center font-mono animate-in fade-in duration-500">
        <div className="max-w-md w-full border-2 border-gb-red/50 bg-gb-bg-soft/10 p-8 rounded-lg shadow-[4px_4px_0_0_rgba(204,36,29,0.15)] relative overflow-hidden">
          <div className="text-gb-red-light text-5xl mb-6 flex justify-center animate-pixel-float">
            <Wrench size={48} />
          </div>
          
          <h1 className="text-2xl font-bold text-gb-fg mb-4 border-b border-gb-bg-soft pb-4">
            {t("blog_maintenance_title")}
          </h1>
          
          <p className="text-sm text-gb-fg-dark leading-relaxed mb-6">
            {t("blog_maintenance_desc")}
          </p>
          
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => navigate(language === 'fa' ? '/fa' : '/')} className="text-xs border border-gb-bg-soft hover:border-gb-orange-light text-gb-fg-dark hover:text-gb-orange-light font-mono flex items-center gap-2 cursor-pointer transition-all duration-200">
              &larr; {language === "fa" ? "بازگشت به خانه" : "Back to Home"}
            </Button>
          </div>
        </div>
      </div>
    );
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
