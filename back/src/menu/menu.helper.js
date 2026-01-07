const db = require("../db");

const validSections = ["pizzas", "esfihas", "bebidas", "doces", "outros"];

async function getMenu() {
    try {
        const [pizzas] = await db.query("SELECT * FROM pizzas")
        const [esfihas] = await db.query("SELECT * FROM esfihas")
        const [bebidas] = await db.query("SELECT * FROM bebidas")
        const [doces] = await db.query("SELECT * FROM doces")
        const [outros] = await db.query("SELECT * FROM outros")

        return ({ pizzas, esfihas, bebidas, doces, outros })
    } catch (error) {
        throw error
    }
}

function validateMenuData(data) {
    const { section, nome, ingredientes, preco, preco_25, preco_35, tamanho } = data

    const missing_fieds_message = 'Todos os campos são obrigatórios.'

    if (!validSections.includes(section)) {
        throw new Error('Seção inválida.')
    }

    if (!nome) {
        throw new Error(missing_fieds_message)
    }

    if (section === "pizzas" && (!ingredientes || !preco_25 || !preco_35)) {
        throw new Error(missing_fieds_message)
    }
    if ((section === "esfihas" || section === "doces" || section === "outros") && !preco) {
        throw new Error(missing_fieds_message)
    }
    if (section === "bebidas" && (!tamanho || !preco)) {
        throw new Error(missing_fieds_message)
    }
}

function validate_section(section) {
    if (!validSections.includes(section)) {
        throw new Error('Seção inválida.')
    }
}

function validateIDItens(ids) {
    const sanitizedIds = ids.map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (sanitizedIds.length === 0) {
        throw new Error('Nenhum ID válido fornecido.')
    }
    return sanitizedIds
}

function chooseQueryForPost(data) {

    const { section, nome, ingredientes, preco, preco_25, preco_35, tamanho } = data

    switch (section) {
        case "pizzas":
            return {
                sql: `INSERT INTO pizzas (sabor, ingredientes, preco_25, preco_35) VALUES (?, ?, ?, ?)`,
                values: [nome, ingredientes, preco_25, preco_35]
            }

        case "esfihas":
            return {
                sql: `INSERT INTO esfihas (sabor, preco) VALUES (?, ?)`,
                values: [nome, preco]
            }

        case "bebidas":
            return {
                sql: `INSERT INTO bebidas (nome, tamanho, preco) VALUES (?, ?, ?)`,
                values: [nome, tamanho, preco]
            }

        case "doces":
            return {
                sql: `INSERT INTO doces (nome, preco) VALUES (?, ?)`,
                values: [nome, preco]
            }

        case "outros":
            return {
                sql: `INSERT INTO outros (nome, preco) VALUES (?, ?)`,
                values: [nome, preco]
            }
    }
}

function chooseQueryForPut(id, data) {
    const { section, nome, ingredientes, preco, preco_25, preco_35, tamanho } = data;

    try {
        switch (section) {
            case "pizzas":
                return {
                    sql: `UPDATE pizzas SET sabor = ?, ingredientes = ?, preco_25 = ?, preco_35 = ? WHERE id = ?`,
                    values: [nome, ingredientes, preco_25, preco_35, id]
                }

            case "esfihas":
                return {
                    sql: `UPDATE esfihas SET sabor = ?, preco = ? WHERE id = ?`,
                    values: [nome, preco, id]
                }

            case "bebidas":
                return {
                    sql: `UPDATE bebidas SET nome = ?, tamanho = ?, preco = ? WHERE id = ?`,
                    values: [nome, tamanho, preco, id]
                }

            case "doces":
                return {
                    sql: `UPDATE doces SET nome = ?, preco = ? WHERE id = ?`,
                    values: [nome, preco, id]
                }

            case "outros":
                return {
                    sql: `UPDATE outros SET nome = ?, preco = ? WHERE id = ?`,
                    values: [nome, preco, id]
                }
        }
    } catch (error) {
        throw error
    }
}

module.exports = {
    getMenu, validateMenuData, validate_section, validateIDItens, chooseQueryForPost, chooseQueryForPut
}