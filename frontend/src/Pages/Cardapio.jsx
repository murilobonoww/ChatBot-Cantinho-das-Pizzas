import React, { useEffect, useState } from "react";
import "../Style/Cardapio.css"; // Corrigido o caminho para o CSS
import voltar from "../assets/voltar.png"; // Corrigido o caminho para o ícone de voltar
import { Link } from "react-router-dom";

export default function Cardapio() {
    const [cardapio, setCardapio] = useState({ pizzas: [], esfihas: [] });
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");

    useEffect(() => {
        fetch("http://localhost:3000/cardapio")
            .then(res => {
                if (!res.ok) throw new Error("Erro ao carregar cardápio");
                return res.json();
            })
            .then(data => {
                setCardapio(data);
                setLoading(false);
            })
            .catch(err => {
                setErro(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) return <div>Carregando cardápio...</div>;
    if (erro) return <div>Erro: {erro}</div>;

    return (
        <div className="cardapio-container">
            <Link to="/" className="btn-fechar">
                <img id="voltar_icone" src={voltar} alt="Pedidos" />
            </Link>
            <h1>Cardápio</h1>

            <div className="secao-cardapio">
                <h2>Pizzas</h2>
                <div className="card-grid">
                    {cardapio.pizzas.map(pizza => (
                        <div className="card-item" key={pizza.id}>
                            <div className="sabor">{pizza.sabor}</div>
                            <div className="ingredientes">Ingredientes: {pizza.ingredientes}</div>
                            <div className="precos">
                                25cm: R$ {(Number(pizza.preco_25) || 0).toFixed(2)} | 35cm: R$ {(Number(pizza.preco_35) || 0).toFixed(2)}
                            </div>

                        </div>
                    ))}
                </div>
            </div>

            <div className="secao-cardapio">
                <h2>Esfihas</h2>
                <div className="card-grid">
                    {cardapio.esfihas.map(esfiha => (
                        <div className="card-item" key={esfiha.id}>
                            <div className="sabor">{esfiha.sabor}</div>
                            <div className="ingredientes"></div>
                            <div className="precos">{(Number(esfiha.preco) || 0).toFixed(2)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
