import db from "../db";

export async function getMenu() {
    const [pizzas] = await db.query("SELECT * FROM pizzas");
    const [esfihas] = await db.query("SELECT * FROM esfihas");
    const [bebidas] = await db.query("SELECT * FROM bebidas");
    const [doces] = await db.query("SELECT * FROM doces");
    const [outros] = await db.query("SELECT * FROM outros");

    return { pizzas, esfihas, bebidas, doces, outros };
}

const VALID_SECTIONS = ["pizzas", "esfihas", "bebidas", "doces", "outros"];

export function validateMenuData(data: { section: string, nome: string, ingredientes: string, preco: number, preco_25: number, preco_35: number, tamanho: string }) {
    const { section, nome, ingredientes, preco, preco_25, preco_35, tamanho } = data;

    const missing_fieds_message = 'Todos os campos são obrigatórios.';

    if (!VALID_SECTIONS.includes(section)) throw new Error('Seção inválida.');

    if (!nome) throw new Error(missing_fieds_message);

    if (section === "pizzas" && (!ingredientes || !preco_25 || !preco_35)) {
        throw new Error(missing_fieds_message);
    }
    if ((section === "esfihas" || section === "doces" || section === "outros") && !preco) {
        throw new Error(missing_fieds_message);
    }
    if (section === "bebidas" && (!tamanho || !preco)) {
        throw new Error(missing_fieds_message);
    }
}

export function validateSection(section: string) {
    if (!VALID_SECTIONS.includes(section)) {
        throw new Error('Seção inválida.');
    }
}

export function validateIDItems(ids: number[]) {
    const sanitizedIds = ids.filter((id) => !isNaN(id));
    if (sanitizedIds.length === 0) {
        throw new Error('Nenhum ID válido fornecido.')
    }
    return sanitizedIds
}

export function chooseQueryForPost(data: { section: string, nome: string, ingredientes: string, preco: number, preco_25: number, preco_35: number, tamanho: string }){

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

export function chooseQueryForPut(id: number, data: { section: string, nome: string, ingredientes: string, preco: number, preco_25: number, preco_35: number, tamanho: string }) {
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
            case "outros":
                return {
                    sql: `UPDATE ${section} SET nome = ?, preco = ? WHERE id = ?`,
                    values: [nome, preco, id]
                }
        }
    } catch (error) {
        throw error
    }
}

export default {
    getMenu, validateMenuData, validateSection, validateIDItems, chooseQueryForPost, chooseQueryForPut
}