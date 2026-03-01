import type { CropRect } from '../types/editor';

interface CropPanelProps {
  crop: CropRect | null;
  disabled: boolean;
  onChange: (crop: CropRect) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
}

export function CropPanel({ crop, disabled, onChange, onApply, onCancel, onReset }: CropPanelProps): JSX.Element {
  const fallback = crop ?? { x: 0, y: 0, width: 0, height: 0 };

  return (
    <section className="panel" aria-label="Crop">
      <h2>Crop</h2>
      <label className="field">
        <span>X</span>
        <input
          type="number"
          min={0}
          value={fallback.x}
          disabled={disabled}
          onChange={(event) => onChange({ ...fallback, x: Number(event.currentTarget.value) })}
        />
      </label>
      <label className="field">
        <span>Y</span>
        <input
          type="number"
          min={0}
          value={fallback.y}
          disabled={disabled}
          onChange={(event) => onChange({ ...fallback, y: Number(event.currentTarget.value) })}
        />
      </label>
      <label className="field">
        <span>Width</span>
        <input
          type="number"
          min={1}
          value={fallback.width}
          disabled={disabled}
          onChange={(event) => onChange({ ...fallback, width: Number(event.currentTarget.value) })}
        />
      </label>
      <label className="field">
        <span>Height</span>
        <input
          type="number"
          min={1}
          value={fallback.height}
          disabled={disabled}
          onChange={(event) => onChange({ ...fallback, height: Number(event.currentTarget.value) })}
        />
      </label>
      <div className="button-row">
        <button type="button" disabled={disabled || !crop} onClick={onApply}>
          Apply Crop
        </button>
        <button type="button" disabled={disabled} onClick={onReset}>
          Reset
        </button>
      </div>
      <button type="button" disabled={disabled} onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}
