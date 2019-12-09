const request = require('request');
const express = require('express');
const router = express.Router();
const jwtDecode = require('jwt-decode');

/*
  ALL OF THE ROUTES IN THIS PAGE REQUIRE AN AUTHENTICATED USER
*/

/* GET users listing. */
router.get('/', function(req, res, next) {

  console.log(req.user)

  res.render('users', {
    title: 'Login Success',
    user: req.user
  });
});

/* GET the profile of the current authenticated user */
router.get('/profile', function(req, res, next) {
  // Call the userinfo_endpoint stored in the session to get the user profile info.
  request.get(
    req.session.userInfoURL,
    {
    'auth': {
      'bearer': req.session.accessToken
    }
  },function(err, respose, body){

    //console.log('User Info')
    //console.log(body);
    const accessToken = jwtDecode(req.session.accessToken);
    const idToken = jwtDecode(req.session.idToken);

    res.render('profile', {
      title: 'Profile',
      user: JSON.parse(body),
      access_token: JSON.stringify(accessToken),
      id_token: JSON.stringify(idToken)
    });

  });
});

module.exports = router;
