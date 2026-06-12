import AppError from "../AppError";

export default function authorize(pass: string | undefined, MANAGEMENT_PASS: string | undefined) {
    if (!pass) throw new AppError('O código de acesso é um campo obrigatório', 400);
    if (!MANAGEMENT_PASS) throw new Error ('Internal server error');
    if (pass !== `Bearer ${MANAGEMENT_PASS}`) throw new AppError('Senha incorreta', 401);
  }