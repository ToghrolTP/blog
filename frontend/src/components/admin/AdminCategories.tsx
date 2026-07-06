import React, { useState } from 'react';
import { Category } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PlusIcon } from '../Icons';
import { CategoryIcon } from '../ui/SidebarTree';

interface AdminCategoriesProps {
  secret: string;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  loading: boolean;
  setSuccessMessage: (m: string | null) => void;
  setError: (e: string | null) => void;
}

export function AdminCategories({
  secret,
  categories,
  setCategories,
  loading,
  setSuccessMessage,
  setError,
}: AdminCategoriesProps) {
  const [name, setName] = useState('');
  const [metaDomain, setMetaDomain] = useState('SYSTEMS & INFRASTRUCTURE');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/svg+xml' && !file.name.endsWith('.svg')) {
      setError('Please upload a valid .svg file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text.trim().toLowerCase().startsWith('<svg')) {
        setIcon(text);
        setError(null);
      } else {
        setError('Invalid SVG file structure');
      }
    };
    reader.onerror = () => {
      setError('Failed to read SVG file');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !icon.trim() || !description.trim()) {
      setError('All fields are required');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`
        },
        body: JSON.stringify({
          name: name.trim(),
          metaDomain: metaDomain,
          icon: icon.trim(),
          description: description.trim(),
        })
      });

      if (res.ok) {
        const newCat = await res.json();
        setCategories(prev => [...prev, newCat]);
        setSuccessMessage('Category created successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        
        // Reset form
        setName('');
        setIcon('');
        setDescription('');
      } else {
        const errorText = await res.text();
        setError(`Failed to create category: ${errorText || res.statusText}`);
      }
    } catch (err) {
      setError('Network error creating category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const metaDomainOptions = [
    { value: 'SYSTEMS & INFRASTRUCTURE', label: '📁 Systems & Infrastructure' },
    { value: 'SOFTWARE DEVELOPMENT', label: '💻 Software Development' },
    { value: 'AI & DATA SCIENCE', label: '🧠 AI & Data Science' },
    { value: 'RESOURCES & DIGITAL PRODUCTS', label: '📦 Resources & Digital Products' },
  ];

  return (
    <div className="space-y-8 font-mono animate-in fade-in duration-300">
      {/* Page Title & Context */}
      <div>
        <h3 className="text-xl font-bold text-gb-fg mb-2">Category Management</h3>
        <p className="text-sm text-gb-fg-dark">Create and manage meta-domain folders and workspace directories.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Category Creation Form */}
        <div className="lg:col-span-1">
          <Card className="border-2 border-gb-bg-soft/60 p-6 space-y-6">
            <h4 className="text-md font-bold text-gb-orange-light border-b border-gb-bg-soft/50 pb-2 uppercase tracking-wider">
              [+] Add New Category
            </h4>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Meta-Domain Selection */}
              <div>
                <label className="block text-xs font-bold text-gb-fg-dark mb-1.5 uppercase">
                  Domain Category (Meta-Domain Group)
                </label>
                <select
                  value={metaDomain}
                  onChange={(e) => setMetaDomain(e.target.value)}
                  className="w-full bg-gb-bg-soft/20 text-gb-fg border-2 border-gb-bg-soft focus:border-gb-orange-light focus:outline-none focus:bg-gb-bg-soft/40 px-3 py-2 text-sm rounded-none transition-all cursor-pointer font-mono"
                >
                  {metaDomainOptions.map(option => (
                    <option key={option.value} value={option.value} className="bg-gb-bg text-gb-fg py-2">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gb-fg-dark mb-1.5 uppercase">
                  Category Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Kernel Development"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  className="!rounded-none focus:border-gb-orange-light"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-xs font-bold text-gb-fg-dark mb-1.5 uppercase">
                  Category Icon (Key / Emoji / SVG)
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="e.g. brain, linux-logo, or 💻"
                      value={icon.trim().toLowerCase().startsWith('<svg') ? 'Custom SVG Uploaded' : icon}
                      onChange={(e) => setIcon(e.target.value)}
                      disabled={isSubmitting || icon.trim().toLowerCase().startsWith('<svg')}
                      className="!rounded-none focus:border-gb-orange-light flex-1"
                    />
                    {icon.trim().toLowerCase().startsWith('<svg') && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setIcon('')}
                        className="!rounded-none px-3 bg-gb-red/10 text-gb-red-light border-gb-red/30 hover:bg-gb-red/20 font-bold font-mono text-xs"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  
                  {/* File Upload Button */}
                  <div className="relative">
                    <input
                      type="file"
                      id="svg-upload"
                      accept=".svg"
                      onChange={handleSvgUpload}
                      disabled={isSubmitting}
                      className="hidden"
                    />
                    <label
                      htmlFor="svg-upload"
                      className={`flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gb-bg-soft hover:border-gb-orange-light text-gb-fg-dark hover:text-gb-fg text-xs font-bold font-mono cursor-pointer select-none transition-all ${
                        isSubmitting ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      <span>📂 Upload Custom SVG Icon</span>
                    </label>
                  </div>

                  {/* Icon Live Preview */}
                  {icon.trim() && (
                    <div className="flex items-center gap-3 p-3 bg-gb-bg-soft/10 border border-gb-bg-soft rounded-none">
                      <span className="text-xs font-bold text-gb-fg-dark uppercase">Preview:</span>
                      <span className="text-gb-orange-light text-xl flex items-center justify-center min-w-[1.5em] min-h-[1.5em] [&>svg]:w-6 [&>svg]:h-6 [&>svg]:fill-current">
                        <CategoryIcon iconKey={icon} />
                      </span>
                      <span className="text-xs text-gb-fg-dark font-mono truncate max-w-[180px]">
                        {icon.trim().toLowerCase().startsWith('<svg') ? 'Vector Graphic' : icon}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gb-fg-dark mb-1.5 uppercase">
                  Short Sub-title / Description
                </label>
                <textarea
                  placeholder="e.g. Low-level OS programming"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full bg-gb-bg-soft/20 text-gb-fg placeholder:text-gb-fg-dark/50 border-2 border-gb-bg-soft focus:border-gb-orange-light focus:outline-none focus:bg-gb-bg-soft/40 rounded-none px-3 py-2 text-sm transition-all font-mono"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gb-orange-light text-gb-bg hover:bg-gb-orange border-transparent font-bold !rounded-none flex items-center justify-center gap-2 py-2.5"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-gb-bg border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <PlusIcon size={16} />
                    <span>Save Directory</span>
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* Existing Categories List */}
        <div className="lg:col-span-2">
          <Card className="border-2 border-gb-bg-soft/60 p-6 space-y-6">
            <h4 className="text-md font-bold text-gb-fg border-b border-gb-bg-soft/50 pb-2 uppercase tracking-wider">
              Directory Tree Nodes ({categories.length})
            </h4>

            {loading ? (
              <div className="text-center py-12 text-gb-fg-dark/50 animate-pulse">
                Reading workspace directories...
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12 text-gb-fg-dark/50">
                No directories registered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gb-bg-soft text-gb-fg-dark uppercase">
                      <th className="py-2.5 px-3">Icon</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Meta-Domain</th>
                      <th className="py-2.5 px-3">Sub-title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat, idx) => (
                      <tr
                        key={cat.id}
                        className={`border-b border-gb-bg-soft/40 hover:bg-gb-bg-soft/10 transition-colors ${
                          idx % 2 === 0 ? 'bg-transparent' : 'bg-gb-bg-soft/5'
                        }`}
                      >
                        <td className="py-3 px-3 text-lg text-gb-orange-light flex items-center justify-start min-h-[3rem]">
                          <CategoryIcon iconKey={cat.icon} />
                        </td>
                        <td className="py-3 px-3 font-bold text-gb-fg">{cat.name}</td>
                        <td className="py-3 px-3 text-gb-yellow-light uppercase text-[10px] tracking-wider font-bold">
                          {cat.metaDomain}
                        </td>
                        <td className="py-3 px-3 text-gb-fg-dark">{cat.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
