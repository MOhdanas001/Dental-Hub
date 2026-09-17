const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/addaddress', orderController.getAddAddress);
router.post('/addaddress', orderController.postAddAddress);
router.get('/placeorder', orderController.getPlaceOrder);
router.post('/create-order', orderController.createRazorpayOrder);
router.post('/verify-payment', orderController.verifyPayment);
router.get('/orderconfirm', orderController.getConfirmOrder);
router.get('/myorders', orderController.getMyOrders);

module.exports = router;
