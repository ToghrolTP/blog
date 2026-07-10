import React from 'react';
import { useState } from 'react';
import { Product } from '../../types';
import { 
  PencilIcon, 
  TrashIcon, 
  PlusIcon, 
  CheckSquareIcon, 
  SquareIcon, 
  XIcon, 
  ArrowLeftIcon 
} from '../Icons';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { compressImage } from './image';

interface AdminProductsProps {
  secret: string;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  loading: boolean;
  setLoading: (l: boolean) => void;
  editingProduct: Partial<Product> | null;
  setEditingProduct: (p: Partial<Product> | null) => void;
  editingFormTab: 'metadata' | 'en' | 'fa';
  setEditingFormTab: (t: 'metadata' | 'en' | 'fa') => void;
  isCreatingMode: boolean;
  setIsCreatingMode: (c: boolean) => void;
  isSelectionMode: boolean;
  setIsSelectionMode: (s: boolean) => void;
  selectedItems: (string | number)[];
  setSelectedItems: React.Dispatch<React.SetStateAction<(string | number)[]>>;
  toggleSelection: (id: string | number) => void;
  setSuccessMessage: (m: string | null) => void;
}

export function AdminProducts({
  secret,
  products,
  setProducts,
  loading,
  setLoading,
  editingProduct,
  setEditingProduct,
  editingFormTab,
  setEditingFormTab,
  isCreatingMode,
  setIsCreatingMode,
  isSelectionMode,
  setIsSelectionMode,
  selectedItems,
  setSelectedItems,
  toggleSelection,
  setSuccessMessage
}: AdminProductsProps) {

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
                                    uploadedUrls.push(data.url);
                                  }
                                } catch(err) { console.error('Upload failed', err); }
                              }
                              
                              if (editingProduct) {
                                setEditingProduct({
                                  ...editingProduct,
                                  photos: [...(editingProduct.photos || []), ...uploadedUrls]
                                });
                              }
                              
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
                                <TrashIcon size={14} className="text-gb-red-light" />
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

  return (
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
                  {isSelected ? <CheckSquareIcon size={20} /> : <SquareIcon size={20} className="text-gb-fg-dark/50" />}
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
                  <TrashIcon size={16} />
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
  );
}
