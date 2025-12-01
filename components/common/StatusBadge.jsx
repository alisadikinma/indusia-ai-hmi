export default function StatusBadge({ status = 'info', label }) {
  const getStyles = () => {
    switch (status) {
      case 'pass':
        return {
          bg: 'bg-indusia-pass/10',
          text: 'text-indusia-pass',
          dot: 'bg-indusia-pass',
        };
      case 'fail':
        return {
          bg: 'bg-indusia-fail/10',
          text: 'text-indusia-fail',
          dot: 'bg-indusia-fail',
        };
      case 'warning':
        return {
          bg: 'bg-indusia-warning/10',
          text: 'text-indusia-warning',
          dot: 'bg-indusia-warning',
        };
      case 'pending':
        return {
          bg: 'bg-amber-500/10',
          text: 'text-amber-500',
          dot: 'bg-amber-500',
        };
      case 'approved':
        return {
          bg: 'bg-green-500/10',
          text: 'text-green-500',
          dot: 'bg-green-500',
        };
      case 'rejected':
        return {
          bg: 'bg-red-500/10',
          text: 'text-red-500',
          dot: 'bg-red-500',
        };
      case 'info':
      default:
        return {
          bg: 'bg-indusia-primary/10',
          text: 'text-indusia-primary',
          dot: 'bg-indusia-primary',
        };
    }
  };

  const styles = getStyles();

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${styles.bg} ${styles.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
      {label}
    </span>
  );
}
