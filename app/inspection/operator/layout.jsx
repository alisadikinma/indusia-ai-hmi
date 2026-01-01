/**
 * Operator Inspection Layout
 * Minimal layout - no sidebar, no header (handled by HMIOperatorView)
 * Designed for fullscreen operator mode
 */

export const metadata = {
  title: 'Inspection - INDUSIA AI HMI',
  description: 'PCB Visual Inspection Interface',
};

export default function OperatorInspectionLayout({ children }) {
  return (
    <div className="min-h-screen bg-indusia-bg">
      {children}
    </div>
  );
}
