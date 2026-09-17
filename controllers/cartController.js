const Cart = require('../Model/Cart');
const product = require('../Model/Product');
const { getInclusivePrice } = require('../helpers/priceHelper');

exports.getCart = async (req, res) => {
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }
  try {
    console.log(req.session.cart);
    let items = [];
    let total = 0;
    let org = 0;
    if (req.user) {
      let dbCart = await Cart.findOne({ userEmail: req.user.useremail });

      if (!dbCart) {
        dbCart = new Cart({ userEmail: req.user.useremail, items: [] });
      }

      await dbCart.populate("items.product");
      items = dbCart.items;

    } else {
      const sessionCart = req.session.cart || [];

      const productIds = sessionCart.map(item => item.productId);
      const products = await product.find({ _id: { $in: productIds } });

      items = sessionCart.map(item => {
        const prod = products.find(p => p._id.toString() === item.productId);
        return { product: prod, quantity: item.quantity };
      });
    }
    if (items && items.length > 0) {
      for (let item of items) {
        let productt = item.product && item.product.productName
          ? item.product
          : await product.findById(item.product);

        if (productt) {
          total += getInclusivePrice(productt.price, productt.SGST, productt.CGST) * item.quantity;
          org += productt.originalprice * item.quantity;
        }
      }
    }

    res.render('cart', { items: items, currentUser: currentUser, total: total, org: org, getInclusivePrice: getInclusivePrice });

  } catch (err) {
    console.error("Cart error:", err);
    res.render('cart', { currentUser: currentUser, items: "" });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = quantity ? parseInt(quantity) : 1;

    if (req.user) {
      console.log(req.user);
      let cart = await Cart.findOne({ userEmail: req.user.useremail });

      if (!cart) cart = new Cart({ userEmail: req.user.useremail, items: [] });

      const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += qty;
      } else {
        cart.items.push({ product: productId, quantity: qty });
      }

      await cart.save();
      return res.json({ success: true, message: "Product added to cart (DB)" });

    } else {
      if (!req.session.cart) req.session.cart = [];

      const itemIndex = req.session.cart.findIndex(item => item.productId === productId);

      if (itemIndex > -1) {
        req.session.cart[itemIndex].quantity += qty;
      } else {
        req.session.cart.push({ productId, quantity: qty });
      }

      return res.json({ success: true, message: "Product added to cart (Session)" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.increaseCartItem = async (req, res) => {
  const productId = req.params.productId;

  if (!req.user) {
    let cart = req.session.cart || [];
    let item = cart.find(i => i.productId.toString() === productId);

    if (item) {
      item.quantity += 1;
    }
    req.session.cart = cart;
    return res.redirect("/cart");
  }

  let dbCart = await Cart.findOne({ userEmail: req.user.useremail });
  if (dbCart) {
    let item = dbCart.items.find(i => i.product._id.toString() === productId);
    if (item) {
      item.quantity += 1;
    }
    await dbCart.save();
  }
  res.redirect("/cart");
};

exports.decreaseCartItem = async (req, res) => {
  const productId = req.params.productId;

  if (!req.user) {
    let cart = req.session.cart || [];
    let itemIndex = cart.findIndex(i => i.productId.toString() === productId);

    if (itemIndex > -1) {
      if (cart[itemIndex].quantity > 1) {
        cart[itemIndex].quantity -= 1;
      } else {
        cart.splice(itemIndex, 1);
      }
    }
    req.session.cart = cart;
    return res.redirect("/cart");
  }

  let dbCart = await Cart.findOne({ userEmail: req.user.useremail });
  if (dbCart) {
    let itemIndex = dbCart.items.findIndex(i => i.product._id.toString() === productId);

    if (itemIndex > -1) {
      if (dbCart.items[itemIndex].quantity > 1) {
        dbCart.items[itemIndex].quantity -= 1;
      } else {
        dbCart.items.splice(itemIndex, 1);
      }
      if (dbCart.items.length === 0) {
        await Cart.deleteOne({ userEmail: req.user.useremail });
      } else {
        await dbCart.save();
      }
    }
  }
  res.redirect("/cart");
};

exports.removeCartItem = async (req, res) => {
  const productId = req.params.productId;

  if (!req.user) {
    let cart = req.session.cart || [];
    req.session.cart = cart.filter(i => i.productId.toString() !== productId);
    return res.redirect("/cart");
  }

  let dbCart = await Cart.findOne({ userEmail: req.user.useremail });
  if (dbCart) {
    dbCart.items = dbCart.items.filter(i => i.product._id.toString() !== productId);
    if (dbCart.items.length === 0) {
      await Cart.deleteOne({ userEmail: req.user.useremail });
    } else {
      await dbCart.save();
    }
  }
  res.redirect("/cart");
};
