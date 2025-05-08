const express = require('express');
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const path = require('path');
const mongoose = require('mongoose');
const Animal = require('./models/Animal');
const flash = require('connect-flash');

const app = express();

const mongoURI = 'mongodb+srv://test:test_project@cluster0.vy3wadi.mongodb.net/dbTest?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

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

app.use(flash());

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

  console.log('Registration data:', req.body);

  if (!email || !password) {
    return res.status(400).send('All fields are required');
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
  successRedirect: '/animals',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

app.get('/', (req, res) => {
  res.redirect('/animals');
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

app.get('/animals', ensureAuthenticated, async (req, res) => {
  try {
    const animals = await Animal.find();
    res.render('animals', { animals });
  } catch (err) {
    console.error('Error fetching animals:', err);
    res.status(500).send('Error fetching animals');
  }
});

app.get('/animals/:id', ensureAuthenticated, async (req, res) => {
  try {
    const animal = await Animal.findById(req.params.id);
    if (!animal) {
      return res.status(404).send('Animal not found');
    }
    res.render('animal', { animal });
  } catch (err) {
    console.error('Error fetching animal:', err);
    res.status(500).send('Error fetching animal');
  }
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
