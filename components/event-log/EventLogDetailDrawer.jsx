import { X, User, Shield, MapPin, Activity, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import Drawer from '@/components/Drawer';
import StatusBadge from '@/components/common/StatusBadge';

const EVENT_COLORS = {
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
  OVERRIDE_SUBMIT: 'info',
  OVERRIDE_APPROVE: 'pass',
  OVERRIDE_REJECT: 'fail',
  MASTERDATA_CREATE: 'info',
  MASTERDATA_UPDATE: 'warning',
  MASTERDATA_DELETE: 'fail',
  SYNC_START: 'info',
  SYNC_SUCCESS: 'pass',
  SYNC_FAIL: 'fail',
};

export default function EventLogDetailDrawer({ isOpen, onClose, event }) {
  if (!event) return null;

  const renderDetails = () => {
    const details = event.details;

    switch (event.type) {
      case 'LOGIN':
        return (
          <>
            <DetailRow label="Result" value={details.result} />
            <DetailRow label="IP Address" value={details.ipAddress} />
          </>
        );

      case 'LOGOUT':
        return (
          <>
            <DetailRow label="Session Duration" value={details.sessionDuration} />
            <DetailRow label="Reason" value={details.reason} />
          </>
        );

      case 'OVERRIDE_SUBMIT':
        return (
          <>
            <DetailRow label="Board ID" value={details.boardId} mono />
            <DetailRow label="Defect Type" value={details.defectType} />
            <DetailRow label="Location" value={details.location} />
            <DetailRow label="Confidence" value={`${details.confidence}%`} />
            <DetailRow label="Original Decision" value={details.originalDecision} />
            <DetailRow label="Reason" value={details.reason} fullWidth />
          </>
        );

      case 'OVERRIDE_APPROVE':
      case 'OVERRIDE_REJECT':
        return (
          <>
            <DetailRow label="Override ID" value={details.overrideId} mono />
            <DetailRow label="Board ID" value={details.boardId} mono />
            <DetailRow label="Original Operator" value={details.originalOperator} />
            <DetailRow label="Decision" value={details.decision} />
            <DetailRow label="Notes" value={details.notes} fullWidth />
          </>
        );

      case 'MASTERDATA_CREATE':
        return (
          <>
            <DetailRow label="Entity Type" value={details.entityType} />
            <DetailRow label="Entity ID" value={details.entityId} mono />
            {details.data && (
              <div className="col-span-2 mt-2">
                <span className="text-xs text-indusia-textMuted block mb-1">
                  Created Data:
                </span>
                <pre className="text-xs bg-indusia-bg p-3 rounded border border-indusia-border overflow-x-auto text-indusia-text">
                  {JSON.stringify(details.data, null, 2)}
                </pre>
              </div>
            )}
          </>
        );

      case 'MASTERDATA_UPDATE':
        return (
          <>
            <DetailRow label="Entity Type" value={details.entityType} />
            <DetailRow label="Entity ID" value={details.entityId} mono />
            {details.changes && (
              <>
                <div className="col-span-2 mt-2">
                  <span className="text-xs text-indusia-textMuted block mb-1">
                    Before:
                  </span>
                  <pre className="text-xs bg-indusia-bg p-3 rounded border border-indusia-border overflow-x-auto text-indusia-text">
                    {JSON.stringify(details.changes.before, null, 2)}
                  </pre>
                </div>
                <div className="col-span-2 mt-2">
                  <span className="text-xs text-indusia-textMuted block mb-1">
                    After:
                  </span>
                  <pre className="text-xs bg-indusia-bg p-3 rounded border border-indusia-border overflow-x-auto text-indusia-text">
                    {JSON.stringify(details.changes.after, null, 2)}
                  </pre>
                </div>
              </>
            )}
            {details.reason && <DetailRow label="Reason" value={details.reason} fullWidth />}
          </>
        );

      case 'MASTERDATA_DELETE':
        return (
          <>
            <DetailRow label="Entity Type" value={details.entityType} />
            <DetailRow label="Entity ID" value={details.entityId} mono />
            {details.data && (
              <div className="col-span-2 mt-2">
                <span className="text-xs text-indusia-textMuted block mb-1">
                  Deleted Data:
                </span>
                <pre className="text-xs bg-indusia-bg p-3 rounded border border-indusia-border overflow-x-auto text-indusia-text">
                  {JSON.stringify(details.data, null, 2)}
                </pre>
              </div>
            )}
          </>
        );

      case 'SYNC_START':
        return (
          <>
            <DetailRow label="Sync Job ID" value={details.syncJobId} mono />
            <DetailRow label="Scope" value={details.scope} />
            {details.lineId && <DetailRow label="Line ID" value={details.lineId} mono />}
            {details.customerId && <DetailRow label="Customer ID" value={details.customerId} mono />}
            <DetailRow label="Record Count" value={details.recordCount} />
          </>
        );

      case 'SYNC_SUCCESS':
        return (
          <>
            <DetailRow label="Sync Job ID" value={details.syncJobId} mono />
            <DetailRow label="Scope" value={details.scope} />
            {details.lineId && <DetailRow label="Line ID" value={details.lineId} mono />}
            {details.customerId && <DetailRow label="Customer ID" value={details.customerId} mono />}
            <DetailRow label="Records Synced" value={details.recordsSynced} />
            <DetailRow label="Duration" value={details.duration} />
          </>
        );

      case 'SYNC_FAIL':
        return (
          <>
            <DetailRow label="Sync Job ID" value={details.syncJobId} mono />
            <DetailRow label="Scope" value={details.scope} />
            {details.customerId && <DetailRow label="Customer ID" value={details.customerId} mono />}
            <DetailRow label="Retry Count" value={details.retryCount} />
            <div className="col-span-2 mt-2 p-3 bg-indusia-fail/10 rounded border border-indusia-fail">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-indusia-fail mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium text-indusia-text block mb-1">
                    Error:
                  </span>
                  <span className="text-xs text-indusia-textMuted">{details.error}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-indusia-fail/20">
                <p className="text-xs font-medium text-indusia-text mb-1">
                  Troubleshooting:
                </p>
                <ul className="text-xs text-indusia-textMuted space-y-1 list-disc list-inside">
                  <li>Check network connectivity</li>
                  <li>Verify cloud service status</li>
                  <li>Retry sync from Sync to Cloud panel</li>
                </ul>
              </div>
            </div>
          </>
        );

      default:
        return (
          <div className="col-span-2">
            <pre className="text-xs bg-indusia-bg p-3 rounded border border-indusia-border overflow-x-auto text-indusia-text">
              {JSON.stringify(details, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Event Details">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <StatusBadge
            status={event.type.replace(/_/g, ' ')}
            variant={EVENT_COLORS[event.type]}
          />
          <span className="text-sm text-indusia-textMuted">
            {format(new Date(event.timestamp), 'MMM dd, yyyy HH:mm:ss')}
          </span>
        </div>

        <div className="bg-indusia-surfaceMuted rounded-lg p-4 border border-indusia-border">
          <h3 className="text-sm font-semibold text-indusia-text mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            User & Role
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DetailRow label="User Name" value={event.userName} />
            <DetailRow label="User ID" value={event.userId} mono />
            <DetailRow label="Role" value={event.role} />
            {event.section && <DetailRow label="Section" value={event.section} />}
          </div>
        </div>

        <div className="bg-indusia-surfaceMuted rounded-lg p-4 border border-indusia-border">
          <h3 className="text-sm font-semibold text-indusia-text mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Event Context
          </h3>
          <div className="space-y-3 text-sm">
            <DetailRow label="Source" value={event.source} />
            <DetailRow label="Event ID" value={event.id} mono />
          </div>
        </div>

        <div className="bg-indusia-surfaceMuted rounded-lg p-4 border border-indusia-border">
          <h3 className="text-sm font-semibold text-indusia-text mb-3">
            Details
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">{renderDetails()}</div>
        </div>
      </div>
    </Drawer>
  );
}

function DetailRow({ label, value, mono = false, fullWidth = false }) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <span className="text-xs text-indusia-textMuted block mb-1">{label}:</span>
      <span className={`text-sm text-indusia-text ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}
