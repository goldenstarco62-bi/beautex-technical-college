-- ============================================================
-- BEAUTEX TECHNICAL TRAINING COLLEGE - INVENTORY MODULE
-- ============================================================

-- Inventory Categories
CREATE TABLE IF NOT EXISTS inv_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  department TEXT,
  color TEXT DEFAULT '#800000',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT OR IGNORE INTO inv_categories (name, description, department, color) VALUES
('Beauty Therapy Supplies', 'Facial creams, lotions, makeup kits, waxing materials', 'Beauty Therapy', '#e91e63'),
('Hairdressing Equipment', 'Hair dryers, clippers, curling irons, combs and brushes', 'Hairdressing', '#9c27b0'),
('Barbering Equipment', 'Clippers, trimmers, razors, barber chairs', 'Barbering', '#3f51b5'),
('Nail Technology Tools', 'Nail polish, UV lamps, nail files, acrylic powder', 'Nail Technology', '#00bcd4'),
('Computer Lab Equipment', 'Computers, keyboards, mouse, routers', 'ICT', '#4caf50'),
('ICT Equipment', 'Printers, projectors, network switches, UPS', 'ICT', '#ff9800'),
('Office Supplies', 'Papers, files, pens, toners', 'Administration', '#795548');

-- Inventory Locations
CREATE TABLE IF NOT EXISTS inv_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO inv_locations (name, description) VALUES
('Main Store', 'Primary storage facility'),
('Computer Lab', 'Computer lab storage'),
('Beauty Therapy Lab', 'Beauty therapy practical room'),
('Nail Technology Lab', 'Nail technology practice room'),
('Barbering Room', 'Barbering department room'),
('Hairdressing Lab', 'Hairdressing practical room'),
('Administration Office', 'Admin office storage');

-- Suppliers
CREATE TABLE IF NOT EXISTS inv_suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  products_supplied TEXT, -- JSON array of product categories
  payment_terms TEXT,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inv_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 0,
  unit_type TEXT DEFAULT 'Piece' CHECK(unit_type IN ('Piece', 'Bottle', 'Box', 'Pack', 'Litre', 'Kg', 'Metre', 'Set', 'Pair', 'Ream')),
  purchase_price REAL DEFAULT 0.0,
  supplier_id INTEGER,
  date_purchased DATE,
  expiry_date DATE,
  minimum_stock_level INTEGER DEFAULT 5,
  location_id INTEGER,
  status TEXT DEFAULT 'Available' CHECK(status IN ('Available', 'Issued', 'Damaged', 'Expired', 'Discontinued')),
  batch_number TEXT,
  serial_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES inv_categories(id),
  FOREIGN KEY (supplier_id) REFERENCES inv_suppliers(id),
  FOREIGN KEY (location_id) REFERENCES inv_locations(id)
);

-- Purchase Requests
CREATE TABLE IF NOT EXISTS inv_purchase_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER,
  requested_by TEXT NOT NULL,  -- user email
  requested_by_name TEXT NOT NULL,
  department TEXT,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  cost_per_item REAL DEFAULT 0.0,
  total_cost REAL DEFAULT 0.0,
  purchase_date DATE,
  delivery_date DATE,
  invoice_number TEXT,
  payment_status TEXT DEFAULT 'Pending' CHECK(payment_status IN ('Pending', 'Paid', 'Partial')),
  approval_status TEXT DEFAULT 'Pending' CHECK(approval_status IN ('Pending', 'Approved', 'Rejected')),
  approved_by TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES inv_suppliers(id)
);

-- Stock In (Receiving Items)
CREATE TABLE IF NOT EXISTS inv_stock_in (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  supplier_id INTEGER,
  quantity_received INTEGER NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  received_by TEXT NOT NULL,   -- user email
  received_by_name TEXT NOT NULL,
  date_received DATE DEFAULT (date('now')),
  purchase_request_id INTEGER,
  unit_cost REAL DEFAULT 0.0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inv_items(id),
  FOREIGN KEY (supplier_id) REFERENCES inv_suppliers(id),
  FOREIGN KEY (purchase_request_id) REFERENCES inv_purchase_requests(id)
);

-- Stock Out (Issuing Items to Departments)
CREATE TABLE IF NOT EXISTS inv_stock_out (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  quantity_issued INTEGER NOT NULL,
  department TEXT NOT NULL,
  issued_to TEXT NOT NULL,      -- Trainer name
  issued_to_email TEXT,
  purpose TEXT,
  approved_by TEXT,
  date_issued DATE DEFAULT (date('now')),
  status TEXT DEFAULT 'Issued' CHECK(status IN ('Issued', 'Returned', 'Partially Returned')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inv_items(id)
);

-- Department Requests
CREATE TABLE IF NOT EXISTS inv_department_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  requested_by TEXT NOT NULL,  -- user email
  requested_by_name TEXT NOT NULL,
  item_id INTEGER,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  purpose TEXT,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Issued')),
  approved_by TEXT,
  approved_date DATE,
  rejection_reason TEXT,
  issued_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inv_items(id)
);

-- Assets (Long-term Equipment)
CREATE TABLE IF NOT EXISTS inv_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_tag TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  serial_number TEXT,
  category_id INTEGER,
  department_assigned TEXT,
  location_id INTEGER,
  condition TEXT DEFAULT 'Good' CHECK(condition IN ('Excellent', 'Good', 'Fair', 'Poor', 'Damaged', 'Disposed')),
  purchase_date DATE,
  purchase_price REAL DEFAULT 0.0,
  supplier_id INTEGER,
  warranty_expiry DATE,
  maintenance_schedule TEXT,
  last_maintenance_date DATE,
  notes TEXT,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Under Maintenance', 'Disposed', 'Lost')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES inv_categories(id),
  FOREIGN KEY (location_id) REFERENCES inv_locations(id),
  FOREIGN KEY (supplier_id) REFERENCES inv_suppliers(id)
);

-- Damaged / Lost Items Log
CREATE TABLE IF NOT EXISTS inv_damage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT DEFAULT 'Damaged' CHECK(reason IN ('Damaged', 'Lost', 'Expired', 'Stolen', 'Obsolete')),
  reported_by TEXT NOT NULL,
  reported_by_name TEXT NOT NULL,
  report_date DATE DEFAULT (date('now')),
  description TEXT,
  action_taken TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inv_items(id)
);
