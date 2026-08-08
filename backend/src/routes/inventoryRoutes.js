/**
 * Inventory Routes — categories, locations, items, suppliers, stock, requests, assets, damage logs, reports
 */
import express from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import * as requisitionController from '../controllers/requisitionController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// Inventory Dashboard
router.get('/dashboard', authenticateToken, authorizeRoles('admin', 'superadmin', 'teacher'), inventoryController.getDashboardStats);
router.get('/stock-summary', authenticateToken, requisitionController.getStockSummary);

// Requisition System Routes
router.get('/requisitions', authenticateToken, requisitionController.getRequisitions);
router.get('/requisitions/:id', authenticateToken, requisitionController.getRequisition);
router.post('/requisitions', authenticateToken, requisitionController.createRequisition);
router.post('/requisitions/:id/submit', authenticateToken, requisitionController.submitRequisition);
router.post('/requisitions/:id/approve', authenticateToken, authorizeRoles('admin', 'superadmin'), requisitionController.approveRequisition);
router.post('/requisitions/:id/reject', authenticateToken, authorizeRoles('admin', 'superadmin'), requisitionController.rejectRequisition);
router.post('/requisitions/:id/request-modification', authenticateToken, authorizeRoles('admin', 'superadmin'), requisitionController.requestModification);
router.post('/requisitions/:id/resubmit', authenticateToken, requisitionController.resubmitRequisition);
router.post('/requisitions/:id/issue', authenticateToken, authorizeRoles('admin', 'superadmin'), requisitionController.issueItems);
router.post('/requisitions/:id/confirm-collection', authenticateToken, requisitionController.confirmCollection);
router.post('/requisitions/:id/cancel', authenticateToken, requisitionController.cancelRequisition);

// Categories
router.get('/categories', authenticateToken, inventoryController.getCategories);
router.post('/categories', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.createCategory);
router.put('/categories/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.updateCategory);
router.delete('/categories/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.deleteCategory);

// Locations
router.get('/locations', authenticateToken, inventoryController.getLocations);
router.post('/locations', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.createLocation);
router.delete('/locations/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.deleteLocation);

// Items
router.get('/items', authenticateToken, inventoryController.getItems);
router.get('/items/:id', authenticateToken, inventoryController.getItem);
router.post('/items', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('CREATE_INVENTORY_ITEM', 'inv_items'), inventoryController.createItem);
router.put('/items/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.updateItem);
router.delete('/items/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.deleteItem);

// Suppliers
router.get('/suppliers', authenticateToken, inventoryController.getSuppliers);
router.post('/suppliers', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.createSupplier);
router.put('/suppliers/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.updateSupplier);
router.delete('/suppliers/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.deleteSupplier);

// Stock In
router.get('/stock-in', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.getStockIn);
router.post('/stock-in', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.createStockIn);

// Stock Out
router.get('/stock-out', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.getStockOut);
router.post('/stock-out', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.createStockOut);

// Department Requests
router.get('/requests', authenticateToken, inventoryController.getDepartmentRequests);
router.post('/requests', authenticateToken, inventoryController.createDepartmentRequest);
router.put('/requests/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.updateDepartmentRequest);
router.delete('/requests/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.deleteDepartmentRequest);

// Purchase Requests
router.get('/purchases', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.getPurchaseRequests);
router.post('/purchases', authenticateToken, inventoryController.createPurchaseRequest);
router.put('/purchases/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.updatePurchaseRequest);
router.delete('/purchases/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.deletePurchaseRequest);

// Procurement Wishlist
router.get('/wishlist', authenticateToken, inventoryController.getProcurementWishlist);
router.post('/wishlist', authenticateToken, inventoryController.createProcurementWishlist);
router.put('/wishlist/:id', authenticateToken, inventoryController.updateProcurementWishlist);
router.delete('/wishlist/:id', authenticateToken, inventoryController.deleteProcurementWishlist);

// Assets
router.get('/assets', authenticateToken, inventoryController.getAssets);
router.post('/assets', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.createAsset);
router.put('/assets/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.updateAsset);
router.delete('/assets/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.deleteAsset);

// Damage Logs
router.get('/damage-logs', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.getDamageLogs);
router.post('/damage-logs', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.createDamageLog);

// Reports
router.get('/reports/:type', authenticateToken, authorizeRoles('admin', 'superadmin'), inventoryController.getReport);

export default router;
