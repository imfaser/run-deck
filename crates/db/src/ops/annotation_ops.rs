use std::collections::HashMap;
use std::collections::HashSet;

use anyhow::{bail, Result};

use crate::models::annotation::{Annotation, AnnotationBox, BoxType, PointSign};
use crate::models::image::{Image, ImageType};
use crate::models::label::Label;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PointInput {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub sign: PointSign,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BoxInput {
    pub id: String,
    pub box_type: BoxType,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AnnotationInput {
    pub id: String,
    pub label_id: uuid::Uuid,
    pub boxes: Vec<BoxInput>,
    pub points: Vec<PointInput>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotationCount {
    pub image_hash: String,
    pub slice_index: Option<i32>,
    pub annotation_count: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NearestVisual {
    pub box_id: String,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    pub image_hash: String,
    pub slice_index: Option<i32>,
    pub image_name: Option<String>,
}

fn validate_unique_ids(annotations: &[AnnotationInput]) -> Result<()> {
    let mut seen_anns = HashSet::new();
    let mut seen_boxes = HashSet::new();
    let mut seen_points = HashSet::new();

    for a in annotations {
        if !seen_anns.insert(&a.id) {
            bail!("duplicate annotation id: {}", a.id);
        }
        for b in &a.boxes {
            if !seen_boxes.insert(&b.id) {
                bail!("duplicate box id: {}", b.id);
            }
        }
        for p in &a.points {
            if !seen_points.insert(&p.id) {
                bail!("duplicate point id: {}", p.id);
            }
        }
    }

    Ok(())
}

fn validate_visual_box_constraint(annotations: &[AnnotationInput]) -> Result<()> {
    let mut visual_counts: HashMap<&uuid::Uuid, u32> = HashMap::new();

    for a in annotations {
        for b in &a.boxes {
            if matches!(b.box_type, BoxType::Visual) {
                *visual_counts.entry(&a.label_id).or_insert(0) += 1;
            }
        }
    }

    for (label_id, count) in &visual_counts {
        if *count > 1 {
            bail!(
                "visual box constraint violated: label {} has {} visual boxes (max 1)",
                label_id,
                count
            );
        }
    }

    Ok(())
}

pub async fn set_annotations(
    db: &mut toasty::Db,
    hash: &str,
    annotations: Vec<AnnotationInput>,
) -> Result<Image> {
    Image::get_by_hash(db, &hash.to_string()).await?;

    validate_unique_ids(&annotations)?;
    validate_visual_box_constraint(&annotations)?;

    let mut tx = db.transaction().await?;

    let old_annotations = Annotation::filter_by_image_id(&hash.to_string())
        .exec(&mut tx)
        .await?;
    for anno in old_annotations {
        anno.delete().exec(&mut tx).await?;
    }

    for input in annotations {
        let label = Label::get_by_id(&mut tx, &input.label_id).await?;
        let anno = toasty::create!(Annotation {
            id: &input.id,
            image: Image::get_by_hash(&mut tx, &hash.to_string()).await?,
            label,
        })
        .exec(&mut tx)
        .await?;

        for b in &input.boxes {
            toasty::create!(in anno.boxes() {
                id: &b.id,
                box_type: &b.box_type,
                x1: b.x1,
                y1: b.y1,
                x2: b.x2,
                y2: b.y2,
            })
            .exec(&mut tx)
            .await?;
        }

        for p in &input.points {
            toasty::create!(in anno.points() {
                id: &p.id,
                x: p.x,
                y: p.y,
                sign: &p.sign,
            })
            .exec(&mut tx)
            .await?;
        }
    }

    tx.commit().await?;

    let image = Image::get_by_hash(db, &hash.to_string()).await?;
    Ok(image)
}

pub async fn list_annotations_by_image(
    db: &mut toasty::Db,
    hash: &str,
) -> Result<Vec<Annotation>> {
    let annotations = Annotation::filter(Annotation::fields().image_id().eq(hash.to_string()))
        .exec(db)
        .await?;
    Ok(annotations)
}

pub async fn list_annotation_counts(
    db: &mut toasty::Db,
    volume_id: &str,
) -> Result<Vec<AnnotationCount>> {
    let images = Image::filter(Image::fields().volume_id().eq(Some(volume_id.to_string())))
        .exec(db)
        .await?;

    let mut counts = Vec::new();
    for image in images {
        let count = Annotation::filter(Annotation::fields().image_id().eq(image.hash.clone()))
            .count()
            .exec(db)
            .await?;
        if count > 0 {
            counts.push(AnnotationCount {
                image_hash: image.hash,
                slice_index: image.slice_index,
                annotation_count: count,
            });
        }
    }

    counts.sort_by_key(|c| c.slice_index.unwrap_or(0));

    Ok(counts)
}

pub async fn nearest_visual_box(
    db: &mut toasty::Db,
    image_hash: &str,
    label_id: uuid::Uuid,
) -> Result<Option<NearestVisual>> {
    let image = Image::get_by_hash(db, &image_hash.to_string()).await?;

    let candidates: Vec<(String, Option<i32>, Option<String>, AnnotationBox)> =
        match image.image_type {
            ImageType::Slice => {
                let volume_id = image.volume_id.clone().unwrap_or_default();
                let images = Image::filter(Image::fields().volume_id().eq(Some(volume_id)))
                    .exec(db)
                    .await?;

                let mut candidates = Vec::new();
                for img in images {
                    if img.hash == image_hash {
                        continue;
                    }
                    let annos =
                        Annotation::filter(Annotation::fields().image_id().eq(img.hash.clone()))
                            .exec(db)
                            .await?;
                    for anno in annos {
                        let boxes = AnnotationBox::filter(
                            AnnotationBox::fields()
                                .annotation_id()
                                .eq(anno.id.clone()),
                        )
                        .exec(db)
                        .await?;
                        for b in boxes {
                            if matches!(b.box_type, BoxType::Visual) && anno.label_id == label_id
                            {
                                candidates.push((
                                    img.hash.clone(),
                                    img.slice_index,
                                    img.image_name.clone(),
                                    b,
                                ));
                            }
                        }
                    }
                }
                candidates
            }
            ImageType::File => {
                let images = Image::filter(Image::fields().image_type().eq(ImageType::File))
                    .exec(db)
                    .await?;

                let mut candidates = Vec::new();
                for img in images {
                    if img.hash == image_hash {
                        continue;
                    }
                    let annos =
                        Annotation::filter(Annotation::fields().image_id().eq(img.hash.clone()))
                            .exec(db)
                            .await?;
                    for anno in annos {
                        let boxes = AnnotationBox::filter(
                            AnnotationBox::fields()
                                .annotation_id()
                                .eq(anno.id.clone()),
                        )
                        .exec(db)
                        .await?;
                        for b in boxes {
                            if matches!(b.box_type, BoxType::Visual) && anno.label_id == label_id
                            {
                                candidates.push((
                                    img.hash.clone(),
                                    img.slice_index,
                                    img.image_name.clone(),
                                    b,
                                ));
                            }
                        }
                    }
                }
                candidates
            }
        };

    if candidates.is_empty() {
        return Ok(None);
    }

    let result = match image.image_type {
        ImageType::Slice => {
            let current_slice = image.slice_index.unwrap_or(0);
            candidates
                .into_iter()
                .min_by_key(|(_, s, _, _)| {
                    let s = s.unwrap_or(0);
                    (s - current_slice).unsigned_abs() as u64
                })
                .map(|(hash, si, name, b)| NearestVisual {
                    box_id: b.id.clone(),
                    x1: b.x1,
                    y1: b.y1,
                    x2: b.x2,
                    y2: b.y2,
                    image_hash: hash,
                    slice_index: si,
                    image_name: name,
                })
        }
        ImageType::File => {
            let current_name = image.image_name.clone().unwrap_or_default();
            candidates
                .into_iter()
                .min_by_key(|(_, _, name, _)| {
                    let n = name.clone().unwrap_or_default();
                    n.cmp(&current_name)
                })
                .map(|(hash, si, name, b)| NearestVisual {
                    box_id: b.id.clone(),
                    x1: b.x1,
                    y1: b.y1,
                    x2: b.x2,
                    y2: b.y2,
                    image_hash: hash,
                    slice_index: si,
                    image_name: name,
                })
        }
    };

    Ok(result)
}
