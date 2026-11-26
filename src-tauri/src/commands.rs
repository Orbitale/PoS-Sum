use chrono::NaiveDateTime;
use rusqlite::backup::{Backup, StepResult};
use rusqlite::params;
use rusqlite::Connection;
use std::path::Path;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

use crate::db::DbState;
use crate::models::*;

fn order_vat_total_cents(items: &[OrderItem]) -> i64 {
    let raw: f64 = items
        .iter()
        .filter(|item| item.vat != 0.0 && item.total != 0)
        .map(|item| (item.total as f64) * item.vat / 100.0)
        .sum();
    raw.round() as i64
}

fn normalize_vat(vat: f64) -> Result<f64, String> {
    if !vat.is_finite() || vat < 0.0 || vat > 100.0 {
        return Err(format!("VAT must be between 0 and 100, got {vat}"));
    }
    let rounded = (vat * 100.0).round() / 100.0;
    if (vat - rounded).abs() > 1e-9 {
        return Err(format!(
            "VAT must have at most 2 decimal places, got {vat}"
        ));
    }
    Ok(rounded)
}

pub(crate) fn list_configuration_inner(db: &DbState) -> Result<Vec<ConfigurationEntry>, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;
    crate::db::ensure_configuration_defaults(&conn);

    let mut stmt = conn
        .prepare("SELECT id, name, value FROM configuration ORDER BY id")
        .map_err(|e| format!("Query error: {e}"))?;

    let entries = stmt
        .query_map([], |row| {
            Ok(ConfigurationEntry {
                id: row.get(0)?,
                name: row.get(1)?,
                value: row.get(2)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping error: {e}"))?;

    Ok(entries)
}

pub(crate) fn update_configuration_inner(
    db: &DbState,
    payload: UpdateConfigurationPayload,
) -> Result<ConfigurationEntry, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;
    crate::db::ensure_configuration_defaults(&conn);

    let rows_affected = conn
        .execute(
            "UPDATE configuration SET value = ?1 WHERE id = ?2",
            params![payload.value, payload.id],
        )
        .map_err(|e| format!("Update error: {e}"))?;

    if rows_affected == 0 {
        return Err(format!("Configuration not found: {}", payload.id));
    }

    conn.query_row(
        "SELECT id, name, value FROM configuration WHERE id = ?1",
        params![payload.id],
        |row| {
            Ok(ConfigurationEntry {
                id: row.get(0)?,
                name: row.get(1)?,
                value: row.get(2)?,
            })
        },
    )
    .map_err(|e| format!("Query error: {e}"))
}

pub(crate) fn list_categories_inner(db: &DbState) -> Result<Vec<Category>, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let mut stmt = conn
        .prepare("SELECT id, label, color FROM categories ORDER BY label")
        .map_err(|e| format!("Query error: {e}"))?;

    let categories = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                label: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping error: {e}"))?;

    Ok(categories)
}

pub(crate) fn create_category_inner(
    db: &DbState,
    payload: CreateCategoryPayload,
) -> Result<Category, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    conn.execute(
        "INSERT INTO categories (id, label, color) VALUES (?1, ?2, ?3)",
        params![payload.id, payload.label, payload.color],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    Ok(Category {
        id: payload.id,
        label: payload.label,
        color: payload.color,
    })
}

pub(crate) fn update_category_inner(
    db: &DbState,
    payload: UpdateCategoryPayload,
) -> Result<Category, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let rows_affected = conn
        .execute(
            "UPDATE categories SET label = ?1, color = ?2 WHERE id = ?3",
            params![payload.label, payload.color, payload.id],
        )
        .map_err(|e| format!("Update error: {e}"))?;

    if rows_affected == 0 {
        return Err(format!("Category not found: {}", payload.id));
    }

    Ok(Category {
        id: payload.id,
        label: payload.label,
        color: payload.color,
    })
}

pub(crate) fn list_products_inner(db: &DbState) -> Result<Vec<Product>, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, price, category_id, available, fixed_price, vat
             FROM products ORDER BY category_id, name",
        )
        .map_err(|e| format!("Query error: {e}"))?;

    let products = stmt
        .query_map([], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                price: row.get(2)?,
                category_id: row.get(3)?,
                available: row.get::<_, i64>(4)? != 0,
                fixed_price: row.get::<_, i64>(5)? != 0,
                vat: row.get(6)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping error: {e}"))?;

    Ok(products)
}

pub(crate) fn create_product_inner(
    db: &DbState,
    payload: CreateProductPayload,
) -> Result<Product, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let vat = normalize_vat(payload.vat)?;

    let id = Uuid::new_v4().to_string();
    let fixed_price_int: i64 = if payload.fixed_price { 1 } else { 0 };

    conn.execute(
        "INSERT INTO products (id, name, price, category_id, available, fixed_price, vat)
         VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)",
        params![
            id,
            payload.name,
            payload.price,
            payload.category_id,
            fixed_price_int,
            vat
        ],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    Ok(Product {
        id,
        name: payload.name,
        price: payload.price,
        category_id: payload.category_id,
        available: true,
        fixed_price: payload.fixed_price,
        vat,
    })
}

pub(crate) fn update_product_inner(
    db: &DbState,
    payload: UpdateProductPayload,
) -> Result<Product, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let vat = normalize_vat(payload.vat)?;

    let available_int: i64 = if payload.available { 1 } else { 0 };
    let fixed_price_int: i64 = if payload.fixed_price { 1 } else { 0 };

    let rows_affected = conn
        .execute(
            "UPDATE products SET name = ?1, price = ?2, category_id = ?3, available = ?4, fixed_price = ?5, vat = ?6
             WHERE id = ?7",
            params![
                payload.name,
                payload.price,
                payload.category_id,
                available_int,
                fixed_price_int,
                vat,
                payload.id
            ],
        )
        .map_err(|e| format!("Update error: {e}"))?;

    if rows_affected == 0 {
        return Err(format!("Product not found: {}", payload.id));
    }

    Ok(Product {
        id: payload.id,
        name: payload.name,
        price: payload.price,
        category_id: payload.category_id,
        available: payload.available,
        fixed_price: payload.fixed_price,
        vat,
    })
}

