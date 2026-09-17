const express = require('express');
const app = express();
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require('path');
const mongoose = require('mongoose');
const bodyparser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcryptjs');
const session = require('express-session');
const dotenv = require("dotenv");
const notifier = require('node-notifier');
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const Razorpay = require("razorpay");
const crypto = require("crypto");
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.json());


dotenv.config();
if (fs.existsSync('./config.env')) {
  dotenv.config({ path: './config.env' });
}
const user = require('./Model/User');
const product = require('./Model/Product');
const Cart = require('./Model/Cart');
const Address = require("./Model/Address");
const Order = require("./Model/Order");
const Otp = require("./Model/Otp");


const DB = process.env.MONGO_URI || "mongodb://localhost:27017/denthub_db";

mongoose.connect(DB, {
  useNewUrlParser: true,

});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {

  console.log("Connected");

});


const razorpay = new Razorpay({
  key_id: process.env.LIVE_KEY || "rzp_test_placeholder",
  key_secret: process.env.LIVE_SECRET || "dummy_secret",
});


passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  user.findOne({ email: email })
    .then(userr => {
      if (!userr) {
        return done(null, false)
      }
      bcrypt.compare(password, userr.password, (err, isMatch) => {
        if (isMatch) {
          return done(null, userr)
        }
        else {
          return done(null, false)
        }
      })
    })
    .catch(err => {
      console.log(err);
    })
}))


app.use(session({
  secret: "Node",
  resave: true,
  saveUninitialized: true,

}))




passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    cb(null, { id: user.id, username: user.name, role: user.role, useremail: user.email });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});
app.use(passport.initialize());
app.use(passport.session());



cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || "dummy_cloud",
  api_key: process.env.CLOUD_KEY || "123456789012345",
  api_secret: process.env.CLOUD_SECRET || "dummy_secret",
});

// Cloudinary storage setup
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "products", // folder name in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ storage });



app.use((req, res, next) => {

  res.locals.currentUser = req.user;
  next();
});



function getInclusivePrice(price, sgst, cgst) {
    const totalGst = sgst + cgst;
    return Number((price + (price * totalGst / 100)).toFixed(2));
}

app.get('/', async (req, res) => {

  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }
  if (currentUser.role === "admin") {
    return res.redirect('/admin')
  }

  try {

    const featuredProducts = await product.aggregate([
      { $sample: { size: 12 } }
    ]);

    const topseller = await product.find({ isTopSeller: true });


    res.render("index", { Products: featuredProducts, currentUser: currentUser, top: topseller,getInclusivePrice:getInclusivePrice });


  } catch (err) {
    console.error("Error fetching featured products:", err);
    res.render('index', { currentUser: currentUser });
  }

})




app.get('/detail/:id', async (req, res) => {

  let id = req.params.id;
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }

  try {
    let Product = await product.findById(id);
    res.render('detail', { Pro: Product, currentUser: currentUser,getInclusivePrice:getInclusivePrice })
  }
  catch (err) {
    console.error("Error fetching  product detail:", err);
    res.render('detail', { currentUser: currentUser });
  }


})

app.get("/cart", async (req, res) => {
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
      // ✅ Logged in → check DB cart
      let dbCart = await Cart.findOne({ userEmail: req.user.useremail });

      // If DB cart doesn't exist, create it
      if (!dbCart) {
        dbCart = new Cart({ userEmail: req.user.useremail, items: [] });
      }

      // ✅ If session cart exists, merge it into DB


      // Populate products for rendering
      await dbCart.populate("items.product");
      items = dbCart.items;


    } else {
      // ✅ Guest user → just use session cart
      const sessionCart = req.session.cart || [];

      const productIds = sessionCart.map(item => item.productId);
      const products = await product.find({ _id: { $in: productIds } });

      items = sessionCart.map(item => {
        const product = products.find(p => p._id.toString() === item.productId);
        return { product, quantity: item.quantity };
      });
    }
    if (items && items.length > 0) {
      for (let item of items) {
        // if logged in: item.productId is populated object
        // if guest: item.productId is string → fetch product
        let productt = item.product.productName
          ? item.product
          : await product.findById(item.product);

        total += getInclusivePrice(productt.price,productt.SGST,productt.CGST) * item.quantity;
        org += productt.originalprice * item.quantity;
      }
    }
    // Render cart page

    res.render('cart', { items: items, currentUser: currentUser, total: total, org: org,getInclusivePrice:getInclusivePrice });

  } catch (err) {
    console.error("Cart error:", err);
    res.render('cart', { currentUser: currentUser, items: "" })
  }
});

