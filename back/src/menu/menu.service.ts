import db from "../db";
import { IOrder } from "../order/IOrder";
import * as helper from "./menu.helper";

export async function post(data: { section: string, nome: string, ingredientes: string, preco: number, preco_25: number, preco_35: number, tamanho: string }) {
    helper.validateMenuData(data);
    try {
        const { sql, values } = helper.chooseQueryForPost(data) as { sql: string, values: any[] };
        const [result] = await db.query(sql, values);
        return result.insertId;
    }
    catch (error: any) {
        throw new Error('Error posting to menu: ' + error.message);
    }
}

export async function put(id: number, data: { section: string, nome: string, ingredientes: string, preco: number, preco_25: number, preco_35: number, tamanho: string }) {
    helper.validateSection(data.section);
    try {
        const { sql, values } = helper.chooseQueryForPut(id, data) as { sql: string, values: any[] };
        const [result] = await db.query(sql, values);
    }
    catch (error: any) {
        throw new Error('Error updating item from menu: ' + error.message);
    }
}

export async function del(section: string, ids: number[]) {
    helper.validateSection(section);
    const valid_ids = helper.validateIDItems(ids);
    try {
        const [result] = await db.query(`DELETE FROM ${section} WHERE id IN (?)`, valid_ids);
    } 
    catch (error: any) {
        throw new Error('Error deleting item from menu: ' + error.message);
    }
}

export default { post, put, del };