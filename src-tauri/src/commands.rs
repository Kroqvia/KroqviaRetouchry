use crate::models::{AppError, ExportRequest, ImageMeta, EditOp};
use crate::pipeline;

#[tauri::command]
pub fn validate_path(path: String) -> Result<(), AppError> {
    pipeline::validate_path(&path)
}

#[tauri::command]
pub fn open_image(path: String) -> Result<ImageMeta, AppError> {
    pipeline::open_image(&path)
}

#[tauri::command]
pub fn render_preview(
    path: String,
    ops: Vec<EditOp>,
    max_width: u32,
    max_height: u32,
) -> Result<Vec<u8>, AppError> {
    pipeline::render_preview(&path, &ops, max_width, max_height)
}

#[tauri::command]
pub fn export_image(req: ExportRequest) -> Result<ImageMeta, AppError> {
    pipeline::export_image(&req)
}
