'use client';

/**
 * Board Overview - Multi-Defect Crop Grid
 * Shows cropped thumbnails for each defect location
 * Click to navigate to specific defect
 */

import { useState, useRef, useEffect } from 'react';
import { Crosshair, ZoomIn, Maximize2, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Severity colors
const SEVERITY_COLORS = {
  critical: { 
    bg: 'bg-phosphor-red/20', 
    border: 'border-phosphor-red', 
    text: 'text-phosphor-red',
    ring: 'ring-phosphor-red'
  },
  major: { 
    bg: 'bg-phosphor-amber/20', 
    border: 'border-phosphor-amber', 
    text: 'text-phosphor-amber',
    ring: 'ring-phosphor-amber'
  },
  minor: { 
    bg: 'bg-yellow-400/20', 
    border: 'border-yellow-400', 
    text: 'text-yellow-400',
    ring: 'ring-yellow-400'
  },
};

/**
 * Single defect crop thumbnail
 */
function DefectCropThumbnail({ 
  defect, 
  imageSrc, 
  imageWidth,
  imageHeight,
  isActive, 
  index,
  onClick 
}) {
  const canvasRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const severity = defect?.severity || 'major';
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.major;

  // Draw cropped image on canvas
  useEffect(() => {
    if (!imageSrc || !defect?.bbox || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const { x, y, width, height } = defect.bbox;
      
      // Add padding around defect (20% on each side)
      const padding = Math.max(width, height) * 0.3;
      const cropX = Math.max(0, x - padding);
      const cropY = Math.max(0, y - padding);
      const cropW = Math.min(width + padding * 2, imageWidth - cropX);
      const cropH = Math.min(height + padding * 2, imageHeight - cropY);
      
      // Set canvas size (maintain aspect ratio, max 150px)
      const maxSize = 150;
      const scale = Math.min(maxSize / cropW, maxSize / cropH);
      canvas.width = cropW * scale;
      canvas.height = cropH * scale;
      
      // Draw cropped region
      ctx.drawImage(
        img,
        cropX, cropY, cropW, cropH,  // Source
        0, 0, canvas.width, canvas.height  // Destination
      );
      
      setImageLoaded(true);
    };
    
    img.onerror = () => {
      console.error('[BoardOverview] Failed to load image:', imageSrc);
    };
    
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
  }, [imageSrc, defect, imageWidth, imageHeight]);

  return (
    <button
      onClick={() => onClick(index)}
      className={cn(
        "relative flex flex-col items-center p-1 border-2 transition-all",
        "hover:scale-105 hover:shadow-lg",
        isActive 
          ? `${colors.border} ${colors.bg} ring-2 ${colors.ring} ring-offset-1 ring-offset-void` 
          : "border-surface-border bg-terminal hover:border-phosphor-amber/50"
      )}
    >
      {/* Crop Canvas */}
      <div className="relative w-[80px] h-[60px] bg-void flex items-center justify-center overflow-hidden">
        {imageSrc && defect?.bbox ? (
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <Crosshair className="w-6 h-6 text-text-tertiary/30" />
        )}
        
        {/* Index badge */}
        <div className={cn(
          "absolute top-0 left-0 w-5 h-5 flex items-center justify-center font-mono text-xs font-bold",
          isActive ? `${colors.bg} ${colors.text}` : "bg-panel text-text-secondary"
        )}>
          {index + 1}
        </div>
      </div>
      
      {/* Component ref */}
      <div className="w-full text-center mt-1">
        <span className={cn(
          "font-mono text-xxs font-bold truncate block",
          isActive ? colors.text : "text-text-secondary"
        )}>
          {defect?.component_ref || '---'}
        </span>
        
        {/* Severity badge */}
        <span className={cn(
          "font-mono text-xxs uppercase",
          colors.text
        )}>
          {severity.slice(0, 4)}
        </span>
      </div>
    </button>
  );
}

export function BoardOverview({
  imageSrc,
  defects = [],
  currentDefectIndex = 0,
  imageWidth = 2400,
  imageHeight = 1792,
  onDefectSelect,
  className,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle defect click
  const handleDefectClick = (index) => {
    onDefectSelect?.(index);
  };

  // Render expanded modal
  if (isExpanded) {
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-void/95 z-50 flex items-center justify-center p-8"
          onClick={() => setIsExpanded(false)}
        >
          {/* Modal Content */}
          <div 
            className="relative w-full h-full max-w-6xl max-h-[85vh] bg-terminal border border-surface-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-void border-b border-surface-border">
              <div className="flex items-center gap-3">
                <Maximize2 className="w-5 h-5 text-phosphor-amber" />
                <span className="font-mono text-sm text-text-primary">
                  BOARD OVERVIEW - {defects.length} DEFECTS
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 border border-surface-border hover:border-phosphor-red hover:text-phosphor-red transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Defect Grid - Larger in expanded view */}
            <div className="flex-1 p-4 overflow-auto">
              <div className="grid grid-cols-4 gap-4">
                {defects.map((defect, index) => (
                  <DefectCropThumbnail
                    key={defect.id || index}
                    defect={defect}
                    imageSrc={imageSrc}
                    imageWidth={imageWidth}
                    imageHeight={imageHeight}
                    isActive={index === currentDefectIndex}
                    index={index}
                    onClick={handleDefectClick}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder in original position */}
        <div className={cn("flex flex-col bg-terminal border border-surface-border opacity-50", className)}>
          <div className="flex items-center justify-between px-3 py-2 bg-void border-b border-surface-border">
            <span className="font-mono text-xs text-text-tertiary">BOARD OVERVIEW</span>
          </div>
          <div className="flex-1 min-h-[120px] flex items-center justify-center">
            <span className="font-mono text-xs text-text-tertiary">Expanded view open</span>
          </div>
        </div>
      </>
    );
  }

  // Normal View - Compact grid
  return (
    <div className={cn("flex flex-col bg-terminal border border-surface-border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-void border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-text-tertiary" />
          <span className="font-mono text-xs text-text-tertiary">BOARD OVERVIEW</span>
        </div>
        <div className="flex items-center gap-2">
          {defects.length > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-phosphor-red" />
              <span className="font-mono text-xs text-phosphor-red font-bold">
                {defects.length} DEFECT{defects.length > 1 ? 'S' : ''}
              </span>
            </div>
          )}
          {/* Expand button */}
          <button
            onClick={() => setIsExpanded(true)}
            className="p-1 border border-surface-border hover:border-phosphor-amber hover:text-phosphor-amber transition-colors"
            title="Expand view"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Defect Thumbnails Grid */}
      <div className="flex-1 p-2 overflow-auto">
        {defects.length > 0 ? (
          <div className={cn(
            "grid gap-2",
            defects.length === 1 ? "grid-cols-1 justify-items-center" :
            defects.length === 2 ? "grid-cols-2" :
            defects.length <= 4 ? "grid-cols-2" : "grid-cols-3"
          )}>
            {defects.map((defect, index) => (
              <DefectCropThumbnail
                key={defect.id || index}
                defect={defect}
                imageSrc={imageSrc}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                isActive={index === currentDefectIndex}
                index={index}
                onClick={handleDefectClick}
              />
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Crosshair className="w-8 h-8 text-text-tertiary/30 mx-auto mb-2" />
              <p className="font-mono text-xxs text-text-tertiary">No defects detected</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Current defect info */}
      {defects[currentDefectIndex] && (
        <div className="px-3 py-2 bg-void border-t border-surface-border">
          <div className="flex items-center justify-between font-mono text-xxs">
            <span className="text-text-tertiary">
              Current: #{currentDefectIndex + 1} - {defects[currentDefectIndex].component_ref}
            </span>
            <span className={cn(
              "uppercase font-bold",
              SEVERITY_COLORS[defects[currentDefectIndex].severity]?.text || "text-text-secondary"
            )}>
              {defects[currentDefectIndex].class_name?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default BoardOverview;
