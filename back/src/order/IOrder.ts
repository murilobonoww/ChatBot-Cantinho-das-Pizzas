export interface IOrder {
    id_pedido?: number;
    tipo?: string;
    status_pedido?: string;
    nome_cliente?: string;
    telefone_cliente?: string;
    observacao?: string;
    endereco_entrega: string | null;
    taxa_entrega?: number | null;
    alteracao?: number;
    data_pedido?: string;
    printed?: boolean;
    delivery?: number;
    latitude?: null;
    longitude?: null;
    houseNumber?: number;
    preco_total?: number;
    forma_pagamento?: string;
    itens: IItem[];
}

export interface IItem {
    produto: string;
    sabor: string;
    quantidade: number;
    observacao: string;
    preco?: number;
}

export interface IFilters {
    id?: number;
    inicio?: string;
    fim?: string;
    cliente?: string;
}