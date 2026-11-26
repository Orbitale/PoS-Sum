//! Prices and totals are in cents, weights in kilograms.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct AppVersion {
    pub version: String,
    pub os: String,
    pub arch: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConfigurationEntry {
    pub id: String,
    pub name: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConfigurationPayload {
    pub id: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentMethod {
    Cash,
    Card,
    Check,
}

impl PaymentMethod {
    pub fn from_db_str(s: &str) -> Result<Self, String> {
        match s {
            "cash" => Ok(PaymentMethod::Cash),
            "card" => Ok(PaymentMethod::Card),
            "check" => Ok(PaymentMethod::Check),
            other => Err(format!("Unknown payment method: {other}")),
        }
    }

    pub fn as_db_str(&self) -> &'static str {
        match self {
            PaymentMethod::Cash => "cash",
            PaymentMethod::Card => "card",
            PaymentMethod::Check => "check",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub label: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryPayload {
    pub id: String,
    pub label: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCategoryPayload {
    pub id: String,
    pub label: String,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub price: i64,
    pub category_id: String,
    pub available: bool,
    /// When false, the price is only a suggestion and can be changed on each order.
    pub fixed_price: bool,
    pub vat: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductPayload {
    pub name: String,
    pub price: i64,
    pub category_id: String,
    #[serde(default = "default_true")]
    pub fixed_price: bool,
    #[serde(default)]
    pub vat: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductPayload {
    pub id: String,
    pub name: String,
    pub price: i64,
    pub category_id: String,
    pub available: bool,
    pub fixed_price: bool,
    #[serde(default)]
    pub vat: f64,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    /// ISO-8601, UTC.
    pub created_at: String,
    pub total: i64,
    /// Total VAT in cents (sum of raw line VAT, rounded once at checkout).
    #[serde(default)]
    pub vat_total: i64,
    pub payment_method: PaymentMethod,
    pub weight: Option<f64>,
    #[serde(default)]
    pub customer_details: String,
}

/// Name and price are copied at sale time, so later catalog changes don't alter past orders.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderItem {
    pub id: String,
    pub order_id: String,
    pub product_id: String,
    pub product_name: String,
    pub unit_price: i64,
    pub quantity: i64,
    pub total: i64,
    #[serde(default)]
    pub comment: String,
    #[serde(default)]
    pub vat: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderWithItems {
    #[serde(flatten)]
    pub order: Order,
    pub items: Vec<OrderItem>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderPayload {
    pub items: Vec<CreateOrderItemPayload>,
    pub payment_method: PaymentMethod,
    #[serde(default)]
    pub weight: Option<f64>,
    #[serde(default)]
    pub customer_details: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderPayload {
    pub id: String,
    #[serde(default)]
    pub weight: Option<f64>,
    #[serde(default)]
    pub customer_details: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderItemPayload {
    pub product_id: String,
    pub product_name: String,
    pub unit_price: i64,
    pub quantity: i64,
    #[serde(default)]
    pub comment: String,
    #[serde(default)]
    pub vat: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProductSalesSummary {
    pub product_id: String,
    pub product_name: String,
    pub total_quantity: i64,
    pub total_revenue: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PaymentMethodBreakdown {
    pub payment_method: PaymentMethod,
    pub total_revenue: i64,
    pub transaction_count: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub total_revenue: i64,
    pub total_transactions: i64,
    pub per_product: Vec<ProductSalesSummary>,
    pub per_payment_method: Vec<PaymentMethodBreakdown>,
}
