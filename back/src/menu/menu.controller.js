const menuService = require("./menu.service")
const menuHelper = require("./menu.helper")

async function get(req, res) {
    try {
        const menu = await menuHelper.getMenu()
        return res.status(200).json(menu)
    }
    catch (error) {
        console.error(error)
        return res.status(500).json({ erro: "Erro ao buscar cardápio: ", message: error.message })
    }
}

async function post(req, res) {
    try {
        await menuService.post(req.body)
        return res.sendStatus(201)
    }
    catch (error) {
        return res.status(500).json({ erro: "Erro ao inserir no cardápio: ", error })
    }
}

async function put(req, res) {
    try {
        await menuService.put(req.params.id, req.body)
        return res.sendStatus(200)
    }
    catch (error) {
        return res.status(error.statusCode || 500).json({ erro: "Erro ao inserir no cardápio: ", error })
    }
}

async function del(req, res) {
    const { section, ids } = req.body
    try {
        await menuService.del(section, ids)
        return res.sendStatus(200)
    }
    catch (error) {
        return res.status(500).json({ erro: "Erro ao deletar item do cardápio: ", error })
    }
}

module.exports = { get, post, put, del }