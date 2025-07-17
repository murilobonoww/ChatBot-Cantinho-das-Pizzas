import React, { useEffect, useState } from "react";
import "../Style/Pedidos.css";
import expandir_img from "../assets/expandir_.png";
import recolher_img from "../assets/recolher.png";
import lixo_img from "../assets/lixo.png";
import voltar from "../assets/voltar.png";
import { toast } from "react-hot-toast";
import { Toaster } from "react-hot-toast"; // precisa desse também
// dentro do JSX:
<Toaster position="top-right" />

import { Link, useLocation } from "react-router-dom";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const Pedidos = () => {
  const [pedidos, setPedidos] = useState([]);
  const [abertos, setAbertos] = useState({});
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [itemFiltro, setItemFiltro] = useState("");
  const [itensSelecionados, setItensSelecionados] = useState([]);
  

  useEffect(() => {
    fetch("http://localhost:3000/pedido/getAll")
      .then(res => res.json())
      .then(data => {
        const pedidosOrdenados = data.sort((a, b) => b.id_pedido - a.id_pedido);
        setPedidos(pedidosOrdenados);
        buscarPedidosFiltrados();
      })
      .catch(err => console.error("Erro ao buscar pedidos:", err));
  }, []);

  const togglePedido = (id) => {
    setAbertos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    buscarPedidosFiltrados();
  }, [dataInicio, dataFim, nomeCliente]); // sem itensSelecionados

  useEffect(() => {
    // Isso força o React a "refiltrar" os pedidos com base nos itens selecionados
    setPedidos((prevPedidos) => [...prevPedidos]);
  }, [itensSelecionados]);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.toastMessage) {
      toast.success(location.state.toastMessage);
      // Limpa o estado para evitar retoast em outras navegações
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);


  const alternarStatus = (id) => {
    const estados = ["pendente", "andamento", "concluído"];
    const pedido = pedidos.find(p => p.id_pedido === id);
    const atual = pedido.status_pedido;
    const proximo = estados[(estados.indexOf(atual) + 1) % estados.length];

    fetch(`http://localhost:3000/pedido/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ novoStatus: proximo }),
    })
      .then(res => {
        if (!res.ok) throw new Error("Erro ao atualizar status");
        setPedidos(prev =>
          prev.map(p =>
            p.id_pedido === id ? { ...p, status_pedido: proximo } : p
          )
        );
      })
      .catch(err => console.error("Erro ao alterar status:", err));
  };

  const buscarPedidosFiltrados = () => {
    const params = new URLSearchParams();

    if (dataInicio) params.append("inicio", dataInicio);
    if (dataFim) params.append("fim", dataFim);
    if (nomeCliente) params.append("cliente", nomeCliente);

    fetch(`http://localhost:3000/pedido/getAll?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        const pedidosOrdenados = data.sort((a, b) => b.id_pedido - a.id_pedido);
        setPedidos(pedidosOrdenados);
      })
      .catch(err => console.error("Erro ao buscar pedidos:", err));
  };

  const handleDeletePedido = (id) => {
    MySwal.fire({
      title: '⚠️ \n Tem certeza?',
      text: "Você não poderá reverter isso",
      showCancelButton: true,
      confirmButtonColor: '#fe4d4d',
      cancelButtonColor: '#454545',
      confirmButtonText: 'Sim, deletar!',
      cancelButtonText: 'Cancelar',
      customClass: {
        confirmButton: 'swal-confirm-button',
        cancelButton: 'swal-cancel-button',
        title: 'swal-custom-title',
        htmlContainer: 'swal-custom-text'
      },
    }).then((result) => {
      if (result.isConfirmed) {
        fetch(`http://localhost:3000/pedido/${id}`, {
          method: "DELETE",
        })
          .then(res => {
            if (!res.ok) throw new Error("Erro ao deletar pedido");
            setPedidos(prev => prev.filter(p => p.id_pedido !== id));
            toast.success("Pedido deletado com sucesso!");
          })
          .catch(err => {
            console.error("Erro ao deletar pedido:", err);
            toast.error("Erro ao deletar pedido.");
          });
      }
    });
  };


  const formatarDataHora = (dataString) => {
    const data = new Date(dataString);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  };

  const adicionarItemFiltro = () => {
    const item = itemFiltro.trim().toLowerCase();
    if (item && !itensSelecionados.includes(item)) {
      setItensSelecionados(prev => [...prev, item]);
    }
    setItemFiltro("");
  };

  const removerItemFiltro = (item) => {
    setItensSelecionados(prev => prev.filter(i => i !== item));
  };

  return (
    <div className="page-pedidos">
      <Toaster position="top-right" />
      <Link to="/" className="btn-fechar">
        <img id="voltar_icone" src={voltar} alt="Pedidos" />
      </Link>

      <div className="pedidos">
        <h1>Histórico de pedidos</h1>


        <h2>Filtros</h2>

        <div className="filtro-datas">
          <label>
            <div className="lbl_filtro">Início:</div>
            <input
              className="inputs_filtro"
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
            />
          </label>

          <label>
            <div className="lbl_filtro">Fim:</div>
            <input
              className="inputs_filtro"
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
            />
          </label>

          <label>
            <div className="lbl_filtro">Nome do Cliente:</div>
            <input
              className="inputs_filtro"
              type="text"
              value={nomeCliente}
              onChange={e => setNomeCliente(e.target.value)}
              placeholder="Digite o nome do cliente"
            />
          </label>

          <div className="filtro-itens">
            <label className="lbl_filtro">Filtrar por item:</label>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                className="inputs_filtro"
                id="itemFiltro"
                type="text"
                value={itemFiltro}
                onChange={e => setItemFiltro(e.target.value)}
                onKeyDown={e => e.key === "Enter" && adicionarItemFiltro()}
                placeholder="Digite um item e pressione Enter"
              />
              <button id="adc_item" onClick={adicionarItemFiltro}>Adicionar</button>
            </div>

            {itensSelecionados.length > 0 && (
              <div className="tags-selecionadas">
                {itensSelecionados.map((item, index) => (
                  <span key={index} className="tag-item">
                    {item} <button onClick={() => removerItemFiltro(item)}>x</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>



        {pedidos
          .filter((pedido) => {
            // Se não houver filtros de item, exibe todos
            if (itensSelecionados.length === 0) return true;

            // Verifica se algum item do pedido bate com os filtros
            return pedido.itens.some(item =>
              itensSelecionados.some(filtro =>
                (item.sabor && item.sabor.toLowerCase().includes(filtro)) ||
                (item.produto && item.produto.toLowerCase().includes(filtro))
              )
            );
          })
          .map((pedido) => (
            <div key={pedido.id_pedido} className={`pedido-card ${abertos[pedido.id_pedido] ? "aberto" : "fechado"}`}>
              <div className="pedido-header">
                <div className="pedido_info">
                  <h2 onClick={() => togglePedido(pedido.id_pedido)}>
                    Pedido #{pedido.id_pedido} {abertos[pedido.id_pedido] ? <img className="e_and_r_icons" src={recolher_img} /> : <img className="e_and_r_icons" src={expandir_img} />}
                  </h2>
                </div>

                {/* Botão de Deletar */}
                <button
                  className="btn_deletar"
                  onClick={() => handleDeletePedido(pedido.id_pedido)}
                  title="Excluir pedido"
                >
                  <img id="lixo_img" src={lixo_img} alt="Deletar Pedido" />
                </button>

                <Link to={`/alterar-pedidos/${pedido.id_pedido}`}>
                  <button className="btn_alterar">Alterar</button>
                </Link>

                {pedido.status_pedido && (
                  <button
                    className={`status-botao ${pedido.status_pedido.replace(" ", "-")}`}
                    onClick={() => alternarStatus(pedido.id_pedido)}
                  >
                    {pedido.status_pedido}
                  </button>
                )}
              </div>



              {abertos[pedido.id_pedido] && (
                <div className="pedido-detalhes">
                  <p><strong>Data do Pedido:</strong> {formatarDataHora(pedido.data_pedido)}</p>
                  <p><strong>Cliente:</strong> {pedido.nome_cliente}</p>
                  <p><strong>Endereço:</strong> {pedido.endereco_entrega}</p>
                  <p><strong>Pagamento:</strong> {pedido.forma_pagamento}</p>
                  <p><strong>Status:</strong> {pedido.status_pedido}</p>
                  <p><strong>Taxa de Entrega:</strong> R$ {parseFloat(pedido.taxa_entrega).toFixed(2)}</p>
                  <p><strong>Total:</strong> R$ {parseFloat(pedido.preco_total).toFixed(2)}</p>

                  <div className="pedido-itens">
                    <h3>Itens:</h3>
                    {pedido.itens.map((item, index) => (
                      <div key={index} className="pedido-item">
                        <p><strong>Produto:</strong> {item.produto}</p>
                        <p><strong>Sabor:</strong> {item.sabor}</p>
                        <p><strong>Quantidade:</strong> {item.quantidade}</p>
                        {item.observacao && <p className="pedido-observacao"><strong>Obs.:</strong> {item.observacao}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};

export default Pedidos;
