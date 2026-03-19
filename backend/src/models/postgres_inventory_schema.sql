-- ============================================================
-- BEAUTEX TECHNICAL TRAINING COLLEGE - INVENTORY MODULE (POSTGRES)
-- ============================================================

-- Inventory Categories
CREATE TABLE IF NOT EXISTS inv_categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  department TEXT,
  color TEXT DEFAULT '#800000',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO inv_categories (name, description, department, color) VALUES
('Beauty Therapy Supplies', 'Facial creams, lotions, makeup kits, waxing materials', 'Beauty Therapy', '#e91e63'),
('Hairdressing Equipment', 'Hair dryers, clippers, curling irons, combs and brushes', 'Hairdressing', '#9c27b0'),
('Barbering Equipment', 'Clippers, trimmers, razors, barber chairs', 'Barbering', '#3f51b5'),
('Nail Technology Tools', 'Nail polish, UV lamps, nail files, acrylic powder', 'Nail Technology', '#00bcd4'),
('Computer Lab Equipment', 'Computers, keyboards, mouse, routers', 'ICT', '#4caf50'),
('ICT Equipment', 'Printers, projectors, network switches, UPS', 'ICT', '#ff9800'),
('Office Supplies', 'Papers, files, pens, toners', 'Administration', '#795548')
ON CONFLICT (name) DO NOTHING;

-- Inventory Locations
CREATE TABLE IF NOT EXISTS inv_locations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO inv_locations (name, description) VALUES
('Main Store', 'Primary storage facility'),
('Computer Lab', 'Computer lab storage'),
('Beauty Therapy Lab', 'Beauty therapy practical room'),
('Nail Technology Lab', 'Nail technology practice room'),
('Barbering Room', 'Barbering department room'),
('Hairdressing Lab', 'Hairdressing practical room'),
('Administration Office', 'Admin office storage')
ON CONFLICT (name) DO NOTHING;

-- Suppliers
CREATE TABLE IF NOT EXISTS inv_suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  products_supplied TEXT, 
  payment_terms TEXT,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inv_items (
  id SERIAL PRIMARY KEY,
  item_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES inv_categories(id),
  description TEXT,
  quantity INTEGER DEFAULT 0,
  unit_type TEXT DEFAULT 'Piece',
  purchase_price DECIMAL DEFAULT 0.0,
  supplier_id INTEGER REFERENCES inv_suppliers(id),
  date_purchased DATE,
  expiry_date DATE,
  minimum_stock_level INTEGER DEFAULT 5,
  location_id INTEGER REFERENCES inv_locations(id),
  status TEXT DEFAULT 'Available' CHECK(status IN ('Available', 'Issued', 'Damaged', 'Expired', 'Discontinued')),
  batch_number TEXT,
  serial_number TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Requests
CREATE TABLE IF NOT EXISTS inv_purchase_requests (
  id SERIAL PRIMARY KEY,
  request_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES inv_suppliers(id),
  requested_by TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  department TEXT,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  cost_per_item DECIMAL DEFAULT 0.0,
  total_cost DECIMAL DEFAULT 0.0,
  purchase_date DATE,
  delivery_date DATE,
  invoice_number TEXT,
  payment_status TEXT DEFAULT 'Pending' CHECK(payment_status IN ('Pending', 'Paid', 'Partial')),
  approval_status TEXT DEFAULT 'Pending' CHECK(approval_status IN ('Pending', 'Approved', 'Rejected')),
  approved_by TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock In
CREATE TABLE IF NOT EXISTS inv_stock_in (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inv_items(id),
  supplier_id INTEGER REFERENCES inv_suppliers(id),
  quantity_received INTEGER NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  received_by TEXT NOT NULL,
  received_by_name TEXT NOT NULL,
  date_received DATE DEFAULT CURRENT_DATE,
  purchase_request_id INTEGER REFERENCES inv_purchase_requests(id),
  unit_cost DECIMAL DEFAULT 0.0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Out
CREATE TABLE IF NOT EXISTS inv_stock_out (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inv_items(id),
  quantity_issued INTEGER NOT NULL,
  department TEXT NOT NULL,
  issued_to TEXT NOT NULL,
  issued_to_email TEXT,
  purpose TEXT,
  approved_by TEXT,
  date_issued DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Issued' CHECK(status IN ('Issued', 'Returned', 'Partially Returned')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Department Requests
CREATE TABLE IF NOT EXISTS inv_department_requests (
  id SERIAL PRIMARY KEY,
  request_id TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  item_id INTEGER REFERENCES inv_items(id),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  purpose TEXT,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Issued')),
  approved_by TEXT,
  approved_date DATE,
  rejection_reason TEXT,
  issued_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assets
CREATE TABLE IF NOT EXISTS inv_assets (
  id SERIAL PRIMARY KEY,
  asset_tag TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  serial_number TEXT,
  category_id INTEGER REFERENCES inv_categories(id),
  department_assigned TEXT,
  location_id INTEGER REFERENCES inv_locations(id),
  condition TEXT DEFAULT 'Good' CHECK(condition IN ('Excellent', 'Good', 'Fair', 'Poor', 'Damaged', 'Disposed')),
  purchase_date DATE,
  purchase_price DECIMAL DEFAULT 0.0,
  supplier_id INTEGER REFERENCES inv_suppliers(id),
  warranty_expiry DATE,
  maintenance_schedule TEXT,
  last_maintenance_date DATE,
  notes TEXT,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Under Maintenance', 'Disposed', 'Lost')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Damage Logs
CREATE TABLE IF NOT EXISTS inv_damage_logs (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inv_items(id),
  quantity INTEGER NOT NULL,
  reason TEXT DEFAULT 'Damaged' CHECK(reason IN ('Damaged', 'Lost', 'Expired', 'Stolen', 'Obsolete')),
  reported_by TEXT NOT NULL,
  reported_by_name TEXT NOT NULL,
  report_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  action_taken TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Procurement Wishlist (Items not yet in inventory)
CREATE TABLE IF NOT EXISTS inv_procurement_wishlist (
  id SERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL,
  estimated_unit_price DECIMAL DEFAULT 0.0,
  priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
  requested_by TEXT NOT NULL,  -- user email
  requested_by_name TEXT NOT NULL,
  department TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Purchased', 'Rejected')),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
