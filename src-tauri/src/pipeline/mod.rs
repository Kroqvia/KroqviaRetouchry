use std::fs::{self, File};
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

use fast_image_resize as fir;
use fir::images::Image as FirImage;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ImageFormat, RgbaImage};
use palette::{FromColor, Hsl, Srgb};
use rayon::prelude::*;

use crate::models::{
    AppError, EditOp, ExportRequest, FlipAxis, ImageMeta, ResizeMode, SupportedFormat, MAX_IMAGE_DIMENSION,
};

#[cfg(test)]
mod tests;

const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];
const JPEG_SIGNATURE: [u8; 3] = [255, 216, 255];
const RIFF_SIGNATURE: [u8; 4] = [82, 73, 70, 70];
const WEBP_SIGNATURE: [u8; 4] = [87, 69, 66, 80];

pub fn validate_path(path: &str) -> Result<(), AppError> {
    let canonical = canonicalize_input(path)?;
    ensure_supported_extension(&canonical)?;
    ensure_magic_matches(&canonical)?;
    Ok(())
}

pub fn open_image(path: &str) -> Result<ImageMeta, AppError> {
    let canonical = canonicalize_input(path)?;
    let ext_format = ensure_supported_extension(&canonical)?;
    let magic_format = ensure_magic_matches(&canonical)?;

    if !format_matches(ext_format, magic_format) {
        return Err(AppError::unsupported(format!(
            "File extension and content mismatch: extension is {}, content is {}",
            ext_format.as_extension(),
            magic_format.as_extension()
        )));
    }

    let image = image::open(&canonical).map_err(|error| AppError::decode(error.to_string()))?;
    assert_dimension_limit(image.width(), image.height())?;

    Ok(ImageMeta {
        width: image.width(),
        height: image.height(),
        format: ext_format,
        has_alpha: ext_format.has_alpha_from_color(image.color()),
    })
}

pub fn render_preview(path: &str, ops: &[EditOp], max_width: u32, max_height: u32) -> Result<Vec<u8>, AppError> {
    let canonical = canonicalize_input(path)?;
    let mut image = load_image(&canonical)?;
    image = apply_ops(image, ops)?;

    let max_width = max_width.max(1);
    let max_height = max_height.max(1);

    let image = downsample_for_preview(image, max_width, max_height)?;

    let mut cursor = Cursor::new(Vec::new());
    image
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|error| AppError::decode(error.to_string()))?;

    Ok(cursor.into_inner())
}

pub fn export_image(req: &ExportRequest) -> Result<ImageMeta, AppError> {
    let canonical_source = canonicalize_input(&req.source_path)?;
    let mut image = load_image(&canonical_source)?;
    image = apply_ops(image, &req.ops)?;

    assert_dimension_limit(image.width(), image.height())?;

    let output = normalize_output_path(&req.out_path)?;
    let parent = output.parent().ok_or_else(|| AppError::export("Output path has no parent directory"))?;
    if !parent.exists() {
        return Err(AppError::export(format!(
            "Output directory does not exist: {}",
            parent.display()
        )));
    }

    match req.format {
        SupportedFormat::Png => image
            .save_with_format(&output, ImageFormat::Png)
            .map_err(|error| AppError::export(error.to_string()))?,
        SupportedFormat::Webp => image
            .save_with_format(&output, ImageFormat::WebP)
            .map_err(|error| AppError::export(error.to_string()))?,
        SupportedFormat::Jpeg => {
            let quality = req.quality.unwrap_or(92).clamp(1, 100);
            let file = File::create(&output)
                .map_err(|error| AppError::export(format!("Cannot create output file: {error}")))?;
            let mut encoder = JpegEncoder::new_with_quality(file, quality);
            encoder
                .encode_image(&image)
                .map_err(|error| AppError::export(error.to_string()))?;
        }
    }

    Ok(ImageMeta {
        width: image.width(),
        height: image.height(),
        format: req.format,
        has_alpha: req.format.has_alpha_from_color(image.color()),
    })
}

