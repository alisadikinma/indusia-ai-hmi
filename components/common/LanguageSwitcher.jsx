import { Globe } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-indusia-surfaceMuted rounded-lg">
      <Globe className="w-4 h-4 text-indusia-textMuted" />
      <button
        onClick={() => setLang('en')}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          lang === 'en'
            ? 'bg-indusia-primary text-white'
            : 'text-indusia-textMuted hover:text-indusia-text'
        }`}
      >
        EN
      </button>
      <span className="text-indusia-textMuted">|</span>
      <button
        onClick={() => setLang('id')}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          lang === 'id'
            ? 'bg-indusia-primary text-white'
            : 'text-indusia-textMuted hover:text-indusia-text'
        }`}
      >
        ID
      </button>
    </div>
  );
}
