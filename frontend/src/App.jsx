import React from "react";
import Home from "./Pages/Home";
import Pedidos from "./Pages/Pedidos";
import Entregadores from "./Pages/Motoboys";
import Relatorios from "./Pages/Relatorios";
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/pedidos" element={<Pedidos/>}/>
        <Route path="/entregadores" element={<Entregadores/>}/>
        <Route path="/relatorios" element={<Relatorios/>}/>
      </Routes>
    </Router>
  )
}

export default App;