use crate::models::annotation::Annotation;

#[derive(Debug, PartialEq, toasty::Embed, serde::Serialize, serde::Deserialize)]
pub enum ImageType {
    File,
    Slice,
}

#[derive(Debug, toasty::Model, serde::Serialize)]
pub struct Image {
    #[key]
    pub hash: String,

    pub image_name: Option<String>,

    pub width: i32,

    pub height: i32,

    pub image_type: ImageType,

    #[index]
    pub volume_id: Option<String>,

    pub slice_index: Option<i32>,

    pub mask_hash: Option<String>,

    #[serde(skip)]
    #[has_many]
    pub annotations: Vec<Annotation>,
}
