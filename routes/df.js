var express = require('express');
var router = express.Router();

/* GET Discussion forum entry page. */
router.get('/df', function(req, res, next) {
  res.render('df', { title: "CTSA Discussion Forum" });
});

module.exports = router;
