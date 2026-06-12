import express from "express";
const router = express.Router();
import * as orderController from "./order.controller";
import autenticarUser from '../shared/middlewares/autenticarUser';

//importante: NAO ESQUECER DO MIDDLEWARE AUTENTICAR EM TODOS OS ENDPOINTS

router.get('/', orderController.getAll);
router.get('/:id/status', orderController.getOrderStatus);
router.get('/new', orderController.getOrdersWithOpenedStatus);
router.get('/generate-relatorio', orderController.generateReport);

router.post('/', orderController.finalize);

router.put('/:id', orderController.update);
router.put('/setPrinted/:id', orderController.setPrinted);
router.put('/item/:id', orderController.updateOrderItem);

router.delete('/:id', orderController.deleteOrder);

export default router;

// router.get('/foody/:id', orderController.getFoodyOrder);