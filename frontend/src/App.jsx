import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, RouterProvider } from "react-router-dom";
import { io } from "socket.io-client";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Home from "./Pages/Home";
import Pedidos from "./Pages/Pedidos";
import Relatorios from "./Pages/Relatorios";
import Cardapio from "./Pages/Cardapio";
import PrivateRoute from "./Pages/PrivateRoute";
import Login from "./Pages/Login";
import "./Style/App.css"
import axios from "axios";

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

  const fetchPedidos = () => {
    fetch("https://back-cantinho-das-pizzas.onrender.com/pedido/getAll", { credentials: "include" })
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

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<Login />} />



        <Route path="/" element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        } />


        <Route
          path="/pedidos"
          element={
            <PrivateRoute>
              <Pedidos pedidos={pedidos} setPedidos={setPedidos} />
            </PrivateRoute>
          }
        />


        <Route path="/relatorios" element={
          <PrivateRoute>
            <Relatorios />
          </PrivateRoute>
        } />


        <Route path="/cardapio" element={
          <PrivateRoute>
            <Cardapio />
          </PrivateRoute>
        } />


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