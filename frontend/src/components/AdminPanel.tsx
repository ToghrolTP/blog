import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Post, Comment, Product, Category } from '../types';
import { 
  BugIcon,
  PlusIcon, 
  LogOutIcon, 
  CheckSquareIcon, 
  XIcon, 
  LayoutDashboardIcon, 
  MessageSquareIcon, 
  TagIcon, 
  ArrowLeftIcon, 
  FileTextIcon,
  SettingsIcon,
  TrashIcon,
  FolderIcon
} from './Icons';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

// Import sub-panels
import { AdminPosts } from './admin/AdminPosts';
import { AdminProducts } from './admin/AdminProducts';
import { AdminComments } from './admin/AdminComments';
import { AdminFeedbacks } from './admin/AdminFeedbacks';
import { AdminSettings } from './admin/AdminSettings';
import { AdminCategories } from './admin/AdminCategories';

export function AdminPanel() {
  const navigate = useNavigate();
  const [secret, setSecret] = useState(localStorage.getItem('adminSecret') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'products' | 'feedback' | 'settings' | 'categories'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<{
    site_maintenance?: boolean;
    blog_maintenance?: boolean;
    comments_maintenance?: boolean;
    store_maintenance?: boolean;
    feedback_enabled?: boolean;
    feedback_allowed_paths?: string;
  }>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Post/Product edit states shared with sub-panels to control list vs editor rendering
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [originalPostId, setOriginalPostId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingFormTab, setEditingFormTab] = useState<'metadata' | 'en' | 'fa'>('metadata');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isCreatingMode, setIsCreatingMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const allExistingTags = Array.from(
    new Set(
      posts.flatMap(p => Array.isArray(p.tags) ? p.tags : [])
    )
  ).sort();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<(string | number)[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const fetchPosts = async (currentSecret: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/posts', {
        headers: { 'Authorization': `Bearer ${currentSecret}` }
      });
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

  const fetchProducts = async (currentSecret: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${currentSecret}` }
      });
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

  const fetchSettings = async (currentSecret: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${currentSecret}` }
      });
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

  const fetchFeedbacks = async (currentSecret: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feedbacks', {
        headers: { 'Authorization': `Bearer ${currentSecret}` }
      });
      if (res.ok) {
        setFeedbacks(await res.json());
      } else {
        setError('Failed to fetch feedbacks');
      }
    } catch (err) {
      setError('Network error fetching feedbacks');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async (currentSecret: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${currentSecret}` }
      });
      if (res.ok) {
        setCategories(await res.json());
      } else {
        setError('Failed to fetch categories');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret })
      });
      if (res.ok) {
        localStorage.setItem('adminSecret', secret);
        setIsAuthenticated(true);
      } else {
        setError('Invalid secret key');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  useEffect(() => {
    if (secret) {
      fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret })
      }).then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('adminSecret');
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCategories(secret);
      if (activeTab === 'posts') fetchPosts(secret);
      else if (activeTab === 'comments') fetchComments(secret);
      else if (activeTab === 'products') fetchProducts(secret);
      else if (activeTab === 'feedback') fetchFeedbacks(secret);
      else if (activeTab === 'settings') fetchSettings(secret);
    }
  }, [isAuthenticated, activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('adminSecret');
    setSecret('');
    setIsAuthenticated(false);
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
              onClick={() => setActiveTab('feedback')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all text-sm w-full text-start shrink-0 cursor-pointer ${
                activeTab === 'feedback'
                  ? 'bg-gb-orange-light/10 text-gb-orange-light border-l-2 border-gb-orange-light font-bold'
                  : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
              }`}
            >
              <BugIcon size={18} />
              <span>Feedback</span>
              <span className="ml-auto text-xs bg-gb-bg-soft px-1.5 py-0.5 rounded border border-gb-bg-light/40 font-bold tabular-nums">{feedbacks.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all text-sm w-full text-start shrink-0 cursor-pointer ${
                activeTab === 'categories'
                  ? 'bg-gb-orange-light/10 text-gb-orange-light border-l-2 border-gb-orange-light font-bold'
                  : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
              }`}
            >
              <FolderIcon size={18} />
              <span>Categories</span>
              <span className="ml-auto text-xs bg-gb-bg-soft px-1.5 py-0.5 rounded border border-gb-bg-light/40 font-bold tabular-nums">{categories.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all text-sm w-full text-start shrink-0 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-gb-orange-light/10 text-gb-orange-light border-l-2 border-gb-orange-light font-bold'
                  : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
              }`}
            >
              <SettingsIcon size={18} />
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
        {/* If we are editing post or product, we don't display the main dashboard header */}
        {((activeTab !== 'posts' || !editingPost) && (activeTab !== 'products' || !editingProduct)) && (
          <>


            {/* Dashboard Title & Quick Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-gb-bg-soft/50 pb-4">
              <div>
                <h2 className="text-3xl font-mono text-gb-fg capitalize">{activeTab}</h2>
                <p className="text-sm text-gb-fg-dark font-mono mt-1">
                  {activeTab === 'posts' && 'Create, edit, and manage blog posts.'}
                  {activeTab === 'comments' && 'Moderate user comments across posts.'}
                  {activeTab === 'products' && 'Manage shop items, books, and templates.'}
                  {activeTab === 'feedback' && 'View and manage user bug reports and feedbacks.'}
                  {activeTab === 'settings' && 'Configure global site preferences and maintenance modes.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {activeTab !== 'comments' && activeTab !== 'settings' && activeTab !== 'feedback' && (
                  <Button 
                    onClick={() => {
                      setIsCreatingMode(true);
                      setEditingFormTab('metadata');
                      setOriginalPostId(null);
                      if (activeTab === 'posts') {
                        setEditingPost({
                          date: new Date().toISOString().split('T')[0],
                          isDraft: true,
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

                {activeTab !== 'settings' && activeTab !== 'feedback' && (
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode);
                      if (isSelectionMode) setSelectedItems([]);
                    }}
                    className={`gap-2 font-mono cursor-pointer ${isSelectionMode ? 'bg-gb-red-light/20 text-gb-red-light border-gb-red-light' : ''}`}
                  >
                    {isSelectionMode ? <XIcon size={16} /> : <CheckSquareIcon size={16} />} 
                    {isSelectionMode ? 'Cancel' : 'Select'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {loading ? (
          <p className="font-mono text-gb-fg-dark animate-pulse">Loading {activeTab}...</p>
        ) : error ? (
          <p className="font-mono text-gb-orange-light">{error}</p>
        ) : (
          <>
            {activeTab === 'posts' && (
              <AdminPosts
                secret={secret}
                posts={posts}
                setPosts={setPosts}
                loading={loading}
                setLoading={setLoading}
                editingPost={editingPost}
                setEditingPost={setEditingPost}
                originalPostId={originalPostId}
                setOriginalPostId={setOriginalPostId}
                editingFormTab={editingFormTab}
                setEditingFormTab={setEditingFormTab}
                isPreviewMode={isPreviewMode}
                setIsPreviewMode={setIsPreviewMode}
                isCreatingMode={isCreatingMode}
                setIsCreatingMode={setIsCreatingMode}
                isSelectionMode={isSelectionMode}
                setIsSelectionMode={setIsSelectionMode}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                toggleSelection={toggleSelection}
                setSuccessMessage={setSuccessMessage}
                fetchPosts={fetchPosts}
                allExistingTags={allExistingTags}
                categories={categories}
              />
            )}

            {activeTab === 'products' && (
              <AdminProducts
                secret={secret}
                products={products}
                setProducts={setProducts}
                loading={loading}
                setLoading={setLoading}
                editingProduct={editingProduct}
                setEditingProduct={setEditingProduct}
                editingFormTab={editingFormTab}
                setEditingFormTab={setEditingFormTab}
                isCreatingMode={isCreatingMode}
                setIsCreatingMode={setIsCreatingMode}
                isSelectionMode={isSelectionMode}
                setIsSelectionMode={setIsSelectionMode}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                toggleSelection={toggleSelection}
                setSuccessMessage={setSuccessMessage}
              />
            )}

            {activeTab === 'comments' && (
              <AdminComments
                secret={secret}
                comments={comments}
                setComments={setComments}
                loading={loading}
                setLoading={setLoading}
                isSelectionMode={isSelectionMode}
                selectedItems={selectedItems}
                toggleSelection={toggleSelection}
                setSuccessMessage={setSuccessMessage}
              />
            )}

            {activeTab === 'feedback' && (
              <AdminFeedbacks
                secret={secret}
                feedbacks={feedbacks}
                setFeedbacks={setFeedbacks}
                loading={loading}
                setLoading={setLoading}
                setSuccessMessage={setSuccessMessage}
              />
            )}

            {activeTab === 'settings' && (
              <AdminSettings
                secret={secret}
                settings={settings}
                setSettings={setSettings}
                savingSettings={savingSettings}
                setSavingSettings={setSavingSettings}
                setSuccessMessage={setSuccessMessage}
                setError={setError}
              />
            )}

            {activeTab === 'categories' && (
              <AdminCategories
                secret={secret}
                categories={categories}
                setCategories={setCategories}
                loading={loading}
                setSuccessMessage={setSuccessMessage}
                setError={setError}
              />
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
              <TrashIcon size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-gb-bg border-2 border-gb-bg-soft rounded p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-gb-orange-light">
              <TrashIcon size={28} />
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
      {successMessage && (
        <div className="fixed top-6 right-6 bg-[#282828] border-l-4 border-gb-green-light px-5 py-4 shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-right-10 fade-in duration-300">
          <div className="w-2 h-2 rounded-full bg-gb-green-light animate-ping" />
          <div className="font-mono text-xs text-gb-fg">
            <span className="text-gb-green-light font-bold">SUCCESS:</span> {successMessage}
          </div>
        </div>
      )}
    </div>
  );
}
