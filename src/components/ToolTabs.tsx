import type { ToolName } from '../types/editor';

interface ToolTabsProps {
  activeTool: ToolName;
  disabled: boolean;
  onChange: (tool: ToolName) => void;
}

const TOOLS: Array<{ id: ToolName; label: string }> = [
  { id: 'crop', label: 'Crop' },
  { id: 'transform', label: 'Transform' },
  { id: 'adjust', label: 'Adjust' },
];

export function ToolTabs({ activeTool, disabled, onChange }: ToolTabsProps): JSX.Element {
  return (
    <aside className="tool-tabs" aria-label="Tools">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={tool.id === activeTool ? 'is-active' : ''}
          onClick={() => onChange(tool.id)}
          disabled={disabled}
        >
          {tool.label}
        </button>
      ))}
    </aside>
  );
}
