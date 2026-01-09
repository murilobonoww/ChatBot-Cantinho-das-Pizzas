//libs
const axios = require("axios");
const OpenAI = require("openai");

//internos
const db = require("../db");

//ENV vars
const { MAPS_API_KEY } = process.env

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const sql = {
    insertPedido: "INSERT INTO pedido (nome_cliente, endereco_entrega, taxa_entrega, preco_total, forma_pagamento, status_pedido, alteracao) VALUES (?, ?, ?, ?, ?, ?, ?)",
    insertItemPedido: "INSERT INTO item_pedido (pedido_id_fk, produto, sabor, quantidade, observacao, preco) VALUES (?, ?, ?, ?, ?, ?)",
    GET_ALL: "SELECT p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega, p.preco_total, p.forma_pagamento, p.status_pedido, p.data_pedido, p.printed, p.alteracao, i.id AS id_item, i.produto, i.sabor, i.quantidade, i.observacao, i.preco FROM pedido p LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk",
    GET_ORDER: `SELECT p.id_pedido, p.nome_cliente, p.endereco_entrega, p.taxa_entrega,  p.preco_total, p.forma_pagamento, p.status_pedido, p.data_pedido, p.alteracao, i.id, i.produto, i.sabor, i.quantidade, i.observacao FROM pedido p LEFT JOIN item_pedido i ON p.id_pedido = i.pedido_id_fk WHERE p.id_pedido = ? `,
    GET_ORDER_STATUS: `SELECT status_pedido FROM pedido where id_pedido = ?`,
    GET_ORDERS_WITH_OPENED_STATUS: `SELECT COUNT(*) AS total FROM pedido WHERE status_pedido = 'aberto'`,
    SET_PRINTED: `UPDATE pedido SET printed = true WHERE id_pedido = ?`,
    UPDATE_ORDER: `UPDATE pedido SET nome_cliente = ?, endereco_entrega = ?, forma_pagamento = ?, status_pedido = ?, taxa_entrega = ?, preco_total = ? WHERE id_pedido = ?`,
    UPDATE_ORDER_ITEM: `UPDATE item_pedido SET produto = ?, sabor = ?, quantidade = ?, observacao = ? WHERE id = ?`,
    UPDATE_ORDER_STATUS: `UPDATE pedido SET status_pedido = ? WHERE id_pedido = ?`,
    DELETE_ITENS_OF_ORDER: `DELETE FROM item_pedido WHERE pedido_id_fk = ?`,
    DELETE_ORDER: `DELETE FROM pedido WHERE id_pedido = ?`,
}

function formatarEndereco(endereco) {
    if (!endereco || typeof endereco !== "string") return "";
    return endereco
        .trim()
        .replace(/^R\.\s*/i, "") // remove "R." do início
        .replace(/\s*-\s*/g, ", ") // substitui traço por vírgula e espaço
        .replace(/,([^ ])/g, ", $1") // força espaço após vírgulas
        .replace(/\s{2,}/g, " ") // remove espaços duplos
        .replace(/,+/g, ",") // evita vírgulas duplicadas
        .trim();
}

async function enviarParaFoody(pedido, id_pedido, lat, lng) {
    const enderecoFormatado = formatarEndereco(pedido.endereco_entrega);

    const payload = {
        id: String(id_pedido),
        status: "open",
        notes: pedido.observacao || "",
        courierFee: pedido.taxa_entrega || 0,
        orderTotal: pedido.preco_total || 0,
        deliveryPoint: {
            address: enderecoFormatado || "",
            street: "", // gpt irá extrair
            houseNumber: "", // gpt irá extrair
            coordinates: {
                lat: lat || "",
                lng: lng || "",
            },
            city: "Barueri",
            region: "SP",
            country: "BR",
        },
    };

    console.log(payload);

    try {
        const res = await axios.post("https://app.foodydelivery.com/rest/1.2/orders", payload,
            {
                headers: {
                    "Content-Type": "application/json;charset=UTF-8",
                    Authorization: "edab289cff47488bb78c9e2897420ffe",
                },
            }
        );

        console.log(
            `✅ Pedido #${id_pedido} enviado para Foody. Status: ${res.status}`
        );

        // Extrair o uid da resposta da API
        const uid_foody = res.data.uid;

        // Atualizar a tabela pedido com o uid
        const sqlUpdateUid = `UPDATE pedido SET uid_foody = ? WHERE id_pedido = ?`;
        db.query(sqlUpdateUid, [uid_foody, id_pedido], (err) => {
            if (err) {
                console.error(
                    `❌ Erro ao atualizar uid_foody do pedido #${id_pedido}:`,
                    err
                );
                return;
            }
            console.log(
                `✅ uid_foody ${uid_foody} salvo para o pedido #${id_pedido}`
            );
        });
    } catch (error) {
        console.error(
            `❌ Erro ao enviar pedido #${id_pedido} para Foody:`,
            error?.response?.data || error.message
        );
    }
}

