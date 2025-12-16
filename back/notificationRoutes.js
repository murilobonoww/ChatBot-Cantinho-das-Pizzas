const express = require("express");
const router = express.Router();
const db = require("./db");
const dotenv = require("dotenv");
dotenv.config();
const axios = require("axios");


router.post("/post", (req, res) => {
    return res.status(200).json({ message: "Ok" })
})

module.exports = router;