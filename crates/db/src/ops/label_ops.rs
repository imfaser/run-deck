use anyhow::Result;

use crate::models::label::Label;

pub async fn create_label(
    db: &mut toasty::Db,
    name: &str,
    color: &str,
    order: i32,
    sub_labels: Vec<String>,
) -> Result<Label> {
    if order < 1 {
        anyhow::bail!("order 必须大于等于 1");
    }
    let label = toasty::create!(Label {
        name,
        color,
        order,
        sub_labels,
    })
    .exec(db)
    .await?;
    Ok(label)
}

pub async fn list_labels(db: &mut toasty::Db) -> Result<Vec<Label>> {
    let labels = Label::all().exec(db).await?;
    Ok(labels)
}

pub async fn update_label(
    db: &mut toasty::Db,
    id: uuid::Uuid,
    name: Option<&str>,
    color: Option<&str>,
    order: Option<i32>,
    sub_labels: Option<Vec<String>>,
) -> Result<Label> {
    let mut label = Label::get_by_id(db, &id).await?;

    let mut update = label.update();
    if let Some(name) = name {
        update = update.name(name);
    }
    if let Some(color) = color {
        update = update.color(color);
    }
    if let Some(order) = order {
        if order < 1 {
            anyhow::bail!("order 必须大于等于 1");
        }
        update = update.order(order);
    }
    if let Some(subs) = sub_labels {
        update = update.sub_labels(subs);
    }
    update.exec(db).await?;

    label = Label::get_by_id(db, &id).await?;
    Ok(label)
}

pub async fn reorder_labels(
    db: &mut toasty::Db,
    id_order_pairs: Vec<(uuid::Uuid, i32)>,
) -> Result<()> {
    // 两阶段更新：先全部设为负数（避开 unique 冲突），再设为目标值。
    // 直接逐条设目标值会在 order 交换（如 1↔3）时撞 unique 约束。
    for (id, _) in &id_order_pairs {
        let mut label = Label::get_by_id(db, id).await?;
        let tmp = -label.order;
        label.update().order(tmp).exec(db).await?;
    }
    for (id, order) in id_order_pairs {
        if order < 1 {
            anyhow::bail!("order 必须大于等于 1");
        }
        let mut label = Label::get_by_id(db, &id).await?;
        label.update().order(order).exec(db).await?;
    }
    Ok(())
}

pub async fn delete_label(db: &mut toasty::Db, id: uuid::Uuid) -> Result<()> {
    let label = Label::get_by_id(db, &id).await?;
    label.delete().exec(db).await?;
    Ok(())
}