app.get('/signup', (req, res) => {
  if (req.user) return res.redirect("/");
  res.render('signup')
})
app.get('/login', (req, res) => {
  if (req.user) return res.redirect("/");
  res.render('login')
})

app.get('/dentalproducts', async (req, res) => {
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }
  try {
    const DentalProduct = await product.find({ category: "dental" })
    res.render('dentalproducts', { Products: DentalProduct, currentUser: currentUser,getInclusivePrice:getInclusivePrice })
  }
  catch (err) {
    console.error("Error fetching dental products:", err);
    res.render('dentalproducts', { currentUser: currentUser });
  }
})
app.get('/stationaryproducts', async (req, res) => {
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }
  try {
    const stationaryProduct = await product.find({ category: "stationary" })
    res.render('stationaryproducts', { Products: stationaryProduct, currentUser: currentUser,getInclusivePrice:getInclusivePrice })
  }
  catch (err) {
    console.error("Error fetching stationary products:", err);
    res.render('dentalproducts', { currentUser: currentUser });
  }
})


app.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  user.findOne({ email: email })
    .then(userr => {
      if (userr) {
        notifier.notify({
          title: 'Message!',
          message: 'User Already Exist!',

          sound: true,
          wait: true
        })

        return res.redirect('/signup')
      }


      const newuser = new user({
        name: name,
        email: email,
        password: password

      })
      bcrypt.genSalt(10, (err, salt) =>
        bcrypt.hash(newuser.password, salt, (err, hash) => {
          if (err)
            throw err;
          newuser.password = hash;

          newuser.save()
            .then(userr => {
              notifier.notify({
                title: 'Message!',
                message: 'Account Created Successfully!',

                sound: true,
                wait: true
              })

              res.redirect('/login')
            })
            .catch(err => {
              console.log(err);
            })
        })

      )


    })

})



app.get("/increase/:productId", async (req, res) => {
  const productId = req.params.productId;

  if (!req.user) {
    // Guest cart (session)
    let cart = req.session.cart || [];
    let item = cart.find(i => i.productId.toString() === productId);

    if (item) {
      item.quantity += 1;
    }
    req.session.cart = cart;
    return res.redirect("/cart");
  }

  // Logged in user
  let dbCart = await Cart.findOne({ userEmail: req.user.useremail });
  if (dbCart) {
    let item = dbCart.items.find(i => i.product._id.toString() === productId);
    if (item) {
      item.quantity += 1;
    }
    await dbCart.save();
  }
  res.redirect("/cart");
});

// Decrease quantity
app.get("/decrease/:productId", async (req, res) => {
  const productId = req.params.productId;

  if (!req.user) {
    // Guest cart
    let cart = req.session.cart || [];
    let itemIndex = cart.findIndex(i => i.productId.toString() === productId);

    if (itemIndex > -1) {
      if (cart[itemIndex].quantity > 1) {
        cart[itemIndex].quantity -= 1;
      } else {
        cart.splice(itemIndex, 1); // remove item
      }
    }
    req.session.cart = cart;
    return res.redirect("/cart");
  }

  // Logged in user
  let dbCart = await Cart.findOne({ userEmail: req.user.useremail });
  if (dbCart) {
    let itemIndex = dbCart.items.findIndex(i => i.product._id.toString() === productId);

    if (itemIndex > -1) {
      if (dbCart.items[itemIndex].quantity > 1) {
        dbCart.items[itemIndex].quantity -= 1;
      } else {
        dbCart.items.splice(itemIndex, 1); // remove item
      }
      if (dbCart.items.length === 0) {
        await Cart.deleteOne({ userEmail: req.user.useremail });
      } else {
        await dbCart.save();
      }
    }
  }
  res.redirect("/cart");
});

