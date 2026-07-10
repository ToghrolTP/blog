import React from 'react';
import { useState } from 'react';
import { Post, Category } from '../../types';
import { 
  PencilIcon, 
  TrashIcon, 
  PlusIcon, 
  CheckSquareIcon, 
  SquareIcon, 
  XIcon, 
  ArrowLeftIcon 
} from '../Icons';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { compressImage } from './image';

interface AdminPostsProps {
  secret: string;
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  loading: boolean;
  setLoading: (l: boolean) => void;
  editingPost: Partial<Post> | null;
  setEditingPost: (p: Partial<Post> | null) => void;
  originalPostId: string | null;
  setOriginalPostId: (id: string | null) => void;
  editingFormTab: 'metadata' | 'en' | 'fa';
  setEditingFormTab: (t: 'metadata' | 'en' | 'fa') => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (p: boolean) => void;
  isCreatingMode: boolean;
  setIsCreatingMode: (c: boolean) => void;
  isSelectionMode: boolean;
  setIsSelectionMode: (s: boolean) => void;
  selectedItems: (string | number)[];
  setSelectedItems: React.Dispatch<React.SetStateAction<(string | number)[]>>;
  toggleSelection: (id: string | number) => void;
  setSuccessMessage: (m: string | null) => void;
  fetchPosts: (secret: string) => Promise<void>;
  allExistingTags: string[];
  categories?: Category[];
}

