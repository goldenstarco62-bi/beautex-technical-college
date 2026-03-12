import { query, queryOne, run } from '../config/database.js';

// ─── HELPERS ────────────────────────────────────────────────────────────────
const generateCode = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
    try {
        const userRole = req.user.role?.toLowerCase() || 'student';
        const userEmail = req.user.email;
        const isAdmin = ['admin', 'superadmin'].includes(userRole);

        const [
            totalItems,
            totalValue,
            lowStock,
            issuedToday,
            pendingRequestsCount,
            expiringSoon,
            recentTransactions,
            recentRequests
        ] = await Promise.all([
            queryOne('SELECT COUNT(*) as count, SUM(quantity) as total_qty FROM inv_items WHERE status != ?', ['Discontinued']),
            queryOne('SELECT SUM(quantity * purchase_price) as value FROM inv_items WHERE status != ?', ['Discontinued']),
            query('SELECT COUNT(*) as count FROM inv_items WHERE quantity <= minimum_stock_level AND quantity > 0 AND status = ?', ['Available']),
            queryOne(`SELECT COUNT(*) as count FROM inv_stock_out WHERE date_issued = date('now') ${!isAdmin ? 'AND issued_to_email = ?' : ''}`, !isAdmin ? [userEmail] : []),
            queryOne(`SELECT COUNT(*) as count FROM inv_department_requests WHERE status = 'Pending' ${!isAdmin ? 'AND requested_by = ?' : ''}`, !isAdmin ? [userEmail] : []),
            query(`SELECT i.name, i.expiry_date, i.quantity, c.name as category 
                   FROM inv_items i LEFT JOIN inv_categories c ON i.category_id = c.id 
                   WHERE i.expiry_date IS NOT NULL AND i.expiry_date >= date('now') 
                   AND i.expiry_date <= date('now', '+30 days') AND i.status = 'Available'
                   ORDER BY i.expiry_date ASC LIMIT 10`),
            query(`SELECT so.*, i.name as item_name, i.unit_type 
                   FROM inv_stock_out so LEFT JOIN inv_items i ON so.item_id = i.id 
                   WHERE 1=1 ${!isAdmin ? 'AND so.issued_to_email = ?' : ''}
                   ORDER BY so.created_at DESC LIMIT 10`, !isAdmin ? [userEmail] : []),
            query(`SELECT * FROM inv_department_requests 
                   WHERE 1=1 ${!isAdmin ? 'AND requested_by = ?' : ''} 
                   ORDER BY created_at DESC LIMIT 5`, !isAdmin ? [userEmail] : [])
        ]);

        if (isAdmin) {
            const expiredItems = await queryOne(`SELECT COUNT(*) as count FROM inv_items WHERE expiry_date < date('now') AND status = 'Available'`);
            const outOfStock = await query('SELECT COUNT(*) as count FROM inv_items WHERE quantity = 0 AND status = ?', ['Available']);
            const damagedItems = await query(`SELECT COUNT(*) as count FROM inv_damage_logs WHERE report_date >= date('now', '-30 days')`);

            res.json({
                totalItems: totalItems?.count || 0,
                totalQty: totalItems?.total_qty || 0,
                totalValue: totalValue?.value || 0,
                lowStockCount: lowStock?.[0]?.count || 0,
                issuedToday: issuedToday?.count || 0,
                pendingRequests: pendingRequestsCount?.count || 0,
                expiringSoon: expiringSoon || [],
                expiredCount: expiredItems?.count || 0,
                outOfStockCount: outOfStock?.[0]?.count || 0,
                recentTransactions: recentTransactions || [],
                damagedLastMonth: damagedItems?.[0]?.count || 0,
                recentRequests: recentRequests || []
            });
        } else {
            // Teacher specific dashboard
            const myTotalIssued = await queryOne('SELECT SUM(quantity_issued) as sum FROM inv_stock_out WHERE issued_to_email = ?', [userEmail]);
            const approvedRequests = await queryOne("SELECT COUNT(*) as count FROM inv_department_requests WHERE status = 'Approved' AND requested_by = ?", [userEmail]);
            
            res.json({
                totalItems: 0,
                totalQty: myTotalIssued?.sum || 0,
                totalValue: 0,
                lowStockCount: 0,
                issuedToday: issuedToday?.count || 0,
                pendingRequests: pendingRequestsCount?.count || 0,
                approvedRequests: approvedRequests?.count || 0,
                expiringSoon: [],
                recentTransactions: recentTransactions || [],
                recentRequests: recentRequests || []
            });
        }
    } catch (err) {
        console.error('Inventory dashboard error:', err);
        res.status(500).json({ error: 'Failed to load dashboard stats' });
    }
};

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
export const getCategories = async (req, res) => {
    try {
        const cats = await query(`
            SELECT c.*, COUNT(i.id) as item_count 
            FROM inv_categories c LEFT JOIN inv_items i ON c.id = i.category_id 
            GROUP BY c.id ORDER BY c.name
        `);
        res.json(cats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};

export const createCategory = async (req, res) => {
    try {
        const { name, description, department, color } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required' });
        const result = await run(
            'INSERT INTO inv_categories (name, description, department, color) VALUES (?, ?, ?, ?)',
            [name, description, department, color || '#800000']
        );
        res.json({ id: result.lastID, name, message: 'Category created' });
    } catch (err) {
        if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Category already exists' });
        res.status(500).json({ error: 'Failed to create category' });
    }
};

export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, department, color } = req.body;
        await run('UPDATE inv_categories SET name=?, description=?, department=?, color=? WHERE id=?',
            [name, description, department, color, id]);
        res.json({ message: 'Category updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update category' });
    }
};

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const items = await queryOne('SELECT COUNT(*) as count FROM inv_items WHERE category_id=?', [id]);
        if (items?.count > 0) return res.status(409).json({ error: 'Cannot delete category with items' });
        await run('DELETE FROM inv_categories WHERE id=?', [id]);
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
};

