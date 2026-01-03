/**
 * Work Order Status Badge
 * Displays work order status with appropriate color coding
 */

import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/30',
  },
  ready: {
    label: 'Ready',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
  },
  active: {
    label: 'Active',
    bgColor: 'bg-green-500/20',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/30',
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
  },
  closed: {
    label: 'Closed',
    bgColor: 'bg-gray-600/20',
    textColor: 'text-gray-500',
    borderColor: 'border-gray-600/30',
  },
};

export function WorkOrderStatusBadge({ status, size = 'default', className }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    default: 'px-3 py-1 text-sm',
    large: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-mono font-medium border rounded',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClasses[size],
        className
      )}
    >
      {config.label.toUpperCase()}
    </span>
  );
}

export default WorkOrderStatusBadge;
