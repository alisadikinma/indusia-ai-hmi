/**
 * Work Order Stats Cards
 * Summary statistics for work orders
 */

'use client';

import { FileText, Clock, Play, Pause, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkOrderStats({ workOrders = [] }) {
  // Calculate stats
  const stats = {
    total: workOrders.length,
    draft: workOrders.filter(wo => wo.status === 'draft').length,
    active: workOrders.filter(wo => wo.status === 'active').length,
    onHold: workOrders.filter(wo => wo.status === 'on_hold').length,
    completed: workOrders.filter(wo => wo.status === 'completed').length,
  };

  const cards = [
    {
      label: 'Total',
      value: stats.total,
      icon: FileText,
      color: 'text-indusia-primary',
      bgColor: 'bg-indusia-primary/20',
    },
    {
      label: 'Draft',
      value: stats.draft,
      icon: Clock,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
    },
    {
      label: 'Active',
      value: stats.active,
      icon: Play,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
    },
    {
      label: 'On Hold',
      value: stats.onHold,
      icon: Pause,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
    },
    {
      label: 'Completed',
      value: stats.completed,
      icon: CheckCircle,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "bg-indusia-surface border border-indusia-border rounded-lg p-4",
            "flex items-center gap-4"
          )}
        >
          <div className={cn("p-3 rounded-lg", card.bgColor)}>
            <card.icon className={cn("w-6 h-6", card.color)} />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-indusia-text">
              {card.value}
            </p>
            <p className="text-sm text-indusia-textMuted">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WorkOrderStats;
