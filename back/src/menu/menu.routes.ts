const express = require("express");
const router = express.Router();
import * as controller from "./menu.controller";

router.get("/", controller.get);
router.post("/", controller.post);
router.put("/:id", controller.put);
router.delete("/", controller.del);

export default router;