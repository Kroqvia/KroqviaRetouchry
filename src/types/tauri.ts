import type { AppError, EditOp, ExportRequest, ImageMeta } from './editor';

export interface OpenImageArgs {
  path: string;
}

export interface RenderPreviewArgs {
  path: string;
  ops: EditOp[];
  maxWidth: number;
  maxHeight: number;
}

export interface ExportImageArgs {
  req: ExportRequest;
}

export type TauriInvokeError = AppError & { name?: string; stack?: string };

export type OpenImageCommand = (args: OpenImageArgs) => Promise<ImageMeta>;
export type RenderPreviewCommand = (args: RenderPreviewArgs) => Promise<number[]>;
export type ExportImageCommand = (args: ExportImageArgs) => Promise<ImageMeta>;
