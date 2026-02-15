import { Activity, Camera, Cloud, Circle, CheckCircle, AlertTriangle, XCircle, WifiOff, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useI18n } from '@/context/I18nContext';

const stateConfig = {
  ok: {
    bg: 'bg-indusia-pass/10',
    border: 'border-indusia-pass',
    text: 'text-indusia-pass',
    icon: CheckCircle,
    labelKey: 'status.online',
  },
  warning: {
    bg: 'bg-indusia-warning/10',
    border: 'border-indusia-warning',
    text: 'text-indusia-warning',
    icon: AlertTriangle,
    labelKey: 'status.warning',
  },
  error: {
    bg: 'bg-indusia-fail/10',
    border: 'border-indusia-fail',
    text: 'text-indusia-fail',
    icon: XCircle,
    labelKey: 'status.error',
  },
  offline: {
    bg: 'bg-indusia-textMuted/10',
    border: 'border-indusia-textMuted',
    text: 'text-indusia-textMuted',
    icon: WifiOff,
    labelKey: 'status.offline',
  },
  degraded: {
    bg: 'bg-indusia-warning/10',
    border: 'border-indusia-warning',
    text: 'text-indusia-warning',
    icon: AlertTriangle,
    labelKey: 'status.degraded',
  },
  unknown: {
    bg: 'bg-indusia-textMuted/10',
    border: 'border-indusia-textMuted',
    text: 'text-indusia-textMuted',
    icon: Circle,
    labelKey: 'status.unknown',
  },
  'in-progress': {
    bg: 'bg-indusia-primary/10',
    border: 'border-indusia-primary',
    text: 'text-indusia-primary',
    icon: Loader2,
    labelKey: 'status.inProgress',
  },
};

export default function SystemStatusChip({ label, state, message, lastUpdated, onClick }) {
  const { t } = useI18n();
  const config = stateConfig[state] || stateConfig.unknown;
  const StateIcon = config.icon;
  const stateLabel = t(config.labelKey);

  const timeAgo = lastUpdated ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true }) : t('status.unknown');

  return (
    <button
      onClick={onClick}
      className={`
        group relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
        ${config.bg} ${config.border} hover:shadow-md
        min-h-[40px] cursor-pointer
      `}
      title={`${label}: ${stateLabel}\n${message}\nUpdated ${timeAgo}`}
    >
      <StateIcon
        className={`w-4 h-4 flex-shrink-0 ${config.text} ${
          state === 'in-progress' ? 'animate-spin' : ''
        }`}
      />
      <div className="flex flex-col items-start text-left">
        <span className="text-xs font-medium text-indusia-text whitespace-nowrap">
          {label}
        </span>
        <span className={`text-xs ${config.text} whitespace-nowrap`}>
          {stateLabel}
        </span>
      </div>

      <div className="absolute top-full left-0 mt-2 p-3 bg-indusia-surface border border-indusia-border rounded-lg shadow-xl z-50 min-w-[240px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none">
        <p className="text-xs font-medium text-indusia-text mb-1">{label}</p>
        <p className="text-xs text-indusia-textMuted mb-2">{message}</p>
        <p className="text-xs text-indusia-textMuted">Updated {timeAgo}</p>
      </div>
    </button>
  );
}
