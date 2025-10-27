import React, { useEffect, useState, useRef } from "react";
import "../Style/Pedidos.css";
import expandir_img from "/assets/folder.webp";
import recolher_img from "/assets/open-folder.webp";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css'; // Importe o CSS
import none_result from "/assets/nenhum-resultado-encontrado.png";
import { Link, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { jsPDF } from "jspdf";
import impressora_icon from "/assets/printer_.png"
import warning_icon from "/assets/warning.webp"
import bell_sound from "/assets/bell.mp3"
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
  const [novospedidos_localstorage, set_novospedidos_localstorage] = useState([]);

  const [secao_pedido_filtro, setSecao_pedido_filtro] = useState("Todos")
  const [contagem_pedidos_secao, setContagem_pedidos_secao] = useState(0)

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
  }, [id_filter, dataInicio, dataFim, nomeCliente, secao_pedido_filtro]);

  useEffect(() => {
    fetch("https://back-cantinho-das-pizzas.onrender.com/pedido/getAll", {
      credentials: "include"
    })
      .then(res => res.json())
      .then(data => {
        const pedidosOrdenados = data.sort((a, b) => b.id_pedido - a.id_pedido);
        setPedidos(pedidosOrdenados);
        buscarPedidosFiltrados();

        if (localStorage.getItem("pedidos") !== null) {
          const pedidos_ = localStorage.getItem("pedidos")
          const parsed_pedidos_ = JSON.parse(pedidos_)

          //data = array de pedidos atual
          //parsed_pedidos = array de pedidos salvo de quando o componente tava aberto
          if (data !== parsed_pedidos_) {

            const ids_de_pedidos_antigos = parsed_pedidos_.map((p) => p.id_pedido)

            const ids_de_pedidos_atuais = data.map((p) => {
              if (!ids_de_pedidos_antigos.some(id => id === p.id_pedido)) {
                setNovosIDs(prev => [...prev, p.id_pedido])
              }
            })
          }

        }
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
  }, [id_filter, dataInicio, dataFim, nomeCliente, secao_pedido_filtro]);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.toastMessage) {
      toast.success(location.state.toastMessage, { autoClose: 4000 });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchPedidos = () => {
    fetch(`https://back-cantinho-das-pizzas.onrender.com/pedido/getAll`, {
      credentials: "include"
    })
      .then(res => res.json())
      .then(data => {
        let pedidosOrdenados = data.sort((a, b) => b.id_pedido - a.id_pedido);

        if (secao_pedido_filtro === "Novos") {
          pedidosOrdenados = pedidosOrdenados.filter((p) => novosIDs.includes(p.id_pedido))
        }
        else if (secao_pedido_filtro === "Em andamento") {
          pedidosOrdenados = pedidosOrdenados.filter((p) => p.status_pedido === "aberto" || p.status_pedido === "aceito" || p.status_pedido === "despachado" || p.status_pedido === "andamento")
        }
        else if (secao_pedido_filtro === "Entregues") {
          pedidosOrdenados = pedidosOrdenados.filter((p) => p.status_pedido === "entregue")
        }

        setContagem_pedidos_secao(pedidosOrdenados.length)

        const idsAnteriores = pedidosAnteriores.current.map(p => p.id_pedido);
        const novosPedidos = pedidosOrdenados.filter(p => !idsAnteriores.includes(p.id_pedido));

        localStorage.setItem("pedidos", JSON.stringify(pedidosOrdenados))

        if (carregamentoInicial.current) {
          carregamentoInicial.current = false;
        } else if (novosPedidos.length > 0) {
          const idsNovos = novosPedidos.map(p => p.id_pedido);
          setNovosIDs(idsNovos);
          playSound();
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


    fetch(`https://back-cantinho-das-pizzas.onrender.com/pedido/getAll?${params.toString()}`, {
      credentials: "include"
    })
      .then((res) => res.json())
      .then((data) => {
        const pedidosOrdenados = data.sort((a, b) => b.id_pedido - a.id_pedido);
        let pedidosOrdenadosFiltradosPorSecao = pedidosOrdenados

        if (secao_pedido_filtro === "Novos") {
          pedidosOrdenadosFiltradosPorSecao = pedidosOrdenados.filter((p) => novosIDs.includes(p.id_pedido))
        }
        else if (secao_pedido_filtro === "Em andamento") {
          pedidosOrdenadosFiltradosPorSecao = pedidosOrdenados.filter((p) => p.status_pedido === "aberto" || p.status_pedido === "aceito" || p.status_pedido === "despachado" || p.status_pedido === "andamento")
        }
        if (secao_pedido_filtro === "Entregues") {
          pedidosOrdenadosFiltradosPorSecao = pedidosOrdenados.filter((p) => p.status_pedido === "entregue")
        }
        setPedidos(pedidosOrdenadosFiltradosPorSecao);
        setContagem_pedidos_secao(pedidosOrdenadosFiltradosPorSecao.length)
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
  }, [id_filter, dataInicio, dataFim, nomeCliente, secao_pedido_filtro]);

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
        fetch(`https://back-cantinho-das-pizzas.onrender.com/pedido/${id}`, {
          method: "DELETE",
          credentials: "include"
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

      if (i.produto === "pizza" || i.produto === "esfiha") {
        doc.text(`${i.quantidade} x ${i.produto} de ${i.sabor} - ${i.observacao} (R$${i.preco})`, 10, y)
        y += 10
      }
      else if (i.produto === "bebida") {
        doc.text(`${i.quantidade} x ${i.sabor} - ${i.observacao} (R$${i.preco})`, 10, y)
        y += 10
      }
      else {
        doc.text(`\nProduto:${i.produto}\nSabor:${i.sabor}\nQuantidade:${i.quantidade}\nObs.:${i.observacao}`, 10, y)
        y += 10
      }

    })
    doc.text(`Pedido: ${orderID}\nCliente: ${order.nome_cliente}\nEndereço de entrega: ${order.endereco_entrega}\nForma de pagamento: ${order.forma_pagamento}\nTaxa de entrega: R$${(order.taxa_entrega).replace(".", ",")}\nTotal: R$${(order.preco_total).replace(".", ",")}`, 10, 10)
    doc.save(`Pedido_${orderID}.pdf`)
  }

  const setAsPrinted = (id) => {
    fetch(`https://back-cantinho-das-pizzas.onrender.com/pedido/setPrinted/${id}`, {
      method: "PUT",
      credentials: "include"
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
          const res = await fetch(`https://back-cantinho-das-pizzas.onrender.com/item-pedido/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(i),
            credentials: "include"
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
      const res = await axios.post(`https://back-cantinho-das-pizzas.onrender.com/confirmAuthPass/${pass}`, { withCredentials: true })
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

  const abreviar_nome_completo = (nome_completo) => {
    const array_de_partes_do_nome = nome_completo.trim().split(/\s+/)
    const primeiroNome = array_de_partes_do_nome[0]
    const primeiroSobrenome = array_de_partes_do_nome[1] ? array_de_partes_do_nome[1][0] + "." : ""

    const nomeCompleto = primeiroNome + " " + primeiroSobrenome
    return nomeCompleto
  }

  const set_classname_pedido_card = (id_) => {
    if(novosIDs.includes(id_) ){
      return " pedido-novo"
    }
    else{
      return ""
    }
  }

  return (
    <div className="page-pedidos">
      <div className="pedidos">

        <div style={{ opacity: changeOpened || authOpened ? "100" : "0", pointerEvents: changeOpened || authOpened ? "auto" : "none" }} className="change_filter" onClick={() => changeOpened ? setChangeOpened(prev => !prev) : setAuthOpened(prev => !prev)} ></div>
        <div style={{ opacity: deleteOpened || authOpenedDelete ? "100" : "0", pointerEvents: deleteOpened || authOpenedDelete ? "auto" : "none" }} className="change_filter" onClick={() => deleteOpened ? setDeleteOpened(prev => !prev) : setAuthOpenedDelete(prev => !prev)} ></div>

        <div className="auth_tela_pedidos" style={{ opacity: authOpened ? "100" : "0", pointerEvents: authOpened ? "auto" : "none" }}>
          <img src={warning_icon} style={{ width: "50px" }} />
          <h1 id="title_auth_tela_pedidos">Ação restrita à gerência</h1>
          <input placeholder="Digite a senha" type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => handleKeyDown(e)} autoFocus id="input_auth_tela_pedidos" />
          <button id="btn_confirm_auth_pass" onClick={() => confirmAuthPass(authPass, "change")}>Entrar</button>
        </div>

        <div className="auth_tela_pedidos" style={{ opacity: authOpenedDelete ? "100" : "0", pointerEvents: authOpenedDelete ? "auto" : "none" }}>
          <img src={warning_icon} style={{ width: "50px" }} />
          <h1 id="title_auth_tela_pedidos">Ação restrita à gerência</h1>
          <input placeholder="Digite a senha" type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => handleKeyDown(e)} autoFocus id="input_auth_tela_pedidos" />
          <button id="btn_confirm_auth_pass" onClick={() => confirmAuthPass(authPass, "delete")}>Entrar</button>
        </div>

        <div style={{ opacity: changeOpened ? "100" : "0", pointerEvents: changeOpened ? "auto" : "none" }} className="change_order_card">
          <h1>Alterar pedido {id_selectedOrder}</h1>

          <div>
            <h2>Itens</h2>
            <form onSubmit={(e) => handleSubmitChange(e, itemsToEdit)}>
              <div style={{
                height: pedidos.find((pedido) => pedido.id_pedido === id_selectedOrder)?.itens.length > 1 ? "400px" : "360px",
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
                <div className="lbl_filtro">Cliente:</div>
                <input
                  className="inputs_filtro"
                  type="text"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Digite o nome do cliente"
                />
              </label>
              <div className="filtro-itens">
                <div className="lbl_filtro">Item:</div>
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

        <div className="divisoes_orders">
          <h1>Pedidos</h1>
          <ul className="ul_divisoes_orders">
            <li>
              <div className="section_divisoes">
                <button className={secao_pedido_filtro === "Todos" ? "btn_divisoes_oders_active" : "btn_divisoes_oders"} onClick={() => setSecao_pedido_filtro("Todos")} >Todos</button>
                <div className="underline_divisoes_orders" style={{ opacity: secao_pedido_filtro === "Todos" ? "100" : "0" }} />
              </div>
              <div className="bubble_section_divisoes" style={{ opacity: secao_pedido_filtro === "Todos" ? "100" : "0" }} >{contagem_pedidos_secao}</div>
            </li>


            <li>
              <div className="section_divisoes">
                <button className={secao_pedido_filtro === "Novos" ? "btn_divisoes_oders_active" : "btn_divisoes_oders"} onClick={() => setSecao_pedido_filtro("Novos")} >Novos</button>
                <div className="underline_divisoes_orders" style={{ opacity: secao_pedido_filtro === "Novos" ? "100" : "0" }} />
              </div>
              <div className="bubble_section_divisoes" style={{ opacity: secao_pedido_filtro === "Novos" ? "100" : "0" }} >{contagem_pedidos_secao}</div>
            </li>


            <li>
              <div className="section_divisoes">
                <button className={secao_pedido_filtro === "Ativos" ? "btn_divisoes_oders_active" : "btn_divisoes_oders"} onClick={() => setSecao_pedido_filtro("Ativos")} >Ativos</button>
                <div className="underline_divisoes_orders" style={{ opacity: secao_pedido_filtro === "Ativos" ? "100" : "0" }} />
              </div>
              <div className="bubble_section_divisoes" style={{ opacity: secao_pedido_filtro === "Ativos" ? "100" : "0" }} >{contagem_pedidos_secao}</div>
            </li>


            <li>
              <div className="section_divisoes">
                <button className={secao_pedido_filtro === "Entregues" ? "btn_divisoes_oders_active" : "btn_divisoes_oders"} onClick={() => setSecao_pedido_filtro("Entregues")} >Entregues</button>
                <div className="underline_divisoes_orders" style={{ opacity: secao_pedido_filtro === "Entregues" ? "100" : "0" }} />
              </div>
              <div className="bubble_section_divisoes" style={{ opacity: secao_pedido_filtro === "Entregues" ? "100" : "0" }} >{contagem_pedidos_secao}</div>
            </li>
          </ul>
        </div>

        <div className="container_pedidos_">
          <div className="lista-pedidos">
            {pedidos.filter(pedidoPassaNoFiltro).length === 0 ? (
              <div style={{ marginTop: "40px", alignSelf: "center", alignItems: "center", display: "flex", flexDirection: "column" }}>
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
                    onClick={() => {
                      togglePedido(pedido.id_pedido)
                    }}
                    key={pedido.id_pedido}
                    className={`pedido-card ${abertos[pedido.id_pedido] ? "aberto" : "fechado"}${set_classname_pedido_card(pedido.id_pedido)}`}
                  // } ${novosIDs.includes(pedido.id_pedido) ? "pedido-novo" : ""}`}
                  >

                    <div className="pedido-header" key={pedido.id_pedido}>
                      <div className="pedido_info">
                        <h2>
                          #{pedido.id_pedido}{" "}
                        </h2>

                        <pre id="client_name_pedido_card">
                          •  {abreviar_nome_completo(pedido.nome_cliente)}        <span style={{ fontFamily: "MinhaFonte3", color: "#9a9898" }}>{formatarDataHora(pedido.data_pedido)}</span>
                        </pre>
                      </div>

                      <button className="printer_btn" onClick={(e) => {
                        e.stopPropagation()
                        setNovosIDs(prev => prev.filter(item => item !== pedido.id_pedido))
                        gerarPDF(pedido.id_pedido)
                        setAsPrinted(pedido.id_pedido)
                      }
                      }>Imprimir
                      </button>

                      <button className="editBtn_h" onClick={(e) => {
                        e.stopPropagation()
                        setAuthOpened(prev => !prev)
                        setId_selectedOrder(pedido.id_pedido)
                      }}>
                        <svg width="1em" height="1em" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
                          <path
                            d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"
                          ></path>
                        </svg>
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

                      <img id="warning_icon_new_order" src={warning_icon} />

                    </div>
                    <div className="pedido_card_second_line">
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
                                <strong>Preço: R$</strong> {item.preco?.toFixed(2).replace(".", ",")}
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
          {/* fim de lista-pedidos */}

          <div className="filtros_div_"></div>
        </div>
      </div>
    </div>
  );
};

export default Pedidos;