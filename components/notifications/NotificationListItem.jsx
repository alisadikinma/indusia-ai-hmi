import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: 'text-indusia-fail',
    bg: 'bg-indusia-fail/10',
    border: 'border-indusia-fail',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-indusia-warning',
    bg: 'bg-indusia-warning/10',
    border: 'border-indusia-warning',
  },
  info: {
    icon: Info,
    color: 'text-indusia-primary',
    bg: 'bg-indusia-primary/10',
    border: 'border-indusia-primary',
  },
};

export default function NotificationListItem({ notification, onClick }) {
  const config = severityConfig[notification.severity] || severityConfig.info;
  const Icon = config.icon;

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <button
      onClick={() => onClick(notification)}
      className={`w-full text-left p-4 border-l-4 transition-all hover:bg-indusia-bg ${
        config.border
      } ${notification.read ? 'bg-indusia-surface' : 'bg-indusia-surfaceMuted'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 p-2 rounded-lg ${config.bg}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4
              className={`text-sm ${
                notification.read ? 'text-indusia-text' : 'text-indusia-text font-semibold'
              }`}
            >
              {notification.title}
            </h4>
            {!notification.read && (
              <span className="flex-shrink-0 w-2 h-2 bg-indusia-primary rounded-full mt-1.5" />
            )}
          </div>

          <p className="text-xs text-indusia-textMuted mb-2 line-clamp-2">
            {notification.message}
          </p>

          <div className="flex items-center gap-3 text-xs text-indusia-textMuted">
            <span>{timeAgo}</span>
            {notification.section && (
              <>
                <span>•</span>
                <span>{notification.section}</span>
              </>
            )}
            {notification.line && (
              <>
                <span>•</span>
                <span>{notification.line}</span>
              </>
            )}
            <span>•</span>
            <span className="uppercase text-[10px] font-medium">
              {notification.type}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
