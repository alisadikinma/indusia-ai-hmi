'use client';

/**
 * Bbox Editor - Visual tool to define defect bounding boxes
 * URL: /dev/bbox-editor
 * 
 * Usage:
 * 1. Select image from dropdown
 * 2. Click and drag on image to draw bbox
 * 3. Copy generated code to imageService.js
 */

import { useState, useRef, useEffect } from 'react';
import { Copy, Trash2, Plus, Save, Eye, EyeOff } from 'lucide-react';

// Available images
const IMAGES = [
  'pcb_golden_TOP.png',
  'pcb_golden_BOTTOM.png',
  'pcb_MC_01_TOP.png',
  'pcb_SB_01_TOP.png',
  'pcb_TS_01_TOP.png',
  'pcb_IS_01_TOP.png',
  'pcb_CS_01_BOTTOM.png',
  'pcb_SL_01_BOTTOM.png',
  'pcb_MC-SB_01_TOP.png',
  'pcb_IS-CS-SL_01_TOP.png',
];

// Defect types
const DEFECT_TYPES = [
  'solder_bridge',
  'missing_component',
  'tombstone',
  'insufficient_solder',
  'cold_solder',
  'solder_ball',
  'excess_solder',
  'misalignment',
];

// Severity options
const SEVERITIES = ['critical', 'major', 'minor'];

// Component refs
const COMPONENT_REFS = [
  'R1', 'R2', 'R3', 'R4',
  'C1', 'C2', 'C3', 'C4', 'C5',
  'U1', 'U2',
  'J1',
  'PCB Surface',
];

