export function flash(req, type, message) {
  if (!req.session) return;
  req.session.flash = { type, message };
}

export function consumeFlash(req, res, next) {
  const f = req.session?.flash;
  if (f) {
    res.locals.flash = f;
    delete req.session.flash;
  } else {
    res.locals.flash = null;
  }
  next();
}
