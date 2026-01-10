//libs
const express = require("express");

//internos
const router = express.Router();
const orderController = require("./order.controller")
const autenticar = require('../middlewares/autenticarUser')

//importante: NAO ESQUECER DO MIDDLEWARE AUTENTICAR

router.get('/getAll', autenticar, orderController.getAll)
router.get('/:id/status', orderController.getOrderStatus)
router.get('/new', orderController.getOrdersWithOpenedStatus)
router.get('/foody/:id', orderController.getFoodyOrder)
router.get('/generate-relatorio', orderController.generateRelatorio)

router.post('/finalizar', orderController.finalize)

router.put('/:id', orderController.update)
router.put('/:id/status', orderController.updateStatus)
router.put('/setPrinted/:id', orderController.setPrinted)
router.put('/item/:id', orderController.updateOrderItem)
router.put('/pedido/:id', orderController.updateOrder)

router.delete('/:id', orderController.deleteOrder)

module.exports = router