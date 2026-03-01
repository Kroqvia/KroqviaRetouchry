use image::ColorType;
use serde::{Deserialize, Serialize};

pub const MAX_IMAGE_DIMENSION: u32 = 12_000;

pub const CODE_IO_ERROR: &str = "IO_ERROR";
pub const CODE_DECODE_ERROR: &str = "DECODE_ERROR";
pub const CODE_UNSUPPORTED_FORMAT: &str = "UNSUPPORTED_FORMAT";
pub const CODE_INVALID_OP: &str = "INVALID_OP";
pub const CODE_OUT_OF_MEMORY: &str = "OUT_OF_MEMORY";
pub const CODE_EXPORT_ERROR: &str = "EXPORT_ERROR";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self::new(CODE_IO_ERROR, message)
    }

    pub fn decode(message: impl Into<String>) -> Self {
        Self::new(CODE_DECODE_ERROR, message)
    }

    pub fn unsupported(message: impl Into<String>) -> Self {
        Self::new(CODE_UNSUPPORTED_FORMAT, message)
    }

    pub fn invalid_op(message: impl Into<String>) -> Self {
        Self::new(CODE_INVALID_OP, message)
    }

    pub fn oom(message: impl Into<String>) -> Self {
        Self::new(CODE_OUT_OF_MEMORY, message)
    }

    pub fn export(message: impl Into<String>) -> Self {
        Self::new(CODE_EXPORT_ERROR, message)
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SupportedFormat {
    Png,
    Jpeg,
    Webp,
}

impl SupportedFormat {
    pub fn as_extension(&self) -> &'static str {
        match self {
            Self::Png => "png",
            Self::Jpeg => "jpeg",
            Self::Webp => "webp",
        }
    }

    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_ascii_lowercase().as_str() {
            "png" => Some(Self::Png),
            "jpg" | "jpeg" => Some(Self::Jpeg),
            "webp" => Some(Self::Webp),
            _ => None,
        }
    }

    pub fn has_alpha_from_color(&self, color: ColorType) -> bool {
        match self {
            Self::Jpeg => false,
            _ => color.has_alpha(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMeta {
    pub width: u32,
    pub height: u32,
    pub format: SupportedFormat,
    pub has_alpha: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ResizeMode {
    Fit,
    Fill,
    Stretch,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FlipAxis {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum EditOp {
    Crop {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
    Resize {
        width: u32,
        height: u32,
        mode: ResizeMode,
    },
    Rotate {
        degrees: u16,
    },
    Flip {
        axis: FlipAxis,
    },
    Brightness {
        value: f32,
    },
    Contrast {
        value: f32,
    },
    Saturation {
        value: f32,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub source_path: String,
    pub ops: Vec<EditOp>,
    pub out_path: String,
    pub format: SupportedFormat,
    pub quality: Option<u8>,
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::io(value.to_string())
    }
}

impl From<image::ImageError> for AppError {
    fn from(value: image::ImageError) -> Self {
        Self::decode(value.to_string())
    }
}
