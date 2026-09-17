const passport = require('passport');
const bcrypt = require('bcryptjs');
const notifier = require('node-notifier');
const nodemailer = require('nodemailer');
const user = require('../Model/User');
const Cart = require('../Model/Cart');
const Otp = require('../Model/Otp');

const geturl = (req) => {
  return req.user.role === 'admin' ? '/admin' : '/';
};

exports.getSignup = (req, res) => {
  if (req.user) return res.redirect("/");
  res.render('signup');
};

exports.getLogin = (req, res) => {
  if (req.user) return res.redirect("/");
  res.render('login');
};

exports.postRegister = (req, res) => {
  const { name, email, password } = req.body;
  user.findOne({ email: email })
    .then(userr => {
      if (userr) {
        notifier.notify({
          title: 'Message!',
          message: 'User Already Exist!',
          sound: true,
          wait: true
        });

        return res.redirect('/signup');
      }

      const newuser = new user({
        name: name,
        email: email,
        password: password
      });

      bcrypt.genSalt(10, (err, salt) =>
        bcrypt.hash(newuser.password, salt, (err, hash) => {
          if (err) throw err;
          newuser.password = hash;

          newuser.save()
            .then(userr => {
              notifier.notify({
                title: 'Message!',
                message: 'Account Created Successfully!',
                sound: true,
                wait: true
              });

              res.redirect('/login');
            })
            .catch(err => {
              console.log(err);
            });
        })
      );
    });
};

exports.postLogin = async (req, res, next) => {
  const oldCart = req.session.cart;
  passport.authenticate("local", async (err, user, info) => {
    if (err || !user) return res.status(400).json({ message: "Login failed! Invalid Credentials" });

    req.logIn(user, async (err) => {
      if (err) return res.status(500).json({ message: "Error during login" });

      // Merge session cart into DB cart
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
};

exports.getForgot = (req, res) => {
  res.render("forgot");
};

exports.postForgot = async (req, res) => {
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
      pass: "cddxntvuevdcuyvh "
    }
  });

  try {
    await transporter.sendMail({
      from: "dentalhub7718@gmail.com",
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otpCode}`
    });

    res.render("verify_otp", { email });

  } catch (err) {
    console.error("Error sending mail:", err);
    res.status(500).send("Failed to send OTP. Please try again later.");
  }
};

exports.postReset = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const record = await Otp.findOne({ email, otp });
  if (!record) {
    return res.send("Invalid or expired OTP");
  }

  const userr = await user.findOne({ email });
  if (!userr) return res.send("User not found");

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);
  userr.password = hash;
  await userr.save();

  await Otp.deleteMany({ email });
  notifier.notify({
    title: 'Message!',
    message: 'Password Reset Successfully',
    sound: true,
    wait: true
  });

  res.redirect('/login');
};

exports.getLogout = function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
};
