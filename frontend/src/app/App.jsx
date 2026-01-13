import React, { useEffect, useState, useRef } from "react";
import { HashRouter as Router, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "@/Style/App.css"
import axios from "axios";
import { useSocketNotifications } from "@/hooks/useSocketNotifications";
import AppRoutes from "@/app/AppRoutes";

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

  useSocketNotifications();

  useEffect(() => {
    const ping_ = async () => {
      const agr = new Date();
      const hora_atual = agr.getHours();
      // if (hora_atual >= 14 && hora_atual <= 23) {
      try {
        const res = await axios.get('https://back-cantinho-das-pizzas.onrender.com/keep-server-on')
      } catch (error) {
        console.log("Erro no ping:", error)
      }
      // }
    }
    const interval = setInterval(ping_, 10000)
    ping_()
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetchPedidos(); // Carrega pedidos iniciais
    const interval = setInterval(fetchPedidos, 10000);

    return () => clearInterval(interval); // Limpa intervalo ao desmontar
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        navigate("/");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const fetchPedidos = () => {
    fetch("https://back-cantinho-das-pizzas.onrender.com/order/getAll", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          navigate('/login')
          return []
        }
        if (res.status === 304) {
          return pedidosAnteriores.current
        }
        return res.json()
      })
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
      .catch((err) => {
        console.error("Erro ao buscar pedidos:", err)
      });
  };

  return (
    <>
      <AppRoutes pedidos={pedidos} setPedidos={setPedidos} />
    </>
  );
}

function App() {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={6000} newestOnTop closeOnClick pauseOnHover />
      <AppContent />
    </Router>
  );
}

export default App;