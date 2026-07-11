const { Router } = require('express');
const multer = require('multer');
const ctrl = require('../controllers/csvController');
const { authenticate, checkPermission } = require('../services/authService');

const ALLOWED_MIMES = [
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'text/comma-separated-values',
  'application/csv',
];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

function createCsvRouter() {
  const router = Router();

  router.get('/sessions', authenticate, checkPermission('view_sessions'), ctrl.listSessions);
  router.get('/sessions/:id', authenticate, checkPermission('view_session'), ctrl.getSession);
  router.post('/upload', authenticate, checkPermission('upload_csv'), upload.single('file'), ctrl.uploadCsv);
  router.post('/sessions/:id/map', authenticate, checkPermission('map_headers'), ctrl.mapHeadersHandler);
  router.get('/sessions/:id/preview', authenticate, checkPermission('preview_mapping'), ctrl.previewMapping);
  router.post('/sessions/:id/import', authenticate, checkPermission('import_leads'), ctrl.importLeads);
  router.get('/sessions/:id/summary', authenticate, checkPermission('view_summary'), ctrl.getSummary);
  router.get('/sessions/:id/leads', authenticate, checkPermission('view_leads'), ctrl.getLeads);
  router.delete('/sessions/:id', authenticate, checkPermission('delete_session'), ctrl.deleteSession);
  router.post('/sessions/:id/reprocess', authenticate, checkPermission('reprocess'), ctrl.reprocessLeads);
  router.post('/sessions/:id/ai-summary', authenticate, checkPermission('view_summary'), ctrl.aiSummary);

  return router;
}

module.exports = createCsvRouter;