fn load_image(path: &Path) -> Result<DynamicImage, AppError> {
    let ext_format = ensure_supported_extension(path)?;
    let magic_format = ensure_magic_matches(path)?;

    if !format_matches(ext_format, magic_format) {
        return Err(AppError::unsupported(format!(
            "File extension and content mismatch: extension is {}, content is {}",
            ext_format.as_extension(),
            magic_format.as_extension()
        )));
    }

    let image = image::open(path).map_err(|error| AppError::decode(error.to_string()))?;
    assert_dimension_limit(image.width(), image.height())?;
    Ok(image)
}

fn apply_ops(mut image: DynamicImage, ops: &[EditOp]) -> Result<DynamicImage, AppError> {
    for op in ops {
        match op {
            EditOp::Crop { x, y, width, height } => {
                if *width == 0 || *height == 0 {
                    return Err(AppError::invalid_op("Crop width and height must be greater than zero"));
                }

                let right = x.checked_add(*width).ok_or_else(|| AppError::invalid_op("Crop exceeds image width"))?;
                let bottom = y
                    .checked_add(*height)
                    .ok_or_else(|| AppError::invalid_op("Crop exceeds image height"))?;

                if right > image.width() || bottom > image.height() {
                    return Err(AppError::invalid_op("Crop rectangle is outside the image bounds"));
                }

                image = image.crop_imm(*x, *y, *width, *height);
            }
            EditOp::Resize { width, height, mode } => {
                if *width == 0 || *height == 0 {
                    return Err(AppError::invalid_op("Resize width and height must be greater than zero"));
                }

                assert_dimension_limit(*width, *height)?;

                image = match mode {
                    ResizeMode::Fit => image.resize(*width, *height, FilterType::Lanczos3),
                    ResizeMode::Fill => image.resize_to_fill(*width, *height, FilterType::Lanczos3),
                    ResizeMode::Stretch => image.resize_exact(*width, *height, FilterType::Lanczos3),
                };
            }
            EditOp::Rotate { degrees } => {
                image = match degrees {
                    90 => image.rotate90(),
                    180 => image.rotate180(),
                    270 => image.rotate270(),
                    _ => {
                        return Err(AppError::invalid_op(
                            "Rotate degrees must be one of 90, 180, or 270",
                        ))
                    }
                };
            }
            EditOp::Flip { axis } => {
                image = match axis {
                    FlipAxis::Horizontal => image.fliph(),
                    FlipAxis::Vertical => image.flipv(),
                };
            }
            EditOp::Brightness { value } => {
                let value = clamp_adjustment(*value);
                let amount = (value * 255.0).round() as i32;
                image = image.brighten(amount);
            }
            EditOp::Contrast { value } => {
                let value = clamp_adjustment(*value);
                image = image.adjust_contrast(value * 100.0);
            }
            EditOp::Saturation { value } => {
                let value = clamp_adjustment(*value);
                image = adjust_saturation(image, value)?;
            }
        }

        assert_dimension_limit(image.width(), image.height())?;
    }

    Ok(image)
}

fn clamp_adjustment(value: f32) -> f32 {
    value.clamp(-1.0, 1.0)
}

fn adjust_saturation(image: DynamicImage, value: f32) -> Result<DynamicImage, AppError> {
    let mut rgba = image.to_rgba8();
    let factor = (1.0 + value).max(0.0);

    rgba.par_chunks_mut(4).for_each(|pixel| {
        let source = Srgb::new(
            pixel[0] as f32 / 255.0,
            pixel[1] as f32 / 255.0,
            pixel[2] as f32 / 255.0,
        );

        let mut hsl: Hsl = Hsl::from_color(source);
        hsl.saturation = (hsl.saturation * factor).clamp(0.0, 1.0);
        let adjusted = Srgb::from_color(hsl);

        pixel[0] = (adjusted.red.clamp(0.0, 1.0) * 255.0).round() as u8;
        pixel[1] = (adjusted.green.clamp(0.0, 1.0) * 255.0).round() as u8;
        pixel[2] = (adjusted.blue.clamp(0.0, 1.0) * 255.0).round() as u8;
    });

    Ok(DynamicImage::ImageRgba8(rgba))
}

fn downsample_for_preview(image: DynamicImage, max_width: u32, max_height: u32) -> Result<DynamicImage, AppError> {
    if image.width() <= max_width && image.height() <= max_height {
        return Ok(image);
    }

    let scale = f32::min(max_width as f32 / image.width() as f32, max_height as f32 / image.height() as f32);
    let target_width = ((image.width() as f32) * scale).round().max(1.0) as u32;
    let target_height = ((image.height() as f32) * scale).round().max(1.0) as u32;

    fast_resize(image, target_width, target_height)
}

