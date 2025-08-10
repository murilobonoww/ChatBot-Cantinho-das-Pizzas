import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Home from "./Pages/Home";
import Pedidos from "./Pages/Pedidos";
import Entregadores from "./Pages/Motoboys";
import Relatorios from "./Pages/Relatorios";
import Cardapio from "./Pages/Cardapio";
import AlterarPedidos from "./Pages/Alterar-pedidos";

function AppContent() {
  const [pedidos, setPedidos] = useState([]);
  const [abertos, setAbertos] = useState({});
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [itemFiltro, setItemFiltro] = useState("");
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const pedidosAnteriores = useRef([]);
  const [modoFiltro, setModoFiltro] = useState("OU");
  const [novosIDs, setNovosIDs] = useState([]);
  const navigate = useNavigate();

  const fetchPedidos = () => {
    fetch("http://localhost:3000/pedido/getAll")
      .then((res) => res.json())
      .then((data) => {
        const pedidosOrdenados = data.sort((a, b) => b.id_pedido - a.id_pedido);
        const anteriores = [...pedidosAnteriores.current];

        const entreguesAgora = pedidosOrdenados.filter((pedidoNovo) => {
          const correspondenteAntigo = anteriores.find((p) => p.id_pedido === pedidoNovo.id_pedido);
          return (
            correspondenteAntigo &&
            correspondenteAntigo.status_pedido !== "entregue" &&
            pedidoNovo.status_pedido === "entregue"
          );
        });

        entreguesAgora.forEach((pedido) => {
          toast.success(
            <span>
              Pedido <strong>{pedido.id_pedido}</strong> foi marcado como entregue
            </span>,
            { autoClose: 4000 }
          );
        });

        pedidosAnteriores.current = pedidosOrdenados.map((p) => ({ ...p }));
        setPedidos(pedidosOrdenados);
      })
      .catch((err) => console.error("Erro ao buscar pedidos:", err));
  };

  useEffect(() => {
    fetchPedidos(); // Carrega pedidos iniciais
    const interval = setInterval(fetchPedidos, 10000); // Aumentado para 10 segundos

    return () => clearInterval(interval); // Limpa intervalo ao desmontar
  }, []);

  // Opcional: Configuração de WebSocket para substituir polling
  /*
  useEffect(() => {
    const socket = io("http://localhost:3000");
    socket.on("pedidoAtualizado", (pedidoAtualizado) => {
      console.log("Pedido atualizado via WebSocket:", pedidoAtualizado);
      if (pedidoAtualizado.status_pedido === "entregue") {
        toast.success(
          <span>
            Pedido <strong>{pedidoAtualizado.id_pedido}</strong> foi marcado como entregue
          </span>,
          { autoClose: 4000 }
        );
      }

      setPedidos((prevPedidos) => {
        const novosPedidos = prevPedidos.map((p) =>
          p.id_pedido === pedidoAtualizado.id_pedido ? pedidoAtualizado : p
        );
        if (!novosPedidos.some((p) => p.id_pedido === pedidoAtualizado.id_pedido)) {
          novosPedidos.unshift(pedidoAtualizado);
        }
        return novosPedidos.sort((a, b) => b.id_pedido - a.id_pedido);
      });

      pedidosAnteriores.current = pedidosAnteriores.current.map((p) =>
        p.id_pedido === pedidoAtualizado.id_pedido ? { ...pedidoAtualizado } : p
      );
    });

    return () => socket.disconnect();
  }, []);
  */

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        navigate("/");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/pedidos"
          element={<Pedidos pedidos={pedidos} setPedidos={setPedidos} />}
        />
        <Route path="/entregadores" element={<Entregadores />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/cardapio" element={<Cardapio />} />
        <Route path="/alterar-pedidos/:id" element={<AlterarPedidos />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;