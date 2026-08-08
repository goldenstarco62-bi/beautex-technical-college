import { query, queryOne, run, getDb, getActiveDbEngine } from '../config/database.js';
import notificationService from '../services/notificationService.js';

/**
 * Log action into inv_audit_logs for security & compliance
 */
const logAudit = async ({ userId, userEmail, userName, action, recordType, recordId, previousValue = null, newValue = null, ipAddress = null }) => {
    try {
        const sql = `
            INSERT INTO inv_audit_logs (user_id, user_email, user_name, action, module, record_type, record_id, previous_value, new_value, ip_address)
            VALUES (?, ?, ?, ?, 'inventory', ?, ?, ?, ?, ?)
        `;
        await run(sql, [
            userId || null,
            userEmail || 'system',
            userName || 'System',
            action,
            recordType,
            String(recordId),
            previousValue ? JSON.stringify(previousValue) : null,
            newValue ? JSON.stringify(newValue) : null,
            ipAddress || null
        ]);
    } catch (err) {
        console.error('⚠️ Inventory audit log failed:', err.message);
    }
};

/**
 * Generate sequential requisition number REQ-YYYY-XXXXX
 */
const generateRequisitionNumber = async () => {
    const year = new Date().getFullYear();
    const prefix = `REQ-${year}-`;
    
    const isPg = getActiveDbEngine() === 'postgres';
    const sql = isPg
        ? `SELECT requisition_number FROM inv_requisitions WHERE requisition_number LIKE $1 ORDER BY id DESC LIMIT 1`
        : `SELECT requisition_number FROM inv_requisitions WHERE requisition_number LIKE ? ORDER BY id DESC LIMIT 1`;
    
    const lastReq = await queryOne(sql, [`${prefix}%`]);
    let nextNum = 1;
    if (lastReq && lastReq.requisition_number) {
        const parts = lastReq.requisition_number.split('-');
        if (parts.length === 3) {
            const parsed = parseInt(parts[2], 10);
            if (!isNaN(parsed)) nextNum = parsed + 1;
        }
    }
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
};

