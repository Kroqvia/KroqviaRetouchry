interface AdjustPanelProps {
  brightness: number;
  contrast: number;
  saturation: number;
  disabled: boolean;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
}

interface SliderFieldProps {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

function SliderField({ label, value, disabled, onChange }: SliderFieldProps): JSX.Element {
  return (
    <label className="field slider-field">
      <span>{label}</span>
      <input
        type="range"
        min={-100}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value) / 100)}
      />
      <output>{Math.round(value * 100)}</output>
    </label>
  );
}

export function AdjustPanel({
  brightness,
  contrast,
  saturation,
  disabled,
  onBrightnessChange,
  onContrastChange,
  onSaturationChange,
}: AdjustPanelProps): JSX.Element {
  return (
    <section className="panel" aria-label="Adjustments">
      <h2>Adjust</h2>
      <SliderField label="Brightness" value={brightness} disabled={disabled} onChange={onBrightnessChange} />
      <SliderField label="Contrast" value={contrast} disabled={disabled} onChange={onContrastChange} />
      <SliderField label="Saturation" value={saturation} disabled={disabled} onChange={onSaturationChange} />
    </section>
  );
}
