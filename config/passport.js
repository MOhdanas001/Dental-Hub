const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const user = require('../Model/User');

passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  user.findOne({ email: email })
    .then(userr => {
      if (!userr) {
        return done(null, false);
      }
      bcrypt.compare(password, userr.password, (err, isMatch) => {
        if (isMatch) {
          return done(null, userr);
        } else {
          return done(null, false);
        }
      });
    })
    .catch(err => {
      console.log(err);
      return done(err);
    });
}));

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

module.exports = passport;
