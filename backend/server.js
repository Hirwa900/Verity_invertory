const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const categoryRoutes = require('./src/routes/categories');
const productRoutes = require('./src/routes/products');
const purchaseRoutes = require('./src/routes/purchases');
const saleRoutes = require('./src/routes/sales');
const stockRoutes = require('./src/routes/stock');
const expenseRoutes = require('./src/routes/expenses');
const reportRoutes = require('./src/routes/reports');
const dashboardRoutes = require('./src/routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Verity Inventory API is running' });
});

const port = process.env.PORT || 5000;
const pool = require('./src/config/db');

// Ensure stock_movements table exists and add performance indexes
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('PURCHASE','SALE','RETURN','DAMAGE','ADJUSTMENT')),
        quantity INT NOT NULL,
        reference_id INT,
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('stock_movements table ensured');

    const indexes = [
      ['idx_sales_date', 'CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)'],
      ['idx_purchases_date', 'CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date)'],
      ['idx_expenses_date', 'CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)'],
      ['idx_sale_items_sale_id', 'CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)'],
      ['idx_sale_items_product_id', 'CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)'],
      ['idx_purchase_items_purchase_id', 'CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id)'],
      ['idx_products_category', 'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)'],
      ['idx_products_active', 'CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)'],
      ['idx_products_active_quantity', 'CREATE INDEX IF NOT EXISTS idx_products_active_quantity ON products(is_active, quantity)'],
      ['idx_stock_movements_created', 'CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at)'],
      ['idx_users_email', 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'],
    ];

    for (const [name, sql] of indexes) {
      try {
        await pool.query(sql);
        console.log(`  index ${name} ensured`);
      } catch (e) {
        console.warn(`  index ${name} failed: ${e.message}`);
      }
    }
    console.log('Performance indexes ensured');
  } catch (e) {
    console.error('Error during setup:', e.message);
  }
})();

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

