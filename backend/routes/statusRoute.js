const express = require('express');
const auth = require('../middleware/authMiddleware');
const upload = require('../config/multerMiddleware');
const c = require('../controllers/statusController');
const router = express.Router();

router.post('/', auth, upload.single('media'), c.createStatus);
router.get('/', auth, c.getStatuses);
router.put('/:statusId/view', auth, c.viewStatus);
router.delete('/:statusId', auth, c.deleteStatus);

module.exports = router;
