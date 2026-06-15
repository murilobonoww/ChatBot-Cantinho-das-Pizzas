import * as menuService from "./menu.service";
import * as menuHelper from "./menu.helper";
import { Request, Response } from 'express';
import AppError from '../shared/AppError';

export async function get(req: Request, res: Response) {
    try {
        const menu = await menuHelper.getMenu();
        return res.status(200).json(menu);
    }
    catch (error: any) {
        console.error(error);
        // return res.status(500).json({ erro: "Erro ao buscar cardápio: ", message: error.message });
        throw new AppError("Erro ao buscar cardápio: " + error.message, error.statusCode || 500);
    }
}

export async function post(req: Request, res: Response) {
    try {
        const id = await menuService.post(req.body);
        return res.status(201).json({ message: "Item inserido no cardápio com sucesso", id: id });
    }
    catch (error: any) {
        return res.status(500).json({ erro: "Erro ao inserir no cardápio: ", error: error.message });
    }
}

export async function put(req: Request, res: Response) {
    try {
        await menuService.put(Number(req.params.id), req.body);
        return res.sendStatus(200);
    }
    catch (error: any) {
        return res.status(error.statusCode || 500).json({ erro: "Erro ao inserir no cardápio: ", error: error.message });
    }
}

export async function del(req: Request, res: Response) {
    const { section, ids } = req.body;
    try {
        await menuService.del(section, ids);
        return res.sendStatus(200);
    }
    catch (error: any) {
        return res.status(500).json({ erro: "Erro ao deletar item do cardápio: ", error: error.message });
    }
}