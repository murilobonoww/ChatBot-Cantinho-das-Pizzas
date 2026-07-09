import { IFilters, IOrder } from "../IOrder";
import { IItem } from "../IOrder";
const axios = require("axios");
const OpenAI = require("openai");
import * as repository from '../order.repository';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function processOrder(order: IOrder): Promise<string>{
    const tax = await calculateTax(order);
    order.taxa_entrega = tax;
    const total_price = await getProductPrice(order);
    order.preco_total = Number((total_price + tax).toFixed(2));
    const { orderID } = await insertOrder(order);
    return generateFinalMessage(orderID, order);
}

export function generateFinalMessage(orderId: number, order: IOrder): string {
    const delivery = order.endereco_entrega !== null;
    const change = order.alteracao == 1;
    const title = `*#️⃣ Pedido Nº ${orderId}*`;
    let items = '';

    for (const item of order.itens) {
        switch (item.produto) {
            case 'Pizza':
                items += `${item.quantidade} x ${item.produto} de ${item.sabor} - R$${item.preco!.toFixed(2).replace(".", ",")} (${item.observacao})\n`;
                break;
            case 'Esfiha':
                items += `${item.quantidade} x ${item.produto} de ${item.sabor} - R$${item.preco!.toFixed(2).replace(".", ",")}\n`;
                break;
            default:
                items += `${item.quantidade} x ${item.sabor} - R$${item.preco!.toFixed(2).replace(".", ",")}\n`;
                break;
        }
    }

    const client = `*👤 ${order.nome_cliente}*`;
    const phone = `*📞 ${order.telefone_cliente}*`;
    const payment_method = `• 💳 Forma de pagamento: ${order.forma_pagamento}`;
    const address = `• 📍 Endereço: ${order.endereco_entrega}`;
    const tax = `• 🚚 Taxa de entrega: R$${order.taxa_entrega!.toFixed(2).replace('.', ',')}`;
    const total_price = `• Total: R$${order.preco_total!.toFixed(2).replace('.', ',')}`;
    const advice = "*O pagamento será feito na entrega.*";
    const thanks = "Obrigado pelo seu pedido! Em breve estaremos aí... 🍕🏍️";

    const parts = [
        ...(change ? ['(*Alteração de pedido*)'] : []),
        title,
        client,
        phone,
        ...(!delivery ? ['*📍 Retirar na loja*'] : []),
        '',
        '━━━━━━━━━━━━━━━━━━━━━━',
        '🛒 *ITENS DO PEDIDO*',
        '━━━━━━━━━━━━━━━━━━━━━━',
        '',
        items.trimEnd(),
        '',
        '━━━━━━━━━━━━━━━━━━━━━━',
        '💰 *RESUMO DO PEDIDO*',
        '━━━━━━━━━━━━━━━━━━━━━━',
        '',
        payment_method,
        ...(delivery ? [address, tax] : []),
        total_price,
        '',
        advice,
        '',
        thanks,
    ];

    return parts.join('\n');
}

async function calculateTax(order: IOrder){
    const address = order.endereco_entrega;
    const isDelivery = order.delivery == 1;
    const distance = await validateDistance(address);

    let tax: number = 0;
    if (isDelivery) tax = calculateDeliveryFee(distance) ?? 0;
    return tax;
}

function calculateDeliveryFee(distance: number | null): number | null {
    const MIN_TAX = 4.00;
    if (!distance) return null;
    if (distance < 1) return MIN_TAX;
    let tax = distance * factor(distance);
    tax = formatTax(tax);
    return tax;
}

function factor(distance: number): number {
    return distance < 3 ? 3 : 2;
}

function formatTax(tax: number): number {
    const formattedTax = parseFloat(tax.toFixed(2));
    return formattedTax;
}

