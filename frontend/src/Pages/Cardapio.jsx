import React, { useEffect, useState, useRef, useMemo } from "react";
import "../Style/Cardapio.css";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { ToastContainer, toast } from "react-toastify";
import axios from "axios";
import 'react-toastify/dist/ReactToastify.css';
import bell_sound from "/assets/bell.mp3"
import pizza_img from "/assets/pizza.png"

export default function Cardapio() {
  const [cardapio, setCardapio] = useState({ pizzas: [], esfihas: [], bebidas: [], doces: [], outros: [] });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedItems, setSelectedItems] = useState({ section: null, ids: [] });
  const carregamentoInicial = useRef(true)
  const last_time_data = useRef([]);
  const [newItem, setNewItem] = useState({
    section: "pizzas",
    nome: "",
    ingredientes: "",
    preco: "",
    preco_25: "",
    preco_35: "",
    tamanho: ""
  });
  const InputRef = useRef(null);
  const topoFixoRef = useRef(null);
  const [dots, setDots] = useState("")

  const playSound = () => {
    const audio = new Audio(bell_sound)
    audio.volume = 0.7
    audio.play()
  }

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const res = await axios.get('https://localhost:3000/pedido/getAll', { withCredentials: true })
        const data = res.data
        if (carregamentoInicial.current === true) {
          console.log("carregamento inicial")
          carregamentoInicial.current = false
        }
        else {
          console.log("carregamento nao inicial", last_time_data, data)
          if (data.length > last_time_data.current.length) {
            playSound()
            toast.info("Novo pedido!",
              {
                className: "custom-info-toast",
                progressClassName: "custom-info-progress"
              }
            )
          }
        }
        last_time_data.current = data
      } catch (error) {
        console.log("algo deu errado no fetchpedidos :( ", error)
      }
    }

    fetchPedidos()
    const interval = setInterval(fetchPedidos, 5000);
    return () => clearInterval(interval);
  }, [])

  useEffect(() => {
    fetch("https://localhost:3000/cardapio", { credentials: "include" })
      .then(res => {
        if (!res.ok) throw new Error("Erro ao carregar cardápio");
        return res.json();
      })
      .then(data => {
        const sanitizedData = {
          pizzas: data.pizzas.map(item => ({ ...item, id: parseInt(item.id) })),
          esfihas: data.esfihas.map(item => ({ ...item, id: parseInt(item.id) })),
          bebidas: data.bebidas.map(item => ({ ...item, id: parseInt(item.id) })),
          doces: data.doces.map(item => ({ ...item, id: parseInt(item.id) })),
          outros: data.outros.map(item => ({ ...item, id: parseInt(item.id) })),
        };
        console.log("Cardápio carregado:", sanitizedData);
        setCardapio(sanitizedData);
        setLoading(false);
      })
      .catch(err => {
        setErro(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading && InputRef.current) {
      InputRef.current.focus();
    }
  }, [loading]);

  useEffect(() => {
    const updatePadding = () => {
      if (topoFixoRef.current) {
        const topoHeight = topoFixoRef.current.getBoundingClientRect().height;
        document.querySelector('.conteudo-rolavel').style.paddingTop = `${topoHeight + 20}px`;
      }
    };

    updatePadding();
    window.addEventListener('resize', updatePadding);

    return () => window.removeEventListener('resize', updatePadding);
  }, []);

  const filtrarItens = useMemo(() => {
    return (lista) => {
      return lista.filter(item => {
        const campoSabor = item.sabor || item.nome || "";
        const campoIngredientes = item.ingredientes || "";
        return (
          campoSabor.toLowerCase().includes(busca.toLowerCase()) ||
          campoIngredientes.toLowerCase().includes(busca.toLowerCase())
        );
      });
    };
  }, [busca]);

  const handleToggleDeleteMode = async () => {
    if (isDeleting && selectedItems.ids.length > 0) {
      const resultado = await Swal.fire({
        title: "⚠️ \n Tem certeza?",
        text: `Deseja deletar ${selectedItems.ids.length} item(s) da seção ${selectedItems.section}?`,
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#000000",
        confirmButtonText: "Sim, deletar",
        cancelButtonText: "Cancelar",
      });

      if (resultado.isConfirmed) {
        handleDeleteItems();
      } else {
        setIsDeleting(false);
        setSelectedItems({ section: null, ids: [] });
      }
    } else {
      setIsDeleting(!isDeleting);
      setSelectedItems({ section: null, ids: [] });
    }
  };

  const realceTexto = (texto) => {
    if (!busca) return texto;
    const regex = new RegExp(`(${busca})`, 'gi');
    return texto.replace(regex, '<mark>$1</mark>');
  };

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section && topoFixoRef.current) {
      const topoFixoAltura = topoFixoRef.current.getBoundingClientRect().height;
      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      setTimeout(() => {
        window.scrollTo({
          top: sectionTop - topoFixoAltura,
          behavior: "smooth"
        });
      }, 0);
    }
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem(prev => ({ ...prev, [name]: value }));
  };

  const handleEditItem = (item, section) => {
    setIsEditing(true);
    setEditItemId(item.id);
    setNewItem({
      section,
      nome: item.sabor || item.nome || "",
      ingredientes: item.ingredientes || "",
      preco: item.preco || "",
      preco_25: item.preco_25 || "",
      preco_35: item.preco_35 || "",
      tamanho: item.tamanho || ""
    });
    setShowModal(true);
  };

  const reloadCardapio = async () => {
    try {
      const res = await fetch("https://localhost:3000/cardapio", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar cardápio");
      const data = await res.json();
      const sanitizedData = {
        pizzas: data.pizzas.map(item => ({ ...item, id: parseInt(item.id) })),
        esfihas: data.esfihas.map(item => ({ ...item, id: parseInt(item.id) })),
        bebidas: data.bebidas.map(item => ({ ...item, id: parseInt(item.id) })),
        doces: data.doces.map(item => ({ ...item, id: parseInt(item.id) })),
        outros: data.outros.map(item => ({ ...item, id: parseInt(item.id) })),
      };
      setCardapio(sanitizedData);
    } catch (err) {
      setErro(err.message);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();

    const newItemData = {
      section: newItem.section,
      nome: newItem.nome,
      ingredientes: newItem.section === "pizzas" ? newItem.ingredientes : undefined,
      preco_25: newItem.section === "pizzas" ? newItem.preco_25 : undefined,
      preco_35: newItem.section === "pizzas" ? newItem.preco_35 : undefined,
      preco: newItem.section !== "pizzas" ? newItem.preco : undefined,
      tamanho: newItem.section === "bebidas" ? newItem.tamanho : undefined,
    };

    try {
      let response;
      if (isEditing) {
        response = await fetch(`https://localhost:3000/cardapio/${editItemId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newItemData),
          credentials: "include"
        });
      } else {
        response = await fetch("https://localhost:3000/cardapio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newItemData),
          credentials: "include"
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || (isEditing ? "Erro ao atualizar item" : "Erro ao adicionar item"));
      }

      await reloadCardapio();
      setShowModal(false);
      setIsEditing(false);
      setEditItemId(null);
      setNewItem({
        section: "pizzas",
        nome: "",
        ingredientes: "",
        preco: "",
        preco_25: "",
        preco_35: "",
        tamanho: "",
      });
      toast.success(isEditing ? "Item atualizado com sucesso!" : "Item adicionado com sucesso!");
    } catch (err) {
      console.error(isEditing ? "Erro ao atualizar item:" : "Erro ao adicionar item:", err);
      toast.error(isEditing ? `Erro ao atualizar item: ${err.message}` : `Erro ao adicionar item: ${err.message}`);
    }
  };

  const handleSelectItem = (id, section) => {
    setSelectedItems(prev => {
      if (prev.section !== section && prev.section !== null) {
        return prev;
      }
      const newIds = prev.ids.includes(id)
        ? prev.ids.filter(itemId => itemId !== id)
        : [...prev.ids, id];
      return { section: section || prev.section, ids: newIds };
    });
  };

  const handleDeleteItems = async () => {
    if (selectedItems.ids.length === 0 || !selectedItems.section) return;

    const sanitizedIds = selectedItems.ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (sanitizedIds.length === 0) {
      toast.error("Nenhum ID válido selecionado para exclusão");
      return;
    }

    console.log("Enviando DELETE com IDs:", sanitizedIds, "Seção:", selectedItems.section);

    try {
      const response = await fetch("https://localhost:3000/cardapio", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section: selectedItems.section,
          ids: sanitizedIds,
        }),
        credentials: "include"
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || "Erro ao deletar itens");
      }

      setCardapio(prev => ({
        ...prev,
        [selectedItems.section]: prev[selectedItems.section].filter(
          item => !sanitizedIds.includes(item.id)
        ),
      }));

      setIsDeleting(false);
      setSelectedItems({ section: null, ids: [] });
      toast.success("Itens deletados com sucesso!");
    } catch (err) {
      console.error("Erro ao deletar itens:", err.message);
      toast.error(`Erro ao deletar itens: ${err.message}`);
    }
  };

  useEffect(() => {
    if (loading) {
      const maxDots = 3;

      const interval = setInterval(() => {
        setDots(prev => (prev.length < maxDots ? prev + "." : ""))
      }, 250)

      return () => clearInterval(interval)
    }
  }, [])

  if (loading) return (
    <div className="loading_menu">
      <img id="pizza_img_loading_menu" src={pizza_img} />
      <h1 id="title_loading_menu">Carregando cardápio{dots}</h1>
    </div>
  )









  return (
    <div className="cardapio-container">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="topo-fixo" ref={topoFixoRef}>
        <div className="topo-fixo-container">
          <h1>Cardápio</h1>
          <input
            type="text"
            placeholder="Buscar item..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input-busca"
            ref={InputRef}
            aria-label="Buscar itens no cardápio"
          />
          <div className="atalhos-container">
            <button
              className="atalho-btn"
              onClick={() => scrollToSection("pizzas-section")}
              aria-label="Ir para seção de Pizzas"
            >
              Pizzas
            </button>
            <button
              className="atalho-btn"
              onClick={() => scrollToSection("esfihas-section")}
              aria-label="Ir para seção de Esfihas"
            >
              Esfihas
            </button>
            <button
              className="atalho-btn"
              onClick={() => scrollToSection("bebidas-section")}
              aria-label="Ir para seção de Bebidas"
            >
              Bebidas
            </button>
            <button
              className="atalho-btn"
              onClick={() => scrollToSection("doces-section")}
              aria-label="Ir para seção de Doces"
            >
              Doces
            </button>
            <button
              className="atalho-btn"
              onClick={() => scrollToSection("outros-section")}
              aria-label="Ir para seção de Doces"
            >
              Outros
            </button>

            <button onClick={() => {
              setIsEditing(false);
              setEditItemId(null);
              setNewItem({
                section: "pizzas",
                nome: "",
                ingredientes: "",
                preco: "",
                preco_25: "",
                preco_35: "",
                tamanho: "",
              });
              setShowModal(true);
            }} id="add_item_menu_btn"> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" id="add_item_menu_svg_btn"><path
              d="m15 0 v30 m0 0 m-15 -15 h30"
              stroke-width="5"
              stroke="gray"
              stroke-linejoin="round"
              stroke-linecap="round"

            ></path></svg></button>






            <button
              aria-label={isDeleting ? "Confirmar exclusão de itens" : "Entrar no modo de exclusão"}
              className="delete-button"
              onClick={handleToggleDeleteMode}
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
          </div>
        </div>
      </div>

      {/* {showModal && ( */}
      <div className="modal-overlay" style={{ opacity: showModal ? "100" : "0", pointerEvents: showModal ? "all" : "none" }}>
        <div className="modal-content">
          <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
          <h2 id="title_modal_content_menu">{isEditing ? "Editar Item" : "Adicionar Novo Item"}</h2>
          <div className="modal-body">
            {!isEditing &&
              <select
                name="section"
                value={newItem.section}
                onChange={handleNewItemChange}
                className="input-busca"
              >
                <option value="pizzas">Pizzas</option>
                <option value="esfihas">Esfihas</option>
                <option value="bebidas">Bebidas</option>
                <option value="doces">Doces</option>
                <option value="outros">Outros</option>
              </select>
            }
            <input
              type="text"
              name="nome"
              value={newItem.nome}
              onChange={handleNewItemChange}
              placeholder={newItem.section === "pizzas" || newItem.section === "esfihas" ? "Sabor" : "Nome"}
              className="input-busca"
            />
            {newItem.section === "pizzas" && (
              <>
                <input
                  type="text"
                  name="ingredientes"
                  value={newItem.ingredientes}
                  onChange={handleNewItemChange}
                  placeholder="Ingredientes"
                  className="input-busca"
                />
                <input
                  type="number"
                  name="preco_25"
                  value={newItem.preco_25}
                  onChange={handleNewItemChange}
                  placeholder="Preço - média"
                  className="input-busca"
                />
                <input
                  type="number"
                  name="preco_35"
                  value={newItem.preco_35}
                  onChange={handleNewItemChange}
                  placeholder="Preço - grande"
                  className="input-busca"
                />
              </>
            )}
            {(newItem.section === "esfihas" || newItem.section === "doces" || newItem.section === "outros") && (
              <input
                type="number"
                name="preco"
                value={newItem.preco}
                onChange={handleNewItemChange}
                placeholder="Preço"
                className="input-busca"
              />
            )}
            {newItem.section === "bebidas" && (
              <>
                <input
                  type="text"
                  name="tamanho"
                  value={newItem.tamanho}
                  onChange={handleNewItemChange}
                  placeholder="Tamanho (ml ou l)"
                  className="input-busca"
                />
                <input
                  type="number"
                  name="preco"
                  value={newItem.preco}
                  onChange={handleNewItemChange}
                  placeholder="Preço"
                  className="input-busca"
                />
              </>
            )}
            <button className="atalho-btn" onClick={handleAddItem}>
              {isEditing ? "Salvar Alterações" : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
      {/* )} */}

      <div className="conteudo-rolavel">
        <div className="secao-cardapio" id="pizzas-section">
          <h2>Pizzas</h2>
          <div className="card-grid">
            {filtrarItens(cardapio.pizzas).map(pizza => (
              <div className="card-item" key={pizza.id}>
                {isDeleting && (
                  <input
                    type="checkbox"
                    checked={selectedItems.section === "pizzas" && selectedItems.ids.includes(pizza.id)}
                    onChange={() => handleSelectItem(pizza.id, "pizzas")}
                    className="delete-checkbox"
                  />
                )}
                <div
                  className="sabor"
                  dangerouslySetInnerHTML={{ __html: realceTexto(pizza.sabor) }}
                />
                <div
                  className="ingredientes"
                  dangerouslySetInnerHTML={{ __html: realceTexto(pizza.ingredientes || "") }}
                />
                <div className="precos">
                  R$ {(Number(pizza.preco_25) || 0).toFixed(2)} | R$ {(Number(pizza.preco_35) || 0).toFixed(2)}
                </div>
                <button className="editBtn" onClick={() => handleEditItem(pizza, "pizzas")}>
                  <svg width="1em" height="1em" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
                    <path
                      d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"
                    ></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="secao-cardapio" id="esfihas-section">
          <h2>Esfihas</h2>
          <div className="card-grid">
            {filtrarItens(cardapio.esfihas).map(esfiha => (
              <div className="card-item" key={esfiha.id}>
                {isDeleting && (
                  <input
                    type="checkbox"
                    checked={selectedItems.section === "esfihas" && selectedItems.ids.includes(esfiha.id)}
                    onChange={() => handleSelectItem(esfiha.id, "esfihas")}
                    className="delete-checkbox"
                  />
                )}
                <div
                  className="sabor"
                  dangerouslySetInnerHTML={{ __html: realceTexto(esfiha.sabor) }}
                />
                <div className="ingredientes" />
                <div className="precos">
                  R$ {(Number(esfiha.preco) || 0).toFixed(2)}
                </div>
                <button className="editBtn" onClick={() => handleEditItem(esfiha, "esfihas")}>
                  <svg width="1em" height="1em" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
                    <path
                      d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"
                    ></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="secao-cardapio" id="bebidas-section">
          <h2>Bebidas</h2>
          <div className="card-grid">
            {filtrarItens(cardapio.bebidas || []).map(bebida => (
              <div className="card-item" key={bebida.id}>
                {isDeleting && (
                  <input
                    type="checkbox"
                    checked={selectedItems.section === "bebidas" && selectedItems.ids.includes(bebida.id)}
                    onChange={() => handleSelectItem(bebida.id, "bebidas")}
                    className="delete-checkbox"
                  />
                )}
                <div
                  className="sabor"
                  dangerouslySetInnerHTML={{ __html: realceTexto(bebida.nome) }}
                />
                <div className="precos">
                  R$ {(Number(bebida.preco) || 0).toFixed(2)}
                </div>
                <button className="editBtn" onClick={() => handleEditItem(bebida, "bebidas")}>
                  <svg width="1em" height="1em" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
                    <path
                      d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"
                    ></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="secao-cardapio" id="doces-section">
          <h2>Doces</h2>
          <div className="card-grid">
            {filtrarItens(cardapio.doces || []).map(doce => (
              <div className="card-item" key={doce.id}>
                {isDeleting && (
                  <input
                    type="checkbox"
                    checked={selectedItems.section === "doces" && selectedItems.ids.includes(doce.id)}
                    onChange={() => handleSelectItem(doce.id, "doces")}
                    className="delete-checkbox"
                  />
                )}
                <div
                  className="sabor"
                  dangerouslySetInnerHTML={{ __html: realceTexto(doce.nome) }}
                />
                <div className="precos">
                  R$ {(Number(doce.preco) || 0).toFixed(2)}
                </div>
                <button className="editBtn" onClick={() => handleEditItem(doce, "doces")}>
                  <svg width="1em" height="1em" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
                    <path
                      d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6l0s6.2 16.4 0 22.6z"
                    ></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="secao-cardapio" id="outros-section">
          <h2>Outros</h2>
          <div className="card-grid">
            {filtrarItens(cardapio.outros).map(item => (
              <div className="card-item" key={item.id}>
                {isDeleting && (
                  <input
                    type="checkbox"
                    checked={selectedItems.section === "outros" && selectedItems.ids.includes(item.id)}
                    onChange={() => handleSelectItem(item.id, "outros")}
                    className="delete-checkbox"
                  />
                )}
                <div
                  className="sabor"
                  dangerouslySetInnerHTML={{ __html: realceTexto(item.nome) }}
                />
                <div className="ingredientes" />
                <div className="precos">
                  R$ {(Number(item.preco) || 0).toFixed(2)}
                </div>
                <button className="editBtn" onClick={() => handleEditItem(item, "outros")}>
                  <svg width="1em" height="1em" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
                    <path
                      d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"
                    ></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}