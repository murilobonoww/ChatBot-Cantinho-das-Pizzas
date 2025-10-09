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
import warning_icon from "../assets/warning.webp"
import bell_sound from "../assets/bell.mp3"
import axios from "axios";

const MySwal = withReactContent(Swal);

const Pedidos = () => {

  const [id_filter, setIdFilter] = useState()
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
  const [id_selectedOrder, setId_selectedOrder] = useState()

  //form change order
  const [newProductName, setNewProductName] = useState("")
  const [newAmountValue, setNewAmountValue] = useState("")
  const [newFlavor, setNewFlavor] = useState("")
  const [newObs, setNewObs] = useState("")
  const [pedido, setPedido] = useState({})
  const [changeOpened, setChangeOpened] = useState(false)
  const [itemsToEdit, setItemsToEdit] = useState([])


  //auth panel to change/delete order
  const [authOpened, setAuthOpened] = useState(false)
  const [authPass, setAuthPass] = useState("")
  const [authOpenedDelete, setAuthOpenedDelete] = useState(false)
  const [deleteOpened, setDeleteOpened] = useState(false)


  const playSound = () => {
    const audio = new Audio(bell_sound);
    audio.volume = 0.7;
    audio.play();
  };

  useEffect(() => {
    buscarPedidosFiltrados();
  }, [id_filter, dataInicio, dataFim, nomeCliente]);

  useEffect(() => {
    fetch("http://localhost:3000/pedido/getAll")
      .then(res => res.json())
      .then(data => {
        console.log(data)
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
      const filtrosAtivos = id_filter || dataInicio || dataFim || nomeCliente;
      if (filtrosAtivos) {
        buscarPedidosFiltrados();
      } else {
        fetchPedidos();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [id_filter, dataInicio, dataFim, nomeCliente]);

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

  const buscarPedidosFiltrados = () => {
    const params = new URLSearchParams();
    if (id_filter) params.append("id", id_filter)
    if (dataInicio) params.append("inicio", dataInicio);
    if (dataFim) params.append("fim", dataFim);
    if (nomeCliente) params.append("cliente", nomeCliente);

    console.log(params)

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
    if (id_filter || dataInicio || dataFim || nomeCliente) {
      buscarPedidosFiltrados();
    }
  }, [id_filter, dataInicio, dataFim, nomeCliente]);

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

      if(i.produto === "pizza" || i.produto === "esfiha"){
        doc.text(`${i.quantidade} x ${i.produto} de ${i.sabor} - ${i.observacao} (R$${i.preco})`, 10, y)
        y += 10
      }
      else if(i.produto === "bebida"){
        doc.text(`${i.quantidade} x ${i.sabor} - ${i.observacao} (R$${i.preco})`, 10, y)
        y += 10
      }
      else{
        doc.text(`\nProduto:${i.produto}\nSabor:${i.sabor}\nQuantidade:${i.quantidade}\nObs.:${i.observacao}`, 10, y)
        y += 10
      }
      
    })
    doc.text(`Pedido: ${orderID}\nCliente: ${order.nome_cliente}\nEndereço de entrega: ${order.endereco_entrega}\nForma de pagamento: ${order.forma_pagamento}\nTaxa de entrega: R$${(order.taxa_entrega).replace(".", ",")}\nTotal: R$${(order.preco_total).replace(".", ",")}`, 10, 10)
    doc.save(`Pedido_${orderID}.pdf`)
  }

  const setAsPrinted = (id) => {
    fetch(`http://localhost:3000/pedido/setPrinted/${id}`, {
      method: "PUT"
    })
  }

  const options_input_time_change_order = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }

  const handleSubmitChange = (e, items) => {
    e.preventDefault()
    console.log(items)
    items.map((item) => {
      const i = {
        novoProdutoNome: item.produto,
        novoSabor: item.sabor,
        novaQuant: item.quantidade,
        novaOBS: item.obs
      }

      async function changeItem() {
        try {
          const res = await fetch(`http://localhost:3000/item-pedido/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(i)
          })

          if (res.status === 200) {
            setChangeOpened((prev) => !prev)
          }
        }

        catch (err) {
          console.log(item.id, err)
        }
      }
      changeItem()
    })
  }

  useEffect(() => {
    pedidos.find((pedido) => pedido.id_pedido === id_selectedOrder)?.itens.map((item) => {
      setNewProductName(item.produto),
        setNewFlavor(item.sabor),
        setNewAmountValue(item.quantidade),
        setNewObs(item.observacao)
    })
  }, [id_selectedOrder])

  async function confirmAuthPass(pass, method) {
    try {
      const res = await axios.post(`http://localhost:3000/confirmAuthPass/${pass}`)
      if (res.status === 200 && method === "change") {
        setChangeOpened(true)
        setAuthOpened(false)
      }
      else if (res.status === 200 && method === "delete") {
        setAuthOpenedDelete(false)
        handleDeletePedido(id_selectedOrder)
      }
    }
    catch (error) {
      if (error.response) {

        if (error.response.status === 404) {
          console.log("rota não encontrada")
        }

        else if (error.response.status === 401) {
          toast.error("Senha incorreta", { autoClose: 4000 })
          console.log("unauthorizated")
        }
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && authOpened) {
      confirmAuthPass(authPass)
    }
  }

  useEffect(() => {
    if (authOpened === false || authOpenedDelete === false) {
      setAuthPass("")
    }
  }, [authOpened, authOpenedDelete])

  useEffect(() => {
    const selected = pedidos.find((pedido) => pedido.id_pedido === id_selectedOrder);
    if (selected) {
      setItemsToEdit(selected.itens.map(item => ({
        id: item.id_item,
        produto: item.produto,
        sabor: item.sabor,
        quantidade: item.quantidade,
        obs: item.observacao
      })))
    }
  }, [id_selectedOrder])

  return (
    <div className="page-pedidos">
      <div className="pedidos">

        <div style={{ opacity: changeOpened || authOpened ? "100" : "0", pointerEvents: changeOpened || authOpened ? "auto" : "none" }} className="change_filter" onClick={() => changeOpened ? setChangeOpened(prev => !prev) : setAuthOpened(prev => !prev)} ></div>
        <div style={{ opacity: deleteOpened || authOpenedDelete ? "100" : "0", pointerEvents: deleteOpened || authOpenedDelete ? "auto" : "none" }} className="change_filter" onClick={() => deleteOpened ? setDeleteOpened(prev => !prev) : setAuthOpenedDelete(prev => !prev)} ></div>

        <div className="auth_tela_pedidos" style={{ opacity: authOpened ? "100" : "0", pointerEvents: authOpened ? "auto" : "none" }}>
          <img src={warning_icon} style={{ width: "50px" }} />
          <h1 id="title_auth_tela_pedidos">Ação restrita à gerência</h1>
          <input placeholder="Digite a senha da gerência" type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => handleKeyDown(e)} autoFocus id="input_auth_tela_pedidos" />
          <button id="btn_confirm_auth_pass" onClick={() => confirmAuthPass(authPass, "change")}>Entrar</button>
        </div>

        <div className="auth_tela_pedidos" style={{ opacity: authOpenedDelete ? "100" : "0", pointerEvents: authOpenedDelete ? "auto" : "none" }}>
          <img src={warning_icon} style={{ width: "50px" }} />
          <h1 id="title_auth_tela_pedidos">Ação restrita à gerência</h1>
          <input placeholder="Digite a senha da gerência" type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => handleKeyDown(e)} autoFocus id="input_auth_tela_pedidos" />
          <button id="btn_confirm_auth_pass" onClick={() => confirmAuthPass(authPass, "delete")}>Entrar</button>
        </div>


















        <div style={{ opacity: changeOpened ? "100" : "0", pointerEvents: changeOpened ? "auto" : "none" }} className="change_order_card">
          <h1>Alterar pedido {id_selectedOrder}</h1>

          <div>
            <h2>Itens</h2>
            <form onSubmit={(e) => handleSubmitChange(e, itemsToEdit)}>
              <div style={{
                height: pedidos.find((pedido) => pedido.id_pedido === id_selectedOrder)?.itens.length > 1 ? "450px" : "360px",
                overflowY: pedidos.find((pedido) => pedido.id_pedido === id_selectedOrder)?.itens.length > 1 ? "auto" : "hidden",
                borderBottom: pedidos.find((pedido) => pedido.id_pedido === id_selectedOrder)?.itens.length > 1 ? "1px solid gray" : "none"
              }}>
                {
                  itemsToEdit.map((item, index) => {
                    return (
                      <div className="changeOrderForm" key={index} style={{ marginRight: pedidos.find((pedido) => pedido.id_pedido === id_selectedOrder)?.itens.length > 1 ? "10px" : "0" }}>
                        <label>Produto</label>
                        <input
                          className="change_order_form_inputs"
                          type="text"
                          value={item.produto}
                          onChange={(e) => {
                            setItemsToEdit(prev => {
                              const copy = [...prev]
                              copy[index] = { ...copy[index], produto: e.target.value }
                              return copy;
                            })
                          }}
                        />

                        <label>Sabor</label>
                        <input
                          className="change_order_form_inputs"
                          type="text"
                          value={item.sabor}
                          onChange={(e) => {
                            setItemsToEdit(prev => {
                              const copy = [...prev]
                              copy[index] = { ...copy[index], sabor: e.target.value }
                              return copy
                            })
                          }}
                        />

                        <label>Quantidade</label>
                        <input
                          className="change_order_form_inputs"
                          type="text"
                          value={item.quantidade}
                          onChange={(e) => {
                            setItemsToEdit(prev => {
                              const copy = [...prev]
                              copy[index] = { ...copy[index], quantidade: e.target.value }
                              return copy
                            })
                          }}
                        />

                        <label>Obs</label>
                        <input
                          className="change_order_form_inputs"
                          type="text"
                          value={item.obs}
                          onChange={(e) => {
                            setItemsToEdit(prev => {
                              const copy = [...prev]
                              copy[index] = { ...copy[index], obs: e.target.value }
                              return copy
                            })
                          }}
                        />
                      </div>
                    )
                  })
                }
              </div>
              <button id="btn_submit_change_order_form" type="submit">Salvar</button>
            </form>

          </div>
        </div>




        <div className="topo-fixo-pedidos">
          <div className="topo-fixo-restante">
            <h1>Pedidos</h1>
            <h2>Filtros</h2>
            <div className="filtro-datas">
              <label>
                <div className="lbl_filtro">ID:</div>
                <input placeholder="Digite o ID do pedido:"
                  className="inputs_filtro"
                  value={id_filter}
                  onChange={(e) => setIdFilter(e.target.value)} />
              </label>

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
                  max={new Date().toISOString().split("T")[0]}
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
                  onClick={() => togglePedido(pedido.id_pedido)}
                  key={pedido.id_pedido}
                  className={`pedido-card ${abertos[pedido.id_pedido] ? "aberto" : "fechado"
                    } ${novosIDs.includes(pedido.id_pedido) ? "pedido-novo" : ""}`}
                >
                  <div className="pedido-header" key={pedido.id_pedido}>
                    <div className="pedido_info">
                      <h2>
                        Pedido {pedido.id_pedido}{" "}
                        {abertos[pedido.id_pedido] ? (
                          <img className="e_and_r_icons" src={recolher_img} alt="Recolher" />
                        ) : (
                          <img className="e_and_r_icons" src={expandir_img} alt="Expandir" />
                        )}
                      </h2>
                    </div>

                    <button className="printer_btn">
                      <img src={impressora_icon} id="printer_icon" onClick={(e) => {
                        e.stopPropagation()
                        gerarPDF(pedido.id_pedido)
                        setAsPrinted(pedido.id_pedido)
                      }
                      } />
                    </button>

                    <button
                      className="delete-button-pedido"
                      style={{}}
                      onClick={(e) => {
                        e.stopPropagation()
                        setAuthOpenedDelete(prev => !prev)
                        setId_selectedOrder(pedido.id_pedido)
                      }
                      }
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

                    <button onClick={(e) => {
                      e.stopPropagation()
                      setAuthOpened(prev => !prev)
                      // setChangeOpened(prev => !prev)
                      setId_selectedOrder(pedido.id_pedido)
                    }} className="btn_alterar">Alterar</button>



                    {/* </Link> */}
                    {/* <Link onClick={(e) => e.stopPropagation()} to={`/alterar-pedidos/${pedido.id_pedido}`}> */}


                    {pedido.status_pedido && (
                      <button
                        className={`status-botao ${pedido.status_pedido.replace(" ", "-")}`}
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
                        {parseFloat(pedido.taxa_entrega).toFixed(2).replace(".", ",")}
                      </p>
                      <p>
                        <strong>Total:</strong> R$ {parseFloat(pedido.preco_total).toFixed(2).replace(".", ",")}
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
                            <p>
                              <strong>Preço: R$</strong> {item.preco?.toFixed(2).replace(".",",")}
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