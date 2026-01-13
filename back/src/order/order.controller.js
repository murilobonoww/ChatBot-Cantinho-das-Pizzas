const service = require('./order.service')

async function finalize(req, res) {
    try {
        await service.submitOrder(req.body)
        return res.sendStatus(200)
    } catch (error) {
        return res.status(500).json({ erro: 'Erro ao finalizar pedido: ', error })
    }
}

async function getAll(req, res) {
    try {
        const filters = { ...req.query }
        const pedidos = await service.getAll(filters)
        return res.status(200).send(pedidos)
    }
    catch (error) {
        return res.status(500).json({ erro: 'Erro ao pegar pedidos: ', error })
    }
}

async function update(req, res) {
    try {
        const orderID = req.params.id
        await service.update(orderID)
        return res.sendStatus(200)
    }
    catch (error) {
        return res.status(500).json({ erro: `Erro ao atualizar pedido ${orderID}: `, error })
    }
}

async function deleteOrder(req, res) {
    const orderID = req.params.id
    try {
        await service.deleteOrder(orderID)
        return res.sendStatus(200)
    } catch (error) {
        return res.status(500).json({ erro: `Erro ao deletar pedido ${orderID}: `, error })
    }
}

async function getOrderStatus(req, res) {
    try {
        const orderID = req.params.id
        await service.getOrderStatus(orderID)
        return res.sendStatus(200)
    } catch (error) {
        return res.status(500).json({ erro: `Erro ao pegar status do pedido ${orderID}: `, error })
    }
}

async function updateStatus(req, res) {
    try {
        const orderID = req.params.id
        const { novoStatus } = req.body

        await service.updateStatus(orderID, novoStatus)
        return res.sendStatus(200)
    } catch (error) {
        return res.status(500).json({ erro: `Erro ao atualizar status do pedido ${orderID}: `, error })
    }
}

async function setPrinted(req, res) {
    try {
        const orderID = req.params.id
        await service.setPrinted(orderID)
        return res.sendStatus(200)
    }
    catch (error) {
        return res.status(500).json({ erro: `Error setting order ${orderID} as printed: `, error })
    }
}

async function updateOrder(req, res) {
    try {
        const orderID = req.params.id
        await service.updateOrder(orderID, req.body)
        return res.sendStatus(200)
    }
    catch (error) {
        return res.status(500).json({ erro: `Error updating order ${orderID}: `, error })
    }
}

async function updateOrderItem(req, res) {
    try {
        const orderID = req.params.id
        await service.updateOrderItem(orderID, req.body)
        return res.sendStatus(200)
    }
    catch (error) {
        return res.status(500).json({ erro: `Error updating item of order ${orderID}: `, error })
    }
}

async function getOrdersWithOpenedStatus(req, res) {
    try {
        const orderID = req.params.id
        await service.getOrdersWithOpenStatus()
        return res.sendStatus(200)
    }
    catch (error) {
        return res.status(500).json({ erro: `Error getting orders with 'open' status: `, error })
    }
}

async function getFoodyOrder(req, res) {
    try {
        const uid = req.params.uid
        const order = await service.getOrderFromFoody(uid)
        return res.status(200).json(order)
    }
    catch (error) {
        return res.status(500).json({ erro: 'Error getting order from Foody: ', error })
    }
}

async function generateRelatorio(req, res) {
    try {
        const pass = req.headers["authorization"];
        const MANAGEMENT_PASS = process.env.SENHA_GERENCIA;
        const { inicio, fim } = req.query

        const relatorio = await service.generateRelatorio(pass, MANAGEMENT_PASS, inicio, fim)
        return res.status(200).json(relatorio)
    }
    catch (error) {
        return res.status(500).json({ erro: 'Error getting order from Foody: ', error })
    }
}

module.exports = { finalize, getAll, update, deleteOrder, getOrderStatus, updateStatus, setPrinted, updateOrder, updateOrderItem, getOrdersWithOpenedStatus, getFoodyOrder, generateRelatorio }