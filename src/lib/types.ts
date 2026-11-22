export interface Category {
	id: string;
	label: string;
	color: string;
}

export interface CreateCategoryPayload {
	id: string;
	label: string;
	color: string;
}

export interface UpdateCategoryPayload {
	id: string;
	label: string;
	color: string;
}

export interface ConfigurationEntry {
	id: string;
	name: string;
	value: string;
}

export interface UpdateConfigurationPayload {
	id: string;
	value: string;
}

export interface Product {
	id: string;
	name: string;
	/** Price in cents (e.g. 150 = 1.50 EUR). */
	price: number;
	/** Foreign key referencing the categories table. */
	category_id: string;
	available: boolean;
	/** When false, the catalog price is only a recommendation. */
	fixed_price: boolean;
}

export type PaymentMethod = 'cash' | 'card' | 'check';

export interface Order {
	id: string;
	created_at: string;
	total: number;
	payment_method: PaymentMethod;
	/** Optional weight in kilograms. */
	weight: number | null;
}

export interface OrderItem {
	id: string;
	order_id: string;
	product_id: string;
	product_name: string;
	unit_price: number;
	quantity: number;
	total: number;
	comment: string;
}

/** Flattened via #[serde(flatten)] on the Rust side. */
export interface OrderWithItems extends Order {
	items: OrderItem[];
}

export interface CreateOrderItemPayload {
	product_id: string;
	product_name: string;
	unit_price: number;
	quantity: number;
	comment?: string;
}

export interface CreateOrderPayload {
	items: CreateOrderItemPayload[];
	payment_method: PaymentMethod;
	/** Optional weight in kilograms. */
	weight?: number | null;
}

export interface CreateProductPayload {
	name: string;
	/** Price in cents. */
	price: number;
	category_id: string;
	fixed_price?: boolean;
}

export interface UpdateProductPayload {
	id: string;
	name: string;
	/** Price in cents. */
	price: number;
	category_id: string;
	available: boolean;
	fixed_price: boolean;
}

// ── App Version ──────────────────────────────────────────────────────────────

export interface AppVersion {
	version: string;
	os: string;
	arch: string;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface ProductSalesSummary {
	product_id: string;
	product_name: string;
	total_quantity: number;
	total_revenue: number;
}

export interface PaymentMethodBreakdown {
	payment_method: PaymentMethod;
	total_revenue: number;
	transaction_count: number;
}

export interface DashboardSummary {
	total_revenue: number;
	total_transactions: number;
	per_product: ProductSalesSummary[];
	per_payment_method: PaymentMethodBreakdown[];
}

/** Client-side cart item (product + chosen quantity + sale overrides). */
export interface CartItem {
	product: Product;
	quantity: number;
	/** Unit price in cents for this cart line (may differ from product.price). */
	unitPrice: number;
	comment: string;
}
