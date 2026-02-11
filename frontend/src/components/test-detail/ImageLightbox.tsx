/**
 * ImageLightbox - Feature #48: Extracted from TestDetailPage.tsx
 * Screenshot lightbox modal with zoom and pan functionality
 */
import { ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';

export interface ImageLightboxProps {
  image: string | null;
  onClose: () => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number }) => void;
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
  dragStart: { x: number; y: number };
  setDragStart: (dragStart: { x: number; y: number }) => void;
}

export function ImageLightbox({
  image,
  onClose,
  zoom,
  setZoom,
  pan,
  setPan,
  isDragging,
  setIsDragging,
  dragStart,
  setDragStart,
}: ImageLightboxProps) {
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot lightbox"
    >
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {/* Top toolbar */}
        <div className="absolute -top-12 left-0 right-0 flex items-center justify-between">
          {/* Zoom controls */}
          <div className="flex items-center gap-2 bg-black/50 rounded-lg px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setZoom(Math.max(0.25, zoom - 0.25));
                if (zoom <= 1) setPan({ x: 0, y: 0 });
              }}
              className="text-white hover:text-muted-foreground px-2 py-1 rounded hover:bg-white/10"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="text-white text-sm min-w-[60px] text-center font-medium">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(4, zoom + 0.25))}
              className="text-white hover:text-muted-foreground px-2 py-1 rounded hover:bg-white/10"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="text-white text-xs hover:text-muted-foreground px-2 py-1 ml-1 rounded hover:bg-white/10"
              aria-label="Reset zoom"
            >
              Reset
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="text-white text-xs hover:text-muted-foreground px-2 py-1 rounded hover:bg-white/10 flex items-center gap-1"
              aria-label="Fit to screen"
            >
              <Maximize2 className="h-4 w-4" />
              Fit
            </button>
          </div>

          {/* Download and Close */}
          <div className="flex items-center gap-4">
            <a
              href={image}
              download={`screenshot-${Date.now()}.png`}
              onClick={(e) => e.stopPropagation()}
              className="text-white text-sm hover:text-muted-foreground flex items-center gap-1"
            >
              <Download className="h-5 w-5" />
              Download
            </a>
            <button
              onClick={onClose}
              className="text-white text-xl hover:text-muted-foreground"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Help text for panning */}
        {zoom > 1 && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white/70 text-xs">
            Drag to pan • Scroll to zoom
          </div>
        )}

        {/* Image container with overflow handling for zoomed images */}
        <div
          className={`overflow-hidden rounded-lg shadow-2xl ${zoom > 1 ? 'cursor-grab' : 'cursor-default'} ${isDragging ? 'cursor-grabbing' : ''}`}
          style={{ maxHeight: '85vh', maxWidth: '90vw' }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            if (zoom > 1) {
              setIsDragging(true);
              setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            }
          }}
          onMouseMove={(e) => {
            if (isDragging && zoom > 1) {
              setPan({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
              });
            }
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newZoom = Math.max(0.25, Math.min(4, zoom + delta));
            setZoom(newZoom);
            if (newZoom <= 1) {
              setPan({ x: 0, y: 0 });
            }
          }}
        >
          <img
            src={image}
            alt="Full-size screenshot"
            className="select-none"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center center',
              maxHeight: zoom === 1 ? '85vh' : 'none',
              maxWidth: zoom === 1 ? '90vw' : 'none',
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

export default ImageLightbox;
