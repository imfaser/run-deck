pub async fn setup_db() -> toasty::Db {
    let db = toasty::Db::builder()
        .models(toasty::models!(db::*))
        .connect("turso::memory:")
        .await
        .expect("failed to connect to sqlite memory db");
    db.push_schema().await.expect("failed to push schema");
    db
}
