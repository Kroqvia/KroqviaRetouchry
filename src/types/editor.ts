export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface ImageMeta {
  width: number;
  height: number;
  format: ImageFormat;
  hasAlpha: boolean;
}

export type ResizeMode = 'fit' | 'fill' | 'stretch';

export type FlipAxis = 'horizontal' | 'vertical';

export interface CropOp {
  kind: 'crop';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeOp {
  kind: 'resize';
  width: number;
  height: number;
  mode: ResizeMode;
}

export interface RotateOp {
  kind: 'rotate';
  degrees: 90 | 180 | 270;
}

export interface FlipOp {
  kind: 'flip';
  axis: FlipAxis;
}

export interface BrightnessOp {
  kind: 'brightness';
  value: number;
}

export interface ContrastOp {
  kind: 'contrast';
  value: number;
}

export interface SaturationOp {
  kind: 'saturation';
  value: number;
}

export type EditOp = CropOp | ResizeOp | RotateOp | FlipOp | BrightnessOp | ContrastOp | SaturationOp;

export interface ExportRequest {
  sourcePath: string;
  ops: EditOp[];
  outPath: string;
  format: ImageFormat;
  quality?: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ToolName = 'crop' | 'transform' | 'adjust';

export interface AppError {
  code: 'IO_ERROR' | 'DECODE_ERROR' | 'UNSUPPORTED_FORMAT' | 'INVALID_OP' | 'OUT_OF_MEMORY' | 'EXPORT_ERROR';
  message: string;
}
