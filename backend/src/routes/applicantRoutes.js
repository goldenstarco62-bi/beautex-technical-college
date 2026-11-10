/**
 * Admissions Pipeline Routes
 * Staff-facing applicant management. The public application form will be added
 * as a separate unauthenticated route set later.
 */
import express from 'express';
import * as applicantController from '../controllers/applicantController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(authenticateToken, authorizeRoles('admin', 'superadmin'));

router.get('/stats', applicantController.getStats);

router.get('/', applicantController.listApplicants);
router.post('/', logAudit('CREATE_APPLICANT', 'applicants'), applicantController.createApplicant);

router.get('/:id/documents', applicantController.listDocuments);
router.post('/:id/documents', upload.single('file'), logAudit('UPLOAD_APPLICANT_DOCUMENT', 'applicant_documents'), applicantController.uploadDocument);
router.get('/:id/documents/:docId/download', applicantController.downloadDocument);
router.patch('/:id/documents/:docId', logAudit('VERIFY_APPLICANT_DOCUMENT', 'applicant_documents'), applicantController.updateDocument);
router.delete('/:id/documents/:docId', logAudit('DELETE_APPLICANT_DOCUMENT', 'applicant_documents'), applicantController.deleteDocument);

router.patch('/:id/status', logAudit('UPDATE_APPLICANT_STATUS', 'applicants'), applicantController.updateApplicantStatus);
router.get('/:id', applicantController.getApplicant);
router.put('/:id', logAudit('UPDATE_APPLICANT', 'applicants'), applicantController.updateApplicant);
router.delete('/:id', logAudit('DELETE_APPLICANT', 'applicants'), applicantController.deleteApplicant);

export default router;
