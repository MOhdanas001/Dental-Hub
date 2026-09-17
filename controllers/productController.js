const product = require('../Model/Product');
const { getInclusivePrice } = require('../helpers/priceHelper');

exports.getHome = async (req, res) => {
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }
  if (currentUser.role === "admin") {
    return res.redirect('/admin');
  }

  try {
    const featuredProducts = await product.aggregate([
      { $sample: { size: 12 } }
    ]);

    const topseller = await product.find({ isTopSeller: true });

    res.render("index", { Products: featuredProducts, currentUser: currentUser, top: topseller, getInclusivePrice: getInclusivePrice });

  } catch (err) {
    console.error("Error fetching featured products:", err);
    res.render('index', { currentUser: currentUser });
  }
};

exports.getProductDetail = async (req, res) => {
  let id = req.params.id;
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }

  try {
    let Product = await product.findById(id);
    res.render('detail', { Pro: Product, currentUser: currentUser, getInclusivePrice: getInclusivePrice });
  }
  catch (err) {
    console.error("Error fetching product detail:", err);
    res.render('detail', { currentUser: currentUser });
  }
};

exports.getDentalProducts = async (req, res) => {
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }
  try {
    const DentalProduct = await product.find({ category: "dental" });
    res.render('dentalproducts', { Products: DentalProduct, currentUser: currentUser, getInclusivePrice: getInclusivePrice });
  }
  catch (err) {
    console.error("Error fetching dental products:", err);
    res.render('dentalproducts', { currentUser: currentUser });
  }
};

exports.getStationaryProducts = async (req, res) => {
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }
  try {
    const stationaryProduct = await product.find({ category: "stationary" });
    res.render('stationaryproducts', { Products: stationaryProduct, currentUser: currentUser, getInclusivePrice: getInclusivePrice });
  }
  catch (err) {
    console.error("Error fetching stationary products:", err);
    res.render('dentalproducts', { currentUser: currentUser });
  }
};

exports.postSearch = async (req, res) => {
  try {
    const searchTerm = req.body.searchTerm;

    const Products = await product.find({
      productName: { $regex: searchTerm, $options: "i" }
    });

    res.render("searchResults", {
      Products,
      searchTerm
    });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).send("Error while searching products");
  }
};

exports.getSearchSuggest = async (req, res) => {
  try {
    const searchTerm = req.query.q;

    if (!searchTerm) {
      return res.json([]);
    }

    const Products = await product.find({
      productName: { $regex: searchTerm, $options: "i" }
    }).limit(10);

    res.json(Products);
  } catch (err) {
    console.error("Search suggestion error:", err);
    res.status(500).json({ error: "Error fetching suggestions" });
  }
};
