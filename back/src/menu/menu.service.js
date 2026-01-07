const db = require("../db")
//funções auxiliares
const { validateMenuData, validate_section, validateIDItens, chooseQueryForPost, chooseQueryForPut } = require("./menu.helper")

async function post(data) {
    validateMenuData(data)
    try {
        const { sql, values } = chooseQueryForPost(data)
        await db.query(sql, values)
    }
    catch (error) {
        throw new Error('Error posting to menu: ' + error.message)
    }
}

async function put(id, data) {
    validate_section(data.section)
    try {
        const { sql, values } = chooseQueryForPut(id, data)
        const [result] = await db.query(sql, values)
    }
    catch (error) {
        throw new Error('Error updating item from menu: ' + error.message)
    }
}

async function del(section, ids) {
    validate_section(section)
    const valid_ids = validateIDItens(ids)

    try {
        const [result] = await db.query(`DELETE FROM ${section} WHERE id IN (?)`, valid_ids);
    } 
    catch (error) {
        throw new Error('Error deleting item from menu: ' + error.message)
    }
}

module.exports = { post, put, del }