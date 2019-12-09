require('dotenv').config();

var request = require('request');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

// Use Passport with OpenId Connect strategy to
// authenticate users
var passport = require('passport');
var OidcStrategy = require('passport-openidconnect').Strategy;

var index = require('./routes/index');
var users = require('./routes/users');
var df = require('./routes/df');

var app = express();
// Get the base URI for the OIDC provider
const OIDC_BASE_URI = process.env.OIDC_BASE_URI;
const callbackURL = process.env.OIDC_REDIRECT_URI;
var issuer;
var authorizationURL;
var userInfoURL;
var tokenURL;
var endSessionURL;

// Get OIDC endpoints from well known configuration endpoint
request(`${OIDC_BASE_URI}/.well-known/openid-configuration`, 
  { json: true },
  (err, res, body) => {
    if (err) { throw Error(err); }
    issuer = body.issuer;
    //console.log(`issuer: ${issuer}`);
    authorizationURL = body.authorization_endpoint;
    //console.log(`authorization_endpoint: ${authorizationURL}`);
    userInfoURL = body.userinfo_endpoint;
    //console.log(`user_info_endpoint: ${userInfoURL}`);
    tokenURL = body.token_endpoint;
    //console.log(`tokenURL: ${tokenURL}`);
    endSessionURL = body.end_session_endpoint;
    //console.log(`end_session_endpoint: ${endSessionURL}`);
    // configure the Passport authentication middleware
    configPassport();
    // configure the Express routes
    configExpress();
  }
);

/**
 * Configure Passport middleware
 */
function configPassport() {
  // Configure the OIDC Strategy for Passport login 
  // with credentials obtained from the OIDC server
  passport.use(new OidcStrategy({
      issuer,
      clientID: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      authorizationURL,
      userInfoURL,
      tokenURL,
      callbackURL,
      passReqToCallback: true
    },
    function (req, issuer, userId, profile, accessToken, refreshToken, params, cb) {
      //console.log('issuer:', issuer);
      //console.log('userId:', userId);
      //console.log('accessToken:', accessToken);
      //console.log('refreshToken:', refreshToken);
      //console.log('params:', params);

      // Store the Access Token and ID Token in the request session 
      req.session.accessToken = accessToken;
      req.session.idToken = params.id_token;

      return cb(null, profile);
    }));

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (obj, done) {
    done(null, obj);
  });
}

/**
 * Configure Express.
 */
function configExpress() {
  // view engine setup
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'hbs');

  // uncomment after placing your favicon in /public
  app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: false
  }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));
  //app.use(express.static('public'));

  // Passport requires session to persist the authentication
  // so were using express-session for this example
  // NOTE: for production you will need a session store such as connect-redis or connect-mongo.
  app.use(session({
    secret: 'lsdfkjalsdfkjpoysdfds',
    resave: false,
    saveUninitialized: true
  }))

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  app.use('/', index);
  app.get('/df', df);
  // // Warmup handler for GCP app engine
  // app.get('/_ah/warmup', (req, res) => {
  //   // Handle your warmup logic. Initiate db connection, etc.
  //   res.send("warmup call received.");
  // });
  // Only allow authenticated users to access the /users route
  app.use('/users', 
    function(req, res, next) {
      // add the userInfoURI to the request.  This is need for the profile page
      req.session.userInfoURL = userInfoURL;
      checkAuthentication(req, res, next);
    }, users);

  // Initiates an authentication request.
  // The user will be redirect to login and once authenticated
  // they will be returned to the callback handler below
  app.get('/login', passport.authenticate('openidconnect', {
    successReturnToOrRedirect: "/",
    scope: 'profile'
  }));

  // Callback handler that the OP will redirect back to
  // after successfully authenticating the user
  app.get('/oauth/callback',
    passport.authenticate('openidconnect', {
      callback: true,
      successReturnToOrRedirect: '/users',
      failureRedirect: '/'
    })
  );

  // Destroy both the local session and revoke the access_token at the OP
  app.get('/logout', function (req, res) {
    res.redirect(`${endSessionURL}?post_logout_redirect_uri=${process.env.POST_LOGOUT_REDIRECT_URI}&id_token_hint=${req.session.idToken}`);
  });

  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  // error handler
  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
  });
}

// Middleware for checking if a user has been authenticated
// via Passport and OpenId Connect
function checkAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect("/");
  }
}

module.exports = app;