//libs
const express = require("express");

//interns
const router = express.Router();

router.get("/keep-server-on", (req, res) => {
  return res.sendStatus(200)
})

module.exports = router;