const PRODUCTS_CONFIG: Record<string, {table:string, column: string, keyColumn: string}> = {
    PizzaM: { table: 'pizzas', column: 'preco_25', keyColumn: 'sabor' },
    PizzaG: { table: 'pizzas', column: 'preco_35', keyColumn: 'sabor' },
    Esfiha: { table: 'esfihas', column: 'preco', keyColumn: 'sabor' },
    Bebida: { table: 'bebidas', column: 'preco', keyColumn: 'nome' },
    Doce: { table: 'doces', column: 'preco', keyColumn: 'nome' },
    Outros: { table: 'outros', column: 'preco', keyColumn: 'nome' }
}

async function getProductPrice(order: IOrder): Promise<number> {
    let totalPrice = 0;

    for (const item of order.itens) {
        let searchTerm: string = resolveSearchTerm(item);
        const productConfig = PRODUCTS_CONFIG[searchTerm];
        if (!productConfig) throw new Error(`${searchTerm} não encontrado`);

        const sabor = await askOpenAI(item);
        const priceData: number = await repository.getProductPrice(sabor, productConfig);
        item.preco = priceData;
        totalPrice += priceData * item.quantidade;
    }
    return Number(totalPrice.toFixed(2));
};

function resolveSearchTerm(item: IItem): string {
    if (item.produto === 'Pizza') {
        if (item.observacao.includes('25')) {
            return 'PizzaM';
        }
        else if (item.observacao.includes('35')) {
            return 'PizzaG';
        }
        else {
            throw new Error('Tamanho de pizza inválido.');
        }
    }
    return item.produto;
}

async function validateDistance(address: string | null): Promise<number | null> {
    const distanceKM = await calculateDistance(address);
    if (distanceKM && distanceKM > 15) throw new Error('Fora do raio de atendimento.');
    return distanceKM;
}

async function insertOrder(order: IOrder): Promise<{ orderID: number }> {
    const order_id = await repository.insertOrder(order);
    const resolvedItems = [];

    for (const item of order.itens) {
        const flavor = await askOpenAI(item);
        item.sabor = flavor;
        resolvedItems.push({ ...item, saborItem: flavor });
        if (flavor === 'NAO_ENCONTRADO') throw new Error(`sabor não encontrado no cardápio: ${item.sabor}`)
    }
    const itemsID = await repository.insertItems(order_id, resolvedItems);
    return { orderID: order_id};
    // const { latitude, longitude } = order;
    // sendToFoody(pedido, pedido_id, latitude, longitude); // ← envia para a Foody de forma assíncrona
}

export const MAPS_API_KEY = process.env.MAPS_API_KEY as string;

async function calculateDistance(destinationAddress: string | null): Promise<number | null> {

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 15000);
    const originAddress = "R. Copacabana, 111 - Jardim Maria Helena, Barueri - SP, 06445-060";
    const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

    const body = {
        origin: { address: originAddress },
        destination: { address: destinationAddress },
        travelMode: "DRIVE"
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": MAPS_API_KEY,
                "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        const data = await response.json();

        const route = data?.routes?.[0];
        if (!route?.distanceMeters) {
            console.log("❌ 'distanceMeters' ausente na resposta.");
            return null;
        }
        return route.distanceMeters / 1000;
    } catch (err) {
        console.log("❌ Erro ao calcular distância:", err);
        return null;
    }
}

async function askOpenAI(item:IItem) {
    try {
        const menu = (await fetchNames(item)).join('\n');
        const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            temperature: 0.3,
            messages: [
                {
                    role: "user", content: `Você deve verificar se o item informado existe no cardápio. Entrada do usuário:
- Nome/sabor informado: "${item.sabor}"
- Categoria: "${item.produto}"

Cardápio da categoria:
${menu}

Regras:
1. Compare o nome informado com os nomes do cardápio informado.
2. Se existir um nome igual ou muito parecido no cardápio, retorne **exatamente o nome como está escrito no cardápio** (sem alterar letras, acentos ou números).
3. Se houver mais de uma opção parecida (ex: "frango 1" e "frango 2"), retorne apenas a que tiver o número "1" no final, ou caso não haja número no final, retorne a opção mais neutra possível.
4. Se não existir nenhuma opção correspondente, responda exatamente: "NAO_ENCONTRADO".
5. Não explique o raciocínio e não invente nomes.

Retorne apenas o resultado.
` }
            ]
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("Erro OpenAI:", error);
        throw error;
    }
}

