import { describe, expect, it } from 'vitest';
import type { ImageMeta } from '../types/editor';
import { useEditorStore } from '../store/editorStore';

const META: ImageMeta = {
  width: 120,
  height: 80,
  format: 'png',
  hasAlpha: true,
};

describe('editor store history behavior', () => {
  it('maintains undo/redo pointer and truncates redo after new operations', () => {
    const store = useEditorStore.getState();
    store.setSession('/tmp/image.png', META);

    store.pushOperation({ kind: 'rotate', degrees: 90 });
    store.pushOperation({ kind: 'flip', axis: 'horizontal' });

    expect(useEditorStore.getState().historyIndex).toBe(2);
    expect(useEditorStore.getState().operations).toHaveLength(2);

    store.undo();
    expect(useEditorStore.getState().historyIndex).toBe(1);

    store.redo();
    expect(useEditorStore.getState().historyIndex).toBe(2);

    store.undo();
    store.pushOperation({ kind: 'flip', axis: 'vertical' });

    expect(useEditorStore.getState().historyIndex).toBe(2);
    expect(useEditorStore.getState().operations).toHaveLength(2);
    expect(useEditorStore.getState().operations[1]).toEqual({ kind: 'flip', axis: 'vertical' });
  });
});
