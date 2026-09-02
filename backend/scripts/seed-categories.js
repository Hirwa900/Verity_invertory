const pool = require('../src/config/db');

const categories = [
  'Agendas & Notebooks',
  'Pens & Writing Instruments',
  'Adhesives & Tapes',
  'Pencils & Erasers',
  'Drawing & Geometry',
  'Markers & Highlighters',
  'Envelopes & Document Holders',
  'Ink, Toner & Printer Supplies',
  'Registers & Record Books',
  'Identification & Cards',
  'Art & Coloring',
  'Miscellaneous',
  'Stapling & Binding',
  'Calculators & Office Equipment',
  'Paper & Printing Materials',
  'Office Accessories',
  'Files, Folders & Binders',
  'bags & cover',
];

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < categories.length; i += 1) {
      const name = categories[i];
      const { rows } = await client.query(
        'SELECT id FROM categories WHERE name = $1',
        [name]
      );
      if (rows.length) {
        console.log(`Skipped existing category: ${name}`);
        continue;
      }
      await client.query(
        'INSERT INTO categories (name) VALUES ($1)',
        [name]
      );
      console.log(`Inserted category: ${name}`);
    }
    await client.query('COMMIT');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
  }
};

run();
