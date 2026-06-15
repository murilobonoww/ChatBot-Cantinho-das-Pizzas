import { Request, Response, NextFunction } from 'express';
import AppError from '../AppError';

export default function errorHandler(err: any, req: Request, res: Response, next: NextFunction){
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message});
    }

    console.error(err);

    return res.status(500).json({ error: 'Internal server error' });
}