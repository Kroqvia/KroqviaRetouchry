import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { CropOverlay } from './components/CropOverlay';
import { CropPanel } from './components/CropPanel';
import { ToolTabs } from './components/ToolTabs';
import { Toolbar } from './components/Toolbar';
import { TransformPanel } from './components/TransformPanel';
import { AdjustPanel } from './components/AdjustPanel';
import {
  selectActiveOps,
  selectCanRedo,
  selectCanUndo,
  selectCurrentAdjustmentValue,
  useEditorStore,
} from './store/editorStore';
import type { CropRect, EditOp } from './types/editor';
import { activeImageDimensions, getExportFormatFromPath, getSuggestedCrop } from './utils/image';
import { exportImage, formatError, openImage, renderPreview, validatePath } from './utils/tauri';

const PREVIEW_DEBOUNCE_MS = 80;

interface ViewportSize {
  width: number;
  height: number;
}

interface PanDrag {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const sanitizeCrop = (crop: CropRect, imageWidth: number, imageHeight: number): CropRect => {
  const x = clamp(Math.round(crop.x), 0, Math.max(0, imageWidth - 1));
  const y = clamp(Math.round(crop.y), 0, Math.max(0, imageHeight - 1));
  const width = clamp(Math.round(crop.width), 1, imageWidth - x);
  const height = clamp(Math.round(crop.height), 1, imageHeight - y);
  return { x, y, width, height };
};

const getPanelTitle = (tool: 'crop' | 'transform' | 'adjust'): string => {
  if (tool === 'crop') {
    return 'Crop';
  }

  if (tool === 'transform') {
    return 'Transform';
  }

  return 'Adjust';
};

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
};

