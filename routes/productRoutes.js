const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/', productController.getHome);
router.get('/detail/:id', productController.getProductDetail);
router.get('/dentalproducts', productController.getDentalProducts);
router.get('/stationaryproducts', productController.getStationaryProducts);
router.post('/search', productController.postSearch);
router.get('/search-suggest', productController.getSearchSuggest);

module.exports = router;
