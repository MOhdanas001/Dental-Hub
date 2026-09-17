const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.LIVE_KEY || "rzp_test_placeholder",
  key_secret: process.env.LIVE_SECRET || "dummy_secret",
});

module.exports = razorpay;
