use std::fmt;

use serde::{Deserialize, Serialize};

// ── AppVersion ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct AppVersion {
    pub version: String,
    pub os: String,
    pub arch: String,
}

// ── Configuration ───────────────────────────────────────────────────────────

/// A single application configuration entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConfigurationEntry {
    pub id: String,
    pub name: String,
    pub value: String,
}

/// Payload sent from the frontend when updating a configuration value.
#[derive(Debug, Deserialize)]
pub struct UpdateConfigurationPayload {
    pub id: String,
    pub value: String,
}

// ── PaymentMethod ───────────────────────────────────────────────────────────

/// The accepted payment methods.
/// Serializes to/from lowercase strings ("cash", "card", "check") for the JS boundary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentMethod {
    Cash,
    Card,
    Check,
}

impl fmt::Display for PaymentMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PaymentMethod::Cash => write!(f, "cash"),
            PaymentMethod::Card => write!(f, "card"),
            PaymentMethod::Check => write!(f, "check"),
        }
    }
}

impl PaymentMethod {
    /// Parse a string from the database into a `PaymentMethod`.
    /// Returns an error message if the value is not recognized.
    pub fn from_db_str(s: &str) -> Result<Self, String> {
        match s {
            "cash" => Ok(PaymentMethod::Cash),
            "card" => Ok(PaymentMethod::Card),
            "check" => Ok(PaymentMethod::Check),
            other => Err(format!("Unknown payment method: {other}")),
        }
    }

    /// Return the lowercase string representation stored in SQLite.
    pub fn as_db_str(&self) -> &'static str {
        match self {
            PaymentMethod::Cash => "cash",
            PaymentMethod::Card => "card",
            PaymentMethod::Check => "check",
        }
    }
}

// ── Category ─────────────────────────────────────────────────────────────────

/// A product category with display label and color.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub label: String,
    pub color: String,
}

/// Payload sent from the frontend when creating a new category.
#[derive(Debug, Deserialize)]
pub struct CreateCategoryPayload {
    pub id: String,
    pub label: String,
    pub color: String,
}

/// Payload sent from the frontend when updating an existing category.
#[derive(Debug, Deserialize)]
pub struct UpdateCategoryPayload {
    pub id: String,
    pub label: String,
    pub color: String,
}

// ── Product ──────────────────────────────────────────────────────────────────

/// A product in the catalog.
/// Prices are stored as integer cents to avoid floating-point errors.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub name: String,
    /// Price in cents (e.g. 150 = 1.50 EUR).
    pub price: i64,
    /// Foreign key referencing the categories table.
    pub category_id: String,
    /// Whether the product appears on the sales screen.
    pub available: bool,
    /// When true, the catalog price is fixed. When false, the price is only a
    /// recommendation and may be changed on the current order.
    pub fixed_price: bool,
}

/// Payload sent from the frontend when creating a new product.
#[derive(Debug, Deserialize)]
pub struct CreateProductPayload {
    pub name: String,
    pub price: i64,
    pub category_id: String,
    #[serde(default = "default_true")]
    pub fixed_price: bool,
}

/// Payload sent from the frontend when updating an existing product.
#[derive(Debug, Deserialize)]
pub struct UpdateProductPayload {
    pub id: String,
    pub name: String,
    pub price: i64,
    pub category_id: String,
    pub available: bool,
    pub fixed_price: bool,
}

fn default_true() -> bool {
    true
}

// ── Order ────────────────────────────────────────────────────────────────────

/// A completed order (transaction).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    /// ISO-8601 timestamp of when the order was completed.
    pub created_at: String,
    /// Total amount in cents.
    pub total: i64,
    /// Payment method used for this order.
    pub payment_method: PaymentMethod,
    /// Optional weight in kilograms.
    pub weight: Option<f64>,
}

/// A line item within an order.
/// Captures a snapshot of the product at the time of sale so that later
/// price changes do not retroactively alter historical data.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderItem {
    pub id: String,
    pub order_id: String,
    pub product_id: String,
    /// Product name snapshot at sale time.
    pub product_name: String,
    /// Unit price snapshot at sale time (cents).
    pub unit_price: i64,
    pub quantity: i64,
    /// unit_price * quantity (cents).
    pub total: i64,
    /// Optional free-text comment for this line item.
    #[serde(default)]
    pub comment: String,
}

/// An order together with its line items, returned to the frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderWithItems {
    #[serde(flatten)]
    pub order: Order,
    pub items: Vec<OrderItem>,
}

/// Payload sent from the frontend when creating a new order.
#[derive(Debug, Deserialize)]
pub struct CreateOrderPayload {
    pub items: Vec<CreateOrderItemPayload>,
    /// Payment method for this order.
    pub payment_method: PaymentMethod,
    /// Optional weight in kilograms.
    #[serde(default)]
    pub weight: Option<f64>,
}

/// A single item within a new-order payload.
#[derive(Debug, Deserialize)]
pub struct CreateOrderItemPayload {
    pub product_id: String,
    pub product_name: String,
    pub unit_price: i64,
    pub quantity: i64,
    #[serde(default)]
    pub comment: String,
}

// ── Dashboard ────────────────────────────────────────────────────────────────

/// Per-product sales summary row.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProductSalesSummary {
    pub product_id: String,
    pub product_name: String,
    pub total_quantity: i64,
    pub total_revenue: i64,
}

/// Breakdown of revenue by payment method.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PaymentMethodBreakdown {
    pub payment_method: PaymentMethod,
    pub total_revenue: i64,
    pub transaction_count: i64,
}

/// The complete dashboard summary returned to the frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub total_revenue: i64,
    pub total_transactions: i64,
    pub per_product: Vec<ProductSalesSummary>,
    pub per_payment_method: Vec<PaymentMethodBreakdown>,
}
