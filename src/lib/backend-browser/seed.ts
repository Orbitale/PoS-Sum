import type { Category, ConfigurationEntry, Product } from '#lib/types.ts';

export const CONFIGURATION_DEFAULTS: readonly ConfigurationEntry[] = [
	{ id: 'shop_name', name: 'Shop name', value: '' },
	{ id: 'company_details', name: 'Company details / address', value: '' },
	{ id: 'order_weight_enabled', name: 'Activate weight field in Order page', value: '0' },
	{ id: 'custom_product_enabled', name: 'Allow adding custom product on-the-fly', value: '0' },
	{ id: 'shop_language', name: 'Shop language', value: 'fr' },
	{ id: 'theme', name: 'Dark/Light mode', value: 'light' }
];

export interface Dataset {
	categories: readonly Category[];
	products: readonly Product[];
}

type ProductRow = [
	id: string,
	name: string,
	price: number,
	category_id: string,
	fixed_price: boolean
];

function dataset(categories: Category[], rows: ProductRow[]): Dataset {
	return {
		categories,
		products: rows.map(([id, name, price, category_id, fixed_price]) => ({
			id,
			name,
			price,
			category_id,
			available: true,
			fixed_price
		}))
	};
}

export const DATASETS: Record<string, Dataset> = {
	snackbar: dataset(
		[
			{ id: 'cake-sale', label: 'Cakes salés', color: '#e8a735' },
			{ id: 'sandwichs', label: 'Sandwiches/Paninis', color: '#9a8441' },
			{ id: 'boisson-sans-alcool', label: 'Boisson sans alcool', color: '#3b82f6' },
			{ id: 'alcool', label: 'Alcool', color: '#8b5cf6' },
			{ id: 'sucreries', label: 'Sucreries', color: '#e84393' },
			{ id: 'crepes', label: 'Crêpes', color: '#edff00' },
			{ id: 'consignes', label: 'Consignes', color: '#6b7280' }
		],
		[
			['the', 'Thé', 100, 'boisson-sans-alcool', true],
			['cafe', 'Café', 100, 'boisson-sans-alcool', true],
			['soda', 'Soda', 200, 'boisson-sans-alcool', true],
			['jus-de-fruit', 'Jus de fruit', 200, 'boisson-sans-alcool', true],
			['limonade', 'Limonade', 200, 'boisson-sans-alcool', true],
			['biere-pichet', 'Bière (pichet)', 1200, 'alcool', true],
			['biere-25cl', 'Bière (25cl)', 300, 'alcool', true],
			['cidre-doux', 'Cidre (DOUX)', 300, 'alcool', true],
			['cidre-brut', 'Cidre (BRUT)', 300, 'alcool', true],
			['consigne-verre', 'Consigne Verre', 100, 'consignes', true],
			['consigne-pichet', 'Consigne Pichet', 500, 'consignes', true],
			['retour-consigne-verre', 'RETOUR Consigne Verre', -100, 'consignes', true],
			['retour-consigne-pichet', 'RETOUR Consigne Pichet', -500, 'consignes', true],
			['bonbon', 'Bonbon/M&Ms/Twix', 100, 'sucreries', true],
			['cake-sucre', 'Cake sucré', 100, 'sucreries', true],
			['cake-pomme-amandes', 'Cake Pomme Amandes', 100, 'sucreries', true],
			['cake-pomme-canelle', 'Cake Pomme Canelles', 100, 'sucreries', true],
			['cake-pomme-chocolat', 'Cake Pomme Chocolat', 100, 'sucreries', true],
			['crepe-nature', 'Crêpe Nature', 200, 'crepes', true],
			['crepe-sucre', 'Crêpe Sucre', 250, 'crepes', true],
			['crepe-confiture', 'Crêpe Confiture', 350, 'crepes', true],
			['crepe-caramel', 'Crêpe Caramel', 350, 'crepes', true],
			['crepe-nutella', 'Crêpe Nutella', 350, 'crepes', true],
			['crepe-speculoos', 'Crêpe Spéculoos', 350, 'crepes', true],
			['cake-tomate-mozza', 'Cake Tomate Mozza', 100, 'cake-sale', true],
			['cake-chorizo-poivrons', 'Cake Chorizo Poivrons', 100, 'cake-sale', true],
			['cake-lardons-olives', 'Cake Lardons Olives', 100, 'cake-sale', true],
			['sandwich-jambon-fromage', 'Sandwich Jambon Fromage', 400, 'sandwichs', true],
			['sandwich-fromage-salade', 'Sandwich Fromage Salade', 400, 'sandwichs', true],
			['panini-3-fromages', 'Panini 3 fromages', 400, 'sandwichs', true],
			['panini-jambon-fromage', 'Panini Jambon Fromage', 400, 'sandwichs', true]
		]
	),
	clothing: dataset(
		[
			{ id: 'hauts', label: 'Hauts', color: '#3b82f6' },
			{ id: 'bas', label: 'Bas', color: '#8b5cf6' },
			{ id: 'chaussures', label: 'Chaussures', color: '#e8a735' },
			{ id: 'accessoires', label: 'Accessoires', color: '#e84393' },
			{ id: 'services', label: 'Services', color: '#6b7280' }
		],
		[
			['tshirt-base', 'T-shirt basique', 1500, 'hauts', true],
			['chemise', 'Chemise', 2500, 'hauts', true],
			['pull', 'Pull / Sweat', 3000, 'hauts', true],
			['veste', 'Veste / Manteau', 5000, 'hauts', false],
			['jean', 'Jean', 3500, 'bas', true],
			['pantalon', 'Pantalon', 3000, 'bas', true],
			['jupe', 'Jupe', 2800, 'bas', true],
			['baskets', 'Baskets', 4500, 'chaussures', true],
			['chaussures-ville', 'Chaussures de ville', 6000, 'chaussures', false],
			['ceinture', 'Ceinture', 1200, 'accessoires', true],
			['sac', 'Sac', 2500, 'accessoires', false],
			['bonnet', 'Bonnet / Écharpe', 1000, 'accessoires', true],
			['retouche', 'Retouche', 500, 'services', false],
			['article-divers', 'Article divers (prix libre)', 0, 'services', false]
		]
	)
};
