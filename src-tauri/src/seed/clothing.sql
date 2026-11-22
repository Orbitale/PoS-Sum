INSERT OR IGNORE INTO categories (id, label, color) VALUES
    ('hauts', 'Hauts', '#3b82f6'),
    ('bas', 'Bas', '#8b5cf6'),
    ('chaussures', 'Chaussures', '#e8a735'),
    ('accessoires', 'Accessoires', '#e84393'),
    ('services', 'Services', '#6b7280');

INSERT OR IGNORE INTO products (id, name, price, category_id, available, fixed_price) VALUES
    ('tshirt-base', 'T-shirt basique', 1500, 'hauts', 1, 1),
    ('chemise', 'Chemise', 2500, 'hauts', 1, 1),
    ('pull', 'Pull / Sweat', 3000, 'hauts', 1, 1),
    ('veste', 'Veste / Manteau', 5000, 'hauts', 1, 0),
    ('jean', 'Jean', 3500, 'bas', 1, 1),
    ('pantalon', 'Pantalon', 3000, 'bas', 1, 1),
    ('jupe', 'Jupe', 2800, 'bas', 1, 1),
    ('baskets', 'Baskets', 4500, 'chaussures', 1, 1),
    ('chaussures-ville', 'Chaussures de ville', 6000, 'chaussures', 1, 0),
    ('ceinture', 'Ceinture', 1200, 'accessoires', 1, 1),
    ('sac', 'Sac', 2500, 'accessoires', 1, 0),
    ('bonnet', 'Bonnet / Écharpe', 1000, 'accessoires', 1, 1),
    ('retouche', 'Retouche', 500, 'services', 1, 0),
    ('article-divers', 'Article divers (prix libre)', 0, 'services', 1, 0);