async function fetchNames(item: IItem) {
    const searchTerm = resolveSearchTerm(item);
    const prodConfig = PRODUCTS_CONFIG[searchTerm];
    if (!prodConfig) throw new Error(`${item.produto} não encontrado`);
    const names = await repository.getProductNames(prodConfig);
    if (!names.length) throw new Error(`${item.produto} não encontrado`);
    return names;
}

export function applyFilters(filters: IFilters, query: string): { query: string, params: any[] } {
    const { id, inicio, fim, cliente } = filters;
    let conditions: string[] = [];
    let params: any[] = [];

    if (id != null) {
        conditions.push(`p.id_pedido = ?`)
        params.push(id)
    }

    if (inicio != null && fim != null) {
        conditions.push(`p.data_pedido BETWEEN ? AND ?`)
        params.push(`${inicio} 00:00:00`, `${fim} 23:59:59`)
    }

    if (cliente != null) {
        conditions.push(`p.nome_cliente LIKE ?`);
        params.push(`%${cliente}%`);
    }

    if (conditions.length > 0) query += ` WHERE ` + conditions.join(" AND ");
    return { query, params };
}

export function appendOrderByClause(sql: string): string {
    return sql + ` ORDER BY p.id_pedido DESC`;
}

export function structureOrders(results: any[]) {
    const OrdersMap: any = {};

    results.forEach((row) => {
        const id = row.id_pedido;
        if (!OrdersMap[id]) {
            OrdersMap[id] = setOrder(row);
        }

        if (row.id_item !== null) {
            OrdersMap[id].itens.push(setItem(row));
        }
    });

    const orders = Object.values(OrdersMap);
    return orders;
}

function setOrder(row: any) {
    return {
        id_pedido: row.id_pedido,
        nome_cliente: row.nome_cliente,
        endereco_entrega: row.endereco_entrega,
        taxa_entrega: row.taxa_entrega,
        preco_total: row.preco_total,
        forma_pagamento: row.forma_pagamento,
        status_pedido: row.status_pedido,
        data_pedido: row.data_pedido,
        printed: row.printed,
        itens: [],
        alteracao: row.alteracao,
        delivery: row.delivery,
        telefone_cliente: row.telefone_cliente
    }
}

function setItem(row: any) {
    return {
        id_item: row.id_item,
        produto: row.produto,
        sabor: row.sabor,
        quantidade: row.quantidade,
        observacao: row.observacao,
        preco: row.preco,
    }
}

export function checkIfNotFound(results: { affectedRows: number }) {
    if (results.affectedRows === 0) throw new Error('Order not found or already deleted.');
}

export function ensureResultExists(results: any[]) {
    if (!results.length) throw new Error('Objeto não encontrado.');
}

export function orderValues(order: IOrder): any[] {
    return [
        order.nome_cliente,
        order.endereco_entrega,
        order.taxa_entrega,
        order.preco_total,
        order.forma_pagamento,
        order.status_pedido || "aberto",
        order.alteracao,
        order.delivery ?? 1,
        order.telefone_cliente
    ];
}

// export enum foodyStatus {
//     OPEN = 'open',
//     ACCEPTED = 'accepted',
//     DISPATCHED = 'dispatched',
//     ONGOING = 'onGoing',
//     DELIVERED = 'delivered',
//     PENDING = 'pending',
//     CANCELED = 'canceled',
// }

// let pollingEmExecucao = false;

