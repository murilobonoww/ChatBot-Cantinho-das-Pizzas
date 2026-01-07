//libs
const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");

//config
dotenv.config();
const { MAPS_API_KEY, CODE_HASH, JWT_SECRET_KEY } = process.env

//internos
const db = require("../db");
const router = express.Router();
const menuController = require("./menu.controller");

router.get("/", menuController.get)
router.post("/", menuController.post)
router.put("/:id", menuController.put)
router.delete("/:id", menuController.del)

module.exports = router;