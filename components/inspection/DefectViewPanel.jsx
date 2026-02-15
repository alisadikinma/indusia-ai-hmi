'use client';

/**
 * Defect View Panel V2
 * Main zoomed view of defect with bounding box overlay
 * Fixed: ResizeObserver for accurate bbox scaling
 */

import { useState, useRef, useEffect } from 'react';
import { 
  ZoomIn, ZoomOut, Maximize, RotateCcw, 
  Eye, EyeOff, Move, Crosshair 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/I18nContext';

const ZOOM_LEVELS = [1, 2, 4, 8];

const SEVERITY_COLORS = {
  critical: { stroke: '#EF4444', fill: 'rgba(239, 68, 68, 0.2)' },
  major: { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.2)' },
  minor: { stroke: '#EAB308', fill: 'rgba(234, 179, 8, 0.2)' },
};

export function DefectViewPanel({
  imageSrc,
  detection,
  imageWidth = 1024,
  imageHeight = 768,
  title,
  showOverlay = true,
  className,
}) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [overlayVisible, setOverlayVisible] = useState(showOverlay);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });

  const zoomIndex = ZOOM_LEVELS.indexOf(zoomLevel);

  // Track rendered image size with ResizeObserver
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const updateSize = () => {
      if (img.complete && img.naturalWidth > 0) {
        setRenderedSize({
          width: img.clientWidth,
          height: img.clientHeight
        });
      }
    };

    // Initial update
    updateSize();

    // ResizeObserver for size changes
    const observer = new ResizeObserver(updateSize);
    observer.observe(img);

    return () => observer.disconnect();
  }, [imageSrc]);

  // Reset pan when detection changes
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoomLevel(1);
  }, [detection]);

  // Zoom handlers
  const handleZoomIn = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      setZoomLevel(ZOOM_LEVELS[zoomIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    if (zoomIndex > 0) {
      setZoomLevel(ZOOM_LEVELS[zoomIndex - 1]);
    }
  };

  const handleReset = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers
  const handleMouseDown = (e) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Calculate scaled bbox
  const getScaledBbox = () => {
    if (!detection?.bbox || !renderedSize.width) return null;
    
    const scaleX = renderedSize.width / imageWidth;
    const scaleY = renderedSize.height / imageHeight;
    
    return {
      x: detection.bbox.x * scaleX,
      y: detection.bbox.y * scaleY,
      width: detection.bbox.width * scaleX,
      height: detection.bbox.height * scaleY,
    };
  };

  const scaledBbox = getScaledBbox();
  const severity = detection?.severity || 'major';
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.major;

  return (
    <div className={cn("flex flex-col bg-terminal border border-surface-border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-void border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-phosphor-teal" />
          <span className="font-mono text-xs text-text-tertiary">{title || t('inspection.defectView')}</span>
        </div>
        <span className="font-mono text-xs text-phosphor-teal">{zoomLevel}x</span>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 overflow-hidden bg-void flex items-center justify-center min-h-0",
          zoomLevel > 1 ? "cursor-grab" : "cursor-default",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {imageSrc ? (
          <div
            className="relative inline-block"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="PCB inspection"
              className="block max-w-full max-h-[60vh] object-contain"
              draggable={false}
              onLoad={() => {
                const img = imgRef.current;
                if (img) {
                  setRenderedSize({ width: img.clientWidth, height: img.clientHeight });
                }
              }}
            />

            {/* Bbox Overlay */}
            {overlayVisible && scaledBbox && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: scaledBbox.x,
                  top: scaledBbox.y,
                  width: scaledBbox.width,
                  height: scaledBbox.height,
                  border: `3px solid ${colors.stroke}`,
                  backgroundColor: colors.fill,
                  boxShadow: `0 0 0 1px ${colors.stroke}40`,
                }}
              >
                {/* Label */}
                <div
                  className="absolute left-0 px-2 py-0.5 font-mono text-xs font-bold text-white whitespace-nowrap"
                  style={{ 
                    backgroundColor: colors.stroke,
                    top: scaledBbox.y > 30 ? -24 : scaledBbox.height + 2,
                  }}
                >
                  {detection.component_ref || detection.class_name?.replace(/_/g, ' ').toUpperCase()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <Move className="w-10 h-10 text-text-tertiary/30 mx-auto mb-2" />
            <p className="font-mono text-sm text-text-tertiary">{t('inspection.waitingForImage')}</p>
          </div>
        )}
      </div>

      {/* Controls - Compact */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-void border-t border-surface-border">
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleZoomOut}
            disabled={zoomIndex === 0}
            className={cn(
              "p-1 border border-surface-border transition-colors",
              zoomIndex === 0 ? "opacity-30" : "hover:border-phosphor-teal"
            )}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          
          {ZOOM_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setZoomLevel(level)}
              className={cn(
                "w-6 h-6 font-mono text-xxs border transition-colors",
                level === zoomLevel
                  ? "bg-phosphor-teal text-void border-phosphor-teal"
                  : "border-surface-border text-text-tertiary hover:border-phosphor-teal/50"
              )}
            >
              {level}x
            </button>
          ))}
          
          <button
            onClick={handleZoomIn}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            className={cn(
              "p-1 border border-surface-border transition-colors",
              zoomIndex === ZOOM_LEVELS.length - 1 ? "opacity-30" : "hover:border-phosphor-teal"
            )}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={handleReset}
            className="p-1 border border-surface-border hover:border-phosphor-teal transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setOverlayVisible(!overlayVisible)}
            className={cn(
              "p-1 border transition-colors",
              overlayVisible ? "border-phosphor-teal text-phosphor-teal" : "border-surface-border"
            )}
          >
            {overlayVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DefectViewPanel;
