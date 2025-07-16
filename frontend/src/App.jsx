import React from "react";
import Home from "./Pages/Home";
import Pedidos from "./Pages/Pedidos";
import Entregadores from "./Pages/Motoboys";
import Relatorios from "./Pages/Relatorios";
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Cardapio from "./Pages/Cardapio";
import AlterarPedidos from "./Pages/Alterar-pedidos";
import { Toaster } from 'react-hot-toast';
// import './Style/App.css';

function App() {
  return (
    
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/entregadores" element={<Entregadores />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/cardapio" element={<Cardapio />} />
        <Route path="/alterar-pedidos/:id" element={<AlterarPedidos />} />

      </Routes>
    </Router>
  )
}

export default App;