// Remove product
app.get("/remove/:productId", async (req, res) => {
  const productId = req.params.productId;

  if (!req.user) {
    // Guest cart
    let cart = req.session.cart || [];
    req.session.cart = cart.filter(i => i.productId.toString() !== productId);
    return res.redirect("/cart");
  }

  // Logged in user
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
});


app.get("/addaddress", async (req, res) => {

  if (!req.user) return res.redirect("/login");

  let address = await Address.findOne({ userEmail: req.user.useremail });

  res.render("addaddress", {
    user: req.user,
    address: address || null
  });
});


app.get("/placeorder", async (req, res) => {

  if (!req.user) return res.redirect("/login");

  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }



  // fetch user address
  const address = await Address.findOne({ userEmail: req.user.useremail });

  if (!address) {
    // if no address, redirect to add address page
    return res.redirect("/addaddress");
  }



  try {
    let items = [];
    let total = 0;
    let org = 0;
    let dbCart = await Cart.findOne({ userEmail: req.user.useremail });

    // If DB cart doesn't exist, create it
    if (!dbCart) {
      dbCart = new Cart({ userEmail: req.user.useremail, items: [] });
    }

    // ✅ If session cart exists, merge it into DB


    // Populate products for rendering
    await dbCart.populate("items.product");
    items = dbCart.items;
    if (items && items.length > 0) {
      for (let item of items) {
        // if logged in: item.productId is populated object
        // if guest: item.productId is string → fetch product
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
      items: items, currentUser: currentUser, total: total, org: org, razorpayKeyId: process.env.LIVE_KEY || "rzp_test_placeholder"
    });

  }
  catch (err) {
    console.error("Cart error:", err);
    res.render('cart', { currentUser: currentUser, items: "" })
  }




});


app.post("/create-order", async (req, res) => {
  const { amount } = req.body; // total in rupees

  const options = {
    amount: amount * 100, // Razorpay works in paise
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
});

app.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const sign = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSign = crypto
    .createHmac("sha256", process.env.LIVE_SECRET || "dummy_secret")
    .update(sign.toString())
    .digest("hex");

  if (razorpay_signature === expectedSign) {
    // Payment verified
    console.log("if " + razorpay_signature, +" " + expectedSign);
    res.json({ success: true });
  } else {
    res.json({ success: false });
    console.log("else " + razorpay_signature, +" " + expectedSign);
  }
});




