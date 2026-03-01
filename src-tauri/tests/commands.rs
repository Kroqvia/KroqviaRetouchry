use std::fs;
use std::path::{Path, PathBuf};

use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use kroqvia_retouchry_lib::commands;
use kroqvia_retouchry_lib::models::{EditOp, ExportRequest, ResizeMode, SupportedFormat};
use tempfile::tempdir;

fn fixture_image() -> DynamicImage {
    let mut image = RgbaImage::new(16, 12);
    for y in 0..12 {
        for x in 0..16 {
            image.put_pixel(x, y, Rgba([((x * 9) % 255) as u8, ((y * 17) % 255) as u8, 80, 255]));
        }
    }

    DynamicImage::ImageRgba8(image)
}

fn write_image(path: &Path, format: ImageFormat) {
    fixture_image()
        .save_with_format(path, format)
        .expect("failed to write fixture image");
}

fn read_magic(path: &Path) -> Vec<u8> {
    let data = fs::read(path).expect("failed to read file");
    data.into_iter().take(12).collect()
}

fn temp_path(dir: &Path, name: &str) -> String {
    dir.join(name).to_string_lossy().into_owned()
}

#[test]
fn open_supported_formats_returns_metadata() {
    let temp = tempdir().expect("tempdir");

    let png = temp.path().join("sample.png");
    let jpg = temp.path().join("sample.jpeg");
    let webp = temp.path().join("sample.webp");

    write_image(&png, ImageFormat::Png);
    write_image(&jpg, ImageFormat::Jpeg);
    write_image(&webp, ImageFormat::WebP);

    let png_meta = commands::open_image(png.to_string_lossy().into_owned()).expect("open png");
    let jpg_meta = commands::open_image(jpg.to_string_lossy().into_owned()).expect("open jpeg");
    let webp_meta = commands::open_image(webp.to_string_lossy().into_owned()).expect("open webp");

    assert_eq!(png_meta.width, 16);
    assert_eq!(png_meta.height, 12);
    assert_eq!(png_meta.format, SupportedFormat::Png);
    assert_eq!(jpg_meta.format, SupportedFormat::Jpeg);
    assert_eq!(webp_meta.format, SupportedFormat::Webp);
}

#[test]
fn reject_corrupt_and_unsupported_files() {
    let temp = tempdir().expect("tempdir");

    let corrupt_png = temp.path().join("corrupt.png");
    let mut corrupt_payload = vec![137, 80, 78, 71, 13, 10, 26, 10];
    corrupt_payload.extend_from_slice(b"broken-payload");
    fs::write(&corrupt_png, corrupt_payload).expect("write corrupt png");

    let text_file = temp.path().join("sample.txt");
    fs::write(&text_file, b"hello").expect("write txt");

    let corrupt_err = commands::open_image(corrupt_png.to_string_lossy().into_owned()).expect_err("corrupt should fail");
    let unsupported_err = commands::open_image(text_file.to_string_lossy().into_owned()).expect_err("txt should fail");

    assert_eq!(corrupt_err.code, "DECODE_ERROR");
    assert_eq!(unsupported_err.code, "UNSUPPORTED_FORMAT");
}

#[test]
fn export_formats_write_expected_magic_and_dimensions() {
    let temp = tempdir().expect("tempdir");
    let input = temp.path().join("input.png");
    write_image(&input, ImageFormat::Png);

    let ops = vec![
        EditOp::Resize {
            width: 8,
            height: 6,
            mode: ResizeMode::Stretch,
        },
        EditOp::Contrast { value: 0.2 },
    ];

    let destinations: Vec<(PathBuf, SupportedFormat)> = vec![
        (temp.path().join("out.png"), SupportedFormat::Png),
        (temp.path().join("out.jpg"), SupportedFormat::Jpeg),
        (temp.path().join("out.webp"), SupportedFormat::Webp),
    ];

    for (path, format) in destinations {
        let meta = commands::export_image(ExportRequest {
            source_path: input.to_string_lossy().into_owned(),
            ops: ops.clone(),
            out_path: path.to_string_lossy().into_owned(),
            format,
            quality: Some(88),
        })
        .expect("export should succeed");

        assert_eq!(meta.width, 8);
        assert_eq!(meta.height, 6);
        assert_eq!(meta.format, format);

        let magic = read_magic(&path);
        match format {
            SupportedFormat::Png => assert_eq!(magic[0..8], [137, 80, 78, 71, 13, 10, 26, 10]),
            SupportedFormat::Jpeg => assert_eq!(magic[0..3], [255, 216, 255]),
            SupportedFormat::Webp => {
                assert_eq!(magic[0..4], [82, 73, 70, 70]);
                assert_eq!(magic[8..12], [87, 69, 66, 80]);
            }
        }
    }
}

#[test]
fn render_preview_returns_png_bytes() {
    let temp = tempdir().expect("tempdir");
    let input = temp.path().join("preview.png");
    write_image(&input, ImageFormat::Png);

    let bytes = commands::render_preview(
        input.to_string_lossy().into_owned(),
        vec![EditOp::Brightness { value: 0.2 }],
        6,
        6,
    )
    .expect("render preview");

    assert!(bytes.len() > 8);
    assert_eq!(bytes[0..8], [137, 80, 78, 71, 13, 10, 26, 10]);
}

#[test]
fn validate_path_accepts_supported_image_files() {
    let temp = tempdir().expect("tempdir");
    let input = temp.path().join("valid.webp");
    write_image(&input, ImageFormat::WebP);

    commands::validate_path(temp_path(temp.path(), "valid.webp")).expect("path should validate");
}
