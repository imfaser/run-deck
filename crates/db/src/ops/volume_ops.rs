use anyhow::Result;

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
