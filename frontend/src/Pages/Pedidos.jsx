import React, { useEffect, useState, useRef } from "react";
import "../Style/Pedidos.css";
import expandir_img from "../assets/folder.webp";
import recolher_img from "../assets/open-folder.webp";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css'; // Importe o CSS
import none_result from "../assets/nenhum-resultado-encontrado.png";
import { Link, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { jsPDF } from "jspdf";
import impressora_icon from "../assets/printer_.png"

const MySwal = withReactContent(Swal);

const Pedidos = () => {

  const [pedidos, setPedidos] = useState([]);
  const [abertos, setAbertos] = useState({});
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [itemFiltro, setItemFiltro] = useState("");
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const pedidosAnteriores = useRef([]);
  const carregamentoInicial = useRef(true);
  const [modoFiltro, setModoFiltro] = useState("OU");
  const [novosIDs, setNovosIDs] = useState([]);

  const playSound = () => {
    const audio = new Audio(bell_sound);
    audio.volume = 0.7;
    audio.play();
  };

  useEffect(() => {
    buscarPedidosFiltrados();
  }, [dataInicio, dataFim, nomeCliente]);

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
    setPedidos((prevPedidos) => [...prevPedidos]);
  }, [itensSelecionados]);

  useEffect(() => {
    const interval = setInterval(() => {
      const filtrosAtivos = dataInicio || dataFim || nomeCliente;
      if (filtrosAtivos) {
        buscarPedidosFiltrados();
      } else {
        fetchPedidos();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [dataInicio, dataFim, nomeCliente]);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.toastMessage) {
      toast.success(location.state.toastMessage, { autoClose: 4000 });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchPedidos = () => {
    fetch(`http://localhost:3000/pedido/getAll`)
      .then(res => res.json())
      .then(data => {
        const pedidosOrdenados = data.sort((a, b) => b.id_pedido - a.id_pedido);
        const idsAnteriores = pedidosAnteriores.current.map(p => p.id_pedido);
        const novosPedidos = pedidosOrdenados.filter(p => !idsAnteriores.includes(p.id_pedido));

        if (carregamentoInicial.current) {
          carregamentoInicial.current = false;
        } else if (novosPedidos.length > 0) {
          const idsNovos = novosPedidos.map(p => p.id_pedido);
          setNovosIDs(idsNovos);
          playSound();

          setTimeout(() => {
            setNovosIDs([]);
          }, 4000);
        }

        pedidosAnteriores.current = pedidosOrdenados;
        setPedidos(pedidosOrdenados);
      })
      .catch(err => console.error("Erro ao buscar pedidos:", err));
  };

  const alternarStatus = (id) => {
    const estados = ["aberto", "andamento", "entregue"];
    const pedido = pedidos.find((p) => p.id_pedido === id);
    const atual = pedido.status_pedido;
    const proximo = estados[(estados.indexOf(atual) + 1) % estados.length];

    fetch(`http://localhost:3000/pedido/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novoStatus: proximo }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao atualizar status");
        setPedidos((prev) =>
          prev.map((p) =>
            p.id_pedido === id ? { ...p, status_pedido: proximo } : p
          )
        );
      })
      .catch((err) => {
        console.error("Erro ao alterar status:", err);
        toast.error("Erro ao alterar status do pedido.", { autoClose: 4000 });
      });
  };

  const buscarPedidosFiltrados = () => {
    const params = new URLSearchParams();
    if (dataInicio) params.append("inicio", dataInicio);
    if (dataFim) params.append("fim", dataFim);
    if (nomeCliente) params.append("cliente", nomeCliente);

    fetch(`http://localhost:3000/pedido/getAll?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const pedidosOrdenados = data.sort((a, b) => b.id_pedido - a.id_pedido);
        setPedidos(pedidosOrdenados);
      })
      .catch((err) => {
        console.error("Erro ao buscar pedidos:", err);
        toast.error("Erro ao buscar pedidos.", { autoClose: 4000 });
      });
  };

  useEffect(() => {
    if (dataInicio || dataFim || nomeCliente) {
      buscarPedidosFiltrados();
    }
  }, [dataInicio, dataFim, nomeCliente]);

  const handleDeletePedido = (id) => {
    MySwal.fire({
      title: "⚠️ \n Tem certeza?",
      text: "Você não poderá reverter isso",
      showCancelButton: true,
      confirmButtonColor: "#fe4d4d",
      cancelButtonColor: "#454545",
      confirmButtonText: "Sim, deletar!",
      cancelButtonText: "Cancelar",
      customClass: {
        confirmButton: "swal-confirm-button",
        cancelButton: "swal-cancel-button",
        title: "swal-custom-title",
        htmlContainer: "swal-custom-text",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        fetch(`http://localhost:3000/pedido/${id}`, {
          method: "DELETE",
        })
          .then((res) => {
            if (!res.ok) throw new Error("Erro ao deletar pedido");
            setPedidos((prev) => prev.filter((p) => p.id_pedido !== id));
            toast.success("Pedido deletado com sucesso!", { autoClose: 4000 });
          })
          .catch((err) => {
            console.error("Erro ao deletar pedido:", err);
            toast.error("Erro ao deletar pedido.", { autoClose: 4000 });
          });
      }
    });
  };

  const formatarDataHora = (dataString) => {
    const data = new Date(dataString);
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, "0");
    const minuto = String(data.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  };

  const pedidoPassaNoFiltro = (pedido) => {
    if (itensSelecionados.length === 0) return true;

    if (modoFiltro === "E") {
      return itensSelecionados.every((filtro) =>
        pedido.itens.some(
          (item) =>
            (item.sabor && item.sabor.toLowerCase().includes(filtro)) ||
            (item.produto && item.produto.toLowerCase().includes(filtro))
        )
      );
    } else {
      return pedido.itens.some((item) =>
        itensSelecionados.some(
          (filtro) =>
            (item.sabor && item.sabor.toLowerCase().includes(filtro)) ||
            (item.produto && item.produto.toLowerCase().includes(filtro))
        )
      );
    }
  };

  const adicionarItemFiltro = () => {
    const item = itemFiltro.trim().toLowerCase();
    if (item && !itensSelecionados.includes(item)) {
      setItensSelecionados((prev) => [...prev, item]);
    }
    setItemFiltro("");
  };

  const removerItemFiltro = (item) => {
    setItensSelecionados((prev) => prev.filter((i) => i !== item));
  };

  const gerarPDF = (orderID) => {
    const order = pedidos.find(o => o.id_pedido === orderID)
    const doc = new jsPDF()
    const itens_arr = order.itens
    let y = 50

    itens_arr.map(i => {
      doc.text(`\nProduto:${i.produto}\nSabor:${i.sabor}\nQuantidade:${i.quantidade}\nObs.:${i.observacao}`, 10, y)
      y += 10
    })
    doc.text(`Pedido: ${orderID}\nCliente: ${order.nome_cliente}\nEndereço de entrega: ${order.endereco_entrega}\nForma de pagamento: ${order.forma_pagamento}\nTaxa de entrega: R$${(order.taxa_entrega).replace(".", ",")}\nTotal: R$${(order.preco_total).replace(".", ",")}`, 10, 10)
    doc.save(`Pedido_${orderID}.pdf`)
  }

  return (
    <div className="page-pedidos">
      <div className="pedidos">
        <div className="topo-fixo-pedidos">
          <div className="topo-fixo-restante">
            <h1>Pedidos</h1>
            <h2>Filtros</h2>
            <div className="filtro-datas">
              <label>
                <div className="lbl_filtro">Início:</div>
                <input
                  className="inputs_filtro"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </label>
              <label>
                <div className="lbl_filtro">Fim:</div>
                <input
                  className="inputs_filtro"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </label>
              <label>
                <div className="lbl_filtro">Nome do Cliente:</div>
                <input
                  className="inputs_filtro"
                  type="text"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
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
                    onChange={(e) => setItemFiltro(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && adicionarItemFiltro()}
                    placeholder="Digite e pressione enter"
                  />
                </div>
                {itensSelecionados.length > 0 && (
                  <div className="tags-selecionadas">
                    {itensSelecionados.map((item, index) => (
                      <span key={index} className="tag-item">
                        {item}{" "}
                        <button onClick={() => removerItemFiltro(item)}>x</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {itensSelecionados != 0 && (
                <button
                  id="btn_pedidos_modo"
                  onClick={() => setModoFiltro(modoFiltro === "OU" ? "E" : "OU")}
                >
                  Modo: {modoFiltro === "OU" ? "1 OU 2" : "1 E 2"}
                </button>
              )}

            </div>

          </div>
        </div>
        <div className="lista-pedidos">
          <div className="counter_div_orders_list">
            <h2 style={{ marginLeft: "110px", marginBottom: "25px", fontSize: "30px", color: "black" }}>
              Nº de pedidos: <strong>{pedidos.filter(pedidoPassaNoFiltro).length}</strong>
            </h2>
          </div>
          {pedidos.filter(pedidoPassaNoFiltro).length === 0 ? (
            <div style={{ textAlign: "center", marginTop: "40px" }}>
              <img
                src={none_result}
                alt="Nenhum resultado encontrado"
                style={{ maxWidth: "400px", opacity: 0.6 }}
              />
              <p
                style={{
                  fontFamily: "MinhaFonte3",
                  fontSize: "18px",
                  marginTop: "16px",
                  color: "#777",
                }}
              >
                Nenhum pedido encontrado.
              </p>
            </div>
          ) : (
            pedidos
              .filter(pedidoPassaNoFiltro)
              .map((pedido) => (
                <div
                  key={pedido.id_pedido}
                  className={`pedido-card ${abertos[pedido.id_pedido] ? "aberto" : "fechado"
                    } ${novosIDs.includes(pedido.id_pedido) ? "pedido-novo" : ""}`}
                >
                  <div className="pedido-header" key={pedido.id_pedido}>
                    <div className="pedido_info">
                      <h2 onClick={() => togglePedido(pedido.id_pedido)}>
                        Pedido {pedido.id_pedido}{" "}
                        {abertos[pedido.id_pedido] ? (
                          <img className="e_and_r_icons" src={recolher_img} alt="Recolher" />
                        ) : (
                          <img className="e_and_r_icons" src={expandir_img} alt="Expandir" />
                        )}
                      </h2>
                    </div>

                    <button className="printer_btn">
                      <img src={impressora_icon} id="printer_icon" onClick={() => gerarPDF(pedido.id_pedido)} />
                    </button>

                    <button
                      className="delete-button-pedido"
                      onClick={() => handleDeletePedido(pedido.id_pedido)}
                    >
                      <svg
                        className="trash-svg"
                        viewBox="0 -10 64 74"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <g id="trash-can">
                          <rect
                            x="16"
                            y="24"
                            width="32"
                            height="30"
                            rx="3"
                            ry="3"
                            fill="#000000"
                          ></rect>
                          <g style={{ transformOrigin: '12px 18px' }} id="lid-group">
                            <rect
                              x="12"
                              y="12"
                              width="40"
                              height="6"
                              rx="2"
                              ry="2"
                              fill="#000000"
                            ></rect>
                            <rect
                              x="26"
                              y="8"
                              width="12"
                              height="4"
                              rx="2"
                              ry="2"
                              fill="#000000"
                            ></rect>
                          </g>
                        </g>
                      </svg>
                    </button>

                    <Link to={`/alterar-pedidos/${pedido.id_pedido}`}>
                      <button className="btn_alterar">Alterar</button>
                    </Link>
                    {pedido.status_pedido && (
                      <button
                        className={`status-botao ${pedido.status_pedido.replace(" ", "-")}`}
                      // onClick={() => alternarStatus(pedido.id_pedido)}
                      >
                        {pedido.status_pedido}
                      </button>
                    )}
                  </div>
                  {abertos[pedido.id_pedido] && (
                    <div className="pedido-detalhes">
                      <p>
                        <strong>Data do Pedido:</strong> {formatarDataHora(pedido.data_pedido)}
                      </p>
                      <p>
                        <strong>Cliente:</strong> {pedido.nome_cliente}
                      </p>
                      <p>
                        <strong>Endereço:</strong> {pedido.endereco_entrega}
                      </p>
                      <p>
                        <strong>Pagamento:</strong> {pedido.forma_pagamento}
                      </p>
                      <p>
                        <strong>Status:</strong> {pedido.status_pedido}
                      </p>
                      <p>
                        <strong>Taxa de Entrega:</strong> R${" "}
                        {parseFloat(pedido.taxa_entrega).toFixed(2)}
                      </p>
                      <p>
                        <strong>Total:</strong> R$ {parseFloat(pedido.preco_total).toFixed(2)}
                      </p>
                      <div className="pedido-itens">
                        <h3>Itens:</h3>
                        {pedido.itens.map((item, index) => (
                          <div key={index} className="pedido-item">
                            <p>
                              <strong>Produto:</strong> {item.produto}
                            </p>
                            <p>
                              <strong>Sabor:</strong> {item.sabor}
                            </p>
                            <p>
                              <strong>Quantidade:</strong> {item.quantidade}
                            </p>
                            {item.observacao && (
                              <p className="pedido-observacao">
                                <strong>Obs.:</strong> {item.observacao}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Pedidos;