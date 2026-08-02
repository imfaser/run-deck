use crate::models::annotation::Annotation;

#[derive(Debug, toasty::Model, serde::Serialize)]
pub struct Label {
    #[key]
    #[auto]
    pub id: uuid::Uuid,

    pub name: String,

    pub color: String,

    #[unique]
    pub order: i32,

    pub sub_labels: Vec<String>,

    #[serde(skip)]
    #[has_many]
    pub annotations: Vec<Annotation>,
}