fn fast_resize(image: DynamicImage, target_width: u32, target_height: u32) -> Result<DynamicImage, AppError> {
    let rgba = image.to_rgba8();
    let source_width = rgba.width();
    let source_height = rgba.height();

    let src = FirImage::from_vec_u8(source_width, source_height, rgba.into_raw(), fir::PixelType::U8x4)
        .map_err(|error| AppError::oom(format!("Failed allocating source preview buffer: {error}")))?;

    let mut dst = FirImage::new(target_width, target_height, fir::PixelType::U8x4);
    let mut resizer = fir::Resizer::new();
    let options = fir::ResizeOptions::new().resize_alg(fir::ResizeAlg::Convolution(fir::FilterType::Lanczos3));

    resizer
        .resize(&src, &mut dst, Some(&options))
        .map_err(|error| AppError::oom(format!("Failed resizing preview buffer: {error}")))?;

    let resized = RgbaImage::from_raw(target_width, target_height, dst.into_vec())
        .ok_or_else(|| AppError::oom("Failed to convert resized preview image"))?;

    Ok(DynamicImage::ImageRgba8(resized))
}

fn canonicalize_input(path: &str) -> Result<PathBuf, AppError> {
    let canonical = fs::canonicalize(path).map_err(|error| {
        AppError::io(format!(
            "Cannot access input path '{}': {}",
            path,
            error
        ))
    })?;

    let metadata = fs::metadata(&canonical).map_err(|error| {
        AppError::io(format!(
            "Cannot read input path '{}': {}",
            canonical.display(),
            error
        ))
    })?;

    if !metadata.is_file() {
        return Err(AppError::io(format!(
            "Input path is not a file: {}",
            canonical.display()
        )));
    }

    Ok(canonical)
}

fn normalize_output_path(path: &str) -> Result<PathBuf, AppError> {
    let output = PathBuf::from(path);
    if output.as_os_str().is_empty() {
        return Err(AppError::export("Output path must not be empty"));
    }

    if output.is_absolute() {
        return Ok(output);
    }

    let cwd = std::env::current_dir().map_err(|error| AppError::export(error.to_string()))?;
    Ok(cwd.join(output))
}

fn ensure_supported_extension(path: &Path) -> Result<SupportedFormat, AppError> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::unsupported(format!("Missing file extension: {}", path.display())))?;

    SupportedFormat::from_extension(extension).ok_or_else(|| {
        AppError::unsupported(format!(
            "Unsupported file extension '{}'. Supported formats: png, jpeg, webp",
            extension
        ))
    })
}

fn ensure_magic_matches(path: &Path) -> Result<SupportedFormat, AppError> {
    let mut file = File::open(path).map_err(|error| {
        AppError::io(format!(
            "Cannot open input file '{}': {}",
            path.display(),
            error
        ))
    })?;

    let mut header = [0_u8; 12];
    let read = file
        .read(&mut header)
        .map_err(|error| AppError::io(format!("Cannot read input file '{}': {}", path.display(), error)))?;

    if read < 12 {
        return Err(AppError::decode(format!(
            "Input file '{}' is too small to identify format",
            path.display()
        )));
    }

    if header[0..8] == PNG_SIGNATURE {
        return Ok(SupportedFormat::Png);
    }

    if header[0..3] == JPEG_SIGNATURE {
        return Ok(SupportedFormat::Jpeg);
    }

    if header[0..4] == RIFF_SIGNATURE && header[8..12] == WEBP_SIGNATURE {
        return Ok(SupportedFormat::Webp);
    }

    Err(AppError::unsupported(format!(
        "Unsupported image signature for file '{}'",
        path.display()
    )))
}

fn format_matches(ext_format: SupportedFormat, magic_format: SupportedFormat) -> bool {
    ext_format == magic_format
}

fn assert_dimension_limit(width: u32, height: u32) -> Result<(), AppError> {
    if width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION {
        return Err(AppError::invalid_op(format!(
            "Image dimensions exceed limit of {} pixels per side",
            MAX_IMAGE_DIMENSION
        )));
    }

    Ok(())
}
