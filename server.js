const express = require('express');
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

const users = [];

app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { httpOnly: true, secure: false } 
}));

app.use(passport.initialize());
app.use(passport.session());


passport.use(new LocalStrategy((username, password, done) => {
  const user = users.find(u => u.email === username);
  if (!user) {
    return done(null, false, { message: 'Incorrect username' });
  }

  bcrypt.compare(password, user.password, (err, isMatch) => {
    if (err) return done(err);
    if (!isMatch) return done(null, false, { message: 'Incorrect password' });
    return done(null, user);
  });
}));

passport.serializeUser((user, done) => {
  done(null, user.email);
});

passport.deserializeUser((email, done) => {
  const user = users.find(u => u.email === email);
  done(null, user);
});


app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { email, password } = req.body;

  
  if (users.some(user => user.email === email)) {
    return res.send('User already exists');
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) throw err;

    users.push({ email, password: hashedPassword });
    res.redirect('/login');
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/protected',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});


app.get('/protected', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }

  res.render('protected', { user: req.user });
});

app.get('/', (req, res) => {
  res.send('<h1>Welcome to the Authentication System</h1><p><a href="/login">Login</a> | <a href="/register">Register</a></p>');
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
