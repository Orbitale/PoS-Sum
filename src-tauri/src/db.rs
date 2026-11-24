use rusqlite::Connection;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

pub struct DbState {
    pub conn: Mutex<Connection>,
    pub db_path: String,
}

pub fn migrations() -> Vec<rusqlite_migration::M<'static>> {
    vec![
        rusqlite_migration::M::up(include_str!("./migrations/0-init.sql")),
        rusqlite_migration::M::up(include_str!("./migrations/1-nonprofits-enhancements.sql")),
        rusqlite_migration::M::up(include_str!("./migrations/2-add-check-payment.sql")),
    ]
}

const CONFIG_DEFAULTS: &[(&str, &str, &str)] = &[
    ("shop_name", "Shop name", ""),
    ("order_weight_enabled", "Activate weight field in Order page", "0"),
    (
        "custom_product_enabled",
        "Allow adding custom product on-the-fly",
        "0",
    ),
    ("shop_language", "Shop language", "fr"),
    ("theme", "Dark/Light mode", "light"),
];

pub fn ensure_configuration_defaults(conn: &Connection) {
    for (id, name, value) in CONFIG_DEFAULTS {
        conn.execute(
            "INSERT OR IGNORE INTO configuration (id, name, value) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, name, value],
        )
        .expect("Failed to insert default configuration");
    }
}

pub fn load_default_dataset(conn: &Connection, dataset: &str) -> Result<(), String> {
    let sql = match dataset {
        "snackbar" => include_str!("./seed/snackbar.sql"),
        "clothing" => include_str!("./seed/clothing.sql"),
        other => return Err(format!("Unknown default dataset: {other}")),
    };

    conn.execute_batch(
        "BEGIN;
         DELETE FROM products;
         DELETE FROM categories;
         COMMIT;",
    )
    .map_err(|e| format!("Failed to clear catalog: {e}"))?;

    conn.execute_batch(sql)
        .map_err(|e| format!("Failed to load default dataset '{dataset}': {e}"))?;

    Ok(())
}

#[cfg(test)]
pub fn init_db_in_memory() -> DbState {
    let mut conn = Connection::open_in_memory().expect("Failed to open in-memory database");
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .expect("Failed to enable foreign keys");

    let migrations = rusqlite_migration::Migrations::new(migrations());
    migrations.to_latest(&mut conn).unwrap();

    ensure_configuration_defaults(&conn);

    DbState {
        conn: Mutex::new(conn),
        db_path: ":memory:".to_string(),
    }
}

pub fn init_db(app_handle: &AppHandle) -> Result<DbState, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create app data dir: {e}"))?;

    let db_path = data_dir.join("pos_sum.db");

    let mut conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database at {}: {e}", db_path.display()))?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {e}"))?;

    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;

    let migrations = rusqlite_migration::Migrations::new(migrations());
    migrations.to_latest(&mut conn).unwrap();

    ensure_configuration_defaults(&conn);

    Ok(DbState {
        conn: Mutex::new(conn),
        db_path: db_path.to_string_lossy().into_owned(),
    })
}