app.get("/orderconfirm", async (req, res) => {

  console.log("===== ORDER CONFIRM ROUTE HIT =====");
  console.log("User session:", req.user);
  if (!req.user) return res.redirect("/login");
  let currentUser = req.user;
  if (currentUser === undefined) {
    currentUser = "";
  }
  try {
    let total = 0;

    // fetch address
    console.log("payyyyyy")
    console.log(req.user.useremail)
    const address = await Address.findOne({ userEmail: req.user.useremail });
    console.log(address);

    if (!address) return res.redirect("/addaddress");

    // fetch cart
    const paystatus = req.query.paystatus || "cod";
    const extrainfo = req.query.extrainfo || "";
    let cart = await Cart.findOne({ userEmail: req.user.useremail }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }
    for (let item of cart.items) {
      total += item.product.price * item.quantity + (item.product.price * item.quantity * (item.product.SGST + item.product.CGST) / 100);;
    }

    if (!address.city || address.city.toLowerCase().trim() !== "rohtak") {
      if (total < 2000) {
        total = total + 90;
      }

    }

    // create order
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

    // empty cart after placing order
    await Cart.deleteOne({ userEmail: req.user.useremail });

    // send confirmation mail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "dentalhub7718@gmail.com",
        pass: "cddxntvuevdcuyvh " // use App Password, not Gmail password
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
});



app.get("/myorders", async (req, res) => {

  try {
    if (!req.user) {
      return res.redirect("/login");
    }

    // Fetch all orders for user
    const orders = await Order.find({ userEmail: req.user.useremail })
      .populate("items.product") // only populate product
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => {
      let total = 0;
      let final = 0;
      final = final + order.total;
      const items = order.items.map(i => {
        if (i.product) {
          // Product still exists
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
          // Product was deleted
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
});



const geturl = (req) => {
  return req.user.role === 'admin' ? '/admin' : '/'
}


app.get('/admin', async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    const { page = 1, search = "" } = req.query;
    const limit = 10; // orders per page
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      query.$or = [{ userEmail: { $regex: search, $options: "i" } }];
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or.push({ _id: search });
      }

    }

    const orders = await Order.find(query)
      .populate("items.product") // get product details
      .populate("address")    // get full address
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("admin_home", {
      orders,
      currentPage: parseInt(page),
      totalPages,
      search
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching orders");
  }
});

app.get("/admin/add-product", (req, res) => {
  if (!req.user || req.user.role !== "admin") return res.redirect("/login");
  res.render("add_product");
});

app.get("/updateproducts", async (req, res) => {


  await product.updateMany(
    {
      SGST: { $exists: false }
    },
    {
      $set: {
        SGST: 2.5,
        CGST: 2.5,
        hsnNo: "123",
      },
    }
  )
  console.log("Product updated");
})

app.post("/admin/add-product", upload.single("img"), async (req, res) => {
  try {

    const { productName, originalprice, price, totalStock, shortDescription, longDescription, category, top, information, hsnNo, sgst, cgst } = req.body;



    const newProduct = new product({
      productName,
      originalprice,
      price,
      totalStock,
      shortDescription,
      longDescription,
      category,
      isTopSeller: top === "yes" ? true : false,
      information,
      hsnNo,
      SGST: sgst,
      CGST: cgst,
      img: req.file ? req.file.path : "https://via.placeholder.com/150"
    });

    await newProduct.save();
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding product");
  }
});

app.get("/admin/products", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    const { page = 1, search = "" } = req.query;
    const limit = 10; // orders per page
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      query.$or = [{ productName: { $regex: search, $options: "i" } }];
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or.push({ _id: search });
      }

    }


    const products = await product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const totalpro = await product.countDocuments(query);
    const totalPages = Math.ceil(totalpro / limit);
    res.render("admin_products", {
      products,
      currentPage: parseInt(page),
      totalPages,
      search
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching products");
  }
});

// const ExcelJS = require("exceljs");
// app.get('/excel',async (req,res)=>{
//   const pro=await product.find().lean();

//   const workbook=new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet("Products");
//   worksheet.columns = [
//     { header: "Product Name", key: "productName", width: 30 },
//     { header: "Price", key: "price", width: 15 },
//     { header: "Original Price", key: "originalprice", width: 15 },
//     { header: "Stock", key: "totalStock", width: 15 },
//     { header: "Category", key: "category", width: 20 },
//   ];

//   pro.forEach(p => worksheet.addRow(p));

//   // Save to file
//   await workbook.xlsx.writeFile("products.xlsx");

//   console.log("✅ Exported products.xlsx");
// })

// DELETE product by ID
app.get("/admin/products/delete/:id", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    await product.findByIdAndDelete(req.params.id);
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting product");
  }
});



app.get("/admin/products/edit/:id", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    const products = await product.findById(req.params.id).lean();
    if (!products) return res.status(404).send("Product not found");
    res.render("edit_product", { products });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading edit form");
  }
});


