--
-- PostgreSQL schema for Verity Inventory
-- Mirrors the original MySQL schema (verity_invetory)
--

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- expenses
CREATE TABLE IF NOT EXISTS expenses (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id),
  title        VARCHAR(150) NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  category     VARCHAR(100),
  description  TEXT,
  expense_date TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- products
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  category_id   INT REFERENCES categories(id),
  name          VARCHAR(150) NOT NULL,
  sku           VARCHAR(50) UNIQUE,
  buying_price  NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  quantity      INT NOT NULL DEFAULT 0,
  minimum_stock INT NOT NULL DEFAULT 5,
  unit          VARCHAR(30) DEFAULT 'piece',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- purchases
CREATE TABLE IF NOT EXISTS purchases (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  purchase_date TIMESTAMP NOT NULL DEFAULT NOW()
);

-- purchase_items
CREATE TABLE IF NOT EXISTS purchase_items (
  id           SERIAL PRIMARY KEY,
  purchase_id  INT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id   INT NOT NULL REFERENCES products(id),
  quantity     INT NOT NULL,
  buying_price NUMERIC(12,2) NOT NULL,
  subtotal     NUMERIC(12,2) NOT NULL
);

-- sales
CREATE TABLE IF NOT EXISTS sales (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  sale_date   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- sale_items
CREATE TABLE IF NOT EXISTS sale_items (
  id            SERIAL PRIMARY KEY,
  sale_id       INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    INT NOT NULL REFERENCES products(id),
  quantity      INT NOT NULL,
  selling_price NUMERIC(12,2) NOT NULL,
  buying_price  NUMERIC(12,2) NOT NULL,
  subtotal      NUMERIC(12,2) NOT NULL,
  profit        NUMERIC(12,2) NOT NULL
);

-- stock_movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id            SERIAL PRIMARY KEY,
  product_id    INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('PURCHASE','SALE','RETURN','DAMAGE','ADJUSTMENT')),
  quantity      INT NOT NULL,
  reference_id  INT,
  note          TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_active_quantity ON products(is_active, quantity);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
