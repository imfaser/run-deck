use anyhow::Result;

use crate::models::annotation::{Annotation, AnnotationBox, AnnotationPoint};
use crate::models::image::Image;
use crate::models::volume::Volume;

pub async fn create_or_get_volume(
    db: &mut toasty::Db,
    id: &str,
    x: i32,
    y: i32,
    z: i32,
    dtype: &str,
    endian: &str,
    axis: &str,
) -> Result<Volume> {
    match Volume::get_by_id(db, &id.to_string()).await {
        Ok(existing) => Ok(existing),
        Err(_) => {
            let volume = toasty::create!(Volume {
                id,
                x,
                y,
                z,
                dtype,
                endian,
                axis,
            })
            .exec(db)
            .await?;
            Ok(volume)
        }
    }
}

pub async fn get_volume(db: &mut toasty::Db, id: &str) -> Result<Option<Volume>> {
    match Volume::get_by_id(db, &id.to_string()).await {
        Ok(volume) => Ok(Some(volume)),
        Err(_) => Ok(None),
    }
}

pub async fn delete_volume(db: &mut toasty::Db, id: &str) -> Result<()> {
    let volume = Volume::get_by_id(db, &id.to_string()).await?;
    volume.delete().exec(db).await?;
    Ok(())
}

/// 级联删除 volume 及其关联数据：boxes/points → annotations → images → volume。
///
/// toasty 的 `delete` 不级联，需要手动按依赖顺序清理。
pub async fn delete_volume_cascade(db: &mut toasty::Db, id: &str) -> Result<()> {
    let mut tx = db.transaction().await?;
    let volume = Volume::get_by_id(&mut tx, &id.to_string()).await?;

    let images = Image::filter_by_volume_id(&id.to_string()).exec(&mut tx).await?;
    for image in images {
        let annotations = Annotation::filter_by_image_id(&image.hash).exec(&mut tx).await?;
        for anno in annotations {
            let boxes = AnnotationBox::filter_by_annotation_id(&anno.id).exec(&mut tx).await?;
            for b in boxes {
                b.delete().exec(&mut tx).await?;
            }
            let points = AnnotationPoint::filter_by_annotation_id(&anno.id).exec(&mut tx).await?;
            for p in points {
                p.delete().exec(&mut tx).await?;
            }
            anno.delete().exec(&mut tx).await?;
        }
        image.delete().exec(&mut tx).await?;
    }

    volume.delete().exec(&mut tx).await?;
    tx.commit().await?;
    Ok(())
}
