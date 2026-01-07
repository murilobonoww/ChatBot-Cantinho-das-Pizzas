//libs
const express = require("express");

//interns
const router = express.Router();
const menuController = require("./menu.controller");

router.get("/", menuController.get)
router.post("/", menuController.post)
router.put("/:id", menuController.put)
router.delete("/:id", menuController.del)

module.exports = router;