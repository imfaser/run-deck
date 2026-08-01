use anyhow::{bail, Result};

use crate::models::image::{Image, ImageType};

#[allow(clippy::too_many_arguments)]
pub async fn upsert_image(
    db: &mut toasty::Db,
    hash: &str,
    image_name: Option<&str>,
    width: i32,
    height: i32,
    image_type: ImageType,
    volume_id: Option<&str>,
    slice_index: Option<i32>,
    mask_hash: Option<&str>,
) -> Result<Image> {
    if image_name.is_none() && slice_index.is_none() {
        bail!("image_name 和 slice_index 不能同时为空");
    }

    match Image::get_by_hash(db, &hash.to_string()).await {
        Ok(mut existing) => {
            if let Some(name) = image_name {
                existing.update().image_name(name).exec(db).await?;
            }
            if let Some(idx) = slice_index {
                existing.update().slice_index(idx).exec(db).await?;
            }
            existing.update().width(width).exec(db).await?;
            existing.update().height(height).exec(db).await?;
            if let Some(mh) = mask_hash {
                existing.update().mask_hash(mh).exec(db).await?;
            }
            existing = Image::get_by_hash(db, &hash.to_string()).await?;
            Ok(existing)
        }
        Err(_) => {
            let image = toasty::create!(Image {
                hash,
                image_name: image_name.map(String::from),
                width,
                height,
                image_type,
                volume_id: volume_id.map(String::from),
                slice_index,
                mask_hash: mask_hash.map(String::from),
            })
            .exec(db)
            .await?;
            Ok(image)
        }
    }
}

pub async fn get_image_by_hash(
    db: &mut toasty::Db,
    hash: &str,
) -> Result<Option<Image>> {
    match Image::get_by_hash(db, &hash.to_string()).await {
        Ok(img) => Ok(Some(img)),
        Err(_) => Ok(None),
    }
}

pub async fn get_image_by_name(
    db: &mut toasty::Db,
    image_name: &str,
) -> Result<Option<Image>> {
    let image = Image::filter(Image::fields().image_name().eq(Some(image_name.to_string())))
        .first()
        .exec(db)
        .await?;
    Ok(image)
}

pub async fn list_images_by_volume(
    db: &mut toasty::Db,
    volume_id: &str,
) -> Result<Vec<Image>> {
    let mut images = Image::filter_by_volume_id(&volume_id.to_string())
        .exec(db)
        .await?;

    images.sort_by(|a, b| {
        let sa = a.slice_index.unwrap_or(0);
        let sb = b.slice_index.unwrap_or(0);
        sa.cmp(&sb)
    });

    Ok(images)
}

pub async fn delete_image(db: &mut toasty::Db, hash: &str) -> Result<()> {
    let image = Image::get_by_hash(db, &hash.to_string()).await?;
    image.delete().exec(db).await?;
    Ok(())
}

pub async fn delete_images_by_volume(db: &mut toasty::Db, volume_id: &str) -> Result<()> {
    let images = Image::filter_by_volume_id(&volume_id.to_string())
        .exec(db)
        .await?;
    for image in images {
        image.delete().exec(db).await?;
    }
    Ok(())
}

pub async fn update_mask_hash(
    db: &mut toasty::Db,
    hash: &str,
    mask_hash: Option<&str>,
) -> Result<Image> {
    let mut image = Image::get_by_hash(db, &hash.to_string()).await?;
    image
        .update()
        .mask_hash(mask_hash.map(String::from))
        .exec(db)
        .await?;
    image = Image::get_by_hash(db, &hash.to_string()).await?;
    Ok(image)
}
