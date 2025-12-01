import { Activity, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import StatsGrid from '@/components/common/StatsGrid';

export default function EventLogSummaryCards({ events }) {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const eventsLast24h = events.filter((e) => new Date(e.timestamp) >= last24h);
  const eventsToday = events.filter((e) => new Date(e.timestamp) >= todayStart);

  const securityEvents = eventsLast24h.filter((e) =>
    ['LOGIN', 'LOGOUT'].includes(e.type)
  ).length;

  const overrideEvents = eventsLast24h.filter((e) =>
    ['OVERRIDE_SUBMIT', 'OVERRIDE_APPROVE', 'OVERRIDE_REJECT'].includes(e.type)
  ).length;

  const syncEvents = eventsLast24h.filter((e) =>
    ['SYNC_START', 'SYNC_SUCCESS', 'SYNC_FAIL'].includes(e.type)
  ).length;

  const stats = [
    {
      icon: Activity,
      label: 'Total Events',
      value: eventsToday.length,
      caption: 'Today',
      color: 'text-indusia-primary',
    },
    {
      icon: Shield,
      label: 'Security Events',
      value: securityEvents,
      caption: 'Last 24h',
      color: 'text-indusia-primary',
    },
    {
      icon: AlertTriangle,
      label: 'Override Actions',
      value: overrideEvents,
      caption: 'Last 24h',
      color: 'text-indusia-warning',
    },
    {
      icon: RefreshCw,
      label: 'Sync Events',
      value: syncEvents,
      caption: 'Last 24h',
      color: 'text-indusia-pass',
    },
  ];

  return <StatsGrid stats={stats} />;
}
