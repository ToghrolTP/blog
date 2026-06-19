import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Post, Comment, Product } from '../types';
import { 
  PencilIcon, 
  Trash2Icon, 
  PlusIcon, 
  LogOutIcon, 
  CheckSquare, 
  Square, 
  XIcon, 
  LayoutDashboardIcon, 
  MessageSquareIcon, 
  TagIcon, 
  ArrowLeftIcon, 
  FileTextIcon,
  Settings
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

export function AdminPanel() {
  const navigate = useNavigate();
  const [secret, setSecret] = useState(localStorage.getItem('adminSecret') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'products' | 'settings'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<{
    site_maintenance?: boolean;
    blog_maintenance?: boolean;
    comments_maintenance?: boolean;
    store_maintenance?: boolean;
  }>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingFormTab, setEditingFormTab] = useState<'metadata' | 'en' | 'fa'>('metadata');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isCreatingMode, setIsCreatingMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<(string | number)[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const fetchPosts = async (currentSecret: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/posts');
      if (res.ok) {
        setPosts(await res.json());
      } else {
        setError('Failed to fetch posts');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  const fetchComments = async (currentSecret: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/comments', {
        headers: { 'Authorization': `Bearer ${currentSecret}` }
      });
      if (res.ok) {
        setComments(await res.json());
      } else {
        setError('Failed to fetch comments');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        setProducts(await res.json());
      } else {
        setError('Failed to fetch products');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        setSettings(await res.json());
      } else {
        setError('Failed to fetch settings');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  const handleToggleSetting = async (
    key: 'site_maintenance' | 'blog_maintenance' | 'comments_maintenance' | 'store_maintenance',
    checked: boolean
  ) => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`
        },
        body: JSON.stringify({
          key,
          value: checked ? 'true' : 'false'
        })
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, [key]: checked }));
        setSuccessMessage('Settings saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      setError('Network error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'posts') fetchPosts(secret);
      else if (activeTab === 'comments') fetchComments(secret);
      else if (activeTab === 'products') fetchProducts();
      else if (activeTab === 'settings') fetchSettings();
    }
  }, [isAuthenticated, activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/comments', {
        headers: { 'Authorization': `Bearer ${secret}` }
      });
      if (res.ok) {
        localStorage.setItem('adminSecret', secret);
        setIsAuthenticated(true);
        setError(null);
      } else {
        setError('Invalid Secret Key');
      }
    } catch (err) {
      setError('Network error verifying secret');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminSecret');
    setSecret('');
    setIsAuthenticated(false);
  };

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

  const handleDeleteProduct = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${secret}`
        }
      });
      if (res.ok) {
        setProducts(products.filter(p => p.id !== id));
        setSuccessMessage('Deleted successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        alert('Failed to delete product (Unauthorized?)');
      }
    } catch (err) {
      alert('Error deleting product');
    }
  };

  const handleBulkDelete = async () => {
    setIsDeletingBulk(true);
    let successCount = 0;
    
    for (const id of selectedItems) {
      try {
        let endpoint = '';
        if (activeTab === 'posts') endpoint = `/api/posts/${id}`;
        else if (activeTab === 'comments') endpoint = `/api/comments/${id}`;
        else if (activeTab === 'products') endpoint = `/api/products/${id}`;

        const res = await fetch(endpoint, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${secret}` }
        });

        if (res.ok) successCount++;
      } catch (err) {
        console.error('Failed to delete', id);
      }
    }

    if (activeTab === 'posts') setPosts(posts.filter(p => !selectedItems.includes(p.id)));
    else if (activeTab === 'comments') setComments(comments.filter(c => !selectedItems.includes(c.id)));
    else if (activeTab === 'products') setProducts(products.filter(p => !selectedItems.includes(p.id)));

    setSuccessMessage(`Successfully deleted ${successCount} items.`);
    setTimeout(() => setSuccessMessage(null), 3000);
    
    setSelectedItems([]);
    setIsSelectionMode(false);
    setIsDeleteModalOpen(false);
    setIsDeletingBulk(false);
  };

  const toggleSelection = (id: string | number) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  useEffect(() => {
    setSelectedItems([]);
    setIsSelectionMode(false);
  }, [activeTab]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const trans_en = editingProduct.translations?.find((t: any) => t.language === 'en');
    const trans_fa = editingProduct.translations?.find((t: any) => t.language === 'fa');
    const defaultTitle = trans_en?.title || trans_fa?.title || `prod-${Date.now()}`;

    const finalId = editingProduct.id || defaultTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    if (isCreatingMode && products.find(p => p.id === finalId)) {
      alert("ID/Slug already exists");
      return;
    }

    const method = isCreatingMode ? 'POST' : 'PUT';
    const url = method === 'POST' ? '/api/products' : `/api/products/${finalId}`;

    const payload = {
      id: finalId,
      type: editingProduct.type || 'latex',
      metadata: editingProduct.type === 'book' ? {
        ...editingProduct.metadata,
        pageCount: parseInt(editingProduct.metadata?.pageCount as any) || 0
      } : undefined,
      tags: Array.isArray(editingProduct.tags) ? editingProduct.tags : (editingProduct.tags as string || '').split(',').map(s => s.trim()).filter(Boolean),
      thumbnailUrl: editingProduct.thumbnailUrl || null,
      photos: Array.isArray(editingProduct.photos) ? editingProduct.photos : [],
      translations: (editingProduct.translations || [])
        .filter((t: any) => t.title) 
        .map((t: any) => ({
          ...t,
          price: Number(t.price) || 0,
          features: Array.isArray(t.features) ? t.features.filter((f: string) => f.trim().length > 0) : []
        }))
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
        const savedProduct = await res.json();
        if (method === 'POST') {
          setProducts([savedProduct, ...products]);
        } else {
          setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
        }
        setSuccessMessage('Saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        setEditingProduct(null);
      } else {
        const errText = await res.text();
        alert(`Failed to save: ${res.status} ${errText}`);
      }
    } catch (err: any) {
      alert(`Error saving product: ${err.message}`);
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
    const url = isCreatingMode ? '/api/posts' : `/api/posts/${editingPost.id || finalId}`;

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
          setPosts(posts.map(p => p.id === savedPost.id ? savedPost : p));
        }
        setSuccessMessage('Saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        setEditingPost(null);
      } else {
        const errText = await res.text();
        alert(`Failed to save: ${res.status} ${errText}`);
      }
    } catch (err: any) {
      alert(`Error saving post: ${err.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="animate-in fade-in duration-500 max-w-md mx-auto mt-20">
        <h2 className="text-2xl font-mono mb-6 text-gb-purple-light border-b-2 border-gb-purple-light pb-2 inline-block">root@log40:~# login</h2>
        <Card>
          {error && <p className="text-gb-red-light font-mono text-sm mb-4 bg-gb-red-light/10 p-2 rounded border border-gb-red-light/30">{error}</p>}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block font-mono text-sm mb-2 text-gb-fg-dark">Enter Secret Key</label>
              <Input 
                type="password" 
                value={secret}
                onChange={e => setSecret(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Authenticate
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/')} className="w-full">
              Cancel
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------
  // PRODUCT EDIT / CREATE FORM VIEW
  // ----------------------------------------------------
  if (editingProduct) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-6 border-b border-gb-bg-soft/50 pb-4">
          <h2 className="text-2xl font-mono text-gb-orange-light flex items-center gap-2">
            <ArrowLeftIcon 
              className="cursor-pointer hover:text-gb-fg transition-colors" 
              size={24} 
              onClick={() => setEditingProduct(null)} 
            />
            {products.find(p => p.id === editingProduct.id) ? 'Edit Product' : 'New Product'}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setEditingProduct(null)}>Cancel</Button>
        </div>

        <Card className="!p-0">
          <form onSubmit={handleSaveProduct} className="font-mono" autoComplete="off">
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
                  {tab === 'metadata' && 'General Info'}
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
                      <label className="block text-sm mb-2 text-gb-fg-dark">ID (Slug - optional)</label>
                      <Input 
                        type="text" 
                        value={editingProduct.id || ''}
                        onChange={e => setEditingProduct({...editingProduct, id: e.target.value})}
                        disabled={!isCreatingMode}
                        placeholder="e.g. academic-template"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2 text-gb-fg-dark">Product Type</label>
                      <select
                        value={editingProduct.type || 'latex'}
                        onChange={e => setEditingProduct({...editingProduct, type: e.target.value})}
                        className="w-full bg-gb-bg-soft border-2 border-gb-fg-dark/20 rounded-none px-3 py-2 text-gb-fg font-mono text-sm focus:outline-none focus:border-gb-orange-light focus:ring-1 focus:ring-gb-orange-light transition-all"
                      >
                        <option value="latex">LaTeX Template</option>
                        <option value="book">Book</option>
                      </select>
                    </div>
                  </div>

                  {editingProduct.type === 'book' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-gb-fg-dark/30 p-4 rounded bg-gb-bg-soft/30 animate-in fade-in duration-300">
                      <div>
                        <label className="block text-sm mb-1 text-gb-fg-dark">Author</label>
                        <Input
                          type="text"
                          value={editingProduct.metadata?.author || ''}
                          onChange={e => setEditingProduct({
                            ...editingProduct, 
                            metadata: { ...editingProduct.metadata, author: e.target.value }
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 text-gb-fg-dark">Page Count</label>
                        <Input
                          type="number"
                          value={editingProduct.metadata?.pageCount ?? ''}
                          onChange={e => setEditingProduct({
                            ...editingProduct, 
                            metadata: { ...editingProduct.metadata, pageCount: e.target.value as any }
                          })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 text-gb-fg-dark">Format</label>
                        <Input
                          type="text"
                          placeholder="e.g. PDF, EPUB"
                          value={editingProduct.metadata?.format || ''}
                          onChange={e => setEditingProduct({
                            ...editingProduct, 
                            metadata: { ...editingProduct.metadata, format: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm mb-2 text-gb-fg-dark">Tags (comma separated)</label>
                    <Input 
                      type="text" 
                      value={Array.isArray(editingProduct.tags) ? editingProduct.tags.join(', ') : (editingProduct.tags || '')}
                      onChange={e => setEditingProduct({...editingProduct, tags: e.target.value as any})}
                      placeholder="latex, clean, academic"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm mb-2 text-gb-fg-dark">Thumbnail Image</label>
                      <div className="flex gap-2">
                        <Input 
                          type="text" 
                          placeholder="/uploads/..."
                          value={editingProduct.thumbnailUrl || ''}
                          onChange={e => setEditingProduct({...editingProduct, thumbnailUrl: e.target.value})}
                        />
                        <label className="cursor-pointer bg-gb-bg-soft hover:bg-gb-purple-light/20 text-gb-purple-light px-3 py-2.5 rounded flex items-center justify-center transition-colors border border-gb-purple-light/30 shrink-0">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const formData = new FormData();
                              formData.append('image', file);
                              try {
                                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                if (res.ok) {
                                  const data = await res.json();
                                  setEditingProduct({...editingProduct, thumbnailUrl: data.url});
                                }
                              } catch(err) { console.error('Upload failed', err); }
                            }} 
                          />
                          <PlusIcon size={18} />
                        </label>
                      </div>
                      {editingProduct.thumbnailUrl && (
                        <img src={editingProduct.thumbnailUrl} alt="Thumbnail preview" className="mt-3 h-24 object-contain bg-gb-bg-dark rounded border border-gb-bg-soft" />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-gb-fg-dark">Gallery Photos</label>
                      <div className="flex gap-2 mb-2">
                        <label className="cursor-pointer bg-gb-bg-soft hover:bg-gb-green-light/20 text-gb-green-light px-3 py-2 rounded flex items-center justify-center transition-colors border border-gb-green-light/30 w-full">
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple
                            className="hidden" 
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length === 0) return;
                              
                              const uploadedUrls: string[] = [];
                              for (const file of files) {
                                const formData = new FormData();
                                formData.append('image', file);
                                try {
                                  const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                  if (res.ok) {
                                    const data = await res.json();
                                    uploadedUrls.push(data.url);
                                  }
                                } catch(err) { console.error('Upload failed', err); }
                              }
                              
                              setEditingProduct(prev => prev ? {
                                ...prev,
                                photos: [...(prev.photos || []), ...uploadedUrls]
                              } : prev);
                              
                              e.target.value = '';
                            }} 
                          />
                          <PlusIcon size={16} className="mr-2" /> Upload Photos
                        </label>
                      </div>
                      
                      {(editingProduct.photos?.length || 0) > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-3 max-h-32 overflow-y-auto">
                          {editingProduct.photos?.map((photo, idx) => (
                            <div key={idx} className="relative group/photo">
                              <img src={photo} alt={`Gallery ${idx}`} className="h-14 w-full object-cover bg-gb-bg-dark rounded border border-gb-bg-soft" />
                              <button
                                type="button"
                                onClick={() => {
                                  const newPhotos = editingProduct.photos?.filter((_, i) => i !== idx);
                                  setEditingProduct({...editingProduct, photos: newPhotos});
                                }}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                              >
                                <Trash2Icon size={14} className="text-gb-red-light" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2 & TAB 3: TRANSLATIONS (EN & FA) */}
              {(editingFormTab === 'en' || editingFormTab === 'fa') && (
                <div className="animate-in fade-in duration-300">
                  {(() => {
                    const lang = editingFormTab;
                    const currentTranslation = editingProduct.translations?.find((t: any) => t.language === lang) 
                      || { language: lang, title: '', description: '', features: [], price: 0 };
                    
                    const updateTranslation = (key: string, value: any) => {
                      const otherTranslations = editingProduct.translations?.filter((t: any) => t.language !== lang) || [];
                      setEditingProduct({
                        ...editingProduct,
                        translations: [...otherTranslations, { ...currentTranslation, [key]: value }]
                      });
                    };

                    return (
                      <div className="space-y-5" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                        <div>
                          <label className="block text-sm mb-2 text-gb-fg-dark">Title ({lang.toUpperCase()})</label>
                          <Input 
                            type="text" 
                            required={lang === 'en'} 
                            value={currentTranslation.title || ''}
                            onChange={e => updateTranslation('title', e.target.value)}
                            placeholder={lang === 'fa' ? 'عنوان محصول' : 'Product Title'}
                            dir={lang === 'fa' ? 'rtl' : 'ltr'}
                          />
                        </div>

                        <div>
                          <label className="block text-sm mb-2 text-gb-fg-dark">Price ({lang.toUpperCase()})</label>
                          <Input 
                            type="number" 
                            required={lang === 'en'}
                            step="0.01"
                            value={currentTranslation.price || 0}
                            onChange={e => updateTranslation('price', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            dir={lang === 'fa' ? 'rtl' : 'ltr'}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm mb-2 text-gb-fg-dark">Description ({lang.toUpperCase()})</label>
                          <Textarea 
                            rows={4}
                            value={currentTranslation.description || ''}
                            onChange={e => updateTranslation('description', e.target.value)}
                            placeholder={lang === 'fa' ? 'توضیحات محصول...' : 'Product Description...'}
                            dir={lang === 'fa' ? 'rtl' : 'ltr'}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm mb-2 text-gb-fg-dark">Features ({lang.toUpperCase()}) (one per line)</label>
                          <Textarea 
                            rows={5}
                            value={Array.isArray(currentTranslation.features) ? currentTranslation.features.join('\n') : currentTranslation.features}
                            onChange={e => updateTranslation('features', e.target.value.split('\n'))}
                            placeholder={lang === 'fa' ? 'ویژگی اول\nویژگی دوم' : 'Feature One\nFeature Two'}
                            dir={lang === 'fa' ? 'rtl' : 'ltr'}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 bg-gb-bg-soft/10 border-t border-gb-bg-soft">
              <Button type="submit" className="bg-gb-yellow-light text-gb-bg hover:bg-gb-yellow border-transparent font-bold">
                Save Product
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------
  // POST EDIT / CREATE FORM VIEW
  // ----------------------------------------------------
  if (editingPost) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-6 border-b border-gb-bg-soft/50 pb-4">
          <h2 className="text-2xl font-mono text-gb-orange-light flex items-center gap-2">
            <ArrowLeftIcon 
              className="cursor-pointer hover:text-gb-fg transition-colors" 
              size={24} 
              onClick={() => { setEditingPost(null); setIsPreviewMode(false); }} 
            />
            {posts.find(p => p.id === editingPost.id) ? 'Edit Post' : 'New Post'}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => { setEditingPost(null); setIsPreviewMode(false); }}>Cancel</Button>
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
                        disabled={!isCreatingMode}
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
                      <label className="block text-sm mb-2 text-gb-fg-dark">Category</label>
                      <select
                        value={editingPost.type || 'linux'}
                        onChange={e => setEditingPost({...editingPost, type: e.target.value})}
                        className="w-full bg-gb-bg-soft border-2 border-gb-fg-dark/20 rounded-none px-3 py-2 text-gb-fg font-mono text-sm focus:outline-none focus:border-gb-orange-light focus:ring-1 focus:ring-gb-orange-light transition-all"
                      >
                        <option value="linux">Linux</option>
                        <option value="cybersecurity">Cybersecurity</option>
                        <option value="backend">Backend Engineering</option>
                        <option value="devops">DevOps & Cloud</option>
                        <option value="terminal">CLI & Terminal</option>
                        <option value="academic">Academic & Writing</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-gb-fg-dark">Tags (comma separated)</label>
                      <Input 
                        type="text" 
                        value={Array.isArray(editingPost.tags) ? editingPost.tags.join(', ') : (editingPost.tags || '')}
                        onChange={e => setEditingPost({...editingPost, tags: e.target.value as any})}
                        placeholder="bash, kernel, systemd"
                      />
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
                            const formData = new FormData();
                            formData.append('image', file);
                            try {
                              const res = await fetch('/api/upload', { method: 'POST', body: formData });
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
                                    const formData = new FormData();
                                    formData.append('image', file);
                                    try {
                                      const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                      if (res.ok) {
                                        const data = await res.json();
                                        updateContentAndReadTime(currentTranslation.content + `\n![image](${data.url})`);
                                      }
                                    } catch(err) {}
                                  }} 
                                />
                                Insert Image
                              </label>
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
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN DASHBOARD LAYOUT (SIDEBAR + CONTENT PANELS)
  // ----------------------------------------------------
  return (
    <div className="animate-in fade-in duration-700 flex flex-col md:flex-row gap-8 min-h-[70vh]">
      {/* Sidebar navigation */}
      <aside className="w-full md:w-60 shrink-0 flex flex-col justify-between bg-gb-bg-soft/10 border border-gb-bg-soft/50 p-4 md:p-6 rounded-lg font-mono">
        <div className="space-y-6">
          <div className="border-b border-gb-bg-soft/50 pb-4">
            <h3 className="text-xl font-bold text-gb-orange-light flex items-center gap-2">
              <LayoutDashboardIcon size={20} />
              root@admin
            </h3>
            <p className="text-[10px] text-gb-fg-dark/60 mt-1">session active</p>
          </div>
          
          <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all text-sm w-full text-start shrink-0 cursor-pointer ${
                activeTab === 'posts'
                  ? 'bg-gb-orange-light/10 text-gb-orange-light border-l-2 border-gb-orange-light font-bold'
                  : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
              }`}
            >
              <FileTextIcon size={18} />
              <span>Posts</span>
              <span className="ml-auto text-xs bg-gb-bg-soft px-1.5 py-0.5 rounded border border-gb-bg-light/40 font-bold tabular-nums">{posts.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('comments')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all text-sm w-full text-start shrink-0 cursor-pointer ${
                activeTab === 'comments'
                  ? 'bg-gb-orange-light/10 text-gb-orange-light border-l-2 border-gb-orange-light font-bold'
                  : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
              }`}
            >
              <MessageSquareIcon size={18} />
              <span>Comments</span>
              <span className="ml-auto text-xs bg-gb-bg-soft px-1.5 py-0.5 rounded border border-gb-bg-light/40 font-bold tabular-nums">{comments.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all text-sm w-full text-start shrink-0 cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-gb-orange-light/10 text-gb-orange-light border-l-2 border-gb-orange-light font-bold'
                  : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
              }`}
            >
              <TagIcon size={18} />
              <span>Products</span>
              <span className="ml-auto text-xs bg-gb-bg-soft px-1.5 py-0.5 rounded border border-gb-bg-light/40 font-bold tabular-nums">{products.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all text-sm w-full text-start shrink-0 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-gb-orange-light/10 text-gb-orange-light border-l-2 border-gb-orange-light font-bold'
                  : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
              }`}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div className="mt-8 pt-4 border-t border-gb-bg-soft/50 flex md:flex-col gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-gb-orange-light/80 hover:text-gb-orange-light cursor-pointer !px-3"
          >
            <LogOutIcon size={16} /> Logout
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')}
            className="w-full justify-start gap-2 text-gb-fg-dark hover:text-gb-fg cursor-pointer !px-3"
          >
            <ArrowLeftIcon size={16} /> Exit dashboard
          </Button>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <div className="flex-1 min-w-0">
        {successMessage && (
          <div className="bg-gb-green-light/10 text-gb-green-light px-4 py-3 mb-6 rounded border border-gb-green-light/30 font-mono text-sm animate-in fade-in duration-300">
            {successMessage}
          </div>
        )}

        {/* Dashboard Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-gb-bg-soft/50 pb-4">
          <div>
            <h2 className="text-3xl font-mono text-gb-fg capitalize">{activeTab}</h2>
            <p className="text-sm text-gb-fg-dark font-mono mt-1">
              {activeTab === 'posts' && 'Create, edit, and manage blog posts.'}
              {activeTab === 'comments' && 'Moderate user comments across posts.'}
              {activeTab === 'products' && 'Manage shop items, books, and templates.'}
              {activeTab === 'settings' && 'Configure global site preferences and maintenance modes.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'comments' && activeTab !== 'settings' && (
              <Button 
                onClick={() => {
                  setIsCreatingMode(true);
                  setEditingFormTab('metadata');
                  if (activeTab === 'posts') {
                    setEditingPost({
                      translations: [
                        { language: 'en', title: '', summary: '', content: '', readTime: 5 },
                        { language: 'fa', title: '', summary: '', content: '', readTime: 5 }
                      ]
                    });
                  } else if (activeTab === 'products') {
                    setEditingProduct({
                      translations: [
                        { language: 'en', title: '', description: '', features: [], price: 0 },
                        { language: 'fa', title: '', description: '', features: [], price: 0 }
                      ]
                    });
                  }
                  setIsPreviewMode(false);
                }}
                className="gap-2 bg-gb-green-light text-gb-bg hover:bg-gb-green border-transparent font-mono cursor-pointer"
              >
                <PlusIcon size={16} /> New {activeTab === 'posts' ? 'Post' : 'Product'}
              </Button>
            )}

            <Button 
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedItems([]);
              }}
              className={`gap-2 font-mono cursor-pointer ${isSelectionMode ? 'bg-gb-red-light/20 text-gb-red-light border-gb-red-light' : ''}`}
            >
              {isSelectionMode ? <XIcon size={16} /> : <CheckSquare size={16} />} 
              {isSelectionMode ? 'Cancel' : 'Select'}
            </Button>
          </div>
        </div>

        {/* Content list panels */}
        {loading ? (
          <p className="font-mono text-gb-fg-dark animate-pulse">Loading {activeTab}...</p>
        ) : error ? (
          <p className="font-mono text-gb-orange-light">{error}</p>
        ) : (
          <>
            {/* POSTS PANEL */}
            {activeTab === 'posts' && (
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
                          setEditingFormTab('metadata');
                          setIsPreviewMode(false);
                          setIsCreatingMode(false);
                        }
                      }}
                    >
                      <div className="flex gap-4 items-start">
                        {isSelectionMode && (
                          <div className="text-gb-red-light shrink-0 mt-1">
                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="text-gb-fg-dark/50" />}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-gb-bg-light/40 border border-gb-bg-soft text-gb-fg-dark rounded-sm">
                              {post.type || 'linux'}
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
                            <Trash2Icon size={16} />
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
            )}

            {/* COMMENTS PANEL */}
            {activeTab === 'comments' && (
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
                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="text-gb-fg-dark/50" />}
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
                            <Trash2Icon size={16} />
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
            )}

            {/* PRODUCTS PANEL */}
            {activeTab === 'products' && (
              <div className="space-y-4 product-list">
                {products.map(product => {
                  const title = product.translations?.find(t => t.language === 'en')?.title 
                    || product.translations?.find(t => t.language === 'fa')?.title 
                    || 'Untitled';
                  const isSelected = selectedItems.includes(product.id);
                  return (
                    <Card 
                      key={product.id} 
                      className={`group relative flex flex-col justify-between !p-5 product-card product-item transition-all duration-300 border-2 ${
                        isSelectionMode 
                          ? isSelected 
                            ? 'border-gb-red-light bg-gb-red-light/5 hover:border-gb-red-light' 
                            : 'border-gb-bg-soft hover:border-gb-red-light/50 cursor-pointer'
                          : 'border-gb-bg-soft/60 hover:border-gb-orange-light hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(254,128,25,0.15)] cursor-pointer'
                      }`}
                      onClick={() => {
                        if (isSelectionMode) {
                          toggleSelection(product.id);
                        } else {
                          let parsedMetadata = product.metadata;
                          if (typeof parsedMetadata === 'string') {
                            try {
                              parsedMetadata = JSON.parse(parsedMetadata);
                            } catch (err) {
                              parsedMetadata = {};
                            }
                          }
                          setEditingProduct({ ...product, metadata: parsedMetadata as any });
                          setEditingFormTab('metadata');
                          setIsCreatingMode(false);
                        }
                      }}
                    >
                      <div className="flex gap-4 items-start">
                        {isSelectionMode && (
                          <div className="text-gb-red-light shrink-0 mt-1">
                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="text-gb-fg-dark/50" />}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-gb-bg-light/40 border border-gb-bg-soft text-gb-fg-dark rounded-sm">
                              {product.type || 'latex'}
                            </span>
                            {product.metadata?.format && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-gb-purple-light/10 text-gb-purple-light border border-gb-purple-light/20 rounded-sm">
                                {product.metadata.format}
                              </span>
                            )}
                            <div className="flex gap-1">
                              {product.translations?.some(t => t.language === 'en' && t.title) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-gb-blue-light/10 text-gb-blue-light border border-gb-blue-light/20 rounded-sm">EN</span>
                              )}
                              {product.translations?.some(t => t.language === 'fa' && t.title) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-gb-green-light/10 text-gb-green-light border border-gb-green-light/20 rounded-sm">FA</span>
                              )}
                            </div>
                          </div>

                          <h3 className="font-mono font-bold text-lg text-gb-fg group-hover:text-gb-orange-light transition-colors mt-2 break-all line-clamp-1">
                            {title}
                          </h3>

                          <p className="text-xs text-gb-fg-dark font-mono mt-1 break-all line-clamp-2 leading-relaxed">
                            {product.translations?.find(t => t.language === 'en')?.description || product.translations?.find(t => t.language === 'fa')?.description || 'No description available.'}
                          </p>
                          
                          <div className="text-[10px] text-gb-fg-dark/60 font-mono mt-3 flex items-center gap-3">
                            <span className="text-gb-yellow-light font-bold">
                              ${product.translations?.find((t: any) => t.language === 'en')?.price ?? 0}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-gb-aqua-light">{product.id}</span>
                            {product.metadata?.author && (
                              <>
                                <span>•</span>
                                <span>By {product.metadata.author}</span>
                              </>
                            )}
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
                              let parsedMetadata = product.metadata;
                              if (typeof parsedMetadata === 'string') {
                                try {
                                  parsedMetadata = JSON.parse(parsedMetadata);
                                } catch (err) {
                                  parsedMetadata = {};
                                }
                              }
                              setEditingProduct({ ...product, metadata: parsedMetadata as any });
                              setEditingFormTab('metadata');
                              setIsCreatingMode(false);
                            }}
                            className="text-gb-yellow-light hover:text-gb-yellow p-1.5 edit-button"
                            title="Edit"
                          >
                            <PencilIcon size={16} />
                          </Button>
                          <Button 
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(product.id);
                            }}
                            className="text-gb-orange-light hover:text-gb-orange p-1.5 delete-button"
                            title="Delete"
                          >
                            <Trash2Icon size={16} />
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
                {products.length === 0 && (
                  <p className="font-mono text-gb-fg-dark italic text-center py-8 border-2 border-dashed border-gb-bg-soft rounded-lg">No products found.</p>
                )}
              </div>
            )}

            {/* SETTINGS PANEL */}
            {activeTab === 'settings' && (
              <Card className="border-2 border-gb-bg-soft/60 p-6 font-mono space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-gb-fg mb-2">Global Preferences</h3>
                  <p className="text-sm text-gb-fg-dark">Configure site settings and features.</p>
                </div>
                
                <div className="border-t border-gb-bg-soft/50 pt-6 space-y-6">
                  {[
                    {
                      key: 'site_maintenance' as const,
                      label: 'Site-wide Maintenance Mode',
                      desc: 'Restricts public access to the entire website, displaying an "Under Maintenance" notice. Admins can still bypass and access all pages.',
                      activeLabel: 'Under Maintenance',
                      inactiveLabel: 'Published',
                    },
                    {
                      key: 'blog_maintenance' as const,
                      label: 'Blog Maintenance Mode',
                      desc: 'Restricts public access to the blog posts feed and individual post pages, displaying an "Under Maintenance" notice.',
                      activeLabel: 'Under Maintenance',
                      inactiveLabel: 'Published',
                    },
                    {
                      key: 'comments_maintenance' as const,
                      label: 'Comments Maintenance Mode',
                      desc: 'Disables posting new comments while keeping existing comments readable.',
                      activeLabel: 'Disabled',
                      inactiveLabel: 'Enabled',
                    },
                    {
                      key: 'store_maintenance' as const,
                      label: 'Store Maintenance Mode',
                      desc: 'Restricts public access to the store page, displaying an "Under Maintenance" notice. Admins can still preview products.',
                      activeLabel: 'Under Maintenance',
                      inactiveLabel: 'Published',
                    },
                  ].map(({ key, label, desc, activeLabel, inactiveLabel }, idx) => {
                    const isChecked = !!settings[key];
                    return (
                      <div key={key} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${idx > 0 ? 'border-t border-gb-bg-soft/30 pt-6' : ''}`}>
                        <div className="space-y-1 max-w-xl">
                          <h4 className="text-base font-bold text-gb-fg">{label}</h4>
                          <p className="text-xs text-gb-fg-dark">{desc}</p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded border transition-all duration-300 ${
                            isChecked 
                              ? 'bg-gb-red/10 text-gb-red-light border-gb-red-light/20' 
                              : 'bg-gb-green/10 text-gb-green-light border-gb-green-light/20'
                          }`}>
                            {isChecked ? activeLabel : inactiveLabel}
                          </span>
                          
                          {/* Retro switch button */}
                          <button
                            onClick={() => handleToggleSetting(key, !isChecked)}
                            disabled={savingSettings}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gb-orange-light focus:ring-offset-2 focus:ring-offset-gb-bg ${
                              isChecked ? 'bg-gb-red-light' : 'bg-gb-bg-light'
                            } ${savingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                            role="switch"
                            aria-checked={isChecked}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-gb-bg shadow ring-0 transition duration-200 ease-in-out ${
                                isChecked ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Floating Action Bar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gb-bg/90 backdrop-blur-md border-2 border-gb-bg-soft px-6 py-4 shadow-2xl flex items-center gap-6 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="font-mono text-sm text-gb-fg">
            <span className="text-gb-orange-light font-bold tabular-nums">{selectedItems.length}</span> items selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-2 bg-gb-orange-light/20 text-gb-orange-light hover:bg-gb-orange-light hover:text-gb-bg rounded border border-gb-orange-light transition-colors group cursor-pointer"
              title="Bulk Delete"
            >
              <Trash2Icon size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-gb-bg border-2 border-gb-bg-soft rounded p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-gb-orange-light">
              <Trash2Icon size={28} />
              <h3 className="text-xl font-bold font-mono">Confirm Deletion</h3>
            </div>
            <p className="text-gb-fg-dark font-mono text-sm mb-8 leading-relaxed">
              Are you sure you want to delete <strong className="text-gb-fg font-extrabold">{selectedItems.length}</strong> items? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <Button 
                variant="secondary" 
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingBulk}
                className="cursor-pointer font-mono"
              >
                Cancel
              </Button>
              <Button 
                className="bg-gb-orange-light text-gb-bg hover:bg-gb-orange border-transparent font-bold flex items-center gap-2 min-w-[120px] justify-center cursor-pointer font-mono"
                onClick={handleBulkDelete}
                disabled={isDeletingBulk}
              >
                {isDeletingBulk ? (
                  <div className="w-5 h-5 border-2 border-gb-bg border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Confirm Delete'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
