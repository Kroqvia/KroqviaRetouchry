use image::{DynamicImage, Rgba, RgbaImage};

use super::*;

fn sample_image(width: u32, height: u32) -> DynamicImage {
    let mut image = RgbaImage::new(width, height);
    for y in 0..height {
        for x in 0..width {
            image.put_pixel(x, y, Rgba([((x * 40) % 255) as u8, ((y * 60) % 255) as u8, 120, 255]));
        }
    }

    DynamicImage::ImageRgba8(image)
}

#[test]
fn operation_order_is_deterministic() {
    let image = sample_image(8, 6);
    let ops_a = vec![
        EditOp::Rotate { degrees: 90 },
        EditOp::Crop {
            x: 1,
            y: 1,
            width: 3,
            height: 3,
        },
    ];

    let ops_b = vec![
        EditOp::Crop {
            x: 1,
            y: 1,
            width: 3,
            height: 3,
        },
        EditOp::Rotate { degrees: 90 },
    ];

    let out_a = apply_ops(image.clone(), &ops_a).expect("ops_a should succeed");
    let out_b = apply_ops(image, &ops_b).expect("ops_b should succeed");

    assert_ne!(out_a.to_rgba8().into_raw(), out_b.to_rgba8().into_raw());
}

#[test]
fn adjustment_values_are_clamped() {
    let image = sample_image(2, 2);

    let extreme = apply_ops(image.clone(), &[EditOp::Brightness { value: 5.0 }]).expect("extreme should clamp");
    let clamped = apply_ops(image, &[EditOp::Brightness { value: 1.0 }]).expect("clamped should succeed");

    assert_eq!(extreme.to_rgba8().into_raw(), clamped.to_rgba8().into_raw());
}

#[test]
fn crop_bounds_are_validated() {
    let image = sample_image(5, 5);

    let error = apply_ops(
        image,
        &[EditOp::Crop {
            x: 4,
            y: 4,
            width: 3,
            height: 3,
        }],
    )
    .expect_err("crop should fail");

    assert_eq!(error.code, "INVALID_OP");
}

#[test]
fn resize_is_guarded_by_dimension_limit() {
    let image = sample_image(10, 10);

    let error = apply_ops(
        image,
        &[EditOp::Resize {
            width: MAX_IMAGE_DIMENSION + 1,
            height: 10,
            mode: ResizeMode::Stretch,
        }],
    )
    .expect_err("resize should fail");

    assert_eq!(error.code, "INVALID_OP");
}
