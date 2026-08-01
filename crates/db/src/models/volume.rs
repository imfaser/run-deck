#[derive(Debug, toasty::Model, serde::Serialize)]
pub struct Volume {
    #[key]
    pub id: String,

    pub x: i32,

    pub y: i32,

    pub z: i32,

    pub dtype: String,

    pub endian: String,

    pub axis: String,
}