function App(): JSX.Element {
  const sourcePath = useEditorStore((state) => state.sourcePath);
  const imageMeta = useEditorStore((state) => state.imageMeta);
  const activeTool = useEditorStore((state) => state.activeTool);
  const pendingCrop = useEditorStore((state) => state.pendingCrop);
  const previewUrl = useEditorStore((state) => state.previewUrl);
  const zoom = useEditorStore((state) => state.zoom);
  const panX = useEditorStore((state) => state.panX);
  const panY = useEditorStore((state) => state.panY);
  const resizeDraft = useEditorStore((state) => state.resizeDraft);
  const isRendering = useEditorStore((state) => state.isRendering);
  const isExporting = useEditorStore((state) => state.isExporting);
  const error = useEditorStore((state) => state.error);
  const notice = useEditorStore((state) => state.notice);

  const activeOps = useEditorStore(selectActiveOps);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const brightness = useEditorStore((state) => selectCurrentAdjustmentValue(state, 'brightness'));
  const contrast = useEditorStore((state) => selectCurrentAdjustmentValue(state, 'contrast'));
  const saturation = useEditorStore((state) => selectCurrentAdjustmentValue(state, 'saturation'));

  const setSession = useEditorStore((state) => state.setSession);
  const setPreviewUrl = useEditorStore((state) => state.setPreviewUrl);
  const pushOperation = useEditorStore((state) => state.pushOperation);
  const replaceAdjustment = useEditorStore((state) => state.replaceAdjustment);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const zoomBy = useEditorStore((state) => state.zoomBy);
  const resetView = useEditorStore((state) => state.resetView);
  const setPan = useEditorStore((state) => state.setPan);
  const setPendingCrop = useEditorStore((state) => state.setPendingCrop);
  const setResizeDraft = useEditorStore((state) => state.setResizeDraft);
  const setRendering = useEditorStore((state) => state.setRendering);
  const setExporting = useEditorStore((state) => state.setExporting);
  const setError = useEditorStore((state) => state.setError);
  const setNotice = useEditorStore((state) => state.setNotice);

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [panDrag, setPanDrag] = useState<PanDrag | null>(null);
  const activeDims = useMemo(() => activeImageDimensions(imageMeta, activeOps), [activeOps, imageMeta]);

  useEffect(() => {
    if (!canvasViewportRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setViewportSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      });
    });

    observer.observe(canvasViewportRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeTool !== 'crop') {
      return;
    }

    if (!pendingCrop && activeDims.width > 0 && activeDims.height > 0) {
      setPendingCrop(getSuggestedCrop(activeDims));
    }
  }, [activeDims, activeTool, pendingCrop, setPendingCrop]);

  useEffect(() => {
    if (!sourcePath || viewportSize.width < 8 || viewportSize.height < 8) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setRendering(true);
        const bytes = await renderPreview(sourcePath, activeOps, viewportSize.width, viewportSize.height);
        if (cancelled) {
          return;
        }

        const blob = new Blob([bytes.slice().buffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setError(null);
      } catch (invokeError) {
        if (!cancelled) {
          setError(formatError(invokeError));
        }
      } finally {
        if (!cancelled) {
          setRendering(false);
        }
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeOps, setError, setPreviewUrl, setRendering, sourcePath, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableElement(event.target)) {
        return;
      }

      const control = event.ctrlKey || event.metaKey;
      if (!control) {
        return;
      }

      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void handleOpen();
        return;
      }

      if (event.key.toLowerCase() === 's' && event.shiftKey) {
        event.preventDefault();
        void handleExport();
        return;
      }

      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === '0') {
        event.preventDefault();
        resetView();
        return;
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomBy(0.1);
        return;
      }

      if (event.key === '-') {
        event.preventDefault();
        zoomBy(-0.1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [redo, resetView, undo, zoomBy]);

  const handleOpen = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
          { name: 'PNG', extensions: ['png'] },
          { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
          { name: 'WebP', extensions: ['webp'] },
        ],
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      await validatePath(selected);
      const meta = await openImage(selected);
      setSession(selected, meta);
      setNotice(`Opened ${selected}`);
      setError(null);
    } catch (invokeError) {
      setError(formatError(invokeError));
    }
  }, [setError, setNotice, setSession]);

  const handleExport = useCallback(async () => {
    if (!sourcePath) {
      return;
    }

    try {
      const outputPath = await save({
        filters: [
          { name: 'PNG', extensions: ['png'] },
          { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
          { name: 'WebP', extensions: ['webp'] },
        ],
      });

      if (!outputPath || Array.isArray(outputPath)) {
        return;
      }

      const format = getExportFormatFromPath(outputPath);

      setExporting(true);
      await exportImage({
        sourcePath,
        ops: activeOps,
        outPath: outputPath,
        format,
        quality: format === 'jpeg' ? 92 : undefined,
      });
      setNotice(`Exported ${outputPath}`);
      setError(null);
    } catch (invokeError) {
      setError(formatError(invokeError));
    } finally {
      setExporting(false);
    }
  }, [activeOps, setError, setExporting, setNotice, sourcePath]);

  const applyCrop = (): void => {
    if (!pendingCrop || activeDims.width < 1 || activeDims.height < 1) {
      return;
    }

    const crop = sanitizeCrop(pendingCrop, activeDims.width, activeDims.height);
    pushOperation({
      kind: 'crop',
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
    });
    setPendingCrop(null);
  };

  const rotateBy = (degrees: 90 | 270): void => {
    pushOperation({ kind: 'rotate', degrees });
  };

  const pushFlip = (axis: 'horizontal' | 'vertical'): void => {
    pushOperation({ kind: 'flip', axis });
  };

  const applyResize = (): void => {
    if (resizeDraft.width < 1 || resizeDraft.height < 1) {
      return;
    }

    pushOperation({
      kind: 'resize',
      width: Math.round(resizeDraft.width),
      height: Math.round(resizeDraft.height),
      mode: resizeDraft.mode,
    });
  };

  const updateResizeWithAspect = (input: number, field: 'width' | 'height'): void => {
    const nextValue = Math.max(1, Math.round(input));
    if (resizeDraft.keepAspect) {
      const ratio = activeDims.width > 0 && activeDims.height > 0 ? activeDims.width / activeDims.height : 1;
      if (field === 'width') {
        setResizeDraft({ width: nextValue, height: Math.max(1, Math.round(nextValue / ratio)) });
      } else {
        setResizeDraft({ height: nextValue, width: Math.max(1, Math.round(nextValue * ratio)) });
      }
      return;
    }

    setResizeDraft({ [field]: nextValue } as Partial<{ width: number; height: number }>);
  };

  const beginPan = (event: ReactPointerEvent): void => {
    if (!imageMeta || activeTool === 'crop') {
      return;
    }

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setPanDrag({
      startX: event.clientX,
      startY: event.clientY,
      originX: panX,
      originY: panY,
    });
  };

  const onPanMove = (event: ReactPointerEvent): void => {
    if (!panDrag) {
      return;
    }

    setPan(panDrag.originX + (event.clientX - panDrag.startX), panDrag.originY + (event.clientY - panDrag.startY));
  };

  const endPan = (): void => {
    setPanDrag(null);
  };

  const setCrop = (crop: CropRect): void => {
    if (activeDims.width < 1 || activeDims.height < 1) {
      return;
    }

    setPendingCrop(sanitizeCrop(crop, activeDims.width, activeDims.height));
  };

  const panel = (() => {
    if (activeTool === 'crop') {
      return (
        <CropPanel
          crop={pendingCrop}
          disabled={!imageMeta}
          onApply={applyCrop}
          onCancel={() => setPendingCrop(null)}
          onReset={() => activeDims.width > 0 && activeDims.height > 0 && setPendingCrop(getSuggestedCrop(activeDims))}
          onChange={setCrop}
        />
      );
    }

    if (activeTool === 'transform') {
      return (
        <TransformPanel
          width={resizeDraft.width}
          height={resizeDraft.height}
          keepAspect={resizeDraft.keepAspect}
          mode={resizeDraft.mode}
          disabled={!imageMeta}
          onWidthChange={(value) => updateResizeWithAspect(value, 'width')}
          onHeightChange={(value) => updateResizeWithAspect(value, 'height')}
          onKeepAspectChange={(value) => setResizeDraft({ keepAspect: value })}
          onModeChange={(value) => setResizeDraft({ mode: value })}
          onResizeApply={applyResize}
          onRotateLeft={() => rotateBy(270)}
          onRotateRight={() => rotateBy(90)}
          onFlipHorizontal={() => pushFlip('horizontal')}
          onFlipVertical={() => pushFlip('vertical')}
        />
      );
    }

    return (
      <AdjustPanel
        brightness={brightness}
        contrast={contrast}
        saturation={saturation}
        disabled={!imageMeta}
        onBrightnessChange={(value) => replaceAdjustment('brightness', value)}
        onContrastChange={(value) => replaceAdjustment('contrast', value)}
        onSaturationChange={(value) => replaceAdjustment('saturation', value)}
      />
    );
  })();

  return (
    <div className="app-shell">
      <Toolbar
        hasImage={Boolean(imageMeta)}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        isExporting={isExporting}
        onOpen={() => {
          void handleOpen();
        }}
        onExport={() => {
          void handleExport();
        }}
        onUndo={undo}
        onRedo={redo}
        onZoomIn={() => zoomBy(0.1)}
        onZoomOut={() => zoomBy(-0.1)}
        onResetZoom={resetView}
      />

      <main className="workspace">
        <ToolTabs activeTool={activeTool} disabled={!imageMeta} onChange={setActiveTool} />

        <section className="canvas-area">
          <div
            ref={canvasViewportRef}
            className={`canvas-viewport ${panDrag ? 'dragging' : ''}`}
            onPointerDown={beginPan}
            onPointerMove={onPanMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            {!imageMeta && <p className="placeholder">Open an image to start editing.</p>}
            {imageMeta && previewUrl && (
              <div
                className="image-stage"
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                }}
              >
                <img className="preview-image" src={previewUrl} alt="Preview" draggable={false} />
                {activeTool === 'crop' && pendingCrop && activeDims.width > 0 && activeDims.height > 0 && (
                  <CropOverlay imageMeta={activeDims} crop={pendingCrop} onChange={setCrop} />
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="panel-area">
          <h2>{getPanelTitle(activeTool)}</h2>
          {panel}
        </aside>
      </main>

      <footer className="status-bar">
        <span>{sourcePath ? sourcePath : 'No image loaded'}</span>
        <span>
          {activeDims.width}x{activeDims.height}
        </span>
        <span>{activeOps.length} ops</span>
        <span>{isRendering ? 'Rendering...' : 'Ready'}</span>
        {notice && <span className="notice">{notice}</span>}
        {error && <span className="error">{error}</span>}
      </footer>
    </div>
  );
}

export default App;