// ─── ITEMS ────────────────────────────────────────────────────────────────────
export const getItems = async (req, res) => {
    try {
        const { category_id, status, search, low_stock, expiring } = req.query;
        let sql = `SELECT i.*, c.name as category_name, c.color as category_color, 
                   s.name as supplier_name, l.name as location_name
                   FROM inv_items i 
                   LEFT JOIN inv_categories c ON i.category_id = c.id
                   LEFT JOIN inv_suppliers s ON i.supplier_id = s.id
                   LEFT JOIN inv_locations l ON i.location_id = l.id
                   WHERE 1=1`;
        const params = [];

        if (category_id) { sql += ' AND i.category_id = ?'; params.push(category_id); }
        if (status) { sql += ' AND i.status = ?'; params.push(status); }
        if (search) { sql += ' AND (i.name LIKE ? OR i.item_code LIKE ? OR i.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        if (low_stock === 'true') { sql += ' AND i.quantity <= i.minimum_stock_level'; }
        if (expiring === 'true') { sql += " AND i.expiry_date IS NOT NULL AND i.expiry_date <= date('now', '+30 days') AND i.expiry_date >= date('now')"; }

        sql += ' ORDER BY i.name';
        const items = await query(sql, params);
        res.json(items);
    } catch (err) {
        console.error('Items error:', err);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
};

export const getItem = async (req, res) => {
    try {
        const item = await queryOne(
            `SELECT i.*, c.name as category_name, s.name as supplier_name, l.name as location_name 
             FROM inv_items i 
             LEFT JOIN inv_categories c ON i.category_id = c.id 
             LEFT JOIN inv_suppliers s ON i.supplier_id = s.id 
             LEFT JOIN inv_locations l ON i.location_id = l.id 
             WHERE i.id = ?`,
            [req.params.id]
        );
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch item' });
    }
};

export const createItem = async (req, res) => {
    try {
        let { name, category, description, quantity, unit_type, purchase_price,
            supplier_id, date_purchased, expiry_date, minimum_stock_level, location, status, serial_number, image_url } = req.body;
        
        if (!name || !category) return res.status(400).json({ error: 'Name and category are required' });

        // Ensure numbers
        quantity = parseInt(quantity) || 0;
        purchase_price = parseFloat(purchase_price) || 0;
        minimum_stock_level = parseInt(minimum_stock_level) || 5;

        // Resolve or create category ID
        let category_id;
        const existingCat = await queryOne('SELECT id FROM inv_categories WHERE name = ?', [category]);
        if (existingCat) {
            category_id = existingCat.id;
        } else {
            const newCat = await run('INSERT INTO inv_categories (name, description, department) VALUES (?, ?, ?)', [category, 'Auto-created from item entry', 'General']);
            category_id = newCat.lastID;
        }

        // Resolve or create location ID
        let location_id = null;
        if (location) {
            const existingLoc = await queryOne('SELECT id FROM inv_locations WHERE name = ?', [location]);
            if (existingLoc) {
                location_id = existingLoc.id;
            } else {
                const newLoc = await run('INSERT INTO inv_locations (name) VALUES (?)', [location]);
                location_id = newLoc.lastID;
            }
        }

        const item_code = generateCode('ITM');
        const result = await run(
            `INSERT INTO inv_items (item_code, name, category_id, description, quantity, unit_type, 
             purchase_price, supplier_id, date_purchased, expiry_date, minimum_stock_level, location_id, status, serial_number, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item_code, name, category_id, description, quantity || 0, unit_type || 'Piece',
                purchase_price || 0, supplier_id || null, date_purchased || null,
                expiry_date || null, minimum_stock_level || 5, location_id, status || 'Available', serial_number || null, image_url || null]
        );
        res.json({ id: result.lastID, item_code, message: 'Item created successfully' });
    } catch (err) {
        console.error('Create item error:', err);
        res.status(500).json({ error: 'Failed to create item', details: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
    }
};

export const updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        let { name, category, description, unit_type, purchase_price, supplier_id,
            date_purchased, expiry_date, minimum_stock_level, location, status, serial_number, image_url } = req.body;

        // Ensure numbers
        purchase_price = parseFloat(purchase_price) || 0;
        minimum_stock_level = parseInt(minimum_stock_level) || 5;

        // Resolve or create category ID
        let category_id;
        const existingCat = await queryOne('SELECT id FROM inv_categories WHERE name = ?', [category]);
        if (existingCat) {
            category_id = existingCat.id;
        } else {
            const newCat = await run('INSERT INTO inv_categories (name, description, department) VALUES (?, ?, ?)', [category, 'Auto-created from item entry', 'General']);
            category_id = newCat.lastID;
        }

        // Resolve or create location ID
        let location_id = null;
        if (location) {
            const existingLoc = await queryOne('SELECT id FROM inv_locations WHERE name = ?', [location]);
            if (existingLoc) {
                location_id = existingLoc.id;
            } else {
                const newLoc = await run('INSERT INTO inv_locations (name) VALUES (?)', [location]);
                location_id = newLoc.lastID;
            }
        }

        await run(
            `UPDATE inv_items SET name=?, category_id=?, description=?, unit_type=?, purchase_price=?,
             supplier_id=?, date_purchased=?, expiry_date=?, minimum_stock_level=?, location_id=?, 
             status=?, serial_number=?, image_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [name, category_id, description, unit_type, purchase_price, supplier_id || null,
                date_purchased || null, expiry_date || null, minimum_stock_level || 5,
                location_id, status, serial_number || null, image_url || null, id]
        );
        res.json({ message: 'Item updated successfully' });
    } catch (err) {
        console.error('Update item error:', err);
        res.status(500).json({ error: 'Failed to update item' });
    }
};

export const deleteItem = async (req, res) => {
    try {
        await run('DELETE FROM inv_items WHERE id=?', [req.params.id]);
        res.json({ message: 'Item deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
};

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
export const getSuppliers = async (req, res) => {
    try {
        const suppliers = await query('SELECT * FROM inv_suppliers ORDER BY name');
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
};

export const createSupplier = async (req, res) => {
    try {
        const { name, company, phone, email, address, products_supplied, payment_terms } = req.body;
        if (!name) return res.status(400).json({ error: 'Supplier name is required' });
        const result = await run(
            'INSERT INTO inv_suppliers (name, company, phone, email, address, products_supplied, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, company, phone, email, address,
                typeof products_supplied === 'object' ? JSON.stringify(products_supplied) : products_supplied,
                payment_terms]
        );
        res.json({ id: result.lastID, message: 'Supplier created' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create supplier' });
    }
};

export const updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, company, phone, email, address, products_supplied, payment_terms, status } = req.body;
        await run(
            `UPDATE inv_suppliers SET name=?, company=?, phone=?, email=?, address=?, 
             products_supplied=?, payment_terms=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [name, company, phone, email, address,
                typeof products_supplied === 'object' ? JSON.stringify(products_supplied) : products_supplied,
                payment_terms, status || 'Active', id]
        );
        res.json({ message: 'Supplier updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update supplier' });
    }
};

export const deleteSupplier = async (req, res) => {
    try {
        await run('DELETE FROM inv_suppliers WHERE id=?', [req.params.id]);
        res.json({ message: 'Supplier deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete supplier' });
    }
};

// ─── STOCK IN ────────────────────────────────────────────────────────────────
export const getStockIn = async (req, res) => {
    try {
        const records = await query(
            `SELECT si.*, i.name as item_name, i.unit_type, s.name as supplier_name
             FROM inv_stock_in si 
             LEFT JOIN inv_items i ON si.item_id = i.id 
             LEFT JOIN inv_suppliers s ON si.supplier_id = s.id
             ORDER BY si.created_at DESC`
        );
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stock in records' });
    }
};

export const createStockIn = async (req, res) => {
    try {
        const { item_id, supplier_id, quantity_received, batch_number, expiry_date,
            date_received, unit_cost, notes } = req.body;
        if (!item_id || !quantity_received) return res.status(400).json({ error: 'Item and quantity are required' });

        const received_by = req.user.email;
        const received_by_name = req.user.name || req.user.email;

        // Record stock in
        const result = await run(
            `INSERT INTO inv_stock_in (item_id, supplier_id, quantity_received, batch_number, expiry_date, 
             received_by, received_by_name, date_received, unit_cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item_id, supplier_id || null, quantity_received, batch_number, expiry_date || null,
                received_by, received_by_name, date_received || new Date().toISOString().split('T')[0],
                unit_cost || 0, notes]
        );

        // Update item quantity
        await run('UPDATE inv_items SET quantity = quantity + ?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            [quantity_received, item_id]);

        // Update expiry date if provided
        if (expiry_date) {
            await run('UPDATE inv_items SET expiry_date=? WHERE id=?', [expiry_date, item_id]);
        }

        res.json({ id: result.lastID, message: 'Stock received and inventory updated' });
    } catch (err) {
        console.error('Stock in error:', err);
        res.status(500).json({ error: 'Failed to record stock in' });
    }
};

// ─── STOCK OUT ────────────────────────────────────────────────────────────────
export const getStockOut = async (req, res) => {
    try {
        let sql = `SELECT so.*, i.name as item_name, i.unit_type
                 FROM inv_stock_out so 
                 LEFT JOIN inv_items i ON so.item_id = i.id 
                 WHERE 1=1`;
        const params = [];

        if (req.user.role === 'teacher') {
            sql += ' AND so.issued_to_email = ?';
            params.push(req.user.email);
        }

        sql += ' ORDER BY so.created_at DESC';
        const records = await query(sql, params);
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stock out records' });
    }
};

export const createStockOut = async (req, res) => {
    try {
        const { item_id, quantity_issued, department, issued_to, issued_to_email, purpose, approved_by, date_issued, notes } = req.body;
        if (!item_id || !quantity_issued || !department || !issued_to) {
            return res.status(400).json({ error: 'Item, quantity, department, and recipient are required' });
        }

        // Check available quantity
        const item = await queryOne('SELECT * FROM inv_items WHERE id=?', [item_id]);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (item.quantity < quantity_issued) {
            return res.status(400).json({ error: `Insufficient stock. Available: ${item.quantity} ${item.unit_type}` });
        }

        const result = await run(
            `INSERT INTO inv_stock_out (item_id, quantity_issued, department, issued_to, issued_to_email, 
             purpose, approved_by, date_issued, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item_id, quantity_issued, department, issued_to, issued_to_email, purpose,
                approved_by, date_issued || new Date().toISOString().split('T')[0], notes]
        );

        // Deduct from inventory
        await run('UPDATE inv_items SET quantity = quantity - ?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            [quantity_issued, item_id]);

        res.json({ id: result.lastID, message: 'Stock issued successfully' });
    } catch (err) {
        console.error('Stock out error:', err);
        res.status(500).json({ error: 'Failed to issue stock' });
    }
};

// ─── DEPARTMENT REQUESTS ─────────────────────────────────────────────────────
export const getDepartmentRequests = async (req, res) => {
    try {
        const { status, department } = req.query;
        let sql = `SELECT dr.*, i.name as item_name_actual, i.quantity as available_qty, i.unit_type
                   FROM inv_department_requests dr 
                   LEFT JOIN inv_items i ON dr.item_id = i.id 
                   WHERE 1=1`;
        const params = [];

        // Trainers/teachers see only their requests
        if (req.user.role === 'teacher') {
            sql += ' AND dr.requested_by = ?';
            params.push(req.user.email);
        } else if (department) {
            sql += ' AND dr.department = ?';
            params.push(department);
        }
        if (status) { sql += ' AND dr.status = ?'; params.push(status); }
        sql += ' ORDER BY dr.created_at DESC';

        const requests = await query(sql, params);
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
};

export const createDepartmentRequest = async (req, res) => {
    try {
        const { item_id, item_name, department, quantity, purpose, notes } = req.body;
        if (!item_name || !department || !quantity) {
            return res.status(400).json({ error: 'Item, department, and quantity are required' });
        }

        const request_id = generateCode('REQ');
        await run(
            `INSERT INTO inv_department_requests (request_id, department, requested_by, requested_by_name, 
             item_id, item_name, quantity, purpose, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [request_id, department, req.user.email, req.user.name || req.user.email,
                item_id || null, item_name, quantity, purpose, notes]
        );
        res.json({ request_id, message: 'Request submitted successfully' });
    } catch (err) {
        console.error('Create request error:', err);
        res.status(500).json({ error: 'Failed to submit request' });
    }
};

export const updateDepartmentRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejection_reason, notes } = req.body;
        const approved_by = req.user.email;

        await run(
            `UPDATE inv_department_requests SET status=?, approved_by=?, approved_date=date('now'), 
             rejection_reason=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [status, status !== 'Pending' ? approved_by : null, rejection_reason, notes, id]
        );

        // If approved and issued, auto-create stock out record
        if (status === 'Issued') {
            const req_row = await queryOne('SELECT * FROM inv_department_requests WHERE id=?', [id]);
            if (req_row?.item_id) {
                const item = await queryOne('SELECT * FROM inv_items WHERE id=?', [req_row.item_id]);
                if (item && item.quantity >= req_row.quantity) {
                    await run(
                        `INSERT INTO inv_stock_out (item_id, quantity_issued, department, issued_to, issued_to_email, 
                         purpose, approved_by, date_issued) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`,
                        [req_row.item_id, req_row.quantity, req_row.department,
                            req_row.requested_by_name, req_row.requested_by, req_row.purpose, approved_by]
                    );
                    await run('UPDATE inv_items SET quantity = quantity - ? WHERE id=?', [req_row.quantity, req_row.item_id]);
                    await run(`UPDATE inv_department_requests SET issued_date=date('now') WHERE id=?`, [id]);
                }
            }
        }

        res.json({ message: 'Request updated' });
    } catch (err) {
        console.error('Update request error:', err);
        res.status(500).json({ error: 'Failed to update request' });
    }
};

export const deleteDepartmentRequest = async (req, res) => {
    try {
        await run('DELETE FROM inv_department_requests WHERE id=?', [req.params.id]);
        res.json({ message: 'Request deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete request' });
    }
};

// ─── PURCHASE REQUESTS ────────────────────────────────────────────────────────
export const getPurchaseRequests = async (req, res) => {
    try {
        const records = await query(
            `SELECT pr.*, s.name as supplier_name 
             FROM inv_purchase_requests pr 
             LEFT JOIN inv_suppliers s ON pr.supplier_id = s.id 
             ORDER BY pr.created_at DESC`
        );
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch purchase requests' });
    }
};

export const createPurchaseRequest = async (req, res) => {
    try {
        const { supplier_id, item_name, department, quantity, cost_per_item,
            purchase_date, delivery_date, invoice_number, notes } = req.body;
        if (!item_name || !quantity) return res.status(400).json({ error: 'Item name and quantity are required' });

        const request_number = generateCode('PO');
        const total_cost = (cost_per_item || 0) * quantity;

        await run(
            `INSERT INTO inv_purchase_requests (request_number, supplier_id, requested_by, requested_by_name, 
             department, item_name, quantity, cost_per_item, total_cost, purchase_date, delivery_date, 
             invoice_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [request_number, supplier_id || null, req.user.email, req.user.name || req.user.email,
                department, item_name, quantity, cost_per_item || 0, total_cost,
                purchase_date || null, delivery_date || null, invoice_number, notes]
        );
        res.json({ request_number, message: 'Purchase request created' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create purchase request' });
    }
};

export const updatePurchaseRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { approval_status, payment_status, invoice_number, delivery_date, notes, supplier_id, cost_per_item, quantity } = req.body;
        const total_cost = cost_per_item && quantity ? cost_per_item * quantity : undefined;

        await run(
            `UPDATE inv_purchase_requests SET approval_status=?, payment_status=?, invoice_number=?, 
             delivery_date=?, notes=?, supplier_id=?, cost_per_item=?, 
             ${total_cost !== undefined ? 'total_cost=?,' : ''}
             approved_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [approval_status, payment_status, invoice_number, delivery_date, notes, supplier_id || null,
                cost_per_item,
                ...(total_cost !== undefined ? [total_cost] : []),
                req.user.email, id]
        );
        res.json({ message: 'Purchase request updated' });
    } catch (err) {
        console.error('Update purchase error:', err);
        res.status(500).json({ error: 'Failed to update purchase request' });
    }
};

export const deletePurchaseRequest = async (req, res) => {
    try {
        await run('DELETE FROM inv_purchase_requests WHERE id=?', [req.params.id]);
        res.json({ message: 'Purchase request deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete purchase request' });
    }
};

// ─── ASSETS ───────────────────────────────────────────────────────────────────
export const getAssets = async (req, res) => {
    try {
        const assets = await query(
            `SELECT a.*, c.name as category_name, l.name as location_name, s.name as supplier_name
             FROM inv_assets a 
             LEFT JOIN inv_categories c ON a.category_id = c.id 
             LEFT JOIN inv_locations l ON a.location_id = l.id
             LEFT JOIN inv_suppliers s ON a.supplier_id = s.id
             ORDER BY a.name`
        );
        res.json(assets);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
};

export const createAsset = async (req, res) => {
    try {
        const { name, serial_number, category_id, department_assigned, location_id,
            condition, purchase_date, purchase_price, supplier_id, warranty_expiry,
            maintenance_schedule, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Asset name is required' });

        const asset_tag = generateCode('AST');
        await run(
            `INSERT INTO inv_assets (asset_tag, name, serial_number, category_id, department_assigned, 
             location_id, condition, purchase_date, purchase_price, supplier_id, warranty_expiry, 
             maintenance_schedule, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [asset_tag, name, serial_number, category_id || null, department_assigned,
                location_id || null, condition || 'Good', purchase_date || null,
                purchase_price || 0, supplier_id || null, warranty_expiry || null,
                maintenance_schedule, notes]
        );
        res.json({ asset_tag, message: 'Asset registered successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create asset' });
    }
};

export const updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, serial_number, category_id, department_assigned, location_id,
            condition, purchase_date, purchase_price, supplier_id, warranty_expiry,
            maintenance_schedule, last_maintenance_date, notes, status } = req.body;
        await run(
            `UPDATE inv_assets SET name=?, serial_number=?, category_id=?, department_assigned=?, 
             location_id=?, condition=?, purchase_date=?, purchase_price=?, supplier_id=?, 
             warranty_expiry=?, maintenance_schedule=?, last_maintenance_date=?, notes=?, 
             status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [name, serial_number, category_id || null, department_assigned, location_id || null,
                condition, purchase_date, purchase_price, supplier_id || null, warranty_expiry || null,
                maintenance_schedule, last_maintenance_date || null, notes, status || 'Active', id]
        );
        res.json({ message: 'Asset updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update asset' });
    }
};

export const deleteAsset = async (req, res) => {
    try {
        await run('DELETE FROM inv_assets WHERE id=?', [req.params.id]);
        res.json({ message: 'Asset deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete asset' });
    }
};

// ─── DAMAGE LOGS ─────────────────────────────────────────────────────────────
export const getDamageLogs = async (req, res) => {
    try {
        const logs = await query(
            `SELECT dl.*, i.name as item_name, i.unit_type
             FROM inv_damage_logs dl 
             LEFT JOIN inv_items i ON dl.item_id = i.id 
             ORDER BY dl.created_at DESC`
        );
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch damage logs' });
    }
};

export const createDamageLog = async (req, res) => {
    try {
        const { item_id, quantity, reason, description, action_taken, report_date } = req.body;
        if (!item_id || !quantity || !reason) {
            return res.status(400).json({ error: 'Item, quantity, and reason are required' });
        }

        const item = await queryOne('SELECT * FROM inv_items WHERE id=?', [item_id]);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (item.quantity < quantity) {
            return res.status(400).json({ error: `Cannot log more than available quantity (${item.quantity})` });
        }

        await run(
            `INSERT INTO inv_damage_logs (item_id, quantity, reason, reported_by, reported_by_name, 
             report_date, description, action_taken) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [item_id, quantity, reason, req.user.email, req.user.name || req.user.email,
                report_date || new Date().toISOString().split('T')[0], description, action_taken]
        );

        // Update item quantity and status if all damaged
        await run('UPDATE inv_items SET quantity = quantity - ? WHERE id=?', [quantity, item_id]);

        res.json({ message: 'Damage/loss logged and inventory updated' });
    } catch (err) {
        console.error('Damage log error:', err);
        res.status(500).json({ error: 'Failed to log damage' });
    }
};

// ─── LOCATIONS ────────────────────────────────────────────────────────────────
export const getLocations = async (req, res) => {
    try {
        const locations = await query('SELECT * FROM inv_locations ORDER BY name');
        res.json(locations);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
};

export const createLocation = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Location name is required' });
        const result = await run('INSERT INTO inv_locations (name, description) VALUES (?, ?)', [name, description]);
        res.json({ id: result.lastID, message: 'Location created' });
    } catch (err) {
        if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Location already exists' });
        res.status(500).json({ error: 'Failed to create location' });
    }
};

export const deleteLocation = async (req, res) => {
    try {
        await run('DELETE FROM inv_locations WHERE id=?', [req.params.id]);
        res.json({ message: 'Location deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete location' });
    }
};

// ─── REPORTS ─────────────────────────────────────────────────────────────────
export const getReport = async (req, res) => {
    try {
        const { type } = req.params;
        let data = {};

        switch (type) {
            case 'current-stock':
                data = await query(
                    `SELECT i.*, c.name as category_name, l.name as location_name, s.name as supplier_name
                     FROM inv_items i 
                     LEFT JOIN inv_categories c ON i.category_id = c.id
                     LEFT JOIN inv_locations l ON i.location_id = l.id
                     LEFT JOIN inv_suppliers s ON i.supplier_id = s.id
                     ORDER BY c.name, i.name`
                );
                break;
            case 'low-stock':
                data = await query(
                    `SELECT i.*, c.name as category_name FROM inv_items i 
                     LEFT JOIN inv_categories c ON i.category_id = c.id
                     WHERE i.quantity <= i.minimum_stock_level ORDER BY i.quantity ASC`
                );
                break;
            case 'expiry':
                data = await query(
                    `SELECT i.*, c.name as category_name FROM inv_items i 
                     LEFT JOIN inv_categories c ON i.category_id = c.id
                     WHERE i.expiry_date IS NOT NULL ORDER BY i.expiry_date ASC`
                );
                break;
            case 'issued':
                data = await query(
                    `SELECT so.*, i.name as item_name, i.unit_type FROM inv_stock_out so 
                     LEFT JOIN inv_items i ON so.item_id = i.id 
                     ORDER BY so.date_issued DESC`
                );
                break;
            case 'damaged':
                data = await query(
                    `SELECT dl.*, i.name as item_name, i.unit_type FROM inv_damage_logs dl 
                     LEFT JOIN inv_items i ON dl.item_id = i.id 
                     ORDER BY dl.report_date DESC`
                );
                break;
            case 'value':
                data = await query(
                    `SELECT c.name as category, COUNT(i.id) as item_count, 
                     SUM(i.quantity) as total_qty, SUM(i.quantity * i.purchase_price) as total_value
                     FROM inv_items i LEFT JOIN inv_categories c ON i.category_id = c.id
                     WHERE i.status != 'Discontinued'
                     GROUP BY c.name ORDER BY total_value DESC`
                );
                break;
            case 'purchases':
                data = await query(
                    `SELECT pr.*, s.name as supplier_name FROM inv_purchase_requests pr 
                     LEFT JOIN inv_suppliers s ON pr.supplier_id = s.id 
                     ORDER BY pr.created_at DESC`
                );
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }
        res.json({ type, data, generated_at: new Date().toISOString() });
    } catch (err) {
        console.error('Report error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};
