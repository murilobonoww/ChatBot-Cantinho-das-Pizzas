import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../Style/Alterar-pedidos.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


export default function AlterarPedidos() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [pedido, setPedido] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");

    useEffect(() => {

        fetch(`http://localhost:3000/pedido/${id}`)
            .then(res => res.json())
            .then(data => {
                setPedido(data);
                setCarregando(false);
            })
            .catch(err => {
                console.error("Erro ao carregar pedido:", err);
                setErro("Erro ao carregar pedido.");
                setCarregando(false);
            });
    }, [id]);

    const handleChange = (campo, valor) => {
        setPedido(prev => ({ ...prev, [campo]: valor }));
    };

    const salvarAlteracoes = () => {
        const pedidoAtualizado = {
            nome_cliente: pedido.nome_cliente,
            endereco_entrega: pedido.endereco_entrega,
            forma_pagamento: pedido.forma_pagamento,
            status_pedido: pedido.status_pedido,
            taxa_entrega: parseFloat(pedido.taxa_entrega),
            preco_total: parseFloat(pedido.preco_total)
        };

        console.log("Enviando para o backend (corrigido):", pedidoAtualizado);
        fetch(`http://localhost:3000/pedido/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pedido)
        })

            .then(res => {
                if (!res.ok) throw new Error("Erro ao salvar alterações");
                navigate("/pedidos", { state: { toastMessage: "Pedido atualizado com sucesso!" } });
            })
            .catch(err => {
                console.error(err);
                setErro("Erro ao salvar alterações.");
            });
    };

    if (carregando) return <div className="alterar-pedidos-container">Carregando...</div>;
    if (erro) return <div className="alterar-pedidos-container">{erro}</div>;
    if (!pedido) return null;

    return (
        <>
            <ToastContainer />
            <div className="alterar-pedidos-container">
                <h1>Alterar Pedido {pedido.id_pedido}</h1>

                <label>
                    Nome do Cliente:
                    <input
                        type="text"
                        value={pedido.nome_cliente}
                        onChange={e => handleChange("nome_cliente", e.target.value)}
                    />
                </label>

                <label>
                    Endereço de Entrega:
                    <input
                        type="text"
                        value={pedido.endereco_entrega}
                        onChange={e => handleChange("endereco_entrega", e.target.value)}
                    />
                </label>

                <label>
                    Forma de Pagamento:
                    <input
                        type="text"
                        value={pedido.forma_pagamento}
                        onChange={e => handleChange("forma_pagamento", e.target.value)}
                    />
                </label>

                <label>
                    Status:
                    <select
                        value={pedido.status_pedido}
                        onChange={e => handleChange("status_pedido", e.target.value)}
                    >
                        <option value="pendente">Pendente</option>
                        <option value="andamento">Andamento</option>
                        <option value="oncluído">Concluído</option>
                    </select>
                </label>

                <label>
                    Taxa de Entrega:
                    <input
                        type="number"
                        value={pedido.taxa_entrega}
                        onChange={e => handleChange("taxa_entrega", e.target.value)}
                    />
                </label>

                <label>
                    Total:
                    <input
                        type="number"
                        value={pedido.preco_total}
                        onChange={e => handleChange("preco_total", e.target.value)}
                    />
                </label>

                <button className="btn-salvar" onClick={salvarAlteracoes}>
                    Salvar Alterações
                </button>
            </div>
        </>
    );
}
