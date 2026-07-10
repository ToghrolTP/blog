import React, { useState } from 'react';
import { XIcon, WarningIcon } from './Icons';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useLanguage } from '../contexts/LanguageContext';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountModal({ isOpen, onClose, onConfirm }: DeleteAccountModalProps) {
  const { language } = useLanguage();
  const [confirmText, setConfirmText] = useState('');
  const [checkedWarning, setCheckedWarning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isRtl = language === 'fa';

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'DELETE' || !checkedWarning) return;
    setIsDeleting(true);
    setError('');

    try {
      await onConfirm();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#000000]/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
      <div
        className="bg-gb-bg border-2 border-gb-red/30 rounded p-6 md:p-8 max-w-md w-full shadow-2xl relative font-mono animate-in zoom-in-95 duration-200"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} text-gb-fg-dark hover:text-gb-red-light transition-colors cursor-pointer p-1`}
          disabled={isDeleting}
        >
          <XIcon size={18} />
        </button>

        <h3 className="text-xl font-bold text-gb-red-light mb-6 text-center border-b border-gb-red/20 pb-4 flex items-center justify-center gap-2">
          <WarningIcon className="w-5 h-5 text-gb-red-light shrink-0" />
          {isRtl ? 'حذف حساب کاربری' : 'Delete Account'}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-gb-red-light/10 border border-gb-red-light text-gb-red-light text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleDelete} className="space-y-5">
          <p className="text-xs text-gb-fg-dark leading-relaxed">
            {isRtl
              ? 'با حذف حساب کاربری، تمام داده‌های شخصی شما طبق قوانین حریم خصوصی و حق فراموشی (GDPR) به طور دائم ناشناس خواهند شد. این اقدام برگشت‌ناپذیر است و دیگر نمی‌توانید به فایل‌های خریداری‌شده یا تنظیمات خود دسترسی داشته باشید.'
              : 'By deleting your account, all your personal data will be permanently anonymized in compliance with the Right to be Forgotten (GDPR). This action is irreversible, and you will lose access to your purchased templates and profile.'}
          </p>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkedWarning}
              onChange={(e) => setCheckedWarning(e.target.checked)}
              className="mt-1 cursor-pointer accent-gb-red-light"
              disabled={isDeleting}
            />
            <span className="text-xs text-gb-fg">
              {isRtl
                ? 'متوجه هستم و می‌خواهم حساب من برای همیشه حذف و ناشناس شود.'
                : 'I understand and want my account to be permanently deleted and anonymized.'}
            </span>
          </label>

          <div className="space-y-1.5">
            <label className="block text-xs text-gb-fg-dark font-bold">
              {isRtl
                ? 'برای تایید عبارت "DELETE" را تایپ کنید:'
                : 'Type "DELETE" to confirm:'}
            </label>
            <Input
              type="text"
              required
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="text-center font-bold tracking-widest"
              disabled={isDeleting}
            />
          </div>

          <div className="pt-2 flex gap-3">
            <Button
              type="submit"
              variant="danger"
              disabled={confirmText !== 'DELETE' || !checkedWarning || isDeleting}
              className="flex-1"
            >
              {isDeleting ? (isRtl ? 'در حال حذف...' : 'Deleting...') : (isRtl ? 'تایید حذف حساب' : 'Confirm Deletion')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
              disabled={isDeleting}
            >
              {isRtl ? 'انصراف' : 'Cancel'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
