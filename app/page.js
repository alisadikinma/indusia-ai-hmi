import Card from '@/components/common/Card';
import SectionHeader from '@/components/common/SectionHeader';

export default function Home() {
  return (
    <div>
      <SectionHeader
        title="Welcome to INDUSIA AI"
        description="Industrial AI Visual Inspection Human-Machine Interface"
      />

      <Card
        title="INDUSIA AI – Visual Inspection HMI"
        subtitle="Getting Started"
      >
        <p className="text-indusia-textMuted leading-relaxed">
          Use the navigation on the left to access inspection and override screens.
        </p>

        <div className="mt-6 space-y-4">
          <div className="bg-indusia-surfaceMuted rounded-lg px-4 py-3 border border-indusia-border">
            <h4 className="text-sm font-semibold text-indusia-text mb-1">
              Inspection Result
            </h4>
            <p className="text-xs text-indusia-textMuted">
              View detailed inspection results with live detection images and defect analysis
            </p>
          </div>

          <div className="bg-indusia-surfaceMuted rounded-lg px-4 py-3 border border-indusia-border">
            <h4 className="text-sm font-semibold text-indusia-text mb-1">
              Override Queue
            </h4>
            <p className="text-xs text-indusia-textMuted">
              Manage pending override approvals from operators and team leaders
            </p>
          </div>

          <div className="bg-indusia-surfaceMuted rounded-lg px-4 py-3 border border-indusia-border">
            <h4 className="text-sm font-semibold text-indusia-text mb-1">
              Sync to Cloud
            </h4>
            <p className="text-xs text-indusia-textMuted">
              Synchronize approved overrides to the cloud training system
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
