interface ToolbarProps {
  hasImage: boolean;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  isExporting: boolean;
  onOpen: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export function Toolbar({
  hasImage,
  canUndo,
  canRedo,
  zoom,
  isExporting,
  onOpen,
  onExport,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: ToolbarProps): JSX.Element {
  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button onClick={onOpen} type="button">
          Open (Ctrl+O)
        </button>
        <button onClick={onExport} disabled={!hasImage || isExporting} type="button">
          {isExporting ? 'Exporting...' : 'Export (Ctrl+Shift+S)'}
        </button>
      </div>

      <div className="toolbar-group">
        <button onClick={onUndo} disabled={!canUndo || !hasImage} type="button">
          Undo (Ctrl+Z)
        </button>
        <button onClick={onRedo} disabled={!canRedo || !hasImage} type="button">
          Redo (Ctrl+Y)
        </button>
      </div>

      <div className="toolbar-group">
        <button onClick={onZoomOut} disabled={!hasImage} type="button" aria-label="Zoom out">
          -
        </button>
        <button onClick={onResetZoom} disabled={!hasImage} type="button">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={onZoomIn} disabled={!hasImage} type="button" aria-label="Zoom in">
          +
        </button>
      </div>
    </header>
  );
}