// async function sincronizarStatusPedidos() {
//     if (pollingEmExecucao) return;

//     pollingEmExecucao = true;

//     try {
//         const pedidos = await buscarPedidosAbertos();

//         if (pedidos.length === 0) {
//             return;
//         }

//         for (const pedido of pedidos) {
//             const { id_pedido, uid_foody, status_pedido } = pedido;

//             const novoStatus = await consultarStatusFoody(uid_foody);
//             if (novoStatus && novoStatus !== status_pedido) {
//                 await atualizarStatusPedido(id_pedido, novoStatus);

//                 const [rows] = await db.query(
//                     "SELECT * FROM pedido WHERE id_pedido = ?",
//                     [id_pedido]
//                 );

//                 global.io.emit("pedidoAtualizado", rows[0]);
//             }
//         }
//     } catch (error) {
//         console.error("⚠️ Erro ao sincronizar status:", error.message);
//     } finally {
//         pollingEmExecucao = false;
//     }
// }

// async function buscarPedidosAbertos() {
//     const sql = "SELECT id_pedido, uid_foody, status_pedido FROM pedido WHERE status_pedido IN ('Despachado', 'Aceito', 'Dispatched', 'aberto', 'Andamento') AND uid_foody IS NOT NULL"
//     const [rows] = await db.query(sql);
//     return rows;
// }

// async function consultarStatusFoody(uid_foody) {
//     try {
//         const response = await axios.get(
//             `https://app.foodydelivery.com/rest/1.2/orders/${uid_foody}`,
//             {
//                 headers: {
//                     Authorization:
//                         process.env.FOODY_API_TOKEN || "edab289cff47488bb78c9e2897420ffe",
//                     "Content-Type": "application/json;charset=UTF-8",
//                 },
//             }
//         );
//         const status: string = response.data.status;
//         const mappedStatus = foodyStatus[status as keyof typeof foodyStatus] ? foodyStatus[status as keyof typeof foodyStatus] : status;
//         return mappedStatus;
//     } catch (error) {
//         console.error(`❌ Erro ao consultar pedido ${uid_foody}:`, error.response?.data || error.message);
//         return null;
//     }
// }

// async function atualizarStatusPedido(id_pedido, novoStatus) {
//     console.log(`🔄 Atualizando status do pedido ${id_pedido} para ${novoStatus}...`);
//     try {
//         const [rows] = await db.query('UPDATE pedido SET status_pedido = ? WHERE id_pedido = ?', [novoStatus, id_pedido]);
//         console.log(`✅ Status do pedido ${id_pedido} atualizado para ${novoStatus}!`);
//         return rows;
//     } catch (error) {
//         console.error(`❌ Erro ao atualizar status do pedido ${id_pedido}:`, error.message);
//         throw error;
//     }
// }

// function formatAddress(address: string | null) {
//     if (!address || typeof address !== "string") return "";
//     return address
//         .trim()
//         .replace(/^R\.\s*/i, "") // remove "R." do início
//         .replace(/\s*-\s*/g, ", ") // substitui traço por vírgula e espaço
//         .replace(/,([^ ])/g, ", $1") // força espaço após vírgulas
//         .replace(/\s{2,}/g, " ") // remove espaços duplos
//         .replace(/,+/g, ",") // evita vírgulas duplicadas
//         .trim();
// }

// async function sendToFoody(order: IOrder, order_id: number, lat: string | null, lng: string | null) {
//     const payload = {
//         id: String(order_id),
//         status: "open",
//         notes: order.observacao || "",
//         courierFee: order.taxa_entrega || 0,
//         orderTotal: order.preco_total || 0,
//         deliveryPoint: {
//             address: formatAddress(order.endereco_entrega) || "",
//             street: "", // gpt irá extrair
//             houseNumber: "", // gpt irá extrair
//             coordinates: {
//                 lat: lat || "",
//                 lng: lng || "",
//             },
//             city: "Barueri",
//             region: "SP",
//             country: "BR",
//         },
//     };

