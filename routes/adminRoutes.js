const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { upload } = require('../config/cloudinary');

router.get('/admin', adminController.getAdminHome);
router.get('/admin/add-product', adminController.getAddProduct);
router.post('/admin/add-product', upload.single("img"), adminController.postAddProduct);
router.get('/admin/products', adminController.getProducts);
router.get('/admin/products/delete/:id', adminController.deleteProduct);
router.get('/admin/products/edit/:id', adminController.getEditProduct);
router.post('/admin/products/edit/:id', upload.single("img"), adminController.postEditProduct);
router.get('/admin/order/receipt/:id', adminController.getOrderReceipt);
router.post('/admin/order/status/:id', adminController.updateOrderStatus);
router.get('/admin/order/delete/:id', adminController.deleteOrder);
router.get('/updateproducts', adminController.updateProductsBulk);

module.exports = router;