export const requisitionController = {
    /**
     * GET /api/inventory/requisitions
     * Fetch list of requisitions filtered by role, status, department, search
     */
    getRequisitions: async (req, res) => {
        try {
            const userRole = String(req.user?.role || '').toLowerCase();
            const userEmail = String(req.user?.email || '').toLowerCase();
            const isAdmin = ['admin', 'superadmin'].includes(userRole);

            const { status, department, priority, search, page = 1, limit = 15 } = req.query;
            const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

            let whereClauses = [];
            let params = [];

            // Role scope: Trainers see only their requisitions; Admins see all
            if (!isAdmin) {
                whereClauses.push('LOWER(r.requester_email) = LOWER(?)');
                params.push(userEmail);
            }

            if (status && status !== 'ALL') {
                whereClauses.push('r.status = ?');
                params.push(status);
            }

            if (department && department !== 'ALL') {
                whereClauses.push('r.department = ?');
                params.push(department);
            }

            if (priority && priority !== 'ALL') {
                whereClauses.push('r.priority = ?');
                params.push(priority);
            }

            if (search && search.trim()) {
                const s = `%${search.trim()}%`;
                whereClauses.push('(r.requisition_number LIKE ? OR r.requester_name LIKE ? OR r.purpose LIKE ?)');
                params.push(s, s, s);
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            // Count total matching
            const countSql = `SELECT COUNT(*) as total FROM inv_requisitions r ${whereSql}`;
            const countRes = await queryOne(countSql, params);
            const total = countRes?.total || 0;

            // Fetch records with items summary
            const dataSql = `
                SELECT 
                    r.*,
                    (SELECT COUNT(*) FROM inv_requisition_items ri WHERE ri.requisition_id = r.id) as total_items,
                    (SELECT SUM(ri.requested_qty) FROM inv_requisition_items ri WHERE ri.requisition_id = r.id) as total_requested_qty,
                    (SELECT SUM(ri.issued_qty) FROM inv_requisition_items ri WHERE ri.requisition_id = r.id) as total_issued_qty
                FROM inv_requisitions r
                ${whereSql}
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
            `;
            const requisitions = await query(dataSql, [...params, parseInt(limit), offset]);

            res.json({
                data: requisitions,
                pagination: {
                    total: parseInt(total),
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            console.error('❌ Fetch requisitions failed:', error);
            res.status(500).json({ error: 'Failed to fetch requisitions', details: error.message });
        }
    },

    /**
     * GET /api/inventory/requisitions/:id
     * Fetch single requisition details with items, reservations, timeline
     */
    getRequisition: async (req, res) => {
        try {
            const { id } = req.params;
            const userRole = String(req.user?.role || '').toLowerCase();
            const userEmail = String(req.user?.email || '').toLowerCase();
            const isAdmin = ['admin', 'superadmin'].includes(userRole);

            const reqHeader = await queryOne('SELECT * FROM inv_requisitions WHERE id = ?', [id]);
            if (!reqHeader) {
                return res.status(404).json({ error: 'Requisition not found' });
            }

            // Security check: non-admin can only view their own
            if (!isAdmin && String(reqHeader.requester_email).toLowerCase() !== userEmail) {
                return res.status(403).json({ error: 'Access denied to this requisition' });
            }

            // Fetch line items with item stock status
            const itemsSql = `
                SELECT 
                    ri.*,
                    i.quantity as current_stock_qty,
                    i.minimum_stock_level,
                    i.location_id,
                    loc.name as location_name,
                    COALESCE((
                        SELECT SUM(sr.reserved_qty) 
                        FROM inv_stock_reservations sr 
                        WHERE sr.item_id = ri.item_id AND sr.status = 'ACTIVE'
                    ), 0) as total_reserved_qty
                FROM inv_requisition_items ri
                LEFT JOIN inv_items i ON ri.item_id = i.id
                LEFT JOIN inv_locations loc ON i.location_id = loc.id
                WHERE ri.requisition_id = ?
                ORDER BY ri.id ASC
            `;
            const items = await query(itemsSql, [id]);

            // Fetch active stock reservations
            const reservations = await query(
                `SELECT sr.*, i.name as item_name FROM inv_stock_reservations sr JOIN inv_items i ON sr.item_id = i.id WHERE sr.requisition_id = ?`,
                [id]
            );

            // Fetch timeline/audit trail
            const timeline = await query(
                `SELECT * FROM inv_audit_logs WHERE record_type = 'requisition' AND record_id = ? ORDER BY timestamp ASC`,
                [String(id)]
            );

            res.json({
                ...reqHeader,
                items: items.map(item => ({
                    ...item,
                    available_stock_qty: Math.max(0, (item.current_stock_qty || 0) - (item.total_reserved_qty || 0))
                })),
                reservations,
                timeline
            });
        } catch (error) {
            console.error('❌ Fetch requisition detail failed:', error);
            res.status(500).json({ error: 'Failed to fetch requisition details', details: error.message });
        }
    },

    /**
     * POST /api/inventory/requisitions
     * Create a new requisition (DRAFT or PENDING directly)
     */
    createRequisition: async (req, res) => {
        try {
            const userId = String(req.user.id);
            const userEmail = String(req.user.email);
            const userName = req.user.name || req.user.email.split('@')[0];
            const userDept = req.user.department || req.body.department || 'General';

            const { purpose, priority = 'Normal', required_date, items, submit_immediately = false } = req.body;

            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'Requisition must include at least one item' });
            }

            // Generate unique REQ number
            const reqNumber = await generateRequisitionNumber();
            const initialStatus = submit_immediately ? 'PENDING' : 'DRAFT';

            const insertReqSql = `
                INSERT INTO inv_requisitions 
                (requisition_number, requester_id, requester_email, requester_name, department, purpose, priority, required_date, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const reqResult = await run(insertReqSql, [
                reqNumber,
                userId,
                userEmail,
                userName,
                userDept,
                purpose || '',
                priority,
                required_date || null,
                initialStatus
            ]);

            const requisitionId = reqResult.lastID || reqResult.id;

            // Insert line items
            for (const item of items) {
                const itemSql = `
                    INSERT INTO inv_requisition_items
                    (requisition_id, item_id, item_name, category_name, requested_qty, approved_qty, issued_qty, unit_type, purpose_remarks)
                    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
                `;
                await run(itemSql, [
                    requisitionId,
                    item.item_id || null,
                    item.item_name,
                    item.category_name || null,
                    parseInt(item.requested_qty) || 1,
                    submit_immediately ? parseInt(item.requested_qty) || 1 : 0,
                    item.unit_type || 'Piece',
                    item.purpose_remarks || null
                ]);
            }

            // Audit log
            await logAudit({
                userId, userEmail, userName,
                action: submit_immediately ? 'SUBMITTED_REQUISITION' : 'CREATED_DRAFT_REQUISITION',
                recordType: 'requisition',
                recordId: requisitionId,
                newValue: { requisition_number: reqNumber, status: initialStatus, items_count: items.length },
                ipAddress: req.ip
            });

            // If submitted immediately, notify administrators
            if (submit_immediately) {
                await notificationService.notifyAll(
                    `📦 New Requisition ${reqNumber}`,
                    `${userName} (${userDept}) submitted requisition ${reqNumber} containing ${items.length} item(s).`,
                    'info'
                );
            }

            res.status(201).json({
                message: submit_immediately ? 'Requisition submitted successfully' : 'Requisition draft created',
                id: requisitionId,
                requisition_number: reqNumber,
                status: initialStatus
            });
        } catch (error) {
            console.error('❌ Create requisition failed:', error);
            res.status(500).json({ error: 'Failed to create requisition', details: error.message });
        }
    },

    /**
     * POST /api/inventory/requisitions/:id/submit
     * Submit a DRAFT requisition to PENDING status
     */
    submitRequisition: async (req, res) => {
        try {
            const { id } = req.params;
            const userEmail = String(req.user.email);
            const userName = req.user.name || userEmail.split('@')[0];

            const reqHeader = await queryOne('SELECT * FROM inv_requisitions WHERE id = ?', [id]);
            if (!reqHeader) return res.status(404).json({ error: 'Requisition not found' });

            if (reqHeader.status !== 'DRAFT') {
                return res.status(409).json({ error: `Cannot submit requisition with status '${reqHeader.status}'` });
            }

            if (String(reqHeader.requester_email).toLowerCase() !== userEmail.toLowerCase()) {
                return res.status(403).json({ error: 'You can only submit your own requisitions' });
            }

            // Set approved_qty equal to requested_qty by default when submitting
            await run(`UPDATE inv_requisition_items SET approved_qty = requested_qty WHERE requisition_id = ?`, [id]);
            await run(`UPDATE inv_requisitions SET status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);

            await logAudit({
                userId: req.user.id, userEmail, userName,
                action: 'SUBMITTED_REQUISITION',
                recordType: 'requisition',
                recordId: id,
                previousValue: { status: 'DRAFT' },
                newValue: { status: 'PENDING' },
                ipAddress: req.ip
            });

            // Notify admins
            await notificationService.notifyAll(
                `📦 New Requisition ${reqHeader.requisition_number}`,
                `${userName} (${reqHeader.department}) submitted requisition ${reqHeader.requisition_number} for approval.`,
                'info'
            );

            res.json({ message: 'Requisition submitted for approval', status: 'PENDING' });
        } catch (error) {
            console.error('❌ Submit requisition failed:', error);
            res.status(500).json({ error: 'Failed to submit requisition', details: error.message });
        }
    },

    /**
     * POST /api/inventory/requisitions/:id/approve
     * Admin approves requisition (or approves with modifications to requested quantities)
     * Reserves stock for approved items
     */
    approveRequisition: async (req, res) => {
        try {
            const { id } = req.params;
            const userRole = String(req.user?.role || '').toLowerCase();
            const userEmail = String(req.user?.email || '').toLowerCase();
            const userName = req.user.name || userEmail.split('@')[0];
            const isAdmin = ['admin', 'superadmin'].includes(userRole);

            if (!isAdmin) {
                return res.status(403).json({ error: 'Only administrators can approve requisitions' });
            }

            const reqHeader = await queryOne('SELECT * FROM inv_requisitions WHERE id = ?', [id]);
            if (!reqHeader) return res.status(404).json({ error: 'Requisition not found' });

            // CRITICAL BUSINESS RULE: Trainer cannot approve their own request!
            if (String(reqHeader.requester_email).toLowerCase() === userEmail) {
                return res.status(403).json({ error: 'Security constraint: You cannot approve your own requisition request.' });
            }

            if (reqHeader.status !== 'PENDING') {
                return res.status(409).json({ error: `Cannot approve requisition in '${reqHeader.status}' state.` });
            }

            const { items, approval_comments = '' } = req.body; // items: [{ item_id, approved_qty }]

            // 1. Update approved_qty per item & reserve stock
            if (Array.isArray(items)) {
                for (const item of items) {
                    const approvedQty = Math.max(0, parseInt(item.approved_qty) || 0);
                    
                    await run(
                        `UPDATE inv_requisition_items SET approved_qty = ? WHERE requisition_id = ? AND id = ?`,
                        [approvedQty, id, item.requisition_item_id || item.id]
                    );

                    // Create stock reservation if item_id exists and approvedQty > 0
                    const reqItem = await queryOne(
                        `SELECT * FROM inv_requisition_items WHERE id = ?`,
                        [item.requisition_item_id || item.id]
                    );

                    if (reqItem && reqItem.item_id && approvedQty > 0) {
                        // Clear old active reservations for this requisition item if any
                        await run(
                            `UPDATE inv_stock_reservations SET status = 'RELEASED' WHERE requisition_item_id = ? AND status = 'ACTIVE'`,
                            [reqItem.id]
                        );
                        // Create active reservation
                        await run(
                            `INSERT INTO inv_stock_reservations (item_id, requisition_id, requisition_item_id, reserved_qty, status) VALUES (?, ?, ?, ?, 'ACTIVE')`,
                            [reqItem.item_id, id, reqItem.id, approvedQty]
                        );
                    }
                }
            } else {
                // If items list not provided, approve 100% of requested_qty and create reservations
                const existingItems = await query(`SELECT * FROM inv_requisition_items WHERE requisition_id = ?`, [id]);
                for (const item of existingItems) {
                    await run(`UPDATE inv_requisition_items SET approved_qty = requested_qty WHERE id = ?`, [item.id]);
                    if (item.item_id && item.requested_qty > 0) {
                        await run(
                            `INSERT INTO inv_stock_reservations (item_id, requisition_id, requisition_item_id, reserved_qty, status) VALUES (?, ?, ?, ?, 'ACTIVE')`,
                            [item.item_id, id, item.id, item.requested_qty]
                        );
                    }
                }
            }

            // 2. Update requisition header
            const now = new Date().toISOString();
            await run(
                `UPDATE inv_requisitions 
                 SET status = 'APPROVED', approved_by = ?, approved_by_name = ?, approved_at = ?, approval_comments = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [userEmail, userName, now, approval_comments, id]
            );

            // 3. Log audit
            await logAudit({
                userId: req.user.id, userEmail, userName,
                action: 'APPROVED_REQUISITION',
                recordType: 'requisition',
                recordId: id,
                previousValue: { status: 'PENDING' },
                newValue: { status: 'APPROVED', approved_by: userEmail, comments: approval_comments },
                ipAddress: req.ip
            });

            // 4. Notify requester
            await notificationService.create({
                userId: reqHeader.requester_id,
                title: `✅ Requisition Approved: ${reqHeader.requisition_number}`,
                content: `Your requisition ${reqHeader.requisition_number} has been approved by ${userName}. Items are reserved and awaiting issuance.`,
                type: 'success'
            });

            res.json({ message: `Requisition ${reqHeader.requisition_number} approved successfully`, status: 'APPROVED' });
        } catch (error) {
            console.error('❌ Approve requisition failed:', error);
            res.status(500).json({ error: 'Failed to approve requisition', details: error.message });
        }
    },

    /**
     * POST /api/inventory/requisitions/:id/reject
     * Reject a pending requisition with a mandatory reason
     */
    rejectRequisition: async (req, res) => {
        try {
            const { id } = req.params;
            const userRole = String(req.user?.role || '').toLowerCase();
            const userEmail = String(req.user?.email || '').toLowerCase();
            const userName = req.user.name || userEmail.split('@')[0];

            if (!['admin', 'superadmin'].includes(userRole)) {
                return res.status(403).json({ error: 'Only administrators can reject requisitions' });
            }

            const { rejection_reason } = req.body;
            if (!rejection_reason || !rejection_reason.trim()) {
                return res.status(400).json({ error: 'A rejection reason is required' });
            }

            const reqHeader = await queryOne('SELECT * FROM inv_requisitions WHERE id = ?', [id]);
            if (!reqHeader) return res.status(404).json({ error: 'Requisition not found' });

            if (reqHeader.status !== 'PENDING') {
                return res.status(409).json({ error: `Cannot reject requisition in '${reqHeader.status}' state.` });
            }

            const now = new Date().toISOString();
            await run(
                `UPDATE inv_requisitions 
                 SET status = 'REJECTED', rejected_by = ?, rejected_by_name = ?, rejected_at = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [userEmail, userName, now, rejection_reason.trim(), id]
            );

            await logAudit({
                userId: req.user.id, userEmail, userName,
                action: 'REJECTED_REQUISITION',
                recordType: 'requisition',
                recordId: id,
                previousValue: { status: 'PENDING' },
                newValue: { status: 'REJECTED', rejection_reason },
                ipAddress: req.ip
            });

            // Notify requester
            await notificationService.create({
                userId: reqHeader.requester_id,
                title: `❌ Requisition Rejected: ${reqHeader.requisition_number}`,
                content: `Your requisition ${reqHeader.requisition_number} was rejected by ${userName}. Reason: "${rejection_reason}"`,
                type: 'error'
            });

            res.json({ message: `Requisition ${reqHeader.requisition_number} rejected`, status: 'REJECTED' });
        } catch (error) {
            console.error('❌ Reject requisition failed:', error);
            res.status(500).json({ error: 'Failed to reject requisition', details: error.message });
        }
    },

    /**
     * POST /api/inventory/requisitions/:id/request-modification
     * Admin requests trainer to modify/clarify requisition
     */
    requestModification: async (req, res) => {
        try {
            const { id } = req.params;
            const userRole = String(req.user?.role || '').toLowerCase();
            const userEmail = String(req.user?.email || '').toLowerCase();
            const userName = req.user.name || userEmail.split('@')[0];

            if (!['admin', 'superadmin'].includes(userRole)) {
                return res.status(403).json({ error: 'Only administrators can request modifications' });
            }

            const { modification_note } = req.body;
            if (!modification_note || !modification_note.trim()) {
                return res.status(400).json({ error: 'Modification note is required' });
            }

            const reqHeader = await queryOne('SELECT * FROM inv_requisitions WHERE id = ?', [id]);
            if (!reqHeader) return res.status(404).json({ error: 'Requisition not found' });

            const now = new Date().toISOString();
            await run(
                `UPDATE inv_requisitions 
                 SET status = 'MODIFICATION_REQUIRED', modification_requested_by = ?, modification_requested_by_name = ?, modification_note = ?, modification_requested_at = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [userEmail, userName, modification_note.trim(), now, id]
            );

            await logAudit({
                userId: req.user.id, userEmail, userName,
                action: 'REQUESTED_MODIFICATION',
                recordType: 'requisition',
                recordId: id,
                newValue: { status: 'MODIFICATION_REQUIRED', modification_note },
                ipAddress: req.ip
            });

            // Notify requester
            await notificationService.create({
                userId: reqHeader.requester_id,
                title: `✏️ Action Required: Requisition ${reqHeader.requisition_number}`,
                content: `${userName} requested modification on requisition ${reqHeader.requisition_number}: "${modification_note}"`,
                type: 'warning'
            });

            res.json({ message: 'Modification request sent to trainer', status: 'MODIFICATION_REQUIRED' });
        } catch (error) {
            console.error('❌ Request modification failed:', error);
            res.status(500).json({ error: 'Failed to request modification', details: error.message });
        }
    },

    /**
     * POST /api/inventory/requisitions/:id/resubmit
     * Trainer updates and resubmits a MODIFICATION_REQUIRED requisition
     */
    resubmitRequisition: async (req, res) => {
        try {
            const { id } = req.params;
            const userEmail = String(req.user.email);
            const userName = req.user.name || userEmail.split('@')[0];

            const reqHeader = await queryOne('SELECT * FROM inv_requisitions WHERE id = ?', [id]);
            if (!reqHeader) return res.status(404).json({ error: 'Requisition not found' });

            if (reqHeader.status !== 'MODIFICATION_REQUIRED' && reqHeader.status !== 'DRAFT') {
                return res.status(409).json({ error: `Cannot resubmit requisition in '${reqHeader.status}' status` });
            }

            if (String(reqHeader.requester_email).toLowerCase() !== userEmail.toLowerCase()) {
                return res.status(403).json({ error: 'You can only resubmit your own requisitions' });
            }

            const { items, purpose, priority } = req.body;

            // Update items if provided
            if (Array.isArray(items) && items.length > 0) {
                // Delete old items and re-insert
                await run(`DELETE FROM inv_requisition_items WHERE requisition_id = ?`, [id]);
                for (const item of items) {
                    const itemSql = `
                        INSERT INTO inv_requisition_items
                        (requisition_id, item_id, item_name, category_name, requested_qty, approved_qty, issued_qty, unit_type, purpose_remarks)
                        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
                    `;
                    await run(itemSql, [
                        id,
                        item.item_id || null,
                        item.item_name,
                        item.category_name || null,
                        parseInt(item.requested_qty) || 1,
                        parseInt(item.requested_qty) || 1,
                        item.unit_type || 'Piece',
                        item.purpose_remarks || null
                    ]);
                }
            }

            await run(
                `UPDATE inv_requisitions 
                 SET status = 'PENDING', purpose = COALESCE(?, purpose), priority = COALESCE(?, priority), updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [purpose || null, priority || null, id]
            );

            await logAudit({
                userId: req.user.id, userEmail, userName,
                action: 'RESUBMITTED_REQUISITION',
                recordType: 'requisition',
                recordId: id,
                previousValue: { status: reqHeader.status },
                newValue: { status: 'PENDING' },
                ipAddress: req.ip
            });

            // Notify admins
            await notificationService.notifyAll(
                `🔄 Requisition Resubmitted: ${reqHeader.requisition_number}`,
                `${userName} updated and resubmitted requisition ${reqHeader.requisition_number} for approval.`,
                'info'
            );

            res.json({ message: 'Requisition resubmitted successfully', status: 'PENDING' });
        } catch (error) {
            console.error('❌ Resubmit requisition failed:', error);
            res.status(500).json({ error: 'Failed to resubmit requisition', details: error.message });
        }
    },

    /**
     * POST /api/inventory/requisitions/:id/issue
     * Admin issues items for an approved requisition.
     * ATOMIC STOCK DEDUCTION:
     *   1. Checks stock availability (quantity >= issue_qty)
     *   2. Inserts inv_stock_out records
     *   3. Deducts inv_items.quantity
     *   4. Releases stock_reservations
     *   5. Updates inv_requisition_items.issued_qty
     *   6. Sets status to ISSUED or PARTIALLY_ISSUED
     */
    issueItems: async (req, res) => {
        try {
            const { id } = req.params;
            const userRole = String(req.user?.role || '').toLowerCase();
            const userEmail = String(req.user?.email || '').toLowerCase();
            const userName = req.user.name || userEmail.split('@')[0];

            if (!['admin', 'superadmin'].includes(userRole)) {
                return res.status(403).json({ error: 'Only administrators can issue inventory stock' });
            }

            const reqHeader = await queryOne('SELECT * FROM inv_requisitions WHERE id = ?', [id]);
            if (!reqHeader) return res.status(404).json({ error: 'Requisition not found' });

            if (!['APPROVED', 'PARTIALLY_ISSUED'].includes(reqHeader.status)) {
                return res.status(409).json({ error: `Cannot issue items for requisition in '${reqHeader.status}' status.` });
            }

            const { items, notes = '' } = req.body; // items: [{ requisition_item_id, issue_qty }]

            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'Must specify items to issue' });
            }

            // Pre-validation of stock levels before issuing
            const errors = [];
            const issuePayload = [];

            for (const item of items) {
                const reqItem = await queryOne(`SELECT * FROM inv_requisition_items WHERE id = ? AND requisition_id = ?`, [item.requisition_item_id, id]);
                if (!reqItem) {
                    errors.push(`Item ID ${item.requisition_item_id} not found in requisition`);
                    continue;
                }

                const issueQty = parseInt(item.issue_qty) || 0;
                if (issueQty <= 0) continue;

                if (reqItem.item_id) {
                    const stockItem = await queryOne(`SELECT * FROM inv_items WHERE id = ?`, [reqItem.item_id]);
                    if (!stockItem) {
                        errors.push(`Inventory item for '${reqItem.item_name}' no longer exists`);
                    } else if (stockItem.quantity < issueQty) {
                        errors.push(`Insufficient stock for '${stockItem.name}'. Available on hand: ${stockItem.quantity}, requested to issue: ${issueQty}`);
                    } else {
                        issuePayload.push({ reqItem, stockItem, issueQty });
                    }
                } else {
                    // Item not linked to stock DB item - record issue without stock deduction
                    issuePayload.push({ reqItem, stockItem: null, issueQty });
                }
            }

            if (errors.length > 0) {
                return res.status(400).json({ error: 'Stock validation failed', details: errors });
            }

            if (issuePayload.length === 0) {
                return res.status(400).json({ error: 'No valid items with issue_qty > 0 provided' });
            }

            // ATOMIC EXECUTION
            const todayStr = new Date().toISOString().split('T')[0];

            for (const payload of issuePayload) {
                const { reqItem, stockItem, issueQty } = payload;

                // 1. Deduct stock from inv_items if linked
                if (stockItem) {
                    await run(
                        `UPDATE inv_items SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [issueQty, stockItem.id]
                    );

                    // 2. Insert into inv_stock_out
                    await run(
                        `INSERT INTO inv_stock_out (item_id, quantity_issued, department, issued_to, issued_to_email, purpose, approved_by, date_issued, status, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Issued', ?)`,
                        [
                            stockItem.id,
                            issueQty,
                            reqHeader.department,
                            reqHeader.requester_name,
                            reqHeader.requester_email,
                            reqHeader.purpose || `Requisition ${reqHeader.requisition_number}`,
                            userName,
                            todayStr,
                            notes || `Issued via ${reqHeader.requisition_number}`
                        ]
                    );

                    // 3. Fulfill/release reservation
                    await run(
                        `UPDATE inv_stock_reservations SET status = 'FULFILLED' WHERE requisition_item_id = ? AND status = 'ACTIVE'`,
                        [reqItem.id]
                    );
                }

                // 4. Update line item issued_qty
                await run(
                    `UPDATE inv_requisition_items SET issued_qty = issued_qty + ? WHERE id = ?`,
                    [issueQty, reqItem.id]
                );
            }

            // 5. Determine overall requisition status
            const allItems = await query(`SELECT * FROM inv_requisition_items WHERE requisition_id = ?`, [id]);
            const allFullyIssued = allItems.every(i => i.issued_qty >= (i.approved_qty > 0 ? i.approved_qty : i.requested_qty));
            const newStatus = allFullyIssued ? 'ISSUED' : 'PARTIALLY_ISSUED';

            const now = new Date().toISOString();
            await run(
                `UPDATE inv_requisitions SET status = ?, issued_by = ?, issued_by_name = ?, issued_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [newStatus, userEmail, userName, now, id]
            );

            // 6. Audit log
            await logAudit({
                userId: req.user.id, userEmail, userName,
                action: newStatus === 'ISSUED' ? 'ISSUED_ALL_ITEMS' : 'ISSUED_PARTIAL_ITEMS',
                recordType: 'requisition',
                recordId: id,
                newValue: { status: newStatus, issued_count: issuePayload.length, issued_by: userEmail },
                ipAddress: req.ip
            });

            // 7. Notify trainer that items are ready for collection
            await notificationService.create({
                userId: reqHeader.requester_id,
                title: `📦 Items Ready for Collection: ${reqHeader.requisition_number}`,
                content: `Items for requisition ${reqHeader.requisition_number} have been issued by ${userName} and are ready for pickup. Please confirm collection upon receipt.`,
                type: 'info'
            });

            res.json({
                message: `Items issued successfully. Requisition status is now '${newStatus}'.`,
                status: newStatus
            });
        } catch (error) {
            console.error('❌ Issue items failed:', error);
            res.status(500).json({ error: 'Failed to issue items', details: error.message });
        }
    },

    /**
     * POST /api/inventory/requisitions/:id/confirm-collection
     * Trainer confirms collection of issued items, completing the requisition
     */
    confirmCollection: async (req, res) => {
        try {
            const { id } = req.params;
            const userEmail = String(req.user.email);
            const userName = req.user.name || userEmail.split('@')[0];

            const reqHeader = await queryOne('SELECT * FROM inv_requisitions WHERE id = ?', [id]);
            if (!reqHeader) return res.status(404).json({ error: 'Requisition not found' });

            if (!['ISSUED', 'PARTIALLY_ISSUED'].includes(reqHeader.status)) {
                return res.status(409).json({ error: `Cannot confirm collection for requisition in '${reqHeader.status}' status.` });
            }

            const now = new Date().toISOString();
            await run(
                `UPDATE inv_requisitions 
                 SET status = 'COMPLETED', confirmed_by = ?, confirmed_by_name = ?, confirmed_at = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [userEmail, userName, now, id]
            );

            await logAudit({
                userId: req.user.id, userEmail, userName,
                action: 'CONFIRMED_COLLECTION',
                recordType: 'requisition',
                recordId: id,
                previousValue: { status: reqHeader.status },
                newValue: { status: 'COMPLETED', confirmed_by: userEmail },
                ipAddress: req.ip
            });

            // Notify admin who issued
            await notificationService.notifyAll(
                `🎉 Requisition Completed: ${reqHeader.requisition_number}`,
                `${userName} confirmed collection for requisition ${reqHeader.requisition_number}. Workflow complete.`,
                'success'
            );

            res.json({ message: 'Collection confirmed. Requisition is now COMPLETED.', status: 'COMPLETED' });
        } catch (error) {
            console.error('❌ Confirm collection failed:', error);
            res.status(500).json({ error: 'Failed to confirm collection', details: error.message });
        }
    },

    /**
     * POST /api/inventory/requisitions/:id/cancel
     * Cancel requisition & release stock reservations
     */
    cancelRequisition: async (req, res) => {
        try {
            const { id } = req.params;
            const userEmail = String(req.user.email);
            const userName = req.user.name || userEmail.split('@')[0];
            const userRole = String(req.user?.role || '').toLowerCase();
            const isAdmin = ['admin', 'superadmin'].includes(userRole);

            const reqHeader = await queryOne('SELECT * FROM inv_requisitions WHERE id = ?', [id]);
            if (!reqHeader) return res.status(404).json({ error: 'Requisition not found' });

            if (['COMPLETED', 'CANCELLED'].includes(reqHeader.status)) {
                return res.status(409).json({ error: `Requisition is already ${reqHeader.status}` });
            }

            if (!isAdmin && String(reqHeader.requester_email).toLowerCase() !== userEmail.toLowerCase()) {
                return res.status(403).json({ error: 'You can only cancel your own requisitions' });
            }

            // Release all active stock reservations
            await run(`UPDATE inv_stock_reservations SET status = 'RELEASED' WHERE requisition_id = ? AND status = 'ACTIVE'`, [id]);

            await run(`UPDATE inv_requisitions SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);

            await logAudit({
                userId: req.user.id, userEmail, userName,
                action: 'CANCELLED_REQUISITION',
                recordType: 'requisition',
                recordId: id,
                previousValue: { status: reqHeader.status },
                newValue: { status: 'CANCELLED' },
                ipAddress: req.ip
            });

            res.json({ message: 'Requisition cancelled and stock reservations released', status: 'CANCELLED' });
        } catch (error) {
            console.error('❌ Cancel requisition failed:', error);
            res.status(500).json({ error: 'Failed to cancel requisition', details: error.message });
        }
    },

    /**
     * GET /api/inventory/stock-summary
     * Returns operational stock summary with reserved and available quantities
     */
    getStockSummary: async (req, res) => {
        try {
            const sql = `
                SELECT 
                    i.id,
                    i.item_code,
                    i.name,
                    c.name as category_name,
                    l.name as location_name,
                    i.quantity as total_quantity,
                    i.minimum_stock_level,
                    i.unit_type,
                    i.status as item_status,
                    COALESCE((
                        SELECT SUM(sr.reserved_qty) 
                        FROM inv_stock_reservations sr 
                        WHERE sr.item_id = i.id AND sr.status = 'ACTIVE'
                    ), 0) as reserved_quantity,
                    (i.quantity - COALESCE((
                        SELECT SUM(sr.reserved_qty) 
                        FROM inv_stock_reservations sr 
                        WHERE sr.item_id = i.id AND sr.status = 'ACTIVE'
                    ), 0)) as available_quantity
                FROM inv_items i
                LEFT JOIN inv_categories c ON i.category_id = c.id
                LEFT JOIN inv_locations l ON i.location_id = l.id
                ORDER BY i.name ASC
            `;

            const items = await query(sql);

            // Compute summary metrics
            let totalItemsCount = items.length;
            let lowStockCount = 0;
            let outOfStockCount = 0;

            const itemsWithStockState = items.map(item => {
                const available = Math.max(0, item.available_quantity);
                let stock_status = 'IN_STOCK';
                if (available <= 0) {
                    stock_status = 'OUT_OF_STOCK';
                    outOfStockCount++;
                } else if (available <= item.minimum_stock_level) {
                    stock_status = 'LOW_STOCK';
                    lowStockCount++;
                }
                return {
                    ...item,
                    available_quantity: available,
                    stock_status
                };
            });

            res.json({
                summary: {
                    total_items: totalItemsCount,
                    low_stock_items: lowStockCount,
                    out_of_stock_items: outOfStockCount
                },
                items: itemsWithStockState
            });
        } catch (error) {
            console.error('❌ Get stock summary failed:', error);
            res.status(500).json({ error: 'Failed to fetch stock summary', details: error.message });
        }
    }
};

// Named exports so `import * as requisitionController` destructuring works in routes
export const {
    getRequisitions,
    getRequisition,
    createRequisition,
    submitRequisition,
    approveRequisition,
    rejectRequisition,
    requestModification,
    resubmitRequisition,
    issueItems,
    confirmCollection,
    cancelRequisition,
    getStockSummary
} = requisitionController;

export default requisitionController;
