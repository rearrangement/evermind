const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const supabase = require('./supabase');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 9876;


// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'devsecret',
  resave: false,
  saveUninitialized: false,
}));

app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated() && req.user) {
    const { id, name, email, avatar } = req.user;
    res.json({ id, name, email, avatar });
  } else {
    res.json({ error: 'Not logged in' });
  }
});

// Passport Google OAuth config
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  // Upsert user in Supabase
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      avatar: profile.photos[0]?.value || null
    })
    .select()
    .single();
  if (error) return done(error);
  return done(null, data);
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return done(error);
  done(null, data);
});

// Auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Middleware to check authentication
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// Save user JSON data
app.post('/api/userdata', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const jsonData = req.body;
  try {
    const { error } = await supabase
      .from('userdata')
      .upsert({ user_id: userId, data: jsonData });
    if (error) {
      console.error('Supabase error (save userdata):', JSON.stringify(error));
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Server error (save userdata):', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save all calendar/logged events for the user
app.post('/api/events', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const events = req.body.events;
  console.log('[DEBUG] /api/events called by user:', userId);
  console.log('[DEBUG] Incoming events:', JSON.stringify(events));
  if (!Array.isArray(events)) {
    console.log('[DEBUG] Events is not an array:', events);
    return res.status(400).json({ error: 'Events must be an array' });
  }
  try {
    const { error } = await supabase
      .from('userdata')
      .upsert({ user_id: userId, data: { events } });
    if (error) {
      console.error('[DEBUG] Supabase error (save events):', JSON.stringify(error));
      return res.status(500).json({ error: error.message });
    }
    console.log('[DEBUG] Events saved successfully for user:', userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[DEBUG] Server error (save events):', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user JSON data
app.get('/api/userdata', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const { data, error } = await supabase
    .from('userdata')
    .select('data')
    .eq('user_id', userId)
    .single();
  if (error) return res.status(404).json({ error: 'No data found' });
  res.json(data.data);
});


// Serve static files from public and src directories
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'src')));

// Serve account page
app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'account.html'));
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`evermind running at http://localhost:${PORT}`);
});
