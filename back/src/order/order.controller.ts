import AppError from '../shared/AppError';
import autenticateManager from '../shared/middlewares/autenticateManager';
import * as service from './order.service';
import { Request, Response } from 'express';

export async function finalize(req: Request, res: Response) {
    const orderID = await service.processOrder(req.body);
    return res.status(201).json({ id: orderID });
}

export async function getAll(req: Request, res: Response) {
    try {
        const filters = { ...req.query }
        const pedidos = await service.getAll(filters)
        return res.status(200).send(pedidos)
    }
    catch (error) {
        return res.status(500).json({ erro: 'Erro ao pegar pedidos: ', error })
    }
}

export async function deleteOrder(req: Request, res: Response) {
    const orderID = req.params.id
    try {
        await service.deleteOrder(Number(orderID))
        return res.sendStatus(200)
    } catch (error) {
        return res.status(500).json({ erro: `Erro ao deletar pedido ${orderID}: `, error })
    }
}

export async function getOrderStatus(req: Request, res: Response) {
    try {
        const orderID = req.params.id
        await service.getOrderStatus(Number(orderID))
        return res.sendStatus(200)
    } catch (error) {
        return res.status(500).json({ erro: `Erro ao pegar status do pedido ${req.params.id}: `, error })
    }
}

export async function setPrinted(req: Request, res: Response) {
    try {
        const orderID = req.params.id
        await service.setPrinted(Number(orderID))
        return res.sendStatus(200)
    }
    catch (error) {
        return res.status(500).json({ erro: `Error setting order ${req.params.id} as printed: `, error })
    }
}

export async function update(req: Request, res: Response) {
    try {
        const orderID = req.params.id;
        await service.update(Number(orderID), req.body);
        return res.sendStatus(200);
    }
    catch (error) {
        return res.status(500).json({ erro: `Error updating order ${req.params.id}: `, error });
    }
}

export async function updateOrderItem(req: Request, res: Response) {
    try {
        const orderID = req.params.id
        await service.updateOrderItem(Number(orderID), req.body)
        return res.sendStatus(200)
    }
    catch (error) {
        return res.status(500).json({ erro: `Error updating item of order ${req.params.id}: `, error })
    }
}

export async function getOrdersWithOpenedStatus(req: Request, res: Response) {
    try {
        const temNovos = await service.getOrdersWithOpenedStatus()
        return res.status(200).json({ novos: temNovos })
    }
    catch (error) {
        return res.status(500).json({ erro: `Error getting orders with 'open' status: `, error })
    }
}

const MANAGEMENT_PASS = process.env.SENHA_GERENCIA;

export async function generateReport(req: Request, res: Response) {
    try {
        const pass = req.headers["authorization"];
        autenticateManager(pass, MANAGEMENT_PASS);
        const { inicio, fim } = req.query;

        const relatorio = await service.generateReport(inicio as string, fim as string);
        return res.status(200).json(relatorio);
    }
    catch (err: any) {
        return res.status(500).json({ erro: 'Error getting order from Foody: ', err });
    }
}

// export async function getFoodyOrder(req: Request, res: Response) {
//     try {
//         const uid = req.params.uid
//         const order = await service.getOrderFromFoody(String(uid))
//         return res.status(200).json(order)
//     }
//     catch (error) {
//         return res.status(500).json({ erro: 'Error getting order from Foody: ', error })
//     }
// }