pub(crate) fn toggle_product_availability_inner(
    db: &DbState,
    product_id: String,
) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let current: i64 = conn
        .query_row(
            "SELECT available FROM products WHERE id = ?1",
            params![product_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Product not found ({}): {e}", product_id))?;

    let new_value: i64 = if current != 0 { 0 } else { 1 };

    conn.execute(
        "UPDATE products SET available = ?1 WHERE id = ?2",
        params![new_value, product_id],
    )
    .map_err(|e| format!("Update error: {e}"))?;

    Ok(new_value != 0)
}

pub(crate) fn create_order_inner(
    db: &DbState,
    payload: CreateOrderPayload,
) -> Result<OrderWithItems, String> {
    let mut conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    if payload.items.is_empty() {
        return Err("Cannot create an order with no items".to_string());
    }

    if let Some(weight) = payload.weight {
        if !weight.is_finite() || weight < 0.0 {
            return Err("Weight must be a non-negative finite number".to_string());
        }
    }

    let mut order_items: Vec<OrderItem> = Vec::with_capacity(payload.items.len());
    let order_id = Uuid::new_v4().to_string();
    let mut order_total: i64 = 0;

    for item in &payload.items {
        if item.quantity <= 0 {
            return Err(format!(
                "Invalid quantity {} for product {}",
                item.quantity, item.product_id
            ));
        }
        let vat = normalize_vat(item.vat)?;
        let line_total = item.unit_price * item.quantity;
        order_total += line_total;
        order_items.push(OrderItem {
            id: Uuid::new_v4().to_string(),
            order_id: order_id.clone(),
            product_id: item.product_id.clone(),
            product_name: item.product_name.clone(),
            unit_price: item.unit_price,
            quantity: item.quantity,
            total: line_total,
            comment: item.comment.clone(),
            vat,
        });
    }

    let vat_total = order_vat_total_cents(&order_items);
    let created_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let tx = conn
        .transaction()
        .map_err(|e| format!("Transaction begin error: {e}"))?;

    tx.execute(
        "INSERT INTO orders (id, created_at, total, vat_total, payment_method, weight, customer_details) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            order_id,
            created_at,
            order_total,
            vat_total,
            payload.payment_method.as_db_str(),
            payload.weight,
            payload.customer_details,
        ],
    )
    .map_err(|e| format!("Insert order error: {e}"))?;

    for oi in &order_items {
        tx.execute(
            "INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, total, comment, vat)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                oi.id,
                oi.order_id,
                oi.product_id,
                oi.product_name,
                oi.unit_price,
                oi.quantity,
                oi.total,
                oi.comment,
                oi.vat
            ],
        )
        .map_err(|e| format!("Insert order item error: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("Transaction commit error: {e}"))?;

    Ok(OrderWithItems {
        order: Order {
            id: order_id,
            created_at,
            total: order_total,
            vat_total,
            payment_method: payload.payment_method,
            weight: payload.weight,
            customer_details: payload.customer_details,
        },
        items: order_items,
    })
}

pub(crate) fn list_orders_inner(db: &DbState) -> Result<Vec<OrderWithItems>, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let mut order_stmt = conn
        .prepare(
            "SELECT id, created_at, total, vat_total, payment_method, weight, customer_details FROM orders ORDER BY created_at DESC",
        )
        .map_err(|e| format!("Query error: {e}"))?;

    let orders: Vec<Order> = order_stmt
        .query_map([], |row| {
            let pm_str: String = row.get(4)?;
            let payment_method = PaymentMethod::from_db_str(&pm_str).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    4,
                    rusqlite::types::Type::Text,
                    Box::from(e),
                )
            })?;
            Ok(Order {
                id: row.get(0)?,
                created_at: row.get(1)?,
                total: row.get(2)?,
                vat_total: row.get(3)?,
                payment_method,
                weight: row.get(5)?,
                customer_details: row.get(6)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping error: {e}"))?;

    let mut item_stmt = conn
        .prepare(
            "SELECT id, order_id, product_id, product_name, unit_price, quantity, total, comment, vat
             FROM order_items
             ORDER BY order_id",
        )
        .map_err(|e| format!("Query error: {e}"))?;

    let all_items: Vec<OrderItem> = item_stmt
        .query_map([], |row| {
            Ok(OrderItem {
                id: row.get(0)?,
                order_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                unit_price: row.get(4)?,
                quantity: row.get(5)?,
                total: row.get(6)?,
                comment: row.get(7)?,
                vat: row.get(8)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping error: {e}"))?;

    let mut items_map: std::collections::HashMap<String, Vec<OrderItem>> =
        std::collections::HashMap::new();
    for item in all_items {
        items_map
            .entry(item.order_id.clone())
            .or_default()
            .push(item);
    }

    let result: Vec<OrderWithItems> = orders
        .into_iter()
        .map(|order| {
            let items = items_map.remove(&order.id).unwrap_or_default();
            OrderWithItems { order, items }
        })
        .collect();

    Ok(result)
}

pub(crate) fn update_order_inner(
    db: &DbState,
    payload: UpdateOrderPayload,
) -> Result<OrderWithItems, String> {
    if let Some(weight) = payload.weight {
        if !weight.is_finite() || weight < 0.0 {
            return Err("Weight must be a non-negative finite number".to_string());
        }
    }

    {
        let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;
        let rows = conn
            .execute(
                "UPDATE orders SET weight = ?1, customer_details = ?2 WHERE id = ?3",
                params![payload.weight, payload.customer_details, payload.id,],
            )
            .map_err(|e| format!("Update order error: {e}"))?;

        if rows == 0 {
            return Err(format!("Order not found: {}", payload.id));
        }
    }

    list_orders_inner(db)?
        .into_iter()
        .find(|order| order.order.id == payload.id)
        .ok_or_else(|| format!("Order not found: {}", payload.id))
}

pub(crate) fn get_dashboard_summary_inner(db: &DbState) -> Result<DashboardSummary, String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let (total_revenue, total_transactions): (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(total), 0), COUNT(*) FROM orders",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Query error: {e}"))?;

    let mut prod_stmt = conn
        .prepare(
            "SELECT product_id, product_name,
                    SUM(quantity) AS total_qty,
                    SUM(total) AS total_rev
             FROM order_items
             GROUP BY product_id
             ORDER BY total_rev DESC",
        )
        .map_err(|e| format!("Query error: {e}"))?;

    let per_product: Vec<ProductSalesSummary> = prod_stmt
        .query_map([], |row| {
            Ok(ProductSalesSummary {
                product_id: row.get(0)?,
                product_name: row.get(1)?,
                total_quantity: row.get(2)?,
                total_revenue: row.get(3)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping error: {e}"))?;

    let mut pm_stmt = conn
        .prepare(
            "SELECT payment_method,
                    SUM(total) AS total_rev,
                    COUNT(*) AS tx_count
             FROM orders
             GROUP BY payment_method
             ORDER BY payment_method",
        )
        .map_err(|e| format!("Query error: {e}"))?;

    let per_payment_method: Vec<PaymentMethodBreakdown> = pm_stmt
        .query_map([], |row| {
            let pm_str: String = row.get(0)?;
            let payment_method = PaymentMethod::from_db_str(&pm_str).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::from(e),
                )
            })?;
            Ok(PaymentMethodBreakdown {
                payment_method,
                total_revenue: row.get(1)?,
                transaction_count: row.get(2)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping error: {e}"))?;

    Ok(DashboardSummary {
        total_revenue,
        total_transactions,
        per_product,
        per_payment_method,
    })
}

pub(crate) fn delete_product_inner(db: &DbState, product_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let rows_affected = conn
        .execute("DELETE FROM products WHERE id = ?1", params![product_id])
        .map_err(|e| format!("Delete error: {e}"))?;

    if rows_affected == 0 {
        return Err(format!("Product not found: {}", product_id));
    }

    Ok(())
}

pub(crate) fn delete_category_inner(db: &DbState, category_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let product_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE category_id = ?1",
            params![category_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Query error: {e}"))?;

    if product_count > 0 {
        return Err(format!(
            "Cannot delete category '{}': it is referenced by {} product(s)",
            category_id, product_count
        ));
    }

    let rows_affected = conn
        .execute("DELETE FROM categories WHERE id = ?1", params![category_id])
        .map_err(|e| format!("Delete error: {e}"))?;

    if rows_affected == 0 {
        return Err(format!("Category not found: {}", category_id));
    }

    Ok(())
}

pub(crate) fn load_default_dataset_inner(db: &DbState, dataset: String) -> Result<(), String> {
    let mut conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;
    crate::db::load_default_dataset(&mut conn, &dataset)
}

pub(crate) fn reset_database_inner(db: &DbState) -> Result<(), String> {
    let mut conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    let db_path = &db.db_path;
    let is_file_db = db_path != ":memory:";

    if is_file_db {
        *conn = Connection::open_in_memory()
            .map_err(|e| format!("Failed to create temporary connection: {e}"))?;

        std::fs::remove_file(db_path)
            .map_err(|e| format!("Failed to delete database file: {e}"))?;
        let _ = std::fs::remove_file(format!("{db_path}-wal"));
        let _ = std::fs::remove_file(format!("{db_path}-shm"));

        *conn = Connection::open(db_path).map_err(|e| format!("Failed to reopen database: {e}"))?;

        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| format!("Failed to set WAL mode: {e}"))?;
    } else {
        *conn = Connection::open_in_memory()
            .map_err(|e| format!("Failed to open in-memory database: {e}"))?;
    }

    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;

    let migrations = rusqlite_migration::Migrations::new(crate::db::migrations());
    migrations
        .to_latest(&mut *conn)
        .map_err(|e| format!("Migration error: {e}"))?;

    crate::db::ensure_configuration_defaults(&conn);

    Ok(())
}

fn reset_sales_inner(state: &DbState) -> Result<(), String> {
    let conn = state
        .conn
        .lock()
        .map_err(|e| format!("DB lock error: {e}"))?;

    conn.execute_batch(
        "BEGIN;
         DELETE FROM order_items;
         DELETE FROM orders;
         COMMIT;",
    )
    .map_err(|e| format!("Failed to reset sales: {e}"))?;

    Ok(())
}

fn saves_dir(db: &DbState) -> Result<&Path, String> {
    match Path::new(&db.db_path).parent() {
        Some(dir) if db.db_path != ":memory:" => Ok(dir),
        _ => Err("Saves are only available for database files".to_string()),
    }
}

fn list_saves(dir: &Path) -> Result<Vec<String>, String> {
    let mut saves: Vec<String> = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to list saves: {e}"))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_file())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| {
            name != crate::db::DB_FILE_NAME && name.starts_with("pos_sum") && name.ends_with(".db")
        })
        .collect();
    saves.sort();
    Ok(saves)
}

fn save_file_name(date: NaiveDateTime, label: &str) -> Result<String, String> {
    let date = date.format("%Y-%m-%d_%H_%M_%S");
    if label.is_empty() {
        return Ok(format!("pos_sum_{date}.db"));
    }

    let is_word = |word: &str| {
        !word.is_empty() && word.bytes().all(|b| matches!(b, b'a'..=b'z' | b'0'..=b'9'))
    };
    if !label.split('-').all(is_word) {
        return Err(format!("Invalid save name: {label}"));
    }

    Ok(format!("pos_sum_{date}_{label}.db"))
}

fn remove_database_files(path: &str) {
    for suffix in ["", "-journal", "-wal", "-shm"] {
        let _ = std::fs::remove_file(format!("{path}{suffix}"));
    }
}

fn restore_from_copy(
    conn: &mut Connection,
    save_path: &Path,
    copy_path: &str,
) -> Result<(), String> {
    std::fs::copy(save_path, copy_path).map_err(|e| format!("Failed to copy save: {e}"))?;
    let mut copy = Connection::open(copy_path).map_err(|e| format!("Failed to open save: {e}"))?;

    // Every PoS-Sum database has at least its first migration applied.
    let is_valid = copy
        .query_row("PRAGMA quick_check", [], |row| row.get::<_, String>(0))
        .is_ok_and(|check| check == "ok")
        && copy
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .is_ok_and(|version| version > 0);
    if !is_valid {
        return Err("Invalid save: the file is corrupted or is not a PoS-Sum database".to_string());
    }

    copy.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;
    rusqlite_migration::Migrations::new(crate::db::migrations())
        .to_latest(&mut copy)
        .map_err(|e| format!("Migration error: {e}"))?;

    let backup = Backup::new(&copy, conn).map_err(|e| format!("Restore error: {e}"))?;
    match backup.step(-1).map_err(|e| format!("Restore error: {e}"))? {
        StepResult::Done => Ok(()),
        _ => Err("Restore error: the database is busy".to_string()),
    }
}

pub(crate) fn list_database_saves_inner(db: &DbState) -> Result<Vec<String>, String> {
    list_saves(saves_dir(db)?)
}

pub(crate) fn create_database_save_inner(
    db: &DbState,
    label: String,
    date: NaiveDateTime,
) -> Result<String, String> {
    let file_name = save_file_name(date, &label)?;
    let save_path = saves_dir(db)?.join(&file_name);
    let conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    conn.execute("VACUUM INTO ?1", params![save_path.to_string_lossy()])
        .map_err(|e| format!("Failed to save database: {e}"))?;

    Ok(file_name)
}

pub(crate) fn restore_database_save_inner(db: &DbState, file_name: String) -> Result<(), String> {
    let dir = saves_dir(db)?;
    if !list_saves(dir)?.contains(&file_name) {
        return Err(format!("Save not found: {file_name}"));
    }
    let mut conn = db.conn.lock().map_err(|e| format!("DB lock error: {e}"))?;

    // Migrations run on a copy, so the save is never modified and the current database is only
    // replaced by a valid, up-to-date one. Leftovers of an interrupted restore are removed first:
    // SQLite would replay their journal into the new copy.
    let copy_path = format!("{}.restoring", db.db_path);
    remove_database_files(&copy_path);
    let result = restore_from_copy(&mut conn, &dir.join(&file_name), &copy_path);
    remove_database_files(&copy_path);
    result
}

#[tauri::command]
pub fn list_configuration(state: State<'_, DbState>) -> Result<Vec<ConfigurationEntry>, String> {
    list_configuration_inner(&state)
}

#[tauri::command]
pub fn update_configuration(
    state: State<'_, DbState>,
    payload: UpdateConfigurationPayload,
) -> Result<ConfigurationEntry, String> {
    update_configuration_inner(&state, payload)
}

#[tauri::command]
pub fn list_categories(state: State<'_, DbState>) -> Result<Vec<Category>, String> {
    list_categories_inner(&state)
}

#[tauri::command]
pub fn create_category(
    state: State<'_, DbState>,
    payload: CreateCategoryPayload,
) -> Result<Category, String> {
    create_category_inner(&state, payload)
}

#[tauri::command]
pub fn update_category(
    state: State<'_, DbState>,
    payload: UpdateCategoryPayload,
) -> Result<Category, String> {
    update_category_inner(&state, payload)
}

#[tauri::command]
pub fn list_products(state: State<'_, DbState>) -> Result<Vec<Product>, String> {
    list_products_inner(&state)
}

#[tauri::command]
pub fn create_product(
    state: State<'_, DbState>,
    payload: CreateProductPayload,
) -> Result<Product, String> {
    create_product_inner(&state, payload)
}

#[tauri::command]
pub fn update_product(
    state: State<'_, DbState>,
    payload: UpdateProductPayload,
) -> Result<Product, String> {
    update_product_inner(&state, payload)
}

#[tauri::command]
pub fn toggle_product_availability(
    state: State<'_, DbState>,
    product_id: String,
) -> Result<bool, String> {
    toggle_product_availability_inner(&state, product_id)
}

#[tauri::command]
pub fn delete_product(state: State<'_, DbState>, product_id: String) -> Result<(), String> {
    delete_product_inner(&state, product_id)
}

#[tauri::command]
pub fn delete_category(state: State<'_, DbState>, category_id: String) -> Result<(), String> {
    delete_category_inner(&state, category_id)
}

#[tauri::command]
pub fn create_order(
    state: State<'_, DbState>,
    payload: CreateOrderPayload,
) -> Result<OrderWithItems, String> {
    create_order_inner(&state, payload)
}

#[tauri::command]
pub fn list_orders(state: State<'_, DbState>) -> Result<Vec<OrderWithItems>, String> {
    list_orders_inner(&state)
}

#[tauri::command]
pub fn update_order(
    state: State<'_, DbState>,
    payload: UpdateOrderPayload,
) -> Result<OrderWithItems, String> {
    update_order_inner(&state, payload)
}

#[tauri::command]
pub fn get_dashboard_summary(state: State<'_, DbState>) -> Result<DashboardSummary, String> {
    get_dashboard_summary_inner(&state)
}

#[tauri::command]
pub fn load_default_dataset(state: State<'_, DbState>, dataset: String) -> Result<(), String> {
    load_default_dataset_inner(&state, dataset)
}

#[tauri::command]
pub fn reset_database(state: State<'_, DbState>) -> Result<(), String> {
    reset_database_inner(&state)
}

#[tauri::command]
pub fn reset_sales(state: State<'_, DbState>) -> Result<(), String> {
    reset_sales_inner(&state)
}

#[tauri::command]
pub fn get_db_path(state: State<'_, DbState>) -> String {
    state.db_path.clone()
}

#[tauri::command]
pub fn list_database_saves(state: State<'_, DbState>) -> Result<Vec<String>, String> {
    list_database_saves_inner(&state)
}

#[tauri::command]
pub fn create_database_save(state: State<'_, DbState>, label: String) -> Result<String, String> {
    create_database_save_inner(&state, label, chrono::Local::now().naive_local())
}

#[tauri::command]
pub fn restore_database_save(state: State<'_, DbState>, file_name: String) -> Result<(), String> {
    restore_database_save_inner(&state, file_name)
}

#[tauri::command]
pub fn open_database_directory(app: AppHandle, state: State<'_, DbState>) -> Result<(), String> {
    app.opener()
        .open_path(saves_dir(&state)?.to_string_lossy(), None::<&str>)
        .map_err(|e| format!("Failed to open the database directory: {e}"))
}

#[tauri::command]
pub fn get_app_version() -> AppVersion {
    AppVersion {
        version: env!("APP_VERSION").to_string(),
        os: env!("APP_OS").to_string(),
        arch: env!("APP_ARCH").to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db_in_memory;

    fn ensure_category(db: &DbState, id: &str) {
        let _ = create_category_inner(
            db,
            CreateCategoryPayload {
                id: id.to_string(),
                label: id.to_string(),
                color: "#888888".to_string(),
            },
        );
    }

    fn make_product(db: &DbState, name: &str, price: i64, category_id: &str) -> Product {
        ensure_category(db, category_id);
        create_product_inner(
            db,
            CreateProductPayload {
                name: name.to_string(),
                price,
                category_id: category_id.to_string(),
                fixed_price: true,
                vat: 0.0,
            },
        )
        .expect("create_product_inner failed")
    }

    #[test]
    fn list_products_starts_empty() {
        let db = init_db_in_memory();
        let products = list_products_inner(&db).unwrap();
        assert!(products.is_empty());
    }

    #[test]
    fn configuration_defaults_are_present() {
        let db = init_db_in_memory();
        let entries = list_configuration_inner(&db).unwrap();
        let ids: Vec<_> = entries.iter().map(|e| e.id.as_str()).collect();
        assert!(ids.contains(&"shop_name"));
        assert!(ids.contains(&"company_details"));
        assert!(ids.contains(&"order_weight_enabled"));
        assert!(ids.contains(&"custom_product_enabled"));
        assert!(ids.contains(&"shop_language"));
        assert!(ids.contains(&"theme"));
        assert!(ids.contains(&"vat_enabled"));

        let lang = entries.iter().find(|e| e.id == "shop_language").unwrap();
        assert_eq!(lang.value, "fr");
    }

    #[test]
    fn configuration_defaults_reappear_after_delete() {
        let db = init_db_in_memory();
        {
            let conn = db.conn.lock().unwrap();
            conn.execute("DELETE FROM configuration WHERE id = 'shop_name'", [])
                .unwrap();
        }
        let entries = list_configuration_inner(&db).unwrap();
        assert!(entries.iter().any(|e| e.id == "shop_name"));
    }

    #[test]
    fn update_configuration_value() {
        let db = init_db_in_memory();
        let updated = update_configuration_inner(
            &db,
            UpdateConfigurationPayload {
                id: "shop_name".to_string(),
                value: "My Shop".to_string(),
            },
        )
        .unwrap();
        assert_eq!(updated.value, "My Shop");
    }

    #[test]
    fn create_product_rejects_overly_precise_vat() {
        let db = init_db_in_memory();
        ensure_category(&db, "snack");
        let result = create_product_inner(
            &db,
            CreateProductPayload {
                name: "Item".to_string(),
                price: 100,
                category_id: "snack".to_string(),
                fixed_price: true,
                vat: 5.555,
            },
        );
        assert!(result.is_err());
    }

    #[test]
    fn create_product_accepts_fractional_vat() {
        let db = init_db_in_memory();
        ensure_category(&db, "snack");
        let created = create_product_inner(
            &db,
            CreateProductPayload {
                name: "Item".to_string(),
                price: 100,
                category_id: "snack".to_string(),
                fixed_price: true,
                vat: 5.5,
            },
        )
        .unwrap();
        assert_eq!(created.vat, 5.5);
    }

    #[test]
    fn create_and_list_products() {
        let db = init_db_in_memory();
        let created = make_product(&db, "Cola", 150, "boisson-sans-alcool");
        assert_eq!(created.name, "Cola");
        assert_eq!(created.price, 150);
        assert_eq!(created.category_id, "boisson-sans-alcool");
        assert!(created.available);
        assert!(created.fixed_price);
        assert_eq!(created.vat, 0.0);

        let products = list_products_inner(&db).unwrap();
        assert_eq!(products.len(), 1);
        assert_eq!(products[0].name, "Cola");
    }

    #[test]
    fn create_product_with_updatable_price() {
        let db = init_db_in_memory();
        ensure_category(&db, "services");
        let created = create_product_inner(
            &db,
            CreateProductPayload {
                name: "Custom".to_string(),
                price: 1000,
                category_id: "services".to_string(),
                fixed_price: false,
                vat: 0.0,
            },
        )
        .unwrap();
        assert!(!created.fixed_price);
    }

    #[test]
    fn update_product_changes_fields() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Chips", 200, "snack");

        let updated = update_product_inner(
            &db,
            UpdateProductPayload {
                id: p.id.clone(),
                name: "Crisps".to_string(),
                price: 250,
                category_id: "snack".to_string(),
                available: false,
                fixed_price: false,
                vat: 0.0,
            },
        )
        .unwrap();

        assert_eq!(updated.id, p.id);
        assert_eq!(updated.name, "Crisps");
        assert_eq!(updated.price, 250);
        assert!(!updated.available);
        assert!(!updated.fixed_price);
    }

    #[test]
    fn update_product_not_found() {
        let db = init_db_in_memory();
        let result = update_product_inner(
            &db,
            UpdateProductPayload {
                id: "nonexistent".to_string(),
                name: "X".to_string(),
                price: 100,
                category_id: "snack".to_string(),
                available: true,
                fixed_price: true,
                vat: 0.0,
            },
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Product not found"));
    }

    #[test]
    fn toggle_availability() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Water", 100, "boisson-sans-alcool");
        assert!(p.available);

        let new_state = toggle_product_availability_inner(&db, p.id.clone()).unwrap();
        assert!(!new_state);

        let new_state = toggle_product_availability_inner(&db, p.id.clone()).unwrap();
        assert!(new_state);

        let new_state = toggle_product_availability_inner(&db, p.id).unwrap();
        assert!(!new_state);
    }

    #[test]
    fn create_order_success() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Candy", 50, "sucreries");

        let order = create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![CreateOrderItemPayload {
                    product_id: p.id.clone(),
                    product_name: "Candy".to_string(),
                    unit_price: 50,
                    quantity: 3,
                    comment: String::new(),
                    vat: 0.0,
                }],
                payment_method: PaymentMethod::Cash,
                weight: None,
                customer_details: String::new(),
            },
        )
        .unwrap();

        assert_eq!(order.order.total, 150);
        assert_eq!(order.order.vat_total, 0);
        assert_eq!(order.order.payment_method, PaymentMethod::Cash);
        assert_eq!(order.order.weight, None);
        assert_eq!(order.items.len(), 1);
        assert_eq!(order.items[0].product_id, p.id);
        assert_eq!(order.items[0].quantity, 3);
        assert_eq!(order.items[0].total, 150);
        assert_eq!(order.items[0].comment, "");

        let orders = list_orders_inner(&db).unwrap();
        assert_eq!(orders.len(), 1);
        assert_eq!(orders[0].order.total, 150);
        assert_eq!(orders[0].items.len(), 1);
    }

    #[test]
    fn create_order_stores_vat_total() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Beer", 300, "drinks");
        let order = create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![CreateOrderItemPayload {
                    product_id: p.id.clone(),
                    product_name: "Beer".to_string(),
                    unit_price: 300,
                    quantity: 1,
                    comment: String::new(),
                    vat: 5.5,
                }],
                payment_method: PaymentMethod::Cash,
                weight: None,
                customer_details: String::new(),
            },
        )
        .unwrap();

        assert_eq!(order.order.vat_total, 17);
        let orders = list_orders_inner(&db).unwrap();
        assert_eq!(orders[0].order.vat_total, 17);
    }

    #[test]
    fn create_order_with_custom_price_and_comment() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Jacket", 5000, "hauts");

        let order = create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![CreateOrderItemPayload {
                    product_id: p.id.clone(),
                    product_name: "Jacket".to_string(),
                    unit_price: 4200,
                    quantity: 1,
                    comment: "Slight stain".to_string(),
                    vat: 0.0,
                }],
                payment_method: PaymentMethod::Card,
                weight: None,
                customer_details: String::new(),
            },
        )
        .unwrap();

        assert_eq!(order.order.total, 4200);
        assert_eq!(order.items[0].unit_price, 4200);
        assert_eq!(order.items[0].comment, "Slight stain");

        let orders = list_orders_inner(&db).unwrap();
        assert_eq!(orders[0].items[0].comment, "Slight stain");
        assert_eq!(orders[0].items[0].unit_price, 4200);
    }

    #[test]
    fn create_order_with_customer_details() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Tea", 200, "boissons");

        let order = create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![CreateOrderItemPayload {
                    product_id: p.id.clone(),
                    product_name: "Tea".to_string(),
                    unit_price: 200,
                    quantity: 1,
                    comment: String::new(),
                    vat: 0.0,
                }],
                payment_method: PaymentMethod::Card,
                weight: None,
                customer_details: "Alice\nLyon".to_string(),
            },
        )
        .unwrap();

        assert_eq!(order.order.customer_details, "Alice\nLyon");

        let orders = list_orders_inner(&db).unwrap();
        assert_eq!(orders[0].order.customer_details, "Alice\nLyon");
    }

    #[test]
    fn update_order_details() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Tea", 200, "boissons");

        let order = create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![CreateOrderItemPayload {
                    product_id: p.id.clone(),
                    product_name: "Tea".to_string(),
                    unit_price: 200,
                    quantity: 1,
                    comment: String::new(),
                    vat: 0.0,
                }],
                payment_method: PaymentMethod::Cash,
                weight: None,
                customer_details: "Alice".to_string(),
            },
        )
        .unwrap();

        let updated = update_order_inner(
            &db,
            UpdateOrderPayload {
                id: order.order.id.clone(),
                weight: Some(2.0),
                customer_details: "Bob".to_string(),
            },
        )
        .unwrap();

        assert_eq!(updated.order.payment_method, PaymentMethod::Cash);
        assert_eq!(updated.order.weight, Some(2.0));
        assert_eq!(updated.order.customer_details, "Bob");
    }

    #[test]
    fn create_order_with_weight() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Candy", 50, "sucreries");

        let order = create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![CreateOrderItemPayload {
                    product_id: p.id.clone(),
                    product_name: "Candy".to_string(),
                    unit_price: 50,
                    quantity: 1,
                    comment: String::new(),
                    vat: 0.0,
                }],
                payment_method: PaymentMethod::Card,
                weight: Some(1.25),
                customer_details: String::new(),
            },
        )
        .unwrap();

        assert_eq!(order.order.weight, Some(1.25));
        let orders = list_orders_inner(&db).unwrap();
        assert_eq!(orders[0].order.weight, Some(1.25));
    }

    #[test]
    fn create_order_negative_weight_fails() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Candy", 50, "sucreries");

        let result = create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![CreateOrderItemPayload {
                    product_id: p.id.clone(),
                    product_name: "Candy".to_string(),
                    unit_price: 50,
                    quantity: 1,
                    comment: String::new(),
                    vat: 0.0,
                }],
                payment_method: PaymentMethod::Cash,
                weight: Some(-0.5),
                customer_details: String::new(),
            },
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Weight"));
    }

    #[test]
    fn create_order_empty_items_fails() {
        let db = init_db_in_memory();
        let result = create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![],
                payment_method: PaymentMethod::Card,
                weight: None,
                customer_details: String::new(),
            },
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("no items"));
    }

    #[test]
    fn dashboard_summary_reflects_orders() {
        let db = init_db_in_memory();
        let p1 = make_product(&db, "Soda", 200, "boisson-sans-alcool");
        let p2 = make_product(&db, "Bar", 100, "snack");

        create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![CreateOrderItemPayload {
                    product_id: p1.id.clone(),
                    product_name: "Soda".to_string(),
                    unit_price: 200,
                    quantity: 2,
                    comment: String::new(),
                    vat: 0.0,
                }],
                payment_method: PaymentMethod::Cash,
                weight: None,
                customer_details: String::new(),
            },
        )
        .unwrap();

        create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![
                    CreateOrderItemPayload {
                        product_id: p1.id.clone(),
                        product_name: "Soda".to_string(),
                        unit_price: 200,
                        quantity: 1,
                        comment: String::new(),
                        vat: 0.0,
                    },
                    CreateOrderItemPayload {
                        product_id: p2.id.clone(),
                        product_name: "Bar".to_string(),
                        unit_price: 100,
                        quantity: 3,
                        comment: String::new(),
                        vat: 0.0,
                    },
                ],
                payment_method: PaymentMethod::Card,
                weight: Some(2.5),
                customer_details: String::new(),
            },
        )
        .unwrap();

        let summary = get_dashboard_summary_inner(&db).unwrap();
        assert_eq!(summary.total_revenue, 900);
        assert_eq!(summary.total_transactions, 2);
        assert_eq!(summary.per_product.len(), 2);
        assert_eq!(summary.per_product[0].product_name, "Soda");
        assert_eq!(summary.per_product[0].total_quantity, 3);
        assert_eq!(summary.per_product[0].total_revenue, 600);
        assert_eq!(summary.per_product[1].product_name, "Bar");
        assert_eq!(summary.per_payment_method.len(), 2);
    }

    #[test]
    fn delete_product_success() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Temp Item", 100, "snack");

        let before = list_products_inner(&db).unwrap().len();
        delete_product_inner(&db, p.id.clone()).unwrap();
        let after = list_products_inner(&db).unwrap().len();

        assert_eq!(after, before - 1);
    }

    #[test]
    fn delete_product_not_found() {
        let db = init_db_in_memory();
        let result = delete_product_inner(&db, "nonexistent".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Product not found"));
    }

    #[test]
    fn delete_product_with_order_items_succeeds() {
        let db = init_db_in_memory();
        let p = make_product(&db, "Ordered Item", 200, "snack");

        create_order_inner(
            &db,
            CreateOrderPayload {
                items: vec![CreateOrderItemPayload {
                    product_id: p.id.clone(),
                    product_name: "Ordered Item".to_string(),
                    unit_price: 200,
                    quantity: 1,
                    comment: String::new(),
                    vat: 0.0,
                }],
                payment_method: PaymentMethod::Cash,
                weight: None,
                customer_details: String::new(),
            },
        )
        .unwrap();

        assert!(delete_product_inner(&db, p.id).is_ok());
    }

    #[test]
    fn delete_category_success() {
        let db = init_db_in_memory();
        create_category_inner(
            &db,
            CreateCategoryPayload {
                id: "test-cat".to_string(),
                label: "Test Cat".to_string(),
                color: "#ff0000".to_string(),
            },
        )
        .unwrap();

        let before = list_categories_inner(&db).unwrap().len();
        delete_category_inner(&db, "test-cat".to_string()).unwrap();
        let after = list_categories_inner(&db).unwrap().len();
        assert_eq!(after, before - 1);
    }

    #[test]
    fn delete_category_not_found() {
        let db = init_db_in_memory();
        let result = delete_category_inner(&db, "nonexistent".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Category not found"));
    }

    #[test]
    fn delete_category_with_products_fails() {
        let db = init_db_in_memory();
        make_product(&db, "Item", 100, "snack");
        let result = delete_category_inner(&db, "snack".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("referenced by"));
    }

    #[test]
    fn load_snackbar_dataset() {
        let db = init_db_in_memory();
        load_default_dataset_inner(&db, "snackbar".to_string()).unwrap();
        let products = list_products_inner(&db).unwrap();
        let categories = list_categories_inner(&db).unwrap();
        assert_eq!(products.len(), 31);
        assert_eq!(categories.len(), 7);
        assert!(products.iter().all(|p| p.fixed_price));
        let tea = products.iter().find(|p| p.id == "the").unwrap();
        assert_eq!(tea.vat, 5.5);
        let beer = products.iter().find(|p| p.id == "biere-25cl").unwrap();
        assert_eq!(beer.vat, 20.0);
        let orders = list_orders_inner(&db).unwrap();
        assert_eq!(orders.len(), 3);
        let evening = orders
            .iter()
            .find(|o| o.order.id == "snackbar-order-evening")
            .unwrap();
        assert_eq!(evening.order.vat_total, 120);
        assert_eq!(evening.order.total, 700);
    }

    #[test]
    fn load_clothing_dataset_has_open_prices() {
        let db = init_db_in_memory();
        load_default_dataset_inner(&db, "clothing".to_string()).unwrap();
        let products = list_products_inner(&db).unwrap();
        assert!(!products.is_empty());
        assert!(products.iter().any(|p| !p.fixed_price));
        assert!(products.iter().any(|p| p.fixed_price));
        let orders = list_orders_inner(&db).unwrap();
        assert_eq!(orders.len(), 3);
        let open = orders
            .iter()
            .find(|o| o.order.id == "clothing-order-open-price")
            .unwrap();
        assert_eq!(open.items[0].unit_price, 4500);
        assert_eq!(open.items[0].comment, "Soldes −10 %");
    }

    #[test]
    fn load_unknown_dataset_fails() {
        let db = init_db_in_memory();
        let result = load_default_dataset_inner(&db, "unknown".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn reset_database_keeps_config_without_catalog() {
        let db = init_db_in_memory();
        load_default_dataset_inner(&db, "snackbar".to_string()).unwrap();
        update_configuration_inner(
            &db,
            UpdateConfigurationPayload {
                id: "shop_name".to_string(),
                value: "Temp".to_string(),
            },
        )
        .unwrap();

        reset_database_inner(&db).unwrap();

        assert!(list_products_inner(&db).unwrap().is_empty());
        assert!(list_categories_inner(&db).unwrap().is_empty());
        let entries = list_configuration_inner(&db).unwrap();
        assert!(entries.iter().any(|e| e.id == "shop_name"));
        let shop = entries.iter().find(|e| e.id == "shop_name").unwrap();
        assert_eq!(shop.value, "");
    }

    struct TempDir(std::path::PathBuf);

    impl TempDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("pos_sum_test_{}", Uuid::new_v4()));
            std::fs::create_dir_all(&path).unwrap();
            TempDir(path)
        }

        fn open_db(&self) -> DbState {
            crate::db::open_db(&self.0.join(crate::db::DB_FILE_NAME)).unwrap()
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn date(day: u32, hour: u32, minute: u32, second: u32) -> NaiveDateTime {
        chrono::NaiveDate::from_ymd_opt(2026, 11, day)
            .unwrap()
            .and_hms_opt(hour, minute, second)
            .unwrap()
    }

    fn product_names(db: &DbState) -> Vec<String> {
        list_products_inner(db)
            .unwrap()
            .into_iter()
            .map(|p| p.name)
            .collect()
    }

    #[test]
    fn save_file_name_contains_the_date_and_the_label() {
        assert_eq!(
            save_file_name(date(24, 9, 5, 3), "").unwrap(),
            "pos_sum_2026-11-24_09_05_03.db"
        );
        assert_eq!(
            save_file_name(date(24, 9, 5, 3), "end-of-day-2").unwrap(),
            "pos_sum_2026-11-24_09_05_03_end-of-day-2.db"
        );
    }

    #[test]
    fn save_file_name_rejects_labels_that_are_not_urlized() {
        for label in [
            "../escape",
            "a/b",
            "a\\b",
            "End",
            "a b",
            "a--b",
            "-a",
            "a-",
            "journée",
        ] {
            let result = save_file_name(date(24, 9, 5, 3), label);
            assert_eq!(result.unwrap_err(), format!("Invalid save name: {label}"));
        }
    }

    #[test]
    fn database_saves_are_listed_alphabetically() {
        let dir = TempDir::new();
        let db = dir.open_db();
        create_database_save_inner(&db, "z-last".to_string(), date(24, 14, 0, 0)).unwrap();
        create_database_save_inner(&db, String::new(), date(23, 18, 30, 0)).unwrap();
        create_database_save_inner(&db, "a-first".to_string(), date(24, 14, 0, 0)).unwrap();
        std::fs::write(dir.0.join("notes.txt"), "").unwrap();
        std::fs::write(dir.0.join("other.db"), "").unwrap();
        std::fs::create_dir(dir.0.join("pos_sum_folder.db")).unwrap();

        assert_eq!(
            list_database_saves_inner(&db).unwrap(),
            [
                "pos_sum_2026-11-23_18_30_00.db",
                "pos_sum_2026-11-24_14_00_00_a-first.db",
                "pos_sum_2026-11-24_14_00_00_z-last.db",
            ]
        );
    }

    #[test]
    fn create_database_save_copies_the_current_database() {
        let dir = TempDir::new();
        let db = dir.open_db();
        make_product(&db, "Cola", 150, "drinks");

        let file_name =
            create_database_save_inner(&db, "cola".to_string(), date(24, 14, 29, 3)).unwrap();

        assert_eq!(file_name, "pos_sum_2026-11-24_14_29_03_cola.db");
        let save = Connection::open_with_flags(
            dir.0.join(&file_name),
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .unwrap();
        let name: String = save
            .query_row("SELECT name FROM products", [], |row| row.get(0))
            .unwrap();
        assert_eq!(name, "Cola");
    }

    #[test]
    fn create_database_save_never_overwrites_a_save() {
        let dir = TempDir::new();
        let db = dir.open_db();
        create_database_save_inner(&db, String::new(), date(24, 14, 29, 3)).unwrap();

        let result = create_database_save_inner(&db, String::new(), date(24, 14, 29, 3));

        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn restore_database_save_replaces_the_current_database() {
        let dir = TempDir::new();
        let db = dir.open_db();
        make_product(&db, "Cola", 150, "drinks");
        let file_name =
            create_database_save_inner(&db, String::new(), date(24, 14, 29, 3)).unwrap();
        make_product(&db, "Water", 100, "drinks");

        restore_database_save_inner(&db, file_name).unwrap();

        assert_eq!(product_names(&db), ["Cola"]);
        let journal_mode: String = db
            .conn
            .lock()
            .unwrap()
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(journal_mode, "wal");
        drop(db);
        assert_eq!(product_names(&dir.open_db()), ["Cola"]);
        let leftovers = std::fs::read_dir(&dir.0)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .filter(|name| name.contains("restoring"))
            .count();
        assert_eq!(leftovers, 0);
    }

    #[test]
    fn restore_database_save_only_accepts_saves_of_the_database_directory() {
        let dir = TempDir::new();
        let data_dir = dir.0.join("data");
        std::fs::create_dir(&data_dir).unwrap();
        let db = crate::db::open_db(&data_dir.join(crate::db::DB_FILE_NAME)).unwrap();
        let save = create_database_save_inner(&db, String::new(), date(24, 14, 29, 3)).unwrap();
        std::fs::copy(data_dir.join(&save), dir.0.join("pos_sum_outside.db")).unwrap();
        std::fs::copy(data_dir.join(&save), data_dir.join("other.db")).unwrap();

        for file_name in [
            "pos_sum.db",
            "pos_sum_missing.db",
            "other.db",
            "../pos_sum_outside.db",
        ] {
            let result = restore_database_save_inner(&db, file_name.to_string());
            assert_eq!(result.unwrap_err(), format!("Save not found: {file_name}"));
        }
    }

    #[test]
    fn restore_database_save_rejects_invalid_files() {
        let dir = TempDir::new();
        let db = dir.open_db();
        make_product(&db, "Cola", 150, "drinks");
        std::fs::write(dir.0.join("pos_sum_text.db"), "not a database").unwrap();
        std::fs::write(dir.0.join("pos_sum_empty.db"), "").unwrap();

        for file_name in ["pos_sum_text.db", "pos_sum_empty.db"] {
            let result = restore_database_save_inner(&db, file_name.to_string());
            assert!(result.unwrap_err().starts_with("Invalid save"));
        }
        assert_eq!(product_names(&db), ["Cola"]);
    }

    #[test]
    fn restore_database_save_migrates_older_saves_without_modifying_them() {
        let dir = TempDir::new();
        let db = dir.open_db();
        let save_path = dir.0.join("pos_sum_old.db");
        let mut old = Connection::open(&save_path).unwrap();
        rusqlite_migration::Migrations::new(crate::db::migrations().into_iter().take(1).collect())
            .to_latest(&mut old)
            .unwrap();
        old.execute(
            "INSERT INTO orders (id, created_at, total, payment_method)
             VALUES ('o1', '2026-01-01T10:00:00Z', 300, 'cash')",
            [],
        )
        .unwrap();
        drop(old);
        let saved_bytes = std::fs::read(&save_path).unwrap();

        restore_database_save_inner(&db, "pos_sum_old.db".to_string()).unwrap();

        let orders = list_orders_inner(&db).unwrap();
        assert_eq!(orders.len(), 1);
        assert_eq!(orders[0].order.weight, None);
        assert!(list_configuration_inner(&db)
            .unwrap()
            .iter()
            .any(|e| e.id == "theme"));
        assert_eq!(std::fs::read(&save_path).unwrap(), saved_bytes);
    }
}
