import { CheckCircle2 } from 'lucide-react';

const processHelp = {
  'False Call Override (Operator)': [
    'Inspect the defect image and metadata on HMI',
    'Press "O" or click "False Call Override" button',
    'Select reason and add notes if needed',
    'Submit override → item routed to Manager for review',
  ],
  'Override Review (Manager)': [
    'Open Manager Override Queue',
    'Filter by line/section when needed',
    'Open an item to see AI decision, images, and operator notes',
    'Approve or reject with optional comment',
    'Decision is logged in Event Log and can influence retraining',
  ],
  'Sync to Cloud (Engineer/SuperAdmin)': [
    'Open Sync to Cloud panel',
    'Review summary and items in sync queue',
    'Click "Sync Now" to push data',
    'Monitor sync progress in modal; pause/cancel if needed',
    'Check results in Event Log & System Health bar if issues occur',
  ],
  'User & Role Management (SuperAdmin)': [
    'Open Super Admin Panel → Users',
    'Create or edit users with correct role & sections',
    'Ensure company email & WhatsApp are correct',
    'Use role → menu mapping to control access',
    'Reset passwords or disable accounts if needed',
  ],
};

export default function HelpSectionCard() {
  return (
    <div className="space-y-6">
      {Object.entries(processHelp).map(([title, steps]) => (
        <div
          key={title}
          className="bg-indusia-surfaceMuted rounded-lg border border-indusia-border overflow-hidden"
        >
          <div className="px-6 py-4 bg-indusia-surface border-b border-indusia-border">
            <h3 className="text-sm font-semibold text-indusia-text">{title}</h3>
          </div>
          <div className="px-6 py-4">
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indusia-primary/20 text-indusia-primary flex items-center justify-center text-xs font-semibold mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-sm text-indusia-textMuted flex-1 pt-0.5">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ))}

      <div className="bg-indusia-primary/10 border border-indusia-primary/30 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-indusia-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-indusia-text mb-1">
            Quick Reference Only
          </p>
          <p className="text-xs text-indusia-textMuted">
            This is a quick reference for key workflows. For detailed training and
            troubleshooting, refer to your company's full documentation or contact
            support.
          </p>
        </div>
      </div>
    </div>
  );
}
