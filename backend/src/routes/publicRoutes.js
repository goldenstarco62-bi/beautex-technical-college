/**
 * Public (unauthenticated) routes used by the admissions portal.
 * Keep this surface minimal — no applicant records are exposed here.
 */
import express from 'express';
import * as applicantController from '../controllers/applicantController.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.get('/admissions', applicantController.getPublicAdmissionsInfo);
router.post('/admissions', applicantController.createPublicApplication);
router.post('/admissions/track', applicantController.trackApplication);
router.post('/admissions/documents', upload.single('file'), applicantController.uploadPublicDocument);
router.delete('/admissions/documents/:docId', applicantController.deletePublicDocument);

export default router;
