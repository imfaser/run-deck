pub mod models;
pub mod ops;

use anyhow::Result;

pub async fn init_db() -> Result<toasty::Db> {
    let db = toasty::Db::builder()
        .models(toasty::models!(crate::*))
        .connect("turso::memory:")
        .await?;
    db.push_schema().await?;
    Ok(db)
}
