import { create } from 'zustand';
import type { CropRect, EditOp, ImageMeta, ResizeMode, ToolName } from '../types/editor';

const EPSILON = 1e-6;

interface ResizeDraft {
  width: number;
  height: number;
  mode: ResizeMode;
  keepAspect: boolean;
}

interface EditorState {
  sourcePath: string | null;
  imageMeta: ImageMeta | null;
  operations: EditOp[];
  historyIndex: number;
  previewUrl: string | null;
  zoom: number;
  panX: number;
  panY: number;
  activeTool: ToolName;
  pendingCrop: CropRect | null;
  resizeDraft: ResizeDraft;
  isRendering: boolean;
  isExporting: boolean;
  error: string | null;
  notice: string | null;
  setSession: (path: string, meta: ImageMeta) => void;
  clearSession: () => void;
  setPreviewUrl: (url: string | null) => void;
  pushOperation: (op: EditOp) => void;
  replaceAdjustment: (kind: 'brightness' | 'contrast' | 'saturation', value: number) => void;
  undo: () => void;
  redo: () => void;
  getActiveOps: () => EditOp[];
  setActiveTool: (tool: ToolName) => void;
  setZoom: (value: number) => void;
  zoomBy: (delta: number) => void;
  resetView: () => void;
  setPan: (x: number, y: number) => void;
  setPendingCrop: (crop: CropRect | null) => void;
  setResizeDraft: (patch: Partial<ResizeDraft>) => void;
  setRendering: (value: boolean) => void;
  setExporting: (value: boolean) => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const findLastByKind = (ops: EditOp[], kind: EditOp['kind']): number => {
  for (let index = ops.length - 1; index >= 0; index -= 1) {
    if (ops[index].kind === kind) {
      return index;
    }
  }

  return -1;
};

const getBaseResizeDraft = (meta: ImageMeta | null): ResizeDraft => ({
  width: meta?.width ?? 0,
  height: meta?.height ?? 0,
  mode: 'fit',
  keepAspect: true,
});

export const useEditorStore = create<EditorState>((set, get) => ({
  sourcePath: null,
  imageMeta: null,
  operations: [],
  historyIndex: 0,
  previewUrl: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  activeTool: 'adjust',
  pendingCrop: null,
  resizeDraft: getBaseResizeDraft(null),
  isRendering: false,
  isExporting: false,
  error: null,
  notice: null,

  setSession: (path, meta) => {
    set((state) => {
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
      }

      return {
        sourcePath: path,
        imageMeta: meta,
        operations: [],
        historyIndex: 0,
        previewUrl: null,
        zoom: 1,
        panX: 0,
        panY: 0,
        pendingCrop: null,
        resizeDraft: getBaseResizeDraft(meta),
        error: null,
        notice: null,
        activeTool: 'adjust',
      };
    });
  },

  clearSession: () => {
    set((state) => {
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
      }

      return {
        sourcePath: null,
        imageMeta: null,
        operations: [],
        historyIndex: 0,
        previewUrl: null,
        zoom: 1,
        panX: 0,
        panY: 0,
        pendingCrop: null,
        resizeDraft: getBaseResizeDraft(null),
        isRendering: false,
        isExporting: false,
        error: null,
        notice: null,
      };
    });
  },

  setPreviewUrl: (url) => {
    set((state) => {
      if (state.previewUrl && state.previewUrl !== url) {
        URL.revokeObjectURL(state.previewUrl);
      }

      return { previewUrl: url };
    });
  },

  pushOperation: (op) => {
    set((state) => {
      const active = state.operations.slice(0, state.historyIndex);
      const operations = [...active, op];

      return {
        operations,
        historyIndex: operations.length,
        pendingCrop: null,
        notice: null,
      };
    });
  },

  replaceAdjustment: (kind, value) => {
    set((state) => {
      const normalized = clamp(value, -1, 1);
      const operations = state.operations.slice(0, state.historyIndex);
      const existingIndex = findLastByKind(operations, kind);

      if (Math.abs(normalized) < EPSILON) {
        if (existingIndex >= 0) {
          operations.splice(existingIndex, 1);
        }
      } else {
        const op = { kind, value: normalized } as EditOp;
        if (existingIndex >= 0) {
          operations[existingIndex] = op;
        } else {
          operations.push(op);
        }
      }

      return {
        operations,
        historyIndex: operations.length,
        notice: null,
      };
    });
  },

  undo: () => {
    set((state) => ({
      historyIndex: Math.max(0, state.historyIndex - 1),
      pendingCrop: null,
      notice: null,
    }));
  },

  redo: () => {
    set((state) => ({
      historyIndex: Math.min(state.operations.length, state.historyIndex + 1),
      pendingCrop: null,
      notice: null,
    }));
  },

  getActiveOps: () => {
    const state = get();
    return state.operations.slice(0, state.historyIndex);
  },

  setActiveTool: (tool) => set({ activeTool: tool, pendingCrop: tool === 'crop' ? get().pendingCrop : null }),

  setZoom: (value) => set({ zoom: clamp(value, 0.1, 8) }),

  zoomBy: (delta) => {
    set((state) => ({
      zoom: clamp(state.zoom + delta, 0.1, 8),
    }));
  },

  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),

  setPan: (x, y) => set({ panX: x, panY: y }),

  setPendingCrop: (crop) => set({ pendingCrop: crop }),

  setResizeDraft: (patch) => {
    set((state) => ({
      resizeDraft: {
        ...state.resizeDraft,
        ...patch,
      },
    }));
  },

  setRendering: (value) => set({ isRendering: value }),

  setExporting: (value) => set({ isExporting: value }),

  setError: (message) => set({ error: message }),

  setNotice: (message) => set({ notice: message }),
}));

export const selectActiveOps = (state: EditorState): EditOp[] => state.operations.slice(0, state.historyIndex);

export const selectCanUndo = (state: EditorState): boolean => state.historyIndex > 0;

export const selectCanRedo = (state: EditorState): boolean => state.historyIndex < state.operations.length;

export const selectCurrentAdjustmentValue = (
  state: EditorState,
  kind: 'brightness' | 'contrast' | 'saturation',
): number => {
  const active = state.operations.slice(0, state.historyIndex);
  for (let index = active.length - 1; index >= 0; index -= 1) {
    const op = active[index];
    if (op.kind === kind) {
      return op.value;
    }
  }

  return 0;
};
