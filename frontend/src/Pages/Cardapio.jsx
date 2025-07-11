import { Link } from "react-router-dom";
import "../Style/Cardapio.css";

export default function Cardapio() {
  return (
    <div className="cardapio-container">
      <h1>Escolha uma categoria do cardápio:</h1>
      <div className="cardapio-links">
        <Link to="/cardapio/pizzas" className="cardapio-link">Pizzas</Link>
        <Link to="/cardapio/esfihas" className="cardapio-link">Esfihas</Link>
        <Link to="/cardapio/bebidas" className="cardapio-link">Bebidas</Link>
        <Link to="/cardapio/outros" className="cardapio-link">Outros</Link>
      </div>
    </div>
  );
}
