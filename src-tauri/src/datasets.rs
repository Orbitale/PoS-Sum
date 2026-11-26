use std::collections::HashMap;

use rusqlite::{params, Connection};

use crate::db::CONFIG_DEFAULTS;
use crate::models::{Category, OrderItem, OrderWithItems, Product};

#[derive(Debug, serde::Deserialize)]
pub struct DefaultDatasetFile {
    pub categories: Vec<Category>,
    pub products: Vec<Product>,
    #[serde(default)]
    pub orders: Vec<OrderWithItems>,
    #[serde(default)]
    pub configuration: HashMap<String, String>,
}

const SNACKBAR_JSON: &str = include_str!("../../datasets/snackbar.json");
const CLOTHING_JSON: &str = include_str!("../../datasets/clothing.json");

pub fn dataset_json(name: &str) -> Result<&'static str, String> {
    match name {
        "snackbar" => Ok(SNACKBAR_JSON),
        "clothing" => Ok(CLOTHING_JSON),
        other => Err(format!("Unknown default dataset: {other}")),
    }
}

fn order_vat_total_cents(items: &[OrderItem]) -> i64 {
    let raw: f64 = items
        .iter()
        .filter(|item| item.vat != 0.0 && item.total != 0)
        .map(|item| (item.total as f64) * item.vat / 100.0)
        .sum();
    raw.round() as i64
}

pub fn load_default_dataset(conn: &mut Connection, dataset: &str) -> Result<(), String> {
    let json = dataset_json(dataset)?;
    let data: DefaultDatasetFile = serde_json::from_str(json)
        .map_err(|e| format!("Failed to parse dataset '{dataset}': {e}"))?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Transaction begin error: {e}"))?;

    tx.execute_batch(
        "DELETE FROM order_items;
         DELETE FROM orders;
         DELETE FROM products;
         DELETE FROM categories;",
    )
    .map_err(|e| format!("Failed to clear catalog: {e}"))?;

    for category in &data.categories {
        tx.execute(
            "INSERT INTO categories (id, label, color) VALUES (?1, ?2, ?3)",
            params![category.id, category.label, category.color],
        )
        .map_err(|e| format!("Failed to insert category: {e}"))?;
    }

    for product in &data.products {
        let available_int: i64 = if product.available { 1 } else { 0 };
        let fixed_price_int: i64 = if product.fixed_price { 1 } else { 0 };
        tx.execute(
            "INSERT INTO products (id, name, price, category_id, available, fixed_price, vat)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                product.id,
                product.name,
                product.price,
                product.category_id,
                available_int,
                fixed_price_int,
                product.vat
            ],
        )
        .map_err(|e| format!("Failed to insert product: {e}"))?;
    }

    for order in &data.orders {
        let vat_total = if order.order.vat_total != 0 || order.items.is_empty() {
            order.order.vat_total
        } else {
            order_vat_total_cents(&order.items)
        };
        tx.execute(
            "INSERT INTO orders (id, created_at, total, vat_total, payment_method, weight, customer_details)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                order.order.id,
                order.order.created_at,
                order.order.total,
                vat_total,
                order.order.payment_method.as_db_str(),
                order.order.weight,
                order.order.customer_details,
            ],
        )
        .map_err(|e| format!("Failed to insert order: {e}"))?;

        for item in &order.items {
            tx.execute(
                "INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, total, comment, vat)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    item.id,
                    item.order_id,
                    item.product_id,
                    item.product_name,
                    item.unit_price,
                    item.quantity,
                    item.total,
                    item.comment,
                    item.vat
                ],
            )
            .map_err(|e| format!("Failed to insert order item: {e}"))?;
        }
    }

    tx.commit()
        .map_err(|e| format!("Transaction commit error: {e}"))?;

    crate::db::ensure_configuration_defaults(conn);

    for (id, value) in &data.configuration {
        let known = CONFIG_DEFAULTS.iter().any(|(key, _, _)| *key == id.as_str());
        if !known {
            return Err(format!("Unknown configuration override: {id}"));
        }
        let updated = conn
            .execute(
                "UPDATE configuration SET value = ?1 WHERE id = ?2",
                params![value, id],
            )
            .map_err(|e| format!("Failed to update configuration: {e}"))?;
        if updated == 0 {
            return Err(format!("Configuration not found: {id}"));
        }
    }

    Ok(())
}