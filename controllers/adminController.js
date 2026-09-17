const product = require('../Model/Product');
const Order = require('../Model/Order');
const mongoose = require('mongoose');
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require('path');

exports.getAdminHome = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    const { page = 1, search = "" } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      query.$or = [{ userEmail: { $regex: search, $options: "i" } }];
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or.push({ _id: search });
      }
    }

    const orders = await Order.find(query)
      .populate("items.product")
      .populate("address")
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
};

exports.getAddProduct = (req, res) => {
  if (!req.user || req.user.role !== "admin") return res.redirect("/login");
  res.render("add_product");
};

exports.postAddProduct = async (req, res) => {
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
};

exports.getProducts = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    const { page = 1, search = "" } = req.query;
    const limit = 10;
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
};

exports.deleteProduct = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    await product.findByIdAndDelete(req.params.id);
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting product");
  }
};

exports.getEditProduct = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    const products = await product.findById(req.params.id).lean();
    if (!products) return res.status(404).send("Product not found");
    res.render("edit_product", { products });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading edit form");
  }
};

exports.postEditProduct = async (req, res) => {
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
};

exports.getOrderReceipt = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");

    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("address")
      .lean();

    if (!order) return res.status(404).send("Order not found");

    let productTotal = 0;
    order.items.forEach(item => {
      if (item.product && item.product.price) productTotal += item.product.price * item.quantity + (item.product.price * item.quantity * (item.product.SGST + item.product.CGST) / 100);
    });
    const deliveryFee = (order.total || 0) - productTotal;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=receipt_${order._id}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    const fontsDir = path.join(__dirname, "..", "public", "fonts");
    const regularFontPath = path.join(fontsDir, "NotoSans-Regular.ttf");
    const boldFontPath = path.join(fontsDir, "NotoSans-Bold.ttf");

    const haveFonts = fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath);
    if (haveFonts) {
      doc.registerFont("Noto-Regular", regularFontPath);
      doc.registerFont("Noto-Bold", boldFontPath);
      doc.font("Noto-Regular");
    } else {
      doc.font("Helvetica");
    }

    const rupee = haveFonts ? "₹" : "Rs.";

    // Watermark
    try {
      const centerX = doc.page.width / 2;
      const centerY = doc.page.height / 2;

      doc.save();
      if (haveFonts) doc.font("Noto-Bold");
      else doc.font("Helvetica-Bold");

      doc.fillColor("#000000");
      doc.opacity(0.08);
      doc.fontSize(80);

      doc.rotate(-45, { origin: [centerX, centerY] });
      doc.text("DentHub", centerX - 150, centerY - 40, {
        align: "center",
        width: 300
      });
      doc.rotate(45, { origin: [centerX, centerY] });
      doc.opacity(1);
      doc.restore();
    } catch (e) {
      doc.restore && doc.restore();
      doc.opacity && doc.opacity(1);
    }

    // HEADER
    const logoPath = path.join(__dirname, "..", "public", "img", "logodental.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 50, { width: 80 });
    }
    doc.fontSize(18);
    if (haveFonts) doc.font("Noto-Bold");
    else doc.font("Helvetica-Bold");
    doc.text("Invoice / Receipt", 0, 60, { align: "center" });
    doc.moveDown(2);

    // SOLD BY & SOLD TO
    const startY = doc.y;
    const leftX = 50;
    const rightX = 320;
    const columnGapY = 0;

    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.fontSize(12).text("Sold By:", leftX, startY);
    if (haveFonts) doc.font("Noto-Regular"); else doc.font("Helvetica");
    doc.fontSize(11).text("DentHub", leftX, doc.y + 3);
    doc.text("DentHub Pvt Ltd", leftX);
    doc.text("GSTIN: 09ASNPH5867P1ZO", leftX);

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

    // ORDER INFO
    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.fontSize(12).text("Order Details:", leftX);
    if (haveFonts) doc.font("Noto-Regular"); else doc.font("Helvetica");
    doc.fontSize(11);
    doc.text(`Order ID: ${order._id}`, leftX, doc.y + 3);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleString()}`, leftX);
    doc.text(`Payment Status: ${order.paystatus}`, leftX);
    doc.moveDown(1);

    // ITEMS TABLE
    doc.moveDown(0.5);
    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.fontSize(12).text("Order Items:", leftX);
    doc.moveDown(0.3);

    const tableTop = doc.y;
    const marginLeft = 35;
    const tableWidth = 530;
    const colSr = 50;
    const colProduct = 70;
    const hsnNo = 295;
    const colQty = 337;
    const colPrice = 370;
    const colSGST = 420;
    const colCGST = 470;
    const colSubtotal = 510;
    const rowHeight = 20;

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
      const subtotal = price * qty + (price * qty * ((item.product?.SGST || 0) + (item.product?.CGST || 0)) / 100);
      const sgst = item.product?.SGST || 0;
      const cgst = item.product?.CGST || 0;
      const hsn = item.product?.hsnNo || "";

      doc.rect(marginLeft, y, tableWidth, rowHeight).stroke();

      const prodColWidth = colQty - colProduct - 5;
      doc.text(String(i + 1), marginLeft + 5, y + 5);
      doc.text(productName, colProduct, y + 5, { width: prodColWidth });
      doc.text(String(hsn), hsnNo, y + 5);

      doc.text(String(qty), colQty, y + 5);
      doc.text(`${rupee}${price}`, colPrice, y + 5);
      doc.text(`${sgst}%`, colSGST, y + 5);
      doc.text(`${cgst}%`, colCGST, y + 5);
      doc.text(`${rupee}${subtotal}`, colSubtotal, y + 5);

      y += rowHeight;
    }

    // TOTALS
    doc.moveTo(marginLeft, y + 5).lineTo(marginLeft + tableWidth, y + 5).stroke();
    doc.fontSize(11);
    if (haveFonts) doc.font("Noto-Bold"); else doc.font("Helvetica-Bold");
    doc.text(`Product Total: ${rupee}${productTotal}`, marginLeft, y + 15, { align: "right", width: tableWidth - 20 });
    doc.text(`Delivery Fee: ${rupee}${deliveryFee > 0 ? deliveryFee : 0}`, marginLeft, y + 35, { align: "right", width: tableWidth - 20 });
    doc.text(`Order Total: ${rupee}${order.total}`, marginLeft, y + 55, { align: "right", width: tableWidth - 20 });

    // FOOTER
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
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, { status });
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating status");
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") return res.redirect("/login");
    await Order.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting order");
  }
};

exports.updateProductsBulk = async (req, res) => {
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
  );
  console.log("Product updated");
  res.send("Products updated successfully");
};
