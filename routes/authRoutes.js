const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/signup', authController.getSignup);
router.get('/login', authController.getLogin);
router.post('/register', authController.postRegister);
router.post('/login', authController.postLogin);
router.get('/forgot', authController.getForgot);
router.post('/forgot', authController.postForgot);
router.post('/reset', authController.postReset);
router.get('/logout', authController.getLogout);

module.exports = router;
