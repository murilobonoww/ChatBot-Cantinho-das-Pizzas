import { Routes, Route } from "react-router-dom";
import PrivateRoute from "@/Components/PrivateRoute";
import Home from "@/Pages/Home";
import Pedidos from "@/Pages/Pedidos";
import Relatorios from "@/Pages/Relatorios";
import Cardapio from "@/Pages/Cardapio";
import Login from "@/Pages/Login";

export default function AppRoutes({ pedidos, setPedidos }) {
    return(
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={ <PrivateRoute> <Home /> </PrivateRoute> } />
        <Route path="/pedidos" element={ <PrivateRoute> <Pedidos pedidos={pedidos} setPedidos={setPedidos} /> </PrivateRoute> } />
        <Route path="/relatorios" element={ <PrivateRoute> <Relatorios /> </PrivateRoute> } />
        <Route path="/cardapio" element={ <PrivateRoute> <Cardapio /> </PrivateRoute> } />
      </Routes>
    )
}