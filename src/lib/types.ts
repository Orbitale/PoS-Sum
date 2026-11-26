// Prices and totals are in cents, weights in kilograms.

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

export interface Product {
	id: string;
	name: string;
	price: number;
	category_id: string;
	available: boolean;
	/** When false, the price is only a suggestion and can be changed on each order. */
	fixed_price: boolean;
}

export type PaymentMethod = 'cash' | 'card' | 'check';

export interface Order {
	id: string;
	created_at: string;
	total: number;
	payment_method: PaymentMethod;
	weight: number | null;
	customer_details: string;
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
	weight?: number | null;
	customer_details?: string;
}

export interface UpdateOrderPayload {
	id: string;
	weight?: number | null;
	customer_details: string;
}

export interface CreateProductPayload {
	name: string;
	price: number;
	category_id: string;
	fixed_price?: boolean;
}

export interface UpdateProductPayload {
	id: string;
	name: string;
	price: number;
	category_id: string;
	available: boolean;
	fixed_price: boolean;
}

export interface AppVersion {
	version: string;
	os: string;
	arch: string;
}

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

export interface CartItem {
	product: Product;
	quantity: number;
	/** Can differ from product.price when the price was changed for this order. */
	unitPrice: number;
	comment: string;
}
