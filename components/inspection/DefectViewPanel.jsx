'use client';

/**
 * Defect View Panel
 * Main zoomed view of defect region with bounding box overlay
 * Supports multi-level zoom and pan
 */

import { useState, useRef, useEffect } from 'react';
import { 
  ZoomIn, ZoomOut, Maximize, RotateCcw, 
  Eye, EyeOff, Move, Crosshair 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Zoom levels
const ZOOM_LEVELS = [1, 2, 4, 8];

// Severity colors for bbox
const SEVERITY_COLORS = {
  critical: { stroke: '#EF4444', fill: 'rgba(239, 68, 68, 0.15)' },
  major: { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.15)' },
  minor: { stroke: '#EAB308', fill: 'rgba(234, 179, 8, 0.15)' },
};

export function DefectViewPanel({
  imageSrc,
  detection,
  imageWidth = 1280,
  imageHeight = 720,
  title = 'DEFECT VIEW',
  showOverlay = true,
  onToggleOverlay,
  className,
}) {
  const containerRef = useRef(null);
  const imageContainerRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [overlayVisible, setOverlayVisible] = useState(showOverlay);
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: imageWidth, height: imageHeight });
  const [imgRenderedSize, setImgRenderedSize] = useState({ width: 0, height: 0 });

  const zoomIndex = ZOOM_LEVELS.indexOf(zoomLevel);

  // Reset pan when detection changes
  useEffect(() => {
    if (detection?.bbox) {
      setPan({ x: 0, y: 0 });
    }
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

  const handleFit = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Toggle overlay
  const handleToggleOverlay = () => {
    setOverlayVisible(!overlayVisible);
    onToggleOverlay?.(!overlayVisible);
  };

  // Handle image load - get both natural and rendered sizes
  const handleImageLoad = (e) => {
    const img = e.target;
    setImgNaturalSize({ 
      width: img.naturalWidth, 
      height: img.naturalHeight 
    });
    setImgRenderedSize({
      width: img.offsetWidth,
      height: img.offsetHeight
    });
    console.log('[DefectView] Image loaded:', {
      natural: `${img.naturalWidth}x${img.naturalHeight}`,
      rendered: `${img.offsetWidth}x${img.offsetHeight}`
    });
  };

  // Get severity config
  const severity = detection?.severity || 'major';
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.major;

  return (
    <div className={cn("flex flex-col bg-terminal border border-surface-border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-void border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-phosphor-amber" />
          <span className="font-mono text-xs text-text-tertiary">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-phosphor-amber mr-2">{zoomLevel}x</span>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 overflow-hidden bg-void flex items-center justify-center",
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
            className="relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
          >
            {/* Image and Overlay Container - inline-block ensures tight fit */}
            <div ref={imageContainerRef} className="relative inline-block">
              <img
                src={imageSrc}
                alt="Defect view"
                className="block max-w-full max-h-[55vh]"
                draggable={false}
                onLoad={handleImageLoad}
              />

              {/* SVG Overlay - exact same size as image */}
              {overlayVisible && detection?.bbox && imgRenderedSize.width > 0 && (
                <svg
                  className="absolute top-0 left-0 pointer-events-none"
                  width={imgRenderedSize.width}
                  height={imgRenderedSize.height}
                  viewBox={`0 0 ${imgNaturalSize.width} ${imgNaturalSize.height}`}
                >
                  {/* Bounding box */}
                  <rect
                    x={detection.bbox.x}
                    y={detection.bbox.y}
                    width={detection.bbox.width}
                    height={detection.bbox.height}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={4}
                    strokeDasharray={severity === 'critical' ? 'none' : '12 6'}
                  />
                  
                  {/* Corner markers */}
                  {['nw', 'ne', 'sw', 'se'].map((corner) => {
                    const size = 16;
                    const x = corner.includes('w') ? detection.bbox.x : detection.bbox.x + detection.bbox.width - size;
                    const y = corner.includes('n') ? detection.bbox.y : detection.bbox.y + detection.bbox.height - size;
                    return (
                      <rect
                        key={corner}
                        x={x}
                        y={y}
                        width={size}
                        height={size}
                        fill={colors.stroke}
                      />
                    );
                  })}

                  {/* Label - position below bbox if near top edge */}
                  {(() => {
                    const labelHeight = 32;
                    const labelY = detection.bbox.y > 50 
                      ? detection.bbox.y - labelHeight - 4  // Above bbox
                      : detection.bbox.y + detection.bbox.height + 4; // Below bbox
                    const textY = labelY + 22;
                    const labelWidth = Math.max(detection.bbox.width, 220);
                    
                    return (
                      <>
                        {/* Label background */}
                        <rect
                          x={detection.bbox.x}
                          y={labelY}
                          width={labelWidth}
                          height={labelHeight}
                          fill={colors.stroke}
                        />
                        
                        {/* Label text */}
                        <text
                          x={detection.bbox.x + 8}
                          y={textY}
                          fill="white"
                          fontSize={18}
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {detection.class_name?.replace(/_/g, ' ').toUpperCase()}
                        </text>
                      </>
                    );
                  })()}
                </svg>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <Move className="w-12 h-12 text-text-tertiary/30 mx-auto mb-3" />
            <p className="font-mono text-sm text-text-tertiary">Waiting for image...</p>
          </div>
        )}

        {/* Zoom indicator overlay */}
        {zoomLevel > 1 && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-void/80 border border-surface-border">
            <span className="font-mono text-xs text-phosphor-amber">
              {zoomLevel}x ZOOM • Drag to pan
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-void border-t border-surface-border">
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoomIndex === 0}
            className={cn(
              "p-1.5 border border-surface-border transition-colors",
              zoomIndex === 0 
                ? "opacity-30 cursor-not-allowed" 
                : "hover:border-phosphor-amber hover:text-phosphor-amber"
            )}
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-0.5 px-2">
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                className={cn(
                  "w-6 h-6 font-mono text-xxs border transition-colors",
                  level === zoomLevel
                    ? "bg-phosphor-amber text-void border-phosphor-amber"
                    : "border-surface-border text-text-tertiary hover:border-phosphor-amber/50"
                )}
              >
                {level}x
              </button>
            ))}
          </div>
          
          <button
            onClick={handleZoomIn}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            className={cn(
              "p-1.5 border border-surface-border transition-colors",
              zoomIndex === ZOOM_LEVELS.length - 1
                ? "opacity-30 cursor-not-allowed"
                : "hover:border-phosphor-amber hover:text-phosphor-amber"
            )}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Other controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleFit}
            className="p-1.5 border border-surface-border hover:border-phosphor-amber hover:text-phosphor-amber transition-colors"
            title="Fit to view"
          >
            <Maximize className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleReset}
            className="p-1.5 border border-surface-border hover:border-phosphor-amber hover:text-phosphor-amber transition-colors"
            title="Reset view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-surface-border mx-1" />
          
          <button
            onClick={handleToggleOverlay}
            className={cn(
              "p-1.5 border transition-colors",
              overlayVisible
                ? "border-phosphor-amber text-phosphor-amber"
                : "border-surface-border text-text-tertiary hover:border-phosphor-amber/50"
            )}
            title={overlayVisible ? "Hide overlay" : "Show overlay"}
          >
            {overlayVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DefectViewPanel;
