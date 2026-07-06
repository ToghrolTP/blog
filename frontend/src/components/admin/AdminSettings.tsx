import React from 'react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

interface AdminSettingsProps {
  secret: string;
  settings: {
    site_maintenance?: boolean;
    blog_maintenance?: boolean;
    comments_maintenance?: boolean;
    store_maintenance?: boolean;
    feedback_enabled?: boolean;
    feedback_allowed_paths?: string;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  savingSettings: boolean;
  setSavingSettings: (s: boolean) => void;
  setSuccessMessage: (m: string | null) => void;
  setError: (e: string | null) => void;
}

export function AdminSettings({
  secret,
  settings,
  setSettings,
  savingSettings,
  setSavingSettings,
  setSuccessMessage,
  setError
}: AdminSettingsProps) {

  const handleToggleSetting = async (
    key: 'site_maintenance' | 'blog_maintenance' | 'comments_maintenance' | 'store_maintenance' | 'feedback_enabled',
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
        setSettings((prev: any) => ({ ...prev, [key]: checked }));
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

  return (
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
          {
            key: 'feedback_enabled' as const,
            label: 'Feedback Feature Status',
            desc: 'Toggle the floating feedback button on/off across allowed paths.',
            activeLabel: 'Enabled',
            inactiveLabel: 'Disabled',
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

        {/* Feedback Allowed Paths Input */}
        <div className="border-t border-gb-bg-soft/30 pt-6">
          <div className="flex flex-col gap-2">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-gb-fg">Feedback Allowed Paths</h4>
              <p className="text-xs text-gb-fg-dark">
                Comma-separated paths or prefixes where the feedback button is active. Use '*' or leave empty for everywhere.
              </p>
            </div>
            
            <div className="flex items-center gap-3 mt-2">
              <Input
                type="text"
                value={settings.feedback_allowed_paths || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings((prev: any) => ({ ...prev, feedback_allowed_paths: val }));
                }}
                onBlur={async (e) => {
                  setSavingSettings(true);
                  try {
                    const res = await fetch('/api/settings', {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${secret}`
                      },
                      body: JSON.stringify({
                        key: 'feedback_allowed_paths',
                        value: e.target.value
                      })
                    });
                    if (res.ok) {
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
                }}
                disabled={savingSettings}
                placeholder="e.g. *, /store, /post"
                className="max-w-md font-mono"
              />
              {savingSettings && (
                <span className="text-xs text-gb-fg-dark/50 font-mono animate-pulse">Saving...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
