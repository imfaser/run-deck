use crate::models::label::Label;

#[derive(Debug, Clone, PartialEq, toasty::Embed, serde::Serialize, serde::Deserialize)]
pub enum BoxType {
    #[column(variant = "annotate")]
    Annotate,
    #[column(variant = "visual")]
    Visual,
}

#[derive(Debug, Clone, PartialEq, toasty::Embed, serde::Serialize, serde::Deserialize)]
pub enum PointSign {
    #[column(variant = "positive")]
    Positive,
    #[column(variant = "negative")]
    Negative,
}

#[derive(Debug, toasty::Model, serde::Serialize)]
pub struct Annotation {
    #[key]
    pub id: String,

    #[index]
    pub image_id: String,

    #[serde(skip)]
    #[belongs_to(key = image_id, references = hash)]
    pub image: toasty::Deferred<crate::models::image::Image>,

    #[index]
    pub label_id: uuid::Uuid,

    #[serde(skip)]
    #[belongs_to(key = label_id, references = id)]
    pub label: toasty::Deferred<Label>,

    #[has_many]
    pub boxes: Vec<AnnotationBox>,

    #[has_many]
    pub points: Vec<AnnotationPoint>,
}

#[derive(Debug, toasty::Model, serde::Serialize)]
pub struct AnnotationBox {
    #[key]
    pub id: String,

    #[index]
    pub annotation_id: String,

    #[serde(skip)]
    #[belongs_to(key = annotation_id, references = id)]
    pub annotation: toasty::Deferred<Annotation>,

    pub box_type: BoxType,

    pub x1: f64,

    pub y1: f64,

    pub x2: f64,

    pub y2: f64,
}

#[derive(Debug, toasty::Model, serde::Serialize)]
pub struct AnnotationPoint {
    #[key]
    pub id: String,

    #[index]
    pub annotation_id: String,

    #[serde(skip)]
    #[belongs_to(key = annotation_id, references = id)]
    pub annotation: toasty::Deferred<Annotation>,

    pub x: f64,

    pub y: f64,

    pub sign: PointSign,
}
