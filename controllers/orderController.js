const Address = require('../Model/Address');
const Cart = require('../Model/Cart');
const Order = require('../Model/Order');
const product = require('../Model/Product');
const razorpay = require('../config/razorpay');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

exports.getAddAddress = async (req, res) => {
  if (!req.user) return res.redirect("/login");

  let address = await Address.findOne({ userEmail: req.user.useremail });

  res.render("addaddress", {
    user: req.user,
    address: address || null
  });
};

exports.postAddAddress = async (req, res) => {
  const { name, email, city, pincode, fullAddress, contactNumber } = req.body;

  let address = await Address.findOne({ userEmail: req.user.useremail });

  if (address) {
    address.name = name;
    address.email = email;
    address.city = city;
    address.pincode = pincode;
    address.fullAddress = fullAddress;
    address.contactNumber = contactNumber;
    await address.save();
  } else {
    address = new Address({
      userEmail: req.user.useremail,
      name,
      email,
      city,
      pincode,
      fullAddress,
      contactNumber
    });
    await address.save();
  }

  res.redirect("/placeorder");
};

exports.getPlaceOrder = async (req, res) => {
  if (!req.user) return res.redirect("/login");

  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }

  const address = await Address.findOne({ userEmail: req.user.useremail });

  if (!address) {
    return res.redirect("/addaddress");
  }

  try {
    let items = [];
    let total = 0;
    let org = 0;
    let dbCart = await Cart.findOne({ userEmail: req.user.useremail });

    if (!dbCart) {
      dbCart = new Cart({ userEmail: req.user.useremail, items: [] });
    }

    await dbCart.populate("items.product");
    items = dbCart.items;
    if (items && items.length > 0) {
      for (let item of items) {
        let productt = item.product.productName
          ? item.product
          : await product.findById(item.product);

        total += productt.price * item.quantity + (productt.price * item.quantity * (productt.SGST + productt.CGST) / 100);
        org += productt.originalprice * item.quantity + (productt.originalprice * item.quantity * (productt.SGST + productt.CGST) / 100);
      }
    }
    let deliveryFee = 0;
    if (!address.city || address.city.toLowerCase().trim() !== "rohtak") {
      if (total < 2000) {
        deliveryFee = 90;
      }
    }

    res.render("placeorder", {
      deliveryFee: deliveryFee,
      items: items,
      currentUser: currentUser,
      total: total,
      org: org,
      razorpayKeyId: process.env.LIVE_KEY || "rzp_test_placeholder"
    });

  } catch (err) {
    console.error("Cart error:", err);
    res.render('cart', { currentUser: currentUser, items: "" });
  }
};

exports.createRazorpayOrder = async (req, res) => {
  const { amount } = req.body;

  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: "order_rcptid_" + Math.floor(Math.random() * 1000),
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error("Order create error:", err);
    res.status(500).send("Error creating order");
  }
};

exports.verifyPayment = (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const sign = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSign = crypto
    .createHmac("sha256", process.env.LIVE_SECRET || "dummy_secret")
    .update(sign.toString())
    .digest("hex");

  if (razorpay_signature === expectedSign) {
    console.log("if " + razorpay_signature, +" " + expectedSign);
    res.json({ success: true });
  } else {
    res.json({ success: false });
    console.log("else " + razorpay_signature, +" " + expectedSign);
  }
};