async function calcularDistanciaKm(enderecoDestino) {

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 15000);
    const origem = "R. Copacabana, 111 - Jardim Maria Helena, Barueri - SP, 06445-060";
    const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

    const body = {
        origin: { address: origem },
        destination: { address: enderecoDestino },
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
        console.log("🛰 API Google Maps:", response.status, JSON.stringify(data));

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

//retorna valores do SQL de inserir_pedido_no_db
function valores_pedido(p) {
    return [
        p.nome_cliente,
        p.endereco_entrega,
        p.taxa_entrega,
        p.preco_total,
        p.forma_pagamento,
        p.status_pedido || "aberto",
        p.alteracao
    ];
}
async function inserir_pedido_no_db(pedido) {
    const [resultadoPedido] = await db.execute(sql.insertPedido(), valores_pedido(pedido));
    const pedido_id = resultadoPedido.insertId;

    const itensResolvidos = [];

    for (const item of pedido.itens) {
        const saborItem = await askOpenAI(item.sabor, item.produto);
        item.sabor = saborItem;
        console.log('🔍 RESOLUÇÃO DE ITEM');
        console.log('Produto:', item.produto);
        console.log('Nome enviado:', item.sabor);
        console.log('Nome resolvido:', saborItem);
        console.log('---------------------');
        itensResolvidos.push({ ...item, saborItem });

        if (saborItem === 'NAO_ENCONTRADO') {
            throw new Error(`sabor não encontrado no cardápio: ${item.sabor}`);
        }
    }

    for (const item of itensResolvidos) {
        await db.execute(sql.insertItemPedido(), [
            pedido_id,
            item.produto,
            item.saborItem,
            item.quantidade,
            item.observacao,
            item.preco
        ]);
    }

    console.log(
        `📦 Pedido #${pedido_id} registrado com sucesso. (ainda não enviado pra foody)`
    );
    const { latitude, longitude } = pedido;

    enviarParaFoody(pedido, pedido_id, latitude, longitude); // ← envia para a Foody de forma assíncrona
    return pedido_id
}

async function askOpenAI(nomeItem, categoriaItem) {
    try {
        const menu = (await getAllNames(categoriaItem)).join('\n');
        const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            temperature: 0.3,
            messages: [
                {
                    role: "user", content: `Você deve verificar se o item informado existe no cardápio. Entrada do usuário:
- Nome/sabor informado: "${nomeItem}"
- Categoria: "${categoriaItem}"

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

async function getAllNames(categoria) {
    if (categoria === 'Pizza') {
        const [rows] = await db.query(`SELECT sabor FROM pizzas`)
        return rows.map(row => row.sabor)
    }

    else if (categoria === 'Esfiha') {
        const [rows] = await db.query(`SELECT sabor FROM esfihas`)
        return rows.map(row => row.sabor)
    }

    else if (categoria === 'Bebida') {
        const [rows] = await db.query(`SELECT nome FROM bebidas`)
        return rows.map(row => row.nome)
    }

    else if (categoria === 'Doce') {
        const [rows] = await db.query(`SELECT nome FROM doces`)
        return rows.map(row => row.nome)
    }

    else if (categoria === 'Outros') {
        const [rows] = await db.query(`SELECT nome FROM outros`)
        return rows.map(row => row.nome)
    }
}

function generate_final_message(id_pedido, pedido) {
    const title = `🍕 Pedido *${id_pedido}*`
    let itens = ''

    for (const item of pedido.itens) {
        if (item.produto === 'Pizza') {
            itens += `${item.quantidade} x ${item.produto} de ${item.sabor} - R$${item.preco.toFixed(2).replace(".", ",")} (${item.observacao})\n`
        }
        else if (item.produto === 'Esfiha') {
            itens += `${item.quantidade} x ${item.produto} de ${item.sabor} - R$${item.preco.toFixed(2).replace(".", ",")}\n`
        }
        else {
            itens += `${item.quantidade} x ${item.sabor} - R$${item.preco.toFixed(2).replace(".", ",")}\n`
        }
    }

    const forma_de_pagamento = `• 💳 Forma de pagamento: ${pedido.forma_pagamento}`

    const endereco = `• 📍 Endereço: ${pedido.endereco_entrega}`

    const taxa = `• 🚚 Taxa de entrega: R$${pedido.taxa_entrega.toFixed(2).replace('.', ',')}`

    const preco_total = `• Total: R$${pedido.preco_total.toFixed(2).replace('.', ',')}`

    const aviso = "*O pagamento será feito na entrega.*"

    const agradecimento = "Obrigado pelo seu pedido! Em breve estaremos aí... 🍕🏍️"

    if (pedido.alteracao === 1) {
        const msg_final = `*(Alteração de pedido)*\n${title}\n${itens}${forma_de_pagamento}\n${endereco}\n${taxa}\n${preco_total}\n${aviso}\n${agradecimento}`
        return msg_final
    }
    else {
        const msg_final = `${title}\n${itens}${forma_de_pagamento}\n${endereco}\n${taxa}\n${preco_total}\n${aviso}\n${agradecimento}`
        return msg_final
    }
}

async function validar_distancia(endereco) {
    const distanciaKM = await calcularDistanciaKm(endereco)

    if (distanciaKM > 15) {
        throw new Error('Fora do raio de atendimento.')
    }
    return distanciaKM
}

function multiplicador(distancia) {
    return distancia < 3 ? 3 : 2
}

function format_tax_to_2_decimals(tax) {
    const formattedTax = parseFloat(tax.toFixed(2))
    return formattedTax
}

function calcularTaxaEntrega(distancia) {
    const TAXA_MINIMA = 4.00
    if (distancia === null) return null
    if (distancia < 1) return TAXA_MINIMA

    let taxa = distancia * multiplicador(distancia)
    taxa = format_tax_to_2_decimals(taxa)
    return taxa
}

const calcularPreco = async (pedido) => {
    let preco_total = 0;

    for (const item of pedido.itens) {
        let price = 0;

        switch (item.produto) {
            case 'Pizza': {
                if (item.observacao.includes('25')) {
                    const sabor = await askOpenAI(item.sabor, item.produto)
                    const [rows] = await db.execute(
                        `SELECT preco_25 FROM pizzas WHERE sabor = ?`,
                        [sabor]
                    );
                    if (!rows.length) {
                        throw new Error(`${item.produto} não encontrado`);
                    }

                    price = rows[0].preco_25;
                    item.preco = Number(rows[0].preco_25);
                    break;
                }
                else if (item.observacao.includes('35')) {
                    const sabor = await askOpenAI(item.sabor, item.produto)
                    const [rows] = await db.execute(
                        `SELECT preco_35 FROM pizzas WHERE sabor = ?`,
                        [sabor]
                    );
                    if (!rows.length) {
                        throw new Error(`${item.produto} não encontrado`);
                    }

                    price = rows[0].preco_35;
                    item.preco = Number(rows[0].preco_35);
                    break;
                }
                else {
                    console.error("Tamanho de pizza inválido.")
                    throw new Error('Tamanho de pizza inválido.')
                }
            }

            case 'Esfiha': {
                const sabor = await askOpenAI(item.sabor, item.produto)
                const [rows] = await db.execute(
                    'SELECT preco FROM esfihas WHERE sabor = ?',
                    [sabor]
                );
                if (!rows.length) {
                    throw new Error(`${sabor} não encontrado`);
                }

                price = rows[0].preco;
                item.preco = Number(rows[0].preco);
                break;
            }

            case 'Bebida': {
                const sabor = await askOpenAI(item.sabor, item.produto)
                const [rows] = await db.execute(
                    'SELECT preco FROM bebidas WHERE nome = ?',
                    [sabor]
                );
                if (!rows.length) {
                    throw new Error(`${item.produto} não encontrado`);
                }

                price = rows[0].preco;
                item.preco = Number(rows[0].preco);
                break;
            }

            case 'Doce': {
                const sabor = await askOpenAI(item.sabor, item.produto)
                const [rows] = await db.execute(
                    'SELECT preco FROM doces WHERE nome = ?',
                    [sabor]
                );
                if (!rows.length) {
                    throw new Error(`${item.produto} não encontrado`);
                }

                price = rows[0].preco;
                item.preco = Number(rows[0].preco);
                break;
            }

            case 'Outros': {
                const sabor = await askOpenAI(item.sabor, item.produto)
                const [rows] = await db.execute(
                    'SELECT preco FROM outros WHERE nome = ?',
                    [sabor]
                );
                if (!rows.length) {
                    throw new Error(`${item.produto} não encontrado`);
                }

                price = rows[0].preco;
                item.preco = Number(rows[0].preco);
                break;
            }

            default:
                throw new Error(`Produto inválido: ${item.produto}`);
        }

        preco_total += price * item.quantidade;
    }

    return Number(preco_total.toFixed(2));
};

async function processOrder(pedido) {
    console.log('Iniciando processamento do pedido...')
    const endereco = pedido.endereco_entrega
    console.log('Validando distância para o endereço:', endereco)
    const distancia = await validar_distancia(endereco)
    console.log('Distância validada:', distancia, 'km')
    const taxa = calcularTaxaEntrega(pedido, distancia)
    pedido.taxa_entrega = taxa
    console.log('Taxa de entrega calculada:', taxa)

    const preco_total = await calcularPreco(pedido)
    console.log('Preço total calculado: ', preco_total)
    pedido.preco_total = Number((preco_total + taxa).toFixed(2))
    console.log('Inserção do preço total no JSON realizada')

    const pedido_id = await inserir_pedido_no_db(pedido)
    return pedido_id
}

function applyFilters(filters, query) {

    const { id, inicio, fim, cliente } = filters;

    let conditions = []
    let params = []

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

    if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(" AND ");
    }

    return { query, params }
}

function criarPedido(row) {
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
    }
}

function criarItem(row) {
    return {
        id_item: row.id_item,
        produto: row.produto,
        sabor: row.sabor,
        quantidade: row.quantidade,
        observacao: row.observacao,
        preco: row.preco,
    }
}

function sortOrdersinSQL(sql) {
    return sql + ` ORDER BY p.id_pedido DESC`
}

function structureOrders(results) {
    const OrdersMap = {};

    results.forEach((row) => {
        const id = row.id_pedido;
        if (!OrdersMap[id]) {
            OrdersMap[id] = criarPedido(row)
        }

        if (row.id_item !== null) {
            OrdersMap[id].itens.push(criarItem(row))
        }
    });

    const orders = Object.values(OrdersMap)
    return orders
}

function ensureResultExists(results) {
    if (!results.length) {
        throw new Error('Objeto não encontrado.')
    }
}

function buildOrderFromRow(rows) {

    if (!rows.length) return null

    const { id_pedido, nome_cliente, endereco_entrega, taxa_entrega, preco_total, forma_pagamento, status_pedido, data_pedido, printed, alteracao } = rows[0]

    return {
        id_pedido,
        nome_cliente,
        endereco_entrega,
        taxa_entrega,
        preco_total,
        forma_pagamento,
        status_pedido,
        data_pedido,
        printed,
        alteracao,
        itens: rows.filter(row => row.id_item !== null).map(row => ({
            id_item: row.id_item,
            produto: row.produto,
            sabor: row.sabor,
            quantidade: row.quantidade,
            observacao: row.observacao,
            printed: row.printed
        }))
    }
}

function checkIfNotFound(results) {
    if (results.affectedRows === 0) throw new Error('Order not found or already deleted.')
}

async function getFoodyOrder(uid) {
    const response = await axios.get(
        `https://app.foodydelivery.com/rest/1.2/orders/${uid}`,
        {
            headers: {
                "Content-Type": "application/json;charset=UTF-8",
                Authorization: "edab289cff47488bb78c9e2897420ffe",
            },
        }
    );
    return response
}

async function structureResponse(response) {
    const order = response.data

    const structuredOrder = {
        uid: order.uid,
        id: order.id,
        status: order.status,
        deliveryFee: order.deliveryFee,
        paymentMethod: order.paymentMethod,
        notes: order.notes,
        courierFee: order.courierFee,
        orderTotal: order.orderTotal,
        orderDetails: order.orderDetails,
        orderTrackerUrl: order.orderTrackerUrl,
        despatchMode: order.despatchMode,
        deliveryPoint: {
            address: order.deliveryPoint?.address,
            street: order.deliveryPoint?.street,
            houseNumber: order.deliveryPoint?.houseNumber,
            postalCode: order.deliveryPoint?.postalCode,
            coordinates: {
                lat: order.deliveryPoint?.coordinates?.lat,
                lng: order.deliveryPoint?.coordinates?.lng,
            },
            city: order.deliveryPoint?.city,
            region: order.deliveryPoint?.region,
            country: order.deliveryPoint?.country,
            complement: order.deliveryPoint?.complement,
        },
        collectionPoint: {
            name: order.collectionPoint?.name,
            address: order.collectionPoint?.address,
            postalCode: order.collectionPoint?.postalCode,
            coordinates: {
                lat: order.collectionPoint?.coordinates?.lat,
                lng: order.collectionPoint?.coordinates?.lng,
            },
            city: order.collectionPoint?.city,
            region: order.collectionPoint?.region,
            country: order.collectionPoint?.country,
        },
        customer: {
            customerPhone: order.customer?.customerPhone,
            customerName: order.customer?.customerName,
            customerEmail: order.customer?.customerEmail,
        },
        courier: {
            courierPhone: order.courier?.courierPhone,
            courierName: order.courier?.courierName,
            courierType: order.courier?.courierType,
        },
        date: order.date,
        readyDate: order.readyDate,
        despatchDate: order.despatchDate,
        collectedDate: order.collectedDate,
        deliveryDate: order.deliveryDate,
        creationDate: order.creationDate,
        updateDate: order.updateDate,
    }

    return structuredOrder
}

module.exports = { sql, structureResponse, processOrder, generate_final_message, applyFilters, sortOrdersinSQL, structureOrders, ensureResultExists, buildOrderFromRow, checkIfNotFound, getFoodyOrder }