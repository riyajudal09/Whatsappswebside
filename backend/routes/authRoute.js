const express = require('express');
const auth = require('../middleware/authMiddleware');
const upload = require('../config/multerMiddleware');
const c = require('../controllers/authController');
const router = express.Router();

router.post('/register', c.register);
router.post('/login', c.login);
router.put('/update-profile', auth, upload.single('profilepicture'), c.updateProfile);
router.get('/check-auth', c.checkAuth);
router.get('/user', auth, c.getAllUser);
router.get('/logout', auth, c.logout);

module.exports = router;
