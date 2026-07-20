const router = require("express").Router();
const controller = require("../controllers/steamController");

router.get("/login", controller.login);
router.get("/callback", controller.callback);
router.get("/me", controller.me);
router.get("/logout", controller.logout);

module.exports = router;