app.get("/admin/order/receipt/:id", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");

    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("address")
      .lean();

    if (!order) return res.status(404).send("Order not found");

    // Compute totals
    let productTotal = 0;
    order.items.forEach(item => {
      if (item.product && item.product.price) productTotal += item.product.price * item.quantity + (item.product.price * item.quantity * (item.product.SGST + item.product.CGST) / 100);
    });
    const deliveryFee = (order.total || 0) - productTotal;

    // Prepare PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=receipt_${order._id}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    // Register fonts if present (for proper Rupee glyph)
    const fontsDir = path.join(__dirname, "public", "fonts");
    const regularFontPath = path.join(fontsDir, "NotoSans-Regular.ttf");
    const boldFontPath = path.join(fontsDir, "NotoSans-Bold.ttf");

    const haveFonts = fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath);
    if (haveFonts) {
      doc.registerFont("Noto-Regular", regularFontPath);
      doc.registerFont("Noto-Bold", boldFontPath);
      doc.font("Noto-Regular");
    } else {
      // fallback; Helvetica may not show ₹ correctly on some systems
      doc.font("Helvetica");
    }

    const rupee = haveFonts ? "₹" : "Rs.";

    // ---------- Watermark ----------
    try {
      const centerX = doc.page.width / 2;
      const centerY = doc.page.height / 2;

      doc.save();
      if (haveFonts) doc.font("Noto-Bold");
      else doc.font("Helvetica-Bold");

      doc.fillColor("#000000");
      doc.opacity(0.08);
      doc.fontSize(80);

      // rotate around center
      doc.rotate(-45, { origin: [centerX, centerY] });
      doc.text("DentHub", centerX - 150, centerY - 40, {
        align: "center",
        width: 300
      });
      doc.rotate(45, { origin: [centerX, centerY] }); // rotate back
      doc.opacity(1);
      doc.restore();
    } catch (e) {
      // continue even if watermark drawing fails
      doc.restore && doc.restore();
      doc.opacity && doc.opacity(1);
    }

    // ---------- HEADER (logo + title) ----------
    const logoPath = path.join(__dirname, "public", "img", "logodental.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 50, { width: 80 });
    }
    doc.fontSize(18);
    if (haveFonts) doc.font("Noto-Bold");
    else doc.font("Helvetica-Bold");
    doc.text("Invoice / Receipt", 0, 60, { align: "center" });
    doc.moveDown(2);

    // ---------- SOLD BY (left) & SOLD TO (right) ----------
    const startY = doc.y;
    const leftX = 50;
    const rightX = 320;
    const columnGapY = 0;

    // Sold By
    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.fontSize(12).text("Sold By:", leftX, startY);
    if (haveFonts) doc.font("Noto-Regular"); else doc.font("Helvetica");
    doc.fontSize(11).text("DentHub", leftX, doc.y + 3);
    doc.text("DentHub Pvt Ltd", leftX);
    doc.text("GSTIN: 09ASNPH5867P1ZO", leftX);



    // Sold To
    const soldToY = startY;
    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.fontSize(12).text("Sold To:", rightX, soldToY);
    if (haveFonts) doc.font("Noto-Regular"); else doc.font("Helvetica");
    doc.fontSize(11);
    const name = order.address?.name || "N/A";
    const contact = order.address?.contactNumber || "N/A";
    const email = order.userEmail || "N/A";
    const addr = order.address ? `${order.address.fullAddress}, ${order.address.city}, ${order.address.pincode}` : "N/A";
    doc.text(`Name: ${name}`, rightX, doc.y + columnGapY);
    doc.text(`Contact: ${contact}`, rightX);
    doc.text(`Email: ${email}`, rightX);
    doc.text(`Address: ${addr}`, rightX);


    doc.moveDown(2);

    // ---------- ORDER INFO ----------
    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.fontSize(12).text("Order Details:", leftX);
    if (haveFonts) doc.font("Noto-Regular"); else doc.font("Helvetica");
    doc.fontSize(11);
    doc.text(`Order ID: ${order._id}`, leftX, doc.y + 3);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleString()}`, leftX);
    doc.text(`Payment Status: ${order.paystatus}`, leftX);
    doc.moveDown(1);

    // ---------- ITEMS TABLE ----------
    doc.moveDown(0.5);
    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.fontSize(12).text("Order Items:", leftX);
    doc.moveDown(0.3);

    const tableTop = doc.y;
    const marginLeft = 35;
    const tableWidth = 530;
    const colSr = 50;
    const colProduct = 70;
    const hsnNo = 295
    const colQty = 337;
    const colPrice = 370;
    const colSGST = 420;
    const colCGST = 470;
    const colSubtotal = 510;
    const rowHeight = 20;

    // DRAW HEADER ROW
    doc.fontSize(11);
    doc.font(haveFonts ? "Noto-Bold" : "Helvetica-Bold");
    doc.rect(marginLeft, tableTop, tableWidth, rowHeight).fillAndStroke("#f3f3f3", "#cccccc");
    doc.fillColor("#000000");
    doc.text("Sr", marginLeft + 5, tableTop + 5, { width: colProduct - colSr - 5 });
    doc.text("Product", colProduct, tableTop + 5);
    doc.text("Hsn", hsnNo, tableTop + 5);

    doc.text("Qty", colQty, tableTop + 5);
    doc.text(`Price`, colPrice, tableTop + 5);
    doc.text(`SGST`, colSGST, tableTop + 5);
    doc.text(`CGST`, colCGST, tableTop + 5);
    doc.text(`Total`, colSubtotal, tableTop + 5);

    // rows
    let y = tableTop + rowHeight;
    doc.font(haveFonts ? "Noto-Regular" : "Helvetica");
    doc.fontSize(10);

    const pageBottom = doc.page.height - doc.page.margins.bottom - 50;

    for (let i = 0; i < order.items.length; i++) {
      if (y + rowHeight > pageBottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      const item = order.items[i];
      const productName = item.product ? item.product.productName : "Product Deleted";
      const qty = item.quantity || 0;
      const price = item.product ? item.product.price : 0;
      const subtotal = price * qty + (price * qty * (item.product.SGST + item.product.CGST) / 100);
      const sgst = item.product.SGST;
      const cgst = item.product.CGST;
      const hsn = item.product.hsnNo;

      // Draw row border
      doc.rect(marginLeft, y, tableWidth, rowHeight).stroke();

      // Product name may be long — wrap inside column width
      const prodColWidth = colQty - colProduct - 5;
      doc.text(String(i + 1), marginLeft + 5, y + 5);
      doc.text(productName, colProduct, y + 5, { width: prodColWidth });
      doc.text(hsn, hsnNo, y + 5);

      doc.text(String(qty), colQty, y + 5);
      doc.text(`${rupee}${price}`, colPrice, y + 5);
      doc.text(`${sgst}%`, colSGST, y + 5);
      doc.text(`${cgst}%`, colCGST, y + 5);
      doc.text(`${rupee}${subtotal}`, colSubtotal, y + 5);

      y += rowHeight;
    }

    // ---------- TOTALS ----------
    doc.moveTo(marginLeft, y + 5).lineTo(marginLeft + tableWidth, y + 5).stroke();
    doc.fontSize(11);
    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.text(`Product Total: ${rupee}${productTotal}`, marginLeft, y + 15, { align: "right", width: tableWidth - 20 });
    doc.text(`Delivery Fee: ${rupee}${deliveryFee > 0 ? deliveryFee : 0}`, marginLeft, y + 35, { align: "right", width: tableWidth - 20 });
    doc.text(`Order Total: ${rupee}${order.total}`, marginLeft, y + 55, { align: "right", width: tableWidth - 20 });

    // ---------- FOOTER / THANK YOU ----------
    doc.moveDown(5);
    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.fillColor("#1f8d4c");
    doc.fontSize(16);
    doc.text(" Thank you for shopping with DentHub! ", { align: "center" });
    doc.moveDown(0.5);
    doc.fillColor("#000000");
    doc.fontSize(11);
    doc.font(haveFonts ? "Noto-Regular" : "Helvetica");
    doc.text("We value your trust. If you have any questions about your order, contact our customer service.", { align: "center" });

    doc.end();
  } catch (err) {
    console.error("Receipt error:", err);
    res.status(500).send("Error generating receipt");
  }
});









app.post("/admin/products/edit/:id", upload.single("img"), async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    const { productName, originalprice, price, totalStock, shortDescription, longDescription, category, top, information, hsnNo, sgst, cgst } = req.body;

    let updateData = {
      productName,
      originalprice,
      price,
      totalStock,
      shortDescription,
      longDescription,
      category,
      isTopSeller: top === "yes" ? true : false,
      information,
      hsnNo,
      SGST: sgst,
      CGST: cgst
    };


    if (req.file) {
      updateData.img = req.file.path;
    }

    await product.findByIdAndUpdate(req.params.id, updateData);

    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating product");
  }
});


app.post("/admin/order/status/:id", async (req, res) => {
  try {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, { status });
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating status");
  }
});

app.get("/admin/order/delete/:id", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    await Order.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting order");
  }
});

app.post("/login", async (req, res, next) => {
  const oldCart = req.session.cart;
  passport.authenticate("local", async (err, user, info) => {
    if (err || !user) return res.status(400).json({ message: "Login failed! Invalid Credentials" });

    req.logIn(user, async (err) => {
      if (err) return res.status(500).json({ message: "Error during login" });

      // 🔹 Merge session cart into DB cart
      req.session.cart = oldCart;
      console.log(req.user);
      if (req.session.cart && req.session.cart.length > 0) {
        let dbCart = await Cart.findOne({ userEmail: req.user.email });
        if (!dbCart) dbCart = new Cart({ userEmail: req.user.email, items: [] });
        for (const sessionItem of req.session.cart) {
          const itemIndex = dbCart.items.findIndex(
            (i) => i.product.toString() === sessionItem.productId
          );
          if (itemIndex > -1) {
            dbCart.items[itemIndex].quantity += sessionItem.quantity;
          } else {
            dbCart.items.push({
              product: sessionItem.productId,
              quantity: sessionItem.quantity,
            });
          }
        }

        await dbCart.save();
        req.session.cart = []; // clear guest cart
      }
      res.redirect(geturl(req));
    });
  })(req, res, next);
});


app.get("/forgot", (req, res) => {
  res.render("forgot"); // ejs file with email input
});


app.post("/forgot", async (req, res) => {
  const { email } = req.body;
  const userr = await user.findOne({ email });
  if (!userr) {
    return res.send("No user with this email");
  }

  // generate 6 digit otp
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // save in DB

  await Otp.create({ email, otp: otpCode });


  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "dentalhub7718@gmail.com",
      pass: "cddxntvuevdcuyvh " // use App Password, not Gmail password
    }
  });
  // send email
  try {
    await transporter.sendMail({
      from: "dentalhub7718@gmail.com",
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otpCode}`
    });

    // ✅ Only render if mail is sent successfully
    res.render("verify_otp", { email });

  } catch (err) {
    console.error("Error sending mail:", err);
    res.status(500).send("Failed to send OTP. Please try again later.");
  }


});