export function AdminPosts({
  secret,
  posts,
  setPosts,
  loading,
  setLoading,
  editingPost,
  setEditingPost,
  originalPostId,
  setOriginalPostId,
  editingFormTab,
  setEditingFormTab,
  isPreviewMode,
  setIsPreviewMode,
  isCreatingMode,
  setIsCreatingMode,
  isSelectionMode,
  setIsSelectionMode,
  selectedItems,
  setSelectedItems,
  toggleSelection,
  setSuccessMessage,
  fetchPosts,
  allExistingTags,
  categories = []
}: AdminPostsProps) {

  const [showSnippetGuide, setShowSnippetGuide] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'code' | 'image' | 'quotes' | 'basics'>('code');

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${secret}`
        }
      });
      if (res.ok) {
        setPosts(posts.filter(p => p.id !== id));
        setSuccessMessage('Deleted successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        alert('Failed to delete (Unauthorized?)');
      }
    } catch (err) {
      alert('Error deleting post');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;

    const trans_en = editingPost.translations?.find((t: any) => t.language === 'en');
    const trans_fa = editingPost.translations?.find((t: any) => t.language === 'fa');
    const defaultTitle = trans_en?.title || trans_fa?.title || 'new-post';

    const finalId = editingPost.id || defaultTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (isCreatingMode && posts.find(p => p.id === finalId)) {
      alert("ID/Slug already exists");
      return;
    }

    const method = isCreatingMode ? 'POST' : 'PUT';
    const url = isCreatingMode ? '/api/posts' : `/api/posts/${originalPostId || editingPost.id || finalId}`;

    const payload = {
      id: finalId,
      date: editingPost.date || new Date().toISOString().split('T')[0],
      tags: typeof editingPost.tags === 'string' ? (editingPost.tags as string).split(',').map(s => s.trim()) : (editingPost.tags || []),
      thumbnailUrl: editingPost.thumbnailUrl || null,
      translations: (editingPost.translations || []).filter((t: any) => t.title && t.content), 
      type: editingPost.type || 'linux'
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const savedPost = await res.json();
        if (isCreatingMode) {
          setPosts([savedPost, ...posts]);
        } else {
          setPosts(posts.map(p => p.id === originalPostId ? savedPost : p));
        }
        setSuccessMessage('Saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        setEditingPost(null);
        setOriginalPostId(null);
      } else {
        const errText = await res.text();
        alert(`Failed to save: ${res.status} ${errText}`);
      }
    } catch (err: any) {
      alert(`Error saving post: ${err.message}`);
    }
  };

  if (editingPost) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-6 border-b border-gb-bg-soft/50 pb-4">
          <h2 className="text-2xl font-mono text-gb-orange-light flex items-center gap-2">
            <ArrowLeftIcon 
              className="cursor-pointer hover:text-gb-fg transition-colors" 
              size={24} 
              onClick={() => { setEditingPost(null); setOriginalPostId(null); setIsPreviewMode(false); }} 
            />
            {posts.find(p => p.id === originalPostId) ? 'Edit Post' : 'New Post'}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => { setEditingPost(null); setOriginalPostId(null); setIsPreviewMode(false); }}>Cancel</Button>
        </div>

        <Card className="!p-0">
          <form onSubmit={handleSave} className="font-mono" autoComplete="off">
            {/* Form navigation tabs */}
            <div className="flex bg-gb-bg-soft/20 border-b border-gb-bg-soft">
              {(['metadata', 'en', 'fa'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEditingFormTab(tab)}
                  className={`px-6 py-4 font-mono text-sm font-bold border-b-2 transition-all cursor-pointer ${
                    editingFormTab === tab
                      ? 'text-gb-orange-light border-gb-orange-light bg-gb-bg-soft/10 font-extrabold'
                      : 'text-gb-fg-dark border-transparent hover:text-gb-fg'
                  }`}
                >
                  {tab === 'metadata' && 'General Metadata'}
                  {tab === 'en' && 'English Translation'}
                  {tab === 'fa' && 'Persian Translation'}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-6">
              {/* TAB 1: METADATA */}
              {editingFormTab === 'metadata' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm mb-2 text-gb-fg-dark">ID (Slug)</label>
                      <Input 
                        type="text" 
                        name="post-slug"
                        autoComplete="off"
                        value={editingPost.id || ''}
                        onChange={e => setEditingPost({...editingPost, id: e.target.value})}
                        placeholder="e.g. linux-tips"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2 text-gb-fg-dark">Date (YYYY-MM-DD)</label>
                      <Input 
                        type="text" 
                        required
                        value={editingPost.date || ''}
                        onChange={e => setEditingPost({...editingPost, date: e.target.value})}
                        placeholder={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm mb-2 text-gb-fg-dark">Categories</label>
                      <div className="grid grid-cols-2 gap-2 p-3 bg-gb-bg-soft/40 border border-gb-fg-dark/20 rounded-none">
                        {(categories && categories.length > 0
                          ? categories.map((cat) => ({ value: cat.id, label: cat.name }))
                          : [
                              { value: 'linux', label: 'Linux' },
                              { value: 'cybersecurity', label: 'Cybersecurity' },
                              { value: 'backend', label: 'Backend Engineering' },
                              { value: 'devops', label: 'DevOps & Cloud' },
                              { value: 'terminal', label: 'CLI & Terminal' },
                              { value: 'academic', label: 'Academic & Writing' }
                            ]
                        ).map((cat) => {
                          const currentCats = (editingPost.type || 'linux').split(',').map(c => c.trim()).filter(Boolean);
                          const isChecked = currentCats.includes(cat.value);
                          return (
                            <label key={cat.value} className="flex items-center space-x-2 text-sm text-gb-fg cursor-pointer select-none py-1 hover:text-gb-orange-light transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let newCats;
                                  if (e.target.checked) {
                                    newCats = [...currentCats, cat.value];
                                  } else {
                                    newCats = currentCats.filter(c => c !== cat.value);
                                  }
                                  const typeVal = newCats.length > 0 ? newCats.join(', ') : 'linux';
                                  setEditingPost({ ...editingPost, type: typeVal });
                                }}
                                className="rounded-none border-gb-fg-dark/30 text-gb-orange-light focus:ring-0 focus:ring-offset-0 bg-gb-bg-dark h-4 w-4"
                              />
                              <span className="font-mono text-xs">{cat.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-gb-fg-dark">Tags (comma separated)</label>
                      <Input 
                        type="text" 
                        value={Array.isArray(editingPost.tags) ? editingPost.tags.join(', ') : (editingPost.tags || '')}
                        onChange={e => setEditingPost({...editingPost, tags: e.target.value as any})}
                        placeholder="bash, kernel, systemd"
                      />
                      {(() => {
                        const tagsVal = Array.isArray(editingPost.tags) ? editingPost.tags.join(', ') : (editingPost.tags || '');
                        const lastCommaIndex = tagsVal.lastIndexOf(',');
                        const currentTagPart = lastCommaIndex === -1 ? tagsVal : tagsVal.slice(lastCommaIndex + 1);
                        const trimmedQuery = currentTagPart.trim().toLowerCase();
                        const suggestions = trimmedQuery 
                          ? allExistingTags.filter(t => t.toLowerCase().startsWith(trimmedQuery) && t.toLowerCase() !== trimmedQuery) 
                          : [];
                        if (suggestions.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1.5 mt-1.5 p-2 bg-gb-bg-soft border border-gb-bg-soft/40 rounded-none text-xs max-h-24 overflow-y-auto">
                            <span className="text-gb-fg-dark self-center mr-1 font-mono">Suggestions:</span>
                            {suggestions.slice(0, 10).map(tag => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const prefix = lastCommaIndex === -1 ? '' : tagsVal.slice(0, lastCommaIndex + 1) + ' ';
                                  const newValue = prefix + tag + ', ';
                                  setEditingPost({ ...editingPost, tags: newValue as any });
                                }}
                                className="px-2 py-0.5 bg-gb-bg-dark hover:bg-gb-orange-light/20 hover:text-gb-orange-light text-gb-fg border border-gb-fg-dark/15 rounded-none cursor-pointer transition-colors font-mono"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gb-fg-dark">Thumbnail URL</label>
                    <div className="flex gap-2">
                      <Input 
                        type="text" 
                        placeholder="/uploads/..."
                        value={editingPost.thumbnailUrl || ''}
                        onChange={e => setEditingPost({...editingPost, thumbnailUrl: e.target.value})}
                      />
                      <label className="cursor-pointer bg-gb-bg-soft hover:bg-gb-purple-light/20 text-gb-purple-light px-3 py-2.5 rounded flex items-center justify-center transition-colors border border-gb-purple-light/30 shrink-0">
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const compressed = await compressImage(file);
                              const formData = new FormData();
                              formData.append('image', compressed, 'image.webp');
                              const res = await fetch('/api/upload', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${secret}`
                                },
                                body: formData
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setEditingPost({...editingPost, thumbnailUrl: data.url});
                              }
                            } catch(err) { console.error('Upload failed', err); }
                          }} 
                        />
                        <PlusIcon size={18} />
                      </label>
                    </div>
                    {editingPost.thumbnailUrl && (
                      <img src={editingPost.thumbnailUrl} alt="Thumbnail preview" className="mt-3 h-24 object-contain bg-gb-bg-dark rounded border border-gb-bg-soft" />
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2 & TAB 3: TRANSLATIONS (EN & FA) */}
              {(editingFormTab === 'en' || editingFormTab === 'fa') && (
                <div className="animate-in fade-in duration-300">
                  {(() => {
                    const lang = editingFormTab;
                    const currentTranslation = editingPost.translations?.find((t: any) => t.language === lang) 
                      || { language: lang, title: '', summary: '', content: '', readTime: 5 };
                    
                    const updateTranslation = (key: string, value: any) => {
                      const otherTranslations = editingPost.translations?.filter((t: any) => t.language !== lang) || [];
                      setEditingPost({
                        ...editingPost,
                        translations: [...otherTranslations, { ...currentTranslation, [key]: value }]
                      });
                    };

                    const updateContentAndReadTime = (text: string) => {
                      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
                      const wpm = lang === 'fa' ? 180 : 200;
                      const calculatedReadTime = Math.max(1, Math.ceil(words / wpm));
                      
                      const otherTranslations = editingPost.translations?.filter((t: any) => t.language !== lang) || [];
                      setEditingPost({
                        ...editingPost,
                        translations: [...otherTranslations, { ...currentTranslation, content: text, readTime: calculatedReadTime }]
                      });
                    };

                    return (
                      <div className="space-y-5" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2">
                            <label className="block text-sm mb-2 text-gb-fg-dark">Title ({lang.toUpperCase()})</label>
                            <Input 
                              type="text" 
                              value={currentTranslation.title}
                              onChange={e => updateTranslation('title', e.target.value)}
                              placeholder={lang === 'fa' ? 'عنوان پست' : 'Post Title'}
                              dir={lang === 'fa' ? 'rtl' : 'ltr'}
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-2 text-gb-fg-dark">Read Time (minutes)</label>
                            <Input 
                              type="number" 
                              value={currentTranslation.readTime}
                              onChange={e => updateTranslation('readTime', parseInt(e.target.value) || 5)}
                              dir={lang === 'fa' ? 'rtl' : 'ltr'}
                            />
                          </div>
                        </div>

                        {lang === 'fa' && (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={currentTranslation.isMachineTranslated || false}
                              onClick={() => updateTranslation('isMachineTranslated', !currentTranslation.isMachineTranslated)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gb-purple-light focus:ring-offset-2 focus:ring-offset-gb-bg-dark cursor-pointer ${currentTranslation.isMachineTranslated ? 'bg-gb-purple-light' : 'bg-gb-bg-soft'}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-gb-fg transition-transform ${currentTranslation.isMachineTranslated ? 'translate-x-6' : 'translate-x-1'}`}
                              />
                            </button>
                            <span className="text-xs font-mono text-gb-fg-dark">
                              {currentTranslation.isMachineTranslated ? 'Machine Translated' : 'Human Translated'}
                            </span>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm mb-2 text-gb-fg-dark">Summary ({lang.toUpperCase()})</label>
                          <Textarea 
                            rows={3}
                            value={currentTranslation.summary}
                            onChange={e => updateTranslation('summary', e.target.value)}
                            placeholder={lang === 'fa' ? 'خلاصه داستان پست...' : 'Brief description of the post...'}
                            dir={lang === 'fa' ? 'rtl' : 'ltr'}
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-end mb-2">
                            <label className="block text-sm text-gb-fg-dark">Content (Markdown)</label>
                            <div className="flex bg-gb-bg-soft rounded overflow-hidden text-xs shrink-0" dir="ltr">
                              <label className="cursor-pointer px-3 py-1.5 text-gb-fg-dark hover:text-gb-fg transition-colors flex items-center border-r border-gb-fg-dark/30">
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      const compressed = await compressImage(file);
                                      const formData = new FormData();
                                      formData.append('image', compressed, 'image.webp');
                                      const res = await fetch('/api/upload', {
                                        method: 'POST',
                                        headers: {
                                          'Authorization': `Bearer ${secret}`
                                        },
                                        body: formData
                                      });
                                      if (res.ok) {
                                        const data = await res.json();
                                        updateContentAndReadTime(currentTranslation.content + `\n![image](${data.url})`);
                                      }
                                    } catch(err) { console.error('Upload failed', err); }
                                  }} 
                                />
                                Insert Image
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowSnippetGuide(!showSnippetGuide)}
                                className={`px-3 py-1.5 transition-colors cursor-pointer border-r border-gb-fg-dark/30 ${showSnippetGuide ? 'bg-gb-blue-light text-gb-bg font-bold' : 'text-gb-fg-dark hover:text-gb-fg'}`}
                              >
                                Snippet Guide
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsPreviewMode(false)}
                                className={`px-3 py-1.5 transition-colors cursor-pointer ${!isPreviewMode ? 'bg-gb-purple-light text-gb-bg font-bold' : 'text-gb-fg-dark hover:text-gb-fg'}`}
                              >
                                Write
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsPreviewMode(true)}
                                className={`px-3 py-1.5 transition-colors cursor-pointer ${isPreviewMode ? 'bg-gb-purple-light text-gb-bg font-bold' : 'text-gb-fg-dark hover:text-gb-fg'}`}
                              >
                                Preview
                              </button>
                            </div>
                          </div>


                          
                          {!isPreviewMode ? (
                            <Textarea 
                              rows={15}
                              value={currentTranslation.content}
                              onChange={e => updateContentAndReadTime(e.target.value)}
                              className="font-mono text-sm leading-relaxed"
                              placeholder={lang === 'fa' ? '# سر تیتر\nمتن در اینجا...' : '# Header\nWrite markdown here...'}
                              dir={lang === 'fa' ? 'rtl' : 'ltr'}
                            />
                          ) : (
                            <div className="w-full bg-gb-bg-light/30 border border-gb-bg-soft rounded px-6 py-4 min-h-[350px] max-h-[600px] overflow-y-auto" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                              <MarkdownRenderer content={currentTranslation.content || '*No content*'} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 bg-gb-bg-soft/10 border-t border-gb-bg-soft">
              <Button type="submit" className="bg-gb-yellow-light text-gb-bg hover:bg-gb-yellow border-transparent font-bold">
                Save Post
              </Button>
            </div>
          </form>
        </Card>

        {/* Floating Guide Drawer */}
        <div 
          className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-[#1d2021] border-l border-gb-bg-light shadow-2xl z-50 transition-transform duration-300 transform flex flex-col font-mono text-xs ${
            showSnippetGuide ? 'translate-x-0' : 'translate-x-full'
          }`}
          dir="ltr"
        >
          {/* Header */}
          <div className="bg-gb-bg-soft/80 px-4 py-4 flex items-center justify-between border-b border-gb-bg-light shrink-0">
            <span className="text-gb-yellow-light font-bold">~/.config/markdown-guide.conf</span>
            <button 
              type="button" 
              onClick={() => setShowSnippetGuide(false)} 
              className="text-gb-fg-dark hover:text-gb-fg cursor-pointer font-bold px-2 py-1 hover:bg-gb-bg-soft border border-transparent hover:border-gb-bg-light transition-all"
            >
              [X]
            </button>
          </div>

          {/* Tabs bar */}
          <div className="flex border-b border-gb-bg-light bg-gb-bg-soft/20 overflow-x-auto shrink-0 select-none">
            {(['code', 'image', 'quotes', 'basics'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveGuideTab(tab)}
                className={`px-3 py-3 border-b-2 font-bold transition-all cursor-pointer whitespace-nowrap flex-1 text-center ${
                  activeGuideTab === tab
                    ? 'text-gb-orange-light border-gb-orange-light bg-gb-bg-soft/10'
                    : 'text-gb-fg-dark border-transparent hover:text-gb-fg'
                }`}
              >
                {tab === 'code' && 'Code'}
                {tab === 'image' && 'Images'}
                {tab === 'quotes' && 'Quotes/Tables'}
                {tab === 'basics' && 'Basics'}
              </button>
            ))}
          </div>

          {/* Content (Scrollable) */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-gb-fg">
            {activeGuideTab === 'code' && (
              <div className="space-y-4">
                <div className="border-b border-gb-bg-light/40 pb-2">
                  <h3 className="text-gb-blue-light font-bold mb-1">Code Snippet Variations</h3>
                  <p className="text-gb-fg-dark text-[10px]">Tweak rendering of code blocks using metadata parameters on the language line.</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">1. Full Featured</h4>
                    <p className="text-gb-fg-dark mb-1.5 text-[10px]">Show header filename, copy button, and line numbers.</p>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`\`\`\`javascript filename="App.js"
const greeting = "Hello World";
\`\`\``}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">2. Header Only</h4>
                    <p className="text-gb-fg-dark mb-1.5 text-[10px]">Show filename header without line numbers.</p>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`\`\`\`javascript filename="config.json" noNumbers
{
  "theme": "gruvbox"
}
\`\`\``}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">3. Floating Control</h4>
                    <p className="text-gb-fg-dark mb-1.5 text-[10px]">Show line numbers only, copy button on hover.</p>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`\`\`\`javascript showNumbers
function add(a, b) {
  return a + b;
}
\`\`\``}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">4. Minimal Block</h4>
                    <p className="text-gb-fg-dark mb-1.5 text-[10px]">Pure code block, no numbers or header. Copy button on hover.</p>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`\`\`\`bash
npm install
\`\`\``}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {activeGuideTab === 'image' && (
              <div className="space-y-4">
                <div className="border-b border-gb-bg-light/40 pb-2">
                  <h3 className="text-gb-blue-light font-bold mb-1">Images & Media Guide</h3>
                  <p className="text-gb-fg-dark text-[10px]">Guidelines for embedding images and setting visual layouts.</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">Standard Markdown Image</h4>
                    <p className="text-gb-fg-dark mb-1.5 text-[10px]">Standard block image spanning 100% width.</p>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`![Alt text](https://example.com/image.png)`}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">Set Custom Width</h4>
                    <p className="text-gb-fg-dark mb-1.5 text-[10px]">Specify width in percentage or pixels using the URL suffix <code>#w=VALUE</code>.</p>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`![Spa Banner](https://example.com/spa.jpg#w=50%)
![Small Icon](https://example.com/icon.png#w=120px)`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {activeGuideTab === 'quotes' && (
              <div className="space-y-4">
                <div className="border-b border-gb-bg-light/40 pb-2">
                  <h3 className="text-gb-blue-light font-bold mb-1">Quotes & Tables</h3>
                  <p className="text-gb-fg-dark text-[10px]">Structure multi-column data grids and quote elements.</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">Markdown Table</h4>
                    <p className="text-gb-fg-dark mb-1.5 text-[10px]">Clean grid container. Renders with sharp borders and hover styles.</p>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`| Option | Default | Description |
|---|---|---|
| theme | gruvbox | Colorscheme |
| mode | dark | Default dark |`}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">Blockquote</h4>
                    <p className="text-gb-fg-dark mb-1.5 text-[10px]">Adds vertical border highlight. Adapts direction to RTL automatically.</p>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`> This is a key quote to emphasize.`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {activeGuideTab === 'basics' && (
              <div className="space-y-4">
                <div className="border-b border-gb-bg-light/40 pb-2">
                  <h3 className="text-gb-blue-light font-bold mb-1">Basic Formatting</h3>
                  <p className="text-gb-fg-dark text-[10px]">Primary elements of standard Markdown syntax.</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">Headers</h4>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`# Main Title (H1)
## Section Title (H2)
### Subsection (H3)`}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">Text Emphasis</h4>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`**Bold Text**
*Italic Text*
~~Strikethrough~~`}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">Lists</h4>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`- Bullet item 1
- Bullet item 2

1. Numbered item 1
2. Numbered item 2`}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-gb-orange-light font-bold mb-1">Links</h4>
                    <pre className="bg-gb-bg-soft/40 p-2 border border-gb-bg-light text-[10px] select-all overflow-x-auto">
{`[Google Search](https://google.com)`}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Persian translations footer based on active tab and language */}
          {editingFormTab === 'fa' && (
            <div className="p-4 border-t border-gb-bg-light text-right select-none bg-gb-bg-soft/10 shrink-0" dir="rtl">
              <span className="text-gb-yellow-light font-bold block mb-1 text-[11px]">توضیح فارسی:</span>
              <div className="text-[10px] text-gb-fg-dark space-y-1">
                {activeGuideTab === 'code' && (
                  <p>امکان استفاده از هدر فایل (<code>filename="index.js"</code>) و شماره‌گذاری خطوط (<code>showNumbers</code> / <code>noNumbers</code>).</p>
                )}
                {activeGuideTab === 'image' && (
                  <p>تعیین عرض سفارشی با پسوند <code>#w=50%</code> یا <code>#w=250px</code> در انتهای لینک تصویر.</p>
                )}
                {activeGuideTab === 'quotes' && (
                  <p>تولید جداول زیبا با هدر و نقل قول‌های متمایز با پشتیبانی خودکار از چیدمان راست‌چین (RTL).</p>
                )}
                {activeGuideTab === 'basics' && (
                  <p>قالب‌بندی‌های پایه مانند سرتیترها (H1-H3)، متن ضخیم/مورب، لیست‌ها و لینک‌ها.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map(post => {
        const isSelected = selectedItems.includes(post.id);
        return (
          <Card 
            key={post.id} 
            className={`group relative flex flex-col justify-between !p-5 transition-all duration-300 border-2 ${
              isSelectionMode 
                ? isSelected 
                  ? 'border-gb-red-light bg-gb-red-light/5 hover:border-gb-red-light' 
                  : 'border-gb-bg-soft hover:border-gb-red-light/50 cursor-pointer'
                : 'border-gb-bg-soft/60 hover:border-gb-orange-light hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(254,128,25,0.15)] cursor-pointer'
            }`}
            onClick={() => {
              if (isSelectionMode) {
                toggleSelection(post.id);
              } else {
                setEditingPost(post);
                setOriginalPostId(post.id);
                setEditingFormTab('metadata');
                setIsPreviewMode(false);
                setIsCreatingMode(false);
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
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-gb-bg-light/40 border border-gb-bg-soft text-gb-fg-dark rounded-sm">
                    {(post.type || 'linux')
                      .split(',')
                      .map(c => c.trim())
                      .map(c => categories?.find(cat => cat.id === c)?.name || c)
                      .join(', ')}
                  </span>
                  <div className="flex gap-1">
                    {post.translations?.some(t => t.language === 'en' && t.title) && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-gb-blue-light/10 text-gb-blue-light border border-gb-blue-light/20 rounded-sm">EN</span>
                    )}
                    {post.translations?.some(t => t.language === 'fa' && t.title) && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-gb-green-light/10 text-gb-green-light border border-gb-green-light/20 rounded-sm">FA</span>
                    )}
                  </div>
                </div>

                <h3 className="font-mono font-bold text-lg text-gb-fg group-hover:text-gb-orange-light transition-colors mt-2 break-all line-clamp-1">
                  {post.translations?.find(t => t.language === 'en')?.title || post.translations?.find(t => t.language === 'fa')?.title || 'Untitled'}
                </h3>

                <p className="text-xs text-gb-fg-dark font-mono mt-1 break-all line-clamp-2 leading-relaxed">
                  {post.translations?.find(t => t.language === 'en')?.summary || post.translations?.find(t => t.language === 'fa')?.summary || 'No summary description.'}
                </p>
                
                <div className="text-[10px] text-gb-fg-dark/60 font-mono mt-3 flex items-center gap-3">
                  <span>{post.date}</span>
                  <span>•</span>
                  <span className="font-semibold text-gb-yellow-light/80">{post.id}</span>
                  <span>•</span>
                  <span>{post.upvotes} upvotes</span>
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
                    setEditingPost(post);
                    setOriginalPostId(post.id);
                    setEditingFormTab('metadata');
                    setIsPreviewMode(false);
                    setIsCreatingMode(false);
                  }}
                  className="text-gb-yellow-light hover:text-gb-yellow p-1.5"
                  title="Edit"
                >
                  <PencilIcon size={16} />
                </Button>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(post.id);
                  }}
                  className="text-gb-orange-light hover:text-gb-orange p-1.5"
                  title="Delete"
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            )}
          </Card>
        );
      })}
      {posts.length === 0 && (
        <p className="font-mono text-gb-fg-dark italic text-center py-8 border-2 border-dashed border-gb-bg-soft rounded-lg">No posts found.</p>
      )}
    </div>
  );
}
