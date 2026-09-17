const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

router.get('/cart', cartController.getCart);
router.post('/cart/add', cartController.addToCart);
router.get('/increase/:productId', cartController.increaseCartItem);
router.get('/decrease/:productId', cartController.decreaseCartItem);
router.get('/remove/:productId', cartController.removeCartItem);

module.exports = router;
