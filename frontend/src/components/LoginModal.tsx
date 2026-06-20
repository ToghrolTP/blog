import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { XIcon, GithubLogoIcon } from './Icons';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { loginWithGithub, loginWithPassword } = useAuth();
  const { language, t } = useLanguage();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setEmailExists(null);
      setIsCheckingEmail(false);
      setErrorMessage('');
    }
  }, [isOpen]);

  // Handle email debounced check
  useEffect(() => {
    if (emailTimeoutRef.current) {
      clearTimeout(emailTimeoutRef.current);
    }

    const emailTrim = email.trim();
    if (!emailTrim || !emailTrim.includes('@')) {
      setEmailExists(null);
      setIsCheckingEmail(false);
      return;
    }

    setIsCheckingEmail(true);
    setErrorMessage('');

    emailTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(emailTrim)}`);
        if (res.ok) {
          const data = await res.json();
          setEmailExists(data.exists);
        }
      } catch (err) {
        console.error('Failed to check email:', err);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 400); // 400ms debounce

    return () => {
      if (emailTimeoutRef.current) clearTimeout(emailTimeoutRef.current);
    };
  }, [email]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const success = await loginWithPassword(email.trim(), password);
      if (success) {
        onClose();
      } else {
        setErrorMessage(
          emailExists 
            ? t('login_error_invalid') || 'Invalid password' 
            : t('login_error_failed') || 'Authentication failed'
        );
      }
    } catch (err) {
      setErrorMessage(t('login_error_failed') || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRtl = language === 'fa';

  return (
    <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
      {/* Modal Container */}
      <div 
        className="bg-gb-bg border-2 border-gb-bg-soft rounded p-6 md:p-8 max-w-md w-full shadow-2xl relative font-mono animate-in zoom-in-95 duration-200"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} text-gb-fg-dark hover:text-gb-red-light transition-colors cursor-pointer p-1`}
          aria-label="Close modal"
        >
          <XIcon size={18} />
        </button>

        {/* Title */}
        <h3 className="text-xl md:text-2xl font-bold text-gb-fg mb-6 text-center border-b border-gb-bg-soft pb-4">
          {t('login_modal_title') || 'Welcome to Log40'}
        </h3>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email field */}
          <div className="space-y-2">
            <label htmlFor="auth-email" className="text-xs text-gb-fg-dark/80 font-bold block">
              {t('email_label') || 'Email Address'}
            </label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoFocus
              autoComplete="email"
              className="w-full font-mono text-sm"
              disabled={isSubmitting}
            />
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label htmlFor="auth-password" className="text-xs text-gb-fg-dark/80 font-bold block">
              {t('password_label') || 'Password'}
            </label>
            <div className="relative flex items-center">
              <Input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={`w-full font-mono text-sm ${isRtl ? 'pl-16' : 'pr-16'}`}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${isRtl ? 'left-3' : 'right-3'} text-[10px] text-gb-fg-dark/80 hover:text-gb-fg transition-colors select-none font-bold uppercase cursor-pointer`}
              >
                {showPassword ? t('password_hide') || 'Hide' : t('password_show') || 'Show'}
              </button>
            </div>
          </div>

          {/* Dynamic Helper Notice */}
          <div className="min-h-10 flex items-center justify-center text-center">
            {isCheckingEmail && (
              <p className="text-xs text-gb-orange-light animate-pulse">
                {t('email_checking') || 'Checking email...'}
              </p>
            )}
            {!isCheckingEmail && emailExists === true && (
              <p className="text-xs text-gb-aqua-light animate-in fade-in duration-200">
                {t('email_exists_notice') || 'Welcome back! Enter your password to log in.'}
              </p>
            )}
            {!isCheckingEmail && emailExists === false && (
              <p className="text-xs text-gb-orange-light animate-in fade-in duration-200">
                {t('email_new_notice') || 'No account found with this email. We will create a new one for you.'}
              </p>
            )}
            {errorMessage && (
              <p className="text-xs text-gb-red-light font-bold animate-in shake duration-200">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className="w-full py-3 bg-gb-orange-light text-gb-bg font-bold border-2 border-transparent hover:border-gb-orange-light/20 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
          >
            {isSubmitting
              ? t('feedback_submitting') || 'Sending...'
              : emailExists === false
              ? t('signup_submit') || 'Sign Up'
              : t('login_submit') || 'Log In'}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gb-bg-soft" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gb-bg px-2 text-gb-fg-dark/50">OR</span>
          </div>
        </div>

        {/* GitHub Auth Button */}
        <Button
          type="button"
          onClick={loginWithGithub}
          variant="secondary"
          className="w-full py-3 gap-2 flex items-center justify-center font-bold font-mono text-sm border-2 border-gb-bg-soft hover:border-gb-orange-light/40"
        >
          <GithubLogoIcon size={18} />
          <span>{t('continue_with_github') || 'Continue with GitHub'}</span>
        </Button>
      </div>
    </div>
  );
}
