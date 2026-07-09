import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { BugIcon } from './Icons';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { useSettings } from '../contexts/SettingsContext';

export function FeedbackButton() {
  const location = useLocation();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isAllowedPath, setIsAllowedPath] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { settings } = useSettings();

  // Check enable status and allowed paths using global settings
  useEffect(() => {
    if (settings) {
      const enabled = settings.feedback_enabled !== false; // Default true if key not set
      setIsEnabled(enabled);

      const allowed = settings.feedback_allowed_paths || '*';
      if (allowed === '*' || allowed.trim() === '') {
        setIsAllowedPath(true);
      } else {
        const paths = allowed.split(',').map((p: string) => p.trim());
        const matched = paths.some((p: string) => p && location.pathname.startsWith(p));
        setIsAllowedPath(matched);
      }
    } else {
      setIsEnabled(false);
    }
  }, [settings, location.pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: location.pathname,
          content: feedback,
        }),
      });

      if (res.ok) {
        setSubmitStatus('success');
        setFeedback('');
        setTimeout(() => {
          setIsOpen(false);
          setSubmitStatus('idle');
        }, 2000);
      } else {
        const errText = await res.text();
        throw new Error(errText || t('feedback_error'));
      }
    } catch (err: any) {
      setSubmitStatus('error');
      setErrorMessage(err.message || 'Error submitting feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isEnabled || !isAllowedPath) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 font-mono">
      {/* Floating Widget Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={t('feedback_button_tooltip') || 'Report a bug or give feedback'}
        className={`flex items-center justify-center w-12 h-12 rounded-full border-2 border-gb-fg-dark/30 shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer ${
          isOpen
            ? 'bg-gb-red-light text-gb-bg border-gb-red-light'
            : 'bg-gb-bg-soft text-gb-fg hover:bg-gb-orange-light hover:text-gb-bg hover:border-gb-orange-light'
        }`}
      >
        <BugIcon size={24} />
      </button>

      {/* Floating Feedback Window */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-gb-bg border-2 border-gb-bg-soft p-5 shadow-2xl rounded-none animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="flex items-center justify-between border-b border-gb-bg-soft pb-2 mb-4">
            <h3 className="text-sm font-bold text-gb-fg flex items-center gap-2">
              <BugIcon size={16} className="text-gb-orange-light" />
              {t('feedback_modal_title') || 'Report Bug / Feedback'}
            </h3>
            <span className="text-[9px] text-gb-fg-dark/50 px-1.5 py-0.5 border border-gb-bg-soft bg-gb-bg-soft/30 font-bold uppercase">
              {location.pathname}
            </span>
          </div>

          {submitStatus === 'success' ? (
            <div className="py-6 text-center text-gb-green-light text-sm font-bold animate-pulse">
              {t('feedback_success') || 'Thank you for your feedback!'}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={t('feedback_textarea_placeholder') || 'Describe the issue or suggestion...'}
                  rows={4}
                  required
                  disabled={isSubmitting}
                  className="resize-none"
                  autoFocus
                />
              </div>

              {submitStatus === 'error' && (
                <div className="text-xs text-gb-red-light border border-gb-red-light/30 bg-gb-red/5 p-2.5 rounded-none">
                  {errorMessage}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || !feedback.trim()}
                  variant="primary"
                  size="sm"
                  className="flex-1"
                >
                  {isSubmitting
                    ? t('feedback_submitting') || 'Sending...'
                    : t('feedback_submit') || 'Submit'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  variant="ghost"
                  size="sm"
                >
                  {t('feedback_cancel') || 'Cancel'}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
