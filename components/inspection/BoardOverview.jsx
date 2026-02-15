'use client';

/**
 * Board Overview - Shows CROPPED defect image
 * Displays the zoomed/cropped area around the current defect
 * 
 * Purpose: Give operator a focused view of the defect area
 * Click to cycle through defects if multiple exist
 */

import { useState, useRef, useEffect } from 'react';
import { Crop, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/I18nContext';

// Severity colors
const SEVERITY_COLORS = {
  critical: { 
    border: 'border-phosphor-red',
    text: 'text-phosphor-red',
    bg: 'bg-phosphor-red/10',
  },
  major: { 
    border: 'border-phosphor-teal',
    text: 'text-phosphor-teal',
    bg: 'bg-phosphor-teal/10',
  },
  minor: { 
    border: 'border-yellow-400',
    text: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
  },
};

export function BoardOverview({
  imageSrc,
  defects = [],
  currentDefectIndex = 0,
  imageWidth = 1024,
  imageHeight = 768,
  onDefectSelect,
  className,
}) {
  const { t } = useI18n();
  const canvasRef = useRef(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentDefect = defects[currentDefectIndex] || null;
  const defectCount = defects.length;

  // Crop image around defect bbox with padding
  useEffect(() => {
    if (!imageSrc || !currentDefect?.bbox) {
      setCroppedImageUrl(null);
      return;
    }

    setIsLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const bbox = currentDefect.bbox;
      
      // Add padding around defect (20% of bbox size, min 50px)
      const paddingX = Math.max(bbox.width * 0.3, 50);
      const paddingY = Math.max(bbox.height * 0.3, 50);
      
      // Calculate crop area with padding
      let cropX = Math.max(0, bbox.x - paddingX);
      let cropY = Math.max(0, bbox.y - paddingY);
      let cropW = bbox.width + paddingX * 2;
      let cropH = bbox.height + paddingY * 2;
      
      // Ensure crop doesn't exceed image bounds
      if (cropX + cropW > img.naturalWidth) {
        cropW = img.naturalWidth - cropX;
      }
      if (cropY + cropH > img.naturalHeight) {
        cropH = img.naturalHeight - cropY;
      }
      
      // Set canvas size (max 400px for thumbnail)
      const maxSize = 400;
      const scale = Math.min(maxSize / cropW, maxSize / cropH, 1);
      canvas.width = cropW * scale;
      canvas.height = cropH * scale;
      
      // Draw cropped area
      ctx.drawImage(
        img,
        cropX, cropY, cropW, cropH,  // source
        0, 0, canvas.width, canvas.height  // destination
      );
      
      // Draw bbox indicator on cropped image
      const severity = currentDefect.severity || 'major';
      const bboxColor = severity === 'critical' ? '#EF4444' : 
                        severity === 'major' ? '#F59E0B' : '#EAB308';
      
      // Calculate bbox position relative to crop
      const bboxX = (bbox.x - cropX) * scale;
      const bboxY = (bbox.y - cropY) * scale;
      const bboxW = bbox.width * scale;
      const bboxH = bbox.height * scale;
      
      ctx.strokeStyle = bboxColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(bboxX, bboxY, bboxW, bboxH);
      
      // Convert to data URL
      setCroppedImageUrl(canvas.toDataURL('image/png'));
      setIsLoading(false);
    };

    img.onerror = () => {
      console.error('Failed to load image for cropping');
      setCroppedImageUrl(null);
      setIsLoading(false);
    };

    img.src = imageSrc;
  }, [imageSrc, currentDefect, imageWidth, imageHeight]);

  // Navigation handlers
  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentDefectIndex > 0) {
      onDefectSelect?.(currentDefectIndex - 1);
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentDefectIndex < defectCount - 1) {
      onDefectSelect?.(currentDefectIndex + 1);
    }
  };

  const severityStyle = currentDefect?.severity 
    ? SEVERITY_COLORS[currentDefect.severity] || SEVERITY_COLORS.major
    : SEVERITY_COLORS.major;

  return (
    <div 
      className={cn(
        "flex flex-col bg-terminal border border-surface-border",
        className
      )}
      style={{ minHeight: '200px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-void border-b border-surface-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Crop className="w-4 h-4 text-text-tertiary" />
          <span className="font-mono text-xs text-text-tertiary">{t('inspection.boardOverview')}</span>
        </div>
        {defectCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-phosphor-red" />
            <span className="font-mono text-xs text-phosphor-red font-bold">
              {defectCount}
            </span>
          </div>
        )}
      </div>

      {/* Cropped Image Display */}
      <div className="flex-1 relative flex items-center justify-center p-2 overflow-hidden bg-void/50" style={{ minHeight: '150px' }}>
        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />
        
        {isLoading ? (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-phosphor-teal border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="font-mono text-xxs text-text-tertiary">{t('common.loading')}</p>
          </div>
        ) : croppedImageUrl ? (
          <div className={cn(
            "relative border-2",
            severityStyle.border
          )}>
            <img
              src={croppedImageUrl}
              alt={`Defect ${currentDefectIndex + 1}`}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
            
            {/* Component ref badge */}
            {currentDefect?.component_ref && (
              <span className={cn(
                "absolute -top-6 left-0 px-2 py-0.5 font-mono text-xs font-bold",
                severityStyle.bg,
                severityStyle.text
              )}>
                {currentDefect.component_ref}
              </span>
            )}
          </div>
        ) : imageSrc ? (
          <div className="text-center">
            <Crop className="w-8 h-8 text-text-tertiary/30 mx-auto mb-2" />
            <p className="font-mono text-xxs text-text-tertiary">{t('inspection.noDefectBbox')}</p>
          </div>
        ) : (
          <div className="text-center">
            <Crop className="w-8 h-8 text-text-tertiary/30 mx-auto mb-2" />
            <p className="font-mono text-xxs text-text-tertiary">{t('inspection.waitingForImage')}</p>
          </div>
        )}

        {/* Navigation arrows (if multiple defects) */}
        {defectCount > 1 && (
          <>
            <button
              onClick={handlePrev}
              disabled={currentDefectIndex === 0}
              className={cn(
                "absolute left-1 top-1/2 -translate-y-1/2 p-1 bg-void/80 border border-surface-border",
                "hover:border-phosphor-teal hover:text-phosphor-teal transition-colors",
                currentDefectIndex === 0 && "opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentDefectIndex === defectCount - 1}
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-void/80 border border-surface-border",
                "hover:border-phosphor-teal hover:text-phosphor-teal transition-colors",
                currentDefectIndex === defectCount - 1 && "opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Footer - Current defect info */}
      <div className="px-3 py-1.5 bg-void border-t border-surface-border flex-shrink-0">
        <div className="flex items-center justify-between font-mono text-xxs">
          <span className="text-text-tertiary">
            #{currentDefectIndex + 1}/{defectCount || 1} - {currentDefect?.component_ref || 'N/A'}
          </span>
          <span className={cn(
            "uppercase font-bold",
            severityStyle.text
          )}>
            {currentDefect?.class_name?.replace(/_/g, ' ') || t('inspection.noDefect')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default BoardOverview;
