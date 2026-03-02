import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { ImageMeta } from '../types/editor';
import { useEditorStore } from '../store/editorStore';
import { open as dialogOpen, save as dialogSave } from '@tauri-apps/plugin-dialog';
import { exportImage, openImage, renderPreview, validatePath } from '../utils/tauri';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../utils/tauri', () => ({
  openImage: vi.fn(),
  renderPreview: vi.fn(),
  exportImage: vi.fn(),
  validatePath: vi.fn(),
  formatError: vi.fn((err: unknown) => String(err)),
}));

const META: ImageMeta = {
  width: 1000,
  height: 600,
  format: 'png',
  hasAlpha: true,
};

const PNG_BYTES = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

beforeAll(() => {
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(): void {
      const entry = {
        contentRect: { width: 900, height: 650 },
      } as ResizeObserverEntry;
      this.callback([entry], this as unknown as ResizeObserver);
    }

    disconnect(): void {}

    unobserve(): void {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useEditorStore.getState().clearSession();

  vi.mocked(renderPreview).mockResolvedValue(PNG_BYTES);
  vi.mocked(openImage).mockResolvedValue(META);
  vi.mocked(validatePath).mockResolvedValue();
  vi.mocked(exportImage).mockResolvedValue(META);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('app behavior', () => {
  it('slider changes trigger debounced preview render', async () => {
    useEditorStore.getState().setSession('/tmp/a.png', META);

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(81);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByAltText('Preview')).toBeInTheDocument();

    vi.mocked(renderPreview).mockClear();

    const slider = screen.getByLabelText('Brightness');
    fireEvent.change(slider, { target: { value: '40' } });

    await act(async () => {
      vi.advanceTimersByTime(79);
      await Promise.resolve();
    });

    expect(renderPreview).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(renderPreview).toHaveBeenCalledTimes(1);
  });

  it('does not schedule repeated preview renders while one render is in flight', async () => {
    useEditorStore.getState().setSession('/tmp/a.png', META);

    let resolveRender: ((value: Uint8Array) => void) | null = null;
    const pendingRender = new Promise<Uint8Array>((resolve) => {
      resolveRender = resolve;
    });
    vi.mocked(renderPreview).mockReturnValue(pendingRender);

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(81);
      await Promise.resolve();
    });

    expect(renderPreview).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(renderPreview).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRender?.(PNG_BYTES);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByAltText('Preview')).toBeInTheDocument();
  });

  it('keyboard shortcuts trigger open/export/undo/redo flows', async () => {
    useEditorStore.getState().setSession('/tmp/a.png', META);
    useEditorStore.getState().pushOperation({ kind: 'rotate', degrees: 90 });

    vi.mocked(dialogOpen).mockResolvedValue('/tmp/opened.png');
    vi.mocked(dialogSave).mockResolvedValue('/tmp/exported.png');

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(81);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
      await Promise.resolve();
    });

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(validatePath).toHaveBeenCalledWith('/tmp/opened.png');

    await act(async () => {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true, shiftKey: true });
      await Promise.resolve();
    });

    expect(dialogSave).toHaveBeenCalledTimes(1);
    expect(exportImage).toHaveBeenCalledTimes(1);

    await act(async () => {
      useEditorStore.getState().pushOperation({ kind: 'flip', axis: 'horizontal' });
    });
    const beforeUndo = useEditorStore.getState().historyIndex;

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(useEditorStore.getState().historyIndex).toBe(beforeUndo - 1);

    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(useEditorStore.getState().historyIndex).toBe(beforeUndo);
  });
});
