const ensureAuthenticated = (req, res, next) => {
  if (req.user) {
    return next();
  }
  res.redirect('/login');
};

const ensureAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.redirect('/login');
};

module.exports = {
  ensureAuthenticated,
  ensureAdmin
};