export default function BboxEditorPage() {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  
  const [selectedImage, setSelectedImage] = useState(IMAGES[0]);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState(null);
  const [defects, setDefects] = useState([]);
  const [selectedDefectIndex, setSelectedDefectIndex] = useState(-1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // New defect form
  const [newDefect, setNewDefect] = useState({
    class_name: 'solder_bridge',
    severity: 'critical',
    confidence: 0.94,
    component_ref: 'U1',
    pin_number: '',
    ipc_reference: 'IPC-A-610 8.2.9',
  });

  // Handle image load
  const handleImageLoad = () => {
    const img = imgRef.current;
    if (img) {
      setImgSize({
        width: img.clientWidth,
        height: img.clientHeight,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    }
  };

  // Convert screen coords to image coords
  const screenToImage = (screenX, screenY) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect || !imgSize.naturalWidth) return { x: 0, y: 0 };
    
    const scaleX = imgSize.naturalWidth / imgSize.width;
    const scaleY = imgSize.naturalHeight / imgSize.height;
    
    return {
      x: Math.round((screenX - rect.left) * scaleX),
      y: Math.round((screenY - rect.top) * scaleY),
    };
  };

  // Convert image coords to screen coords (for display)
  const imageToScreen = (imgX, imgY) => {
    if (!imgSize.naturalWidth) return { x: 0, y: 0 };
    
    const scaleX = imgSize.width / imgSize.naturalWidth;
    const scaleY = imgSize.height / imgSize.naturalHeight;
    
    return {
      x: imgX * scaleX,
      y: imgY * scaleY,
    };
  };

  // Mouse handlers
  const handleMouseDown = (e) => {
    const pos = screenToImage(e.clientX, e.clientY);
    setStartPos(pos);
    setIsDrawing(true);
    setCurrentBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    
    const pos = screenToImage(e.clientX, e.clientY);
    const width = pos.x - startPos.x;
    const height = pos.y - startPos.y;
    
    setCurrentBox({
      x: width >= 0 ? startPos.x : pos.x,
      y: height >= 0 ? startPos.y : pos.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentBox && currentBox.width > 5 && currentBox.height > 5) {
      // Keep the box, ready to add as defect
    }
    setIsDrawing(false);
  };

  // Add defect with current box
  const addDefect = () => {
    if (!currentBox || currentBox.width < 5) return;
    
    const defect = {
      id: defects.length + 1,
      ...newDefect,
      bbox: { ...currentBox },
      reviewed: false,
    };
    
    setDefects([...defects, defect]);
    setCurrentBox(null);
  };

  // Remove defect
  const removeDefect = (index) => {
    setDefects(defects.filter((_, i) => i !== index));
    setSelectedDefectIndex(-1);
  };

  // Clear all
  const clearAll = () => {
    setDefects([]);
    setCurrentBox(null);
    setSelectedDefectIndex(-1);
  };

  // Generate code
  const generateCode = () => {
    const side = selectedImage.includes('BOTTOM') ? 'BOTTOM' : 'TOP';
    
    let code = `  // ${selectedImage}\n`;
    code += `  '${selectedImage}': {\n`;
    code += `    imageWidth: ${imgSize.naturalWidth || 1024},\n`;
    code += `    imageHeight: ${imgSize.naturalHeight || 768},\n`;
    code += `    side: '${side}',\n`;
    code += `    defects: [\n`;
    
    defects.forEach((d, i) => {
      code += `      {\n`;
      code += `        id: ${i + 1},\n`;
      code += `        class_name: '${d.class_name}',\n`;
      code += `        confidence: ${d.confidence},\n`;
      code += `        severity: '${d.severity}',\n`;
      code += `        component_ref: '${d.component_ref}',\n`;
      code += `        pin_number: ${d.pin_number ? `'${d.pin_number}'` : 'null'},\n`;
      code += `        ipc_reference: '${d.ipc_reference}',\n`;
      code += `        bbox: { x: ${d.bbox.x}, y: ${d.bbox.y}, width: ${d.bbox.width}, height: ${d.bbox.height} },\n`;
      code += `        reviewed: false,\n`;
      code += `      },\n`;
    });
    
    code += `    ],\n`;
    code += `  },`;
    
    return code;
  };

  // Copy to clipboard
  const copyCode = () => {
    navigator.clipboard.writeText(generateCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#EF4444';
      case 'major': return '#F59E0B';
      case 'minor': return '#EAB308';
      default: return '#F59E0B';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-amber-400">
          🎯 Bbox Editor - Defect Position Tool
        </h1>
        
        <div className="flex gap-4">
          {/* Left: Image + Canvas */}
          <div className="flex-1">
            {/* Image selector */}
            <div className="mb-4 flex items-center gap-4">
              <select
                value={selectedImage}
                onChange={(e) => {
                  setSelectedImage(e.target.value);
                  setDefects([]);
                  setCurrentBox(null);
                }}
                className="bg-gray-800 border border-gray-600 px-3 py-2 text-sm"
              >
                {IMAGES.map(img => (
                  <option key={img} value={img}>{img}</option>
                ))}
              </select>
              
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className={`px-3 py-2 border ${showOverlay ? 'border-amber-500 text-amber-500' : 'border-gray-600'}`}
              >
                {showOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              
              <button
                onClick={clearAll}
                className="px-3 py-2 border border-red-500 text-red-500 hover:bg-red-500/20"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <span className="text-xs text-gray-400">
                Image: {imgSize.naturalWidth}x{imgSize.naturalHeight} | 
                Rendered: {imgSize.width}x{imgSize.height}
              </span>
            </div>
            
            {/* Image container */}
            <div 
              className="relative inline-block border border-gray-600 cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                ref={imgRef}
                src={`/images/${selectedImage}`}
                alt={selectedImage}
                className="block max-w-full max-h-[70vh]"
                onLoad={handleImageLoad}
                draggable={false}
              />
              
              {/* Overlay: existing defects */}
              {showOverlay && defects.map((d, i) => {
                const pos = imageToScreen(d.bbox.x, d.bbox.y);
                const size = {
                  width: d.bbox.width * (imgSize.width / imgSize.naturalWidth),
                  height: d.bbox.height * (imgSize.height / imgSize.naturalHeight),
                };
                const color = getSeverityColor(d.severity);
                
                return (
                  <div
                    key={i}
                    className={`absolute border-2 cursor-pointer ${selectedDefectIndex === i ? 'border-white' : ''}`}
                    style={{
                      left: pos.x,
                      top: pos.y,
                      width: size.width,
                      height: size.height,
                      borderColor: color,
                      backgroundColor: `${color}20`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDefectIndex(i);
                    }}
                  >
                    <span 
                      className="absolute -top-5 left-0 text-xs px-1 font-mono"
                      style={{ backgroundColor: color }}
                    >
                      #{i + 1} {d.component_ref}
                    </span>
                  </div>
                );
              })}
              
              {/* Current drawing box */}
              {currentBox && (
                <div
                  className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/20 pointer-events-none"
                  style={{
                    left: currentBox.x * (imgSize.width / imgSize.naturalWidth),
                    top: currentBox.y * (imgSize.height / imgSize.naturalHeight),
                    width: currentBox.width * (imgSize.width / imgSize.naturalWidth),
                    height: currentBox.height * (imgSize.height / imgSize.naturalHeight),
                  }}
                >
                  <span className="absolute -top-5 left-0 text-xs px-1 bg-cyan-400 text-black font-mono">
                    {currentBox.width}x{currentBox.height}
                  </span>
                </div>
              )}
            </div>
            
            {/* Current box info */}
            {currentBox && (
              <div className="mt-4 p-3 bg-gray-800 border border-cyan-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-cyan-400">
                    Current Box: x={currentBox.x}, y={currentBox.y}, w={currentBox.width}, h={currentBox.height}
                  </span>
                  <button
                    onClick={addDefect}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Defect
                  </button>
                </div>
                
                {/* Defect properties form */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Defect Type</label>
                    <select
                      value={newDefect.class_name}
                      onChange={(e) => setNewDefect({...newDefect, class_name: e.target.value})}
                      className="w-full bg-gray-700 border border-gray-600 px-2 py-1"
                    >
                      {DEFECT_TYPES.map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Severity</label>
                    <select
                      value={newDefect.severity}
                      onChange={(e) => setNewDefect({...newDefect, severity: e.target.value})}
                      className="w-full bg-gray-700 border border-gray-600 px-2 py-1"
                    >
                      {SEVERITIES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Confidence</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={newDefect.confidence}
                      onChange={(e) => setNewDefect({...newDefect, confidence: parseFloat(e.target.value)})}
                      className="w-full bg-gray-700 border border-gray-600 px-2 py-1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Component Ref</label>
                    <select
                      value={newDefect.component_ref}
                      onChange={(e) => setNewDefect({...newDefect, component_ref: e.target.value})}
                      className="w-full bg-gray-700 border border-gray-600 px-2 py-1"
                    >
                      {COMPONENT_REFS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Pin Number</label>
                    <input
                      type="text"
                      placeholder="e.g., Pin 8-9"
                      value={newDefect.pin_number}
                      onChange={(e) => setNewDefect({...newDefect, pin_number: e.target.value})}
                      className="w-full bg-gray-700 border border-gray-600 px-2 py-1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">IPC Reference</label>
                    <input
                      type="text"
                      value={newDefect.ipc_reference}
                      onChange={(e) => setNewDefect({...newDefect, ipc_reference: e.target.value})}
                      className="w-full bg-gray-700 border border-gray-600 px-2 py-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Right: Defect list + Code output */}
          <div className="w-96 flex flex-col gap-4">
            {/* Defect list */}
            <div className="bg-gray-800 border border-gray-600 p-3">
              <h3 className="font-bold text-amber-400 mb-2">
                Defects ({defects.length})
              </h3>
              
              {defects.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Draw a box on the image to add defects
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {defects.map((d, i) => (
                    <div 
                      key={i}
                      className={`p-2 border text-sm cursor-pointer ${
                        selectedDefectIndex === i ? 'border-white bg-gray-700' : 'border-gray-600'
                      }`}
                      onClick={() => setSelectedDefectIndex(i)}
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ color: getSeverityColor(d.severity) }}>
                          #{i + 1} {d.class_name.replace(/_/g, ' ')}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDefect(i);
                          }}
                          className="text-red-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {d.component_ref} | bbox: {d.bbox.x},{d.bbox.y} {d.bbox.width}x{d.bbox.height}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Code output */}
            <div className="bg-gray-800 border border-gray-600 p-3 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-amber-400">Generated Code</h3>
                <button
                  onClick={copyCode}
                  className={`px-3 py-1 border flex items-center gap-2 text-sm ${
                    copied ? 'border-green-500 text-green-500' : 'border-gray-600 hover:border-amber-500'
                  }`}
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              
              <pre className="text-xs text-green-400 bg-gray-900 p-2 overflow-auto max-h-96 font-mono">
                {generateCode()}
              </pre>
            </div>
            
            {/* Instructions */}
            <div className="bg-gray-800 border border-gray-600 p-3 text-xs text-gray-400">
              <h4 className="font-bold text-white mb-2">Instructions:</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Select image from dropdown</li>
                <li>Click and drag to draw bbox</li>
                <li>Set defect properties</li>
                <li>Click "Add Defect"</li>
                <li>Copy generated code to imageService.js</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
