import type { ResizeMode } from '../types/editor';

interface TransformPanelProps {
  width: number;
  height: number;
  keepAspect: boolean;
  mode: ResizeMode;
  disabled: boolean;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onKeepAspectChange: (value: boolean) => void;
  onModeChange: (mode: ResizeMode) => void;
  onResizeApply: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
}

export function TransformPanel({
  width,
  height,
  keepAspect,
  mode,
  disabled,
  onWidthChange,
  onHeightChange,
  onKeepAspectChange,
  onModeChange,
  onResizeApply,
  onRotateLeft,
  onRotateRight,
  onFlipHorizontal,
  onFlipVertical,
}: TransformPanelProps): JSX.Element {
  return (
    <section className="panel" aria-label="Transform">
      <h2>Transform</h2>

      <div className="button-row">
        <button type="button" disabled={disabled} onClick={onRotateLeft}>
          Rotate Left
        </button>
        <button type="button" disabled={disabled} onClick={onRotateRight}>
          Rotate Right
        </button>
      </div>

      <div className="button-row">
        <button type="button" disabled={disabled} onClick={onFlipHorizontal}>
          Flip H
        </button>
        <button type="button" disabled={disabled} onClick={onFlipVertical}>
          Flip V
        </button>
      </div>

      <h3>Resize</h3>

      <label className="field">
        <span>Width</span>
        <input
          type="number"
          min={1}
          value={width}
          disabled={disabled}
          onChange={(event) => onWidthChange(Number(event.currentTarget.value || 1))}
        />
      </label>

      <label className="field">
        <span>Height</span>
        <input
          type="number"
          min={1}
          value={height}
          disabled={disabled}
          onChange={(event) => onHeightChange(Number(event.currentTarget.value || 1))}
        />
      </label>

      <label className="field checkbox">
        <input
          type="checkbox"
          checked={keepAspect}
          disabled={disabled}
          onChange={(event) => onKeepAspectChange(event.currentTarget.checked)}
        />
        <span>Keep aspect ratio</span>
      </label>

      <label className="field">
        <span>Mode</span>
        <select
          value={mode}
          disabled={disabled}
          onChange={(event) => onModeChange(event.currentTarget.value as ResizeMode)}
        >
          <option value="fit">Fit</option>
          <option value="fill">Fill</option>
          <option value="stretch">Stretch</option>
        </select>
      </label>

      <button type="button" disabled={disabled || width <= 0 || height <= 0} onClick={onResizeApply}>
        Apply Resize
      </button>
    </section>
  );
}