//     try {
//         const res = await axios.post("https://app.foodydelivery.com/rest/1.2/orders", payload,
//             {
//                 headers: {
//                     "Content-Type": "application/json;charset=UTF-8",
//                     Authorization: "edab289cff47488bb78c9e2897420ffe",
//                 },
//             }
//         );

//         console.log(
//             `✅ Pedido #${order_id} enviado para Foody. Status: ${res.status}`
//         );

//         const uid_foody = res.data.uid;

//         const sqlUpdateUid = `UPDATE pedido SET uid_foody = ? WHERE id_pedido = ?`;
//         db.query(sqlUpdateUid, [uid_foody, order_id], (err) => {
//             if (err) {
//                 console.error(
//                     `❌ Erro ao atualizar uid_foody do pedido #${order_id}:`,
//                     err
//                 );
//                 return;
//             }
//             console.log(
//                 `✅ uid_foody ${uid_foody} salvo para o pedido #${order_id}`
//             );
//         });
//     } catch (error) {
//         console.error(
//             `❌ Erro ao enviar pedido #${order_id} para Foody:`,
//             error?.response?.data || error.message
//         );
//     }
// }

// export async function getFoodyOrder(uid: string) {
//     const response = await axios.get(
//         `https://app.foodydelivery.com/rest/1.2/orders/${uid}`,
//         {
//             headers: {
//                 "Content-Type": "application/json;charset=UTF-8",
//                 Authorization: "edab289cff47488bb78c9e2897420ffe",
//             },
//         }
//     );
//     return response;
// }

// export async function structureResponse(response: any) {
//     const order = response.data;
//     const structuredOrder = {
//         uid: order.uid,
//         id: order.id,
//         status: order.status,
//         deliveryFee: order.deliveryFee,
//         paymentMethod: order.paymentMethod,
//         notes: order.notes,
//         courierFee: order.courierFee,
//         orderTotal: order.orderTotal,
//         orderDetails: order.orderDetails,
//         orderTrackerUrl: order.orderTrackerUrl,
//         despatchMode: order.despatchMode,
//         deliveryPoint: {
//             address: order.deliveryPoint?.address,
//             street: order.deliveryPoint?.street,
//             houseNumber: order.deliveryPoint?.houseNumber,
//             postalCode: order.deliveryPoint?.postalCode,
//             coordinates: {
//                 lat: order.deliveryPoint?.coordinates?.lat,
//                 lng: order.deliveryPoint?.coordinates?.lng,
//             },
//             city: order.deliveryPoint?.city,
//             region: order.deliveryPoint?.region,
//             country: order.deliveryPoint?.country,
//             complement: order.deliveryPoint?.complement,
//         },
//         collectionPoint: {
//             name: order.collectionPoint?.name,
//             address: order.collectionPoint?.address,
//             postalCode: order.collectionPoint?.postalCode,
//             coordinates: {
//                 lat: order.collectionPoint?.coordinates?.lat,
//                 lng: order.collectionPoint?.coordinates?.lng,
//             },
//             city: order.collectionPoint?.city,
//             region: order.collectionPoint?.region,
//             country: order.collectionPoint?.country,
//         },
//         customer: {
//             customerPhone: order.customer?.customerPhone,
//             customerName: order.customer?.customerName,
//             customerEmail: order.customer?.customerEmail,
//         },
//         courier: {
//             courierPhone: order.courier?.courierPhone,
//             courierName: order.courier?.courierName,
//             courierType: order.courier?.courierType,
//         },
//         date: order.date,
//         readyDate: order.readyDate,
//         despatchDate: order.despatchDate,
//         collectedDate: order.collectedDate,
//         deliveryDate: order.deliveryDate,
//         creationDate: order.creationDate,
//         updateDate: order.updateDate,
//     }
//     return structuredOrder;
// }