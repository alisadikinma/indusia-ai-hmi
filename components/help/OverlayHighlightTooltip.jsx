export default function OverlayHighlightTooltip({ title, description, position, anchor }) {
  const getPositionStyles = () => {
    const baseStyles = 'absolute bg-indusia-surface border-2 border-indusia-primary rounded-lg shadow-2xl p-4 max-w-xs z-[80]';

    switch (position) {
      case 'top':
        return `${baseStyles} bottom-full left-1/2 -translate-x-1/2 mb-4`;
      case 'bottom':
        return `${baseStyles} top-full left-1/2 -translate-x-1/2 mt-4`;
      case 'left':
        return `${baseStyles} right-full top-1/2 -translate-y-1/2 mr-4`;
      case 'right':
        return `${baseStyles} left-full top-1/2 -translate-y-1/2 ml-4`;
      default:
        return `${baseStyles} top-full left-1/2 -translate-x-1/2 mt-4`;
    }
  };

  const getArrowStyles = () => {
    const baseArrow = 'absolute w-0 h-0 border-8';

    switch (position) {
      case 'top':
        return `${baseArrow} border-transparent border-t-indusia-primary top-full left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseArrow} border-transparent border-b-indusia-primary bottom-full left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseArrow} border-transparent border-l-indusia-primary left-full top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseArrow} border-transparent border-r-indusia-primary right-full top-1/2 -translate-y-1/2`;
      default:
        return `${baseArrow} border-transparent border-b-indusia-primary bottom-full left-1/2 -translate-x-1/2`;
    }
  };

  return (
    <div className={getPositionStyles()}>
      <div className={getArrowStyles()} />
      <h4 className="text-sm font-semibold text-indusia-text mb-2">{title}</h4>
      <p className="text-xs text-indusia-textMuted leading-relaxed">{description}</p>
    </div>
  );
}
