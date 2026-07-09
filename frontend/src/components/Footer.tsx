import { TerminalWindowIcon } from './Icons';
import { Button } from './ui/Button';
import { useNavigate } from 'react-router-dom';

export function Footer() {
  const navigate = useNavigate();
  return (
    <footer className="border-t border-gb-bg-soft py-8 mt-16 flex flex-col items-center opacity-80">
      <div className="flex items-center gap-2 text-gb-fg-dark font-mono text-sm mb-4">
        <TerminalWindowIcon className="text-lg" />
        <span>System running beautifully.</span>
      </div>
      <p className="text-xs text-gb-fg-dark/60 font-mono text-center">
        Built with React + Tailwind.<br/>
        Color scheme: Gruvbox.
      </p>
      <Button 
        variant="ghost"
        size="sm"
        onClick={() => navigate('/admin')}
        className="mt-4 text-gb-fg-dark/50 hover:text-gb-fg hover:bg-transparent"
      >
        $ su root
      </Button>
    </footer>
  );
}