app.post("/reset", async (req, res) => {
  const { email, otp, newPassword } = req.body;


  const record = await Otp.findOne({ email, otp });
  if (!record) {
    return res.send("Invalid or expired OTP");
  }

  // update password
  const userr = await user.findOne({ email });
  if (!userr) return res.send("User not found");


  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);
  userr.password = hash;
  await userr.save();

  // delete used OTP
  await Otp.deleteMany({ email });
  notifier.notify({
    title: 'Message!',
    message: 'Password Reset Successfully',

    sound: true,
    wait: true
  })

  res.redirect('/login');
});






app.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});


app.post("/cart/add", async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = quantity ? parseInt(quantity) : 1;

    if (req.user) {
      // Logged in → Save in DB
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
      // Guest → Save in session
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
});


app.post("/addaddress", async (req, res) => {


  const { name, email, city, pincode, fullAddress, contactNumber } = req.body;

  let address = await Address.findOne({ userEmail: req.user.useremail });

  if (address) {
    // Update existing
    address.name = name;
    address.email = email;
    address.city = city;
    address.pincode = pincode;
    address.fullAddress = fullAddress;
    address.contactNumber = contactNumber;
    await address.save();
  } else {
    // Create new
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

  res.redirect("/placeorder"); // redirect back to same page
});


// Search products
app.post("/search", async (req, res) => {
  try {
    const searchTerm = req.body.searchTerm;

    // Case-insensitive partial match
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
});




app.get("/search-suggest", async (req, res) => {
  try {
    const searchTerm = req.query.q;

    if (!searchTerm) {
      return res.json([]); // return empty array if no query
    }

    const Products = await product.find({
      productName: { $regex: searchTerm, $options: "i" }
    }).limit(10); // limit for suggestions

    res.json(Products); // return JSON instead of rendering
  } catch (err) {
    console.error("Search suggestion error:", err);
    res.status(500).json({ error: "Error fetching suggestions" });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