exports.getConfirmOrder = async (req, res) => {
  console.log("===== ORDER CONFIRM ROUTE HIT =====");
  console.log("User session:", req.user);
  if (!req.user) return res.redirect("/login");
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }
  try {
    let total = 0;

    console.log("payyyyyy");
    console.log(req.user.useremail);
    const address = await Address.findOne({ userEmail: req.user.useremail });
    console.log(address);

    if (!address) return res.redirect("/addaddress");

    const paystatus = req.query.paystatus || "cod";
    const extrainfo = req.query.extrainfo || "";
    let cart = await Cart.findOne({ userEmail: req.user.useremail }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }
    for (let item of cart.items) {
      total += item.product.price * item.quantity + (item.product.price * item.quantity * (item.product.SGST + item.product.CGST) / 100);
    }

    if (!address.city || address.city.toLowerCase().trim() !== "rohtak") {
      if (total < 2000) {
        total = total + 90;
      }
    }

    const order = new Order({
      userEmail: req.user.useremail,
      address: address._id,
      items: cart.items,
      status: "Confirmed",
      total,
      paystatus,
      extrainfo
    });

    await order.save();

    await Cart.deleteOne({ userEmail: req.user.useremail });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "dentalhub7718@gmail.com",
        pass: "cddxntvuevdcuyvh "
      }
    });

    const mailOptions = {
      from: "dentalhub7718@gmail.com",
      to: req.user.useremail,
      subject: "Order Confirmation",
      html: `
        <h2>Order Confirmed ✅</h2>
        <p>Hi ${req.user.username || req.user.useremail},</p>
        <p>Thank you for your order. Here are the details:</p>
        <ul>
          ${order.items.map(it => `<li>${it.product.productName} - Qty: ${it.quantity} - Price: ${it.product.price}</li>`).join("")}
        </ul>
        <p>Status: ${order.status}</p>
        <p>Our Delivery Partner will notify you once it ships 🚚</p>
      `
    };

    const adminMail = {
      from: "dentalhub7718@gmail.com",
      to: "Hamzahaleem788@gmail.com",
      subject: "📦 New Order Received",
      html: `
        <h2>New Order Received 🔔</h2>
        <p>Customer: ${req.user.username || req.user.useremail}</p>
        <p>Contact: ${address.contactNumber}</p>
        <p>Email: ${req.user.useremail}</p>
        <p>Delivery Address:  ${address.city}, ${address.pincode},${address.fullAddress}</p>
        <ul>
          ${order.items.map(it => `<li>${it.product.productName} - Qty: ${it.quantity} - Price: ${it.product.price}</li>`).join("")}
        </ul>
        <p><strong>Total: ₹${total}</strong></p>
        <p>Status: ${order.status}</p>
        <p>Payment Status: <strong> ${order.paystatus}</strong></p>
        ${order.extrainfo ? `<p><strong>Extra Info:</strong> ${order.extrainfo}</p>` : ""}
      `
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Mail error:", err);
      else console.log("Mail sent:", info.response);
    });

    transporter.sendMail(adminMail, (err, info) => {
      if (err) console.error("Admin mail error:", err);
      else console.log("Admin mail sent:", info.response);
    });

    await order.populate("address");

    res.render("orderconfirm", {
      orderId: order._id,
      items: order.items,
      total: total,
      address: order.address,
      currentUser: currentUser
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error....Please place order again");
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/login");
    }

    const orders = await Order.find({ userEmail: req.user.useremail })
      .populate("items.product")
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => {
      let total = 0;
      let final = 0;
      final = final + order.total;
      const items = order.items.map(i => {
        if (i.product) {
          const subtotal = i.product.price * i.quantity + (i.product.price * i.quantity * (i.product.SGST + i.product.CGST) / 100);
          total += subtotal;

          return {
            productName: i.product.productName,
            price: i.product.price,
            img: i.product.img,
            quantity: i.quantity,
            subtotal
          };
        } else {
          return {
            productName: "Product Deleted",
            price: null,
            img: null,
            quantity: i.quantity,
            subtotal: null
          };
        }
      });

      return {
        id: order._id,
        status: order.status,
        createdAt: order.createdAt,
        items,
        total,
        final
      };
    });

    res.render("myorder", {
      orders: formattedOrders,
      currentUser: req.user,
    });

  } catch (err) {
    console.error("My Orders error:", err);
    res.status(500).send("Error loading orders");
  }
};
