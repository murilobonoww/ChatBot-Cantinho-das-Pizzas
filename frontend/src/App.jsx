import React from "react";
import Home from "./Pages/Home";
import Pedidos from "./Pages/Pedidos";
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/pedidos" element={<Pedidos/>}/>
      </Routes>
    </Router>
  )
}

export default App;