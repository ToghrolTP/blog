import React, { useState, useEffect } from 'react';
import { User, Post, Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { DeleteAccountModal } from './DeleteAccountModal';
import {
  UserIcon,
  CheckIcon,
  SettingsIcon,
  EyeIcon,
  EyeSlashIcon,
  FloppyDiskIcon,
  FolderIcon,
  ArrowRightIcon,
  PackageIcon,
  FileTextIcon,
  DownloadIcon,
  SparkleIcon,
  WarningIcon
} from './Icons';

interface ProfilePageProps {
  profile: User;
  onUpdateProfile: () => void;
  onSelectPost: (id: string) => void;
  onNavigateToStore: () => void;
}

// Simple deterministic hash to simulate dynamic real-time integrity verification
function getRealtimeHash(display: string, user: string, mail: string, text: string): string {
  const combined = `${display}:${user}:${mail}:${text}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  return `0x${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

export function ProfilePage({
  profile,
  onUpdateProfile,
  onSelectPost,
  onNavigateToStore
}: ProfilePageProps) {
  const { language } = useLanguage();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteAccount = async () => {
    const res = await fetch('/api/users/profile', {
      method: 'DELETE',
    });

    if (res.ok) {
      window.location.href = language === 'fa' ? '/fa' : '/';
    } else {
      const errText = await res.text();
      throw new Error(errText || 'Failed to delete account');
    }
  };

  const [posts, setPosts] = useState<Post[]>([]);
  const [templates, setTemplates] = useState<Product[]>([]);

  // Fetch posts and products on mount
  useEffect(() => {
    fetch('/api/posts')
      .then(res => res.json())
      .then(data => setPosts(data))
      .catch(err => console.error("Failed to fetch posts:", err));

    fetch('/api/products')
      .then(res => res.json())
      .then(data => setTemplates(data))
      .catch(err => console.error("Failed to fetch products:", err));
  }, []);

  // Config states
  const [displayName, setDisplayName] = useState(profile.displayName || profile.username);
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email || '');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState(profile.bio || '');

  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync state if profile changes externally
  useEffect(() => {
    setDisplayName(profile.displayName || profile.username);
    setUsername(profile.username);
    setEmail(profile.email || '');
    setBio(profile.bio || '');
  }, [profile]);

  // Derived real-time interactive calculations
  const liveHash = getRealtimeHash(displayName, username, email, bio);
  const savedPosts = posts.filter(p => (profile.savedPostIds || []).includes(p.id));
  const purchasedTemplates = templates.filter(t => (profile.purchasedTemplateIds || []).includes(t.id));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          displayName,
          email,
          bio,
          password: password || undefined,
        }),
      });

      if (res.ok) {
        onUpdateProfile();
        setSuccessMsg(
          language === 'fa' 
            ? 'پیکربندی ایستگاه کاری با موفقیت در هسته ثبت شد!' 
            : 'Workstation configuration committed to kernel successfully!'
        );
        setPassword('');
        setTimeout(() => setSuccessMsg(null), 3500);
      } else {
        const errText = await res.text();
        setErrorMsg(errText || 'Failed to update profile');
      }
    } catch (err) {
      setErrorMsg('Connection error');
    } finally {
      setSaving(false);
    }
  };

  const isRtl = language === 'fa';

  return (
    <div className="animate-in fade-in duration-500 w-full pb-16" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div className={`mb-8 font-mono text-gb-fg-dark border-gb-yellow-light py-1 ${isRtl ? 'border-r-2 pr-4' : 'border-l-2 pl-4'}`}>
        <p className="text-gb-fg text-lg font-bold">
          {isRtl ? 'پروفایل' : 'Profile'}{' '}
          <span className="text-gb-fg-dark font-normal">/sys/profile</span>
        </p>
        <p className="mt-1 text-sm leading-relaxed">
          {isRtl 
            ? 'نماد برنامه نویسیتون رو شخصی‌سازی کنید، مشخصات حسابتون رو تغییر بدید و دارایی‌هاتون رو مدیریت کنید'
            : 'Customize your developer signature, view credentials, and review your assets.'}
        </p>
      </div>

      {/* Realtime committed notification */}
      {successMsg && (
        <div className="mb-6 p-3 bg-gb-green-light/10 border border-gb-green-light text-gb-green-light font-mono text-sm rounded-none flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <span className="flex items-center gap-1.5"><SparkleIcon className="w-4 h-4 text-gb-green-light animate-pulse" /> [SYS_LOG] {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="hover:opacity-75">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-3 bg-gb-red-light/10 border border-gb-red-light text-gb-red-light font-mono text-sm rounded-none flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <span className="flex items-center gap-1.5"><WarningIcon className="w-4 h-4 text-gb-red-light animate-shake" /> [ERR_LOG] {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="hover:opacity-75">✕</button>
        </div>
      )}

      {/* Stacked Layout: Live Card first, then Configuration Form */}
      <div className="space-y-6 mb-12">
        
        {/* Real-time Interactive Developer Card Preview */}
        <div className="flex flex-col gap-2 w-full">
          <div 
            className="relative rounded-none p-6 text-[#ebdbb2] bg-[#282828] border-2 border-[#504945] shadow-[6px_6px_0px_rgba(60,56,54,0.6)] overflow-hidden transition-all duration-300"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, rgba(235,219,178,0.015) 0px, rgba(235,219,178,0.015) 1px, transparent 1px, transparent 10px)'
            }}
          >
            {/* Soft Ambient Card Background Glow */}
            <div className="absolute top-[-30%] right-[-10%] w-[250px] h-[250px] bg-gradient-to-br from-[#fe8019]/8 via-[#fabd2f]/3 to-transparent blur-[40px] pointer-events-none"></div>

            {/* Micro Terminal Window Header */}
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-[#504945] text-[10px] font-mono tracking-wider text-[#a89984]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#fb4934]">■</span>
                <span className="text-[#fabd2f]">■</span>
                <span className="text-[#b8bb26]">■</span>
                <span className="text-[#ebdbb2] ml-1 uppercase">USER_SIGNATURE</span>
              </div>
              <span className="text-[#8ec07c]">OK.SYS</span>
            </div>
            
            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
              
              {/* Left Segment: Avatar & Identity */}
              <div className={`md:col-span-5 flex flex-col items-center text-center space-y-3 ${isRtl ? 'md:items-end md:text-right md:border-l md:pl-6' : 'md:items-start md:text-left md:border-r md:pr-6'} border-[#504945]/60`}>
                
                {/* Square Avatar */}
                <div className="w-16 h-16 rounded-none bg-[#1d2021] border-2 border-[#b8bb26] flex items-center justify-center text-3xl shadow-[3px_3px_0px_rgba(184,187,38,0.2)]">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={username} className="w-full h-full object-cover rounded-none" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-[#b8bb26]" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <h3 className="font-mono font-black text-[#fbf1c7] text-sm tracking-tight leading-snug flex items-center justify-center md:justify-start gap-1">
                    {displayName || 'Anonymous'}
                    <CheckIcon className="w-3.5 h-3.5 text-[#fabd2f]" />
                  </h3>
                  <p className="text-xs font-mono text-[#a89984]" dir="ltr">
                    @{username || 'operator'}
                  </p>
                </div>
              </div>

              {/* Right Segment: Stats Grid */}
              <div className="md:col-span-7 flex flex-col justify-center space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center md:text-left font-mono">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#a89984] font-bold">
                      {isRtl ? 'مقاله‌های ذخیره‌شده' : 'Saved Articles'}
                    </div>
                    <div className="text-sm font-black text-[#b8bb26] mt-0.5">
                      {String(savedPosts.length).padStart(2, '0')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#a89984] font-bold">
                      {isRtl ? 'قالب‌های خریداری‌شده' : 'Templates Owned'}
                    </div>
                    <div className="text-sm font-black text-[#fe8019] mt-0.5">
                      {String(purchasedTemplates.length).padStart(2, '0')}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* BIO Section */}
            <div className="mt-5 pt-4 border-t border-[#504945] font-mono text-xs">
              <div className="text-[9px] uppercase tracking-wider text-[#a89984] font-bold mb-1.5">
                {isRtl ? 'گزارش بیوگرافی اپراتور' : 'User bio log'}
              </div>
              <p className="text-[#ebdbb2] bg-[#1d2021] p-3 rounded-none border border-[#3c3836] leading-relaxed min-h-[52px] whitespace-pre-wrap">
                {bio || (isRtl ? 'اپراتور فعال بدون یادداشت ثبت‌شده.' : 'Active user with no custom profile log entry.')}
              </p>
            </div>

          </div>
        </div>

        {/* Modular Profile Configurations Form with Hard Edges */}
        <div className="border-2 border-[#3c3836] bg-gb-bg p-6 sm:p-8 rounded-none shadow-[4px_4px_0px_#3c3836]">
          <div className="mb-6 border-b border-[#3c3836] pb-4 flex justify-between items-center">
            <h3 className="font-mono font-bold text-sm text-gb-fg flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-gb-fg-dark shrink-0" /> CONFIGURE_PROFILE_STATE
            </h3>
            <span className="text-xs font-mono text-gb-fg-dark uppercase tracking-wider">
              {isRtl ? 'ورودی‌ها' : 'Form Inputs'}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-5 font-mono text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-gb-fg-dark font-bold">
                  {isRtl ? 'نام نمایشی' : 'Display Name'}
                </label>
                <Input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="System Operator"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-gb-fg-dark font-bold">
                  {isRtl ? 'نام کاربری' : 'Username'}
                </label>
                <div className="relative">
                  <span className={`absolute top-2.5 text-gb-fg-dark ${isRtl ? 'right-3' : 'left-3'}`}>@</span>
                  <Input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={isRtl ? 'pr-7' : 'pl-7'}
                    placeholder="operator"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-gb-fg-dark font-bold">
                  {isRtl ? 'آدرس ایمیل' : 'Email Address'}
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mail@server.net"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-gb-fg-dark font-bold">
                  {isRtl ? 'رمز عبور امنیتی' : 'Password'}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={isRtl ? 'pl-10' : 'pr-10'}
                    placeholder={isRtl ? 'برای تغییر رمز عبور بنویسید...' : 'Type to change password...'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute top-2.5 hover:text-gb-yellow-light text-gb-fg-dark focus:outline-none ${isRtl ? 'left-3' : 'right-3'}`}
                    title={showPassword ? 'Hide value' : 'Show value'}
                  >
                    {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-gb-fg-dark font-bold">
                {isRtl ? 'توضیحات بیوگرافی' : 'Bio Description'}
              </label>
              <Textarea
                value={bio}
                rows={3}
                onChange={(e) => setBio(e.target.value)}
                className="resize-none leading-relaxed"
                placeholder={isRtl ? 'بیوگرافی خودت رو اینجا بنویس...' : 'Declare your biography log...'}
              />
            </div>

            <div className="pt-4 border-t border-gb-bg-soft/40 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-xs text-gb-fg-dark leading-relaxed order-2 sm:order-1">
                * Checksum: <code className="text-gb-aqua-light font-bold bg-gb-bg-soft px-1 rounded-none">{liveHash}</code>
              </span>
              <Button
                type="submit"
                disabled={saving}
                variant="primary"
                className="order-1 sm:order-2 flex items-center gap-1.5 cursor-pointer"
              >
                <FloppyDiskIcon className="w-4 h-4" /> {saving ? (isRtl ? 'در حال ثبت...' : 'Committing...') : (isRtl ? 'ثبت تغییرات' : 'Commit Changes')}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Bookmarked / Saved Articles List */}
      <div className="mb-10 border-t border-gb-bg-soft pt-8">
        <h3 className="font-mono font-bold text-sm text-gb-fg mb-4 flex items-center gap-2">
          <FolderIcon className="w-4 h-4 text-gb-fg-dark shrink-0" /> SAVED_ARTICLES ({savedPosts.length})
        </h3>

        {savedPosts.length > 0 ? (
          <div className="space-y-3 font-mono">
            {savedPosts.map(post => {
              const trans = post.translations?.find(t => t.language === language) || post.translations?.[0];
              const title = trans?.title || 'Untitled';
              const summary = trans?.summary || '';
              return (
                <Card
                  key={post.id}
                  onClick={() => onSelectPost(post.id)}
                  className="cursor-pointer group flex justify-between items-center gap-2 !p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-base text-gb-fg group-hover:text-gb-orange-light transition-colors line-clamp-1">
                      {title}
                    </h4>
                    <p className="text-sm text-gb-fg-dark line-clamp-1 mt-1">{summary}</p>
                  </div>
                  <span className="text-sm text-gb-aqua-light shrink-0">
                    <span className="flex items-center gap-1">{isRtl ? 'مطالعه' : 'Read'} <ArrowRightIcon className="w-3.5 h-3.5" /></span>
                  </span>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-gb-bg-soft rounded-none text-center text-gb-fg-dark font-mono text-sm bg-gb-bg-soft/5">
            {isRtl 
              ? 'هیچ مقاله‌ای نشانه‌گذاری نشده است. برای ذخیره کردن، وبلاگ را مرور کنید.'
              : 'No bookmarked articles. Go explore the blog to save some.'}
          </div>
        )}
      </div>

      {/* Licensed LaTeX Templates List */}
      <div className="border-t border-gb-bg-soft pt-8">
        <h3 className="font-mono font-bold text-sm text-gb-fg mb-4 flex items-center gap-2">
          <PackageIcon className="w-4 h-4 text-gb-fg-dark shrink-0" /> LICENSED_TEMPLATES ({purchasedTemplates.length})
        </h3>

        {purchasedTemplates.length > 0 ? (
          <div className="space-y-3 font-mono">
            {purchasedTemplates.map(tpl => {
              const trans = tpl.translations?.find(t => t.language === language) || tpl.translations?.[0];
              const title = trans?.title || tpl.id;
              const description = trans?.description || '';
              return (
                <Card key={tpl.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 !p-4">
                  <div className="flex gap-3 items-center min-w-0">
                    <FileTextIcon className="w-8 h-8 text-gb-fg-dark shrink-0" />
                    <div className="min-w-0">
                      <h4 className="font-bold text-base text-gb-fg truncate">{title}</h4>
                      <p className="text-sm text-gb-fg-dark line-clamp-1 mt-0.5">{description}</p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/api/downloads/${tpl.id}`;
                    }}
                    variant="secondary"
                    size="sm"
                    className="shrink-0 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <DownloadIcon className="w-4 h-4" /> {isRtl ? 'دانلود سورس' : 'Download Source'}
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-gb-bg-soft rounded-none text-center text-gb-fg-dark font-mono text-sm bg-gb-bg-soft/5">
            <p className="mb-3">{isRtl ? 'هیچ محصول یا قالبی تهیه نکرده‌اید.' : 'No acquired templates.'}</p>
            <Button
              onClick={onNavigateToStore}
              variant="secondary"
              size="sm"
              className="cursor-pointer"
            >
              {isRtl ? 'مشاهده فروشگاه قالب‌ها' : 'Browse Template Store'}
            </Button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="mt-12 border-t border-gb-red/30 pt-8">
        <h3 className="font-mono font-bold text-sm text-gb-red-light mb-4 flex items-center gap-2">
          <WarningIcon className="w-4 h-4 text-gb-red-light shrink-0" /> DANGER_ZONE
        </h3>
        
        <Card className="border-2 border-gb-red/30 bg-gb-bg p-6 rounded-none shadow-[4px_4px_0px_#cc241d20] hover:border-gb-red-light/50 transition-all duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-mono font-bold text-sm text-gb-fg">
                {isRtl ? 'حذف حساب کاربری' : 'Delete Account'}
              </h4>
              <p className="text-xs text-gb-fg-dark mt-1 max-w-md">
                {isRtl
                  ? 'حساب کاربری شما طبق قانون حق فراموشی (GDPR) به طور کامل ناشناس خواهد شد. این عمل غیرقابل بازگشت است.'
                  : 'Your account will be permanently anonymized under the Right to be Forgotten (GDPR). This action is irreversible.'}
              </p>
            </div>
            
            <Button
              onClick={() => setShowDeleteModal(true)}
              variant="danger"
              size="sm"
              className="cursor-pointer shrink-0"
            >
              {isRtl ? 'حذف حساب' : 'Delete Account'}
            </Button>
          </div>
        </Card>
      </div>

      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
