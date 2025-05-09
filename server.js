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

app.get('/animals', async (req, res) => {
  try {
    const animals = await Animal.find();
    res.render('animals', { animals });
  } catch (err) {
    console.error('Error fetching animals:', err);
    res.status(500).send('Error fetching animals');
  }
});

app.get('/animals/:id', async (req, res) => {
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

app.post('/animals', async (req, res) => {
  const { name, species, age } = req.body;

  if (!name || !species) {
    return res.status(400).send('All fields are required');
  }

  try {
    const newAnimal = new Animal({ name, species, age });
    await newAnimal.save();
    res.redirect('/animals');
  } catch (err) {
    console.error('Error saving animal:', err);
    res.status(500).send('Error saving animal');
  }
});


app.post('/animals/delete', async (req, res) => {
  try {
    const { id } = req.body;
    await Animal.findByIdAndDelete(id);
    res.redirect('/animals');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting animal');
  }
});

app.post('/animals/deleteMany', async (req, res) => {
  const { animalIds } = req.body;

  if (!animalIds) {
    return res.status(400).send('No animals selected for deletion');
  }

  const idsArray = animalIds.split(',');

  try {
    await Animal.deleteMany({ _id: { $in: idsArray } });
    res.redirect('/animals');
  } catch (err) {
    console.error('Error deleting animals:', err);
    res.status(500).send('Error deleting animals');
  }
});


app.get('/animals/:id/edit', async (req, res) => {
    try {
        const animal = await Animal.findById(req.params.id);
        if (!animal) {
            return res.status(404).send('Animal not found');
        }
        res.render('edit-animal', { animal });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching animal for editing');
    }
});


app.post('/animals/:id/edit', async (req, res) => {
    try {
        const { name, species } = req.body;
        await Animal.findByIdAndUpdate(req.params.id, { name, species });
        res.redirect('/animals');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating animal');
    }
});


app.post('/animals/:id/replace', async (req, res) => {
  const { name, species, age } = req.body;

  if (!name || !species || !age) {
    return res.status(400).send('All fields are required for replacement');
  }

  try {
    const replacedAnimal = await Animal.replaceOne({ _id: req.params.id }, { name, species, age });
    if (replacedAnimal.matchedCount === 0) {
      return res.status(404).send('Animal not found');
    }
    res.redirect('/animals');
  } catch (err) {
    console.error('Error replacing animal:', err);
    res.status(500).send('Error replacing animal');
  }
});


app.get('/animals/:id/replace', async (req, res) => {
  try {
    const animal = await Animal.findById(req.params.id);
    if (!animal) {
      return res.status(404).send('Animal not found');
    }
    res.render('edit-animal', { animal, isReplace: true });
  } catch (err) {
    console.error('Error fetching animal for replacement:', err);
    res.status(500).send('Error fetching animal for replacement');
  }
});

app.get('/animals-search', async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).send('Name query parameter is required');
  }

  try {
    const animals = await Animal.find({ name: new RegExp(name, 'i') }, 'name species');
    res.render('animals', { animals });
  } catch (err) {
    console.error('Error searching animals:', err);
    res.status(500).send('Error searching animals');
  }
});

app.get('/animals-update-cats-to-dogs', async (req, res) => {
  try {
    const result = await Animal.updateMany({ species: 'cat' }, { species: 'dog' });
    res.redirect('/animals');
  } catch (err) {
    console.error('Error updating species:', err);
    res.status(500).send('Error updating species');
  }
});

app.post('/animals/create-piglets', async (req, res) => {
  try {
    const piglets = [
      { name: 'Nif-Nif', species: 'pig', age: 1 },
      { name: 'Nuf-Nuf', species: 'pig', age: 1 },
      { name: 'Naf-Naf', species: 'pig', age: 1 }
    ];

    await Animal.insertMany(piglets);
    res.redirect('/animals');
  } catch (err) {
    console.error('Error creating piglets:', err);
    res.status(500).send('Error creating piglets');
  }
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
