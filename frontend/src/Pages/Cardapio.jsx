import React, { useEffect, useState, useRef } from "react";
import "../Style/Cardapio.css";
import { Link } from "react-router-dom";

export default function Cardapio() {
    const [cardapio, setCardapio] = useState({ pizzas: [], esfihas: [], bebidas: [], doces: [] });
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");
    const [busca, setBusca] = useState("");
    const InputRef = useRef(null);
    const topoFixoRef = useRef(null);

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

    useEffect(() => {
        if (!loading && InputRef.current) {
            InputRef.current.focus();
        }
    }, [loading]);

    const realceTexto = (texto) => {
        if (!busca) return texto;
        const regex = new RegExp(`(${busca})`, 'gi');
        return texto.replace(regex, '<mark>$1</mark>');
    };

    const filtrarItens = (lista) => {
        return lista.filter(item => {
            const campoSabor = item.sabor || item.nome || "";
            const campoIngredientes = item.ingredientes || "";
            return (
                campoSabor.toLowerCase().includes(busca.toLowerCase()) ||
                campoIngredientes.toLowerCase().includes(busca.toLowerCase())
            );
        });
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

    if (loading) return <div>Carregando cardápio...</div>;
    if (erro) return <div>Erro: {erro}</div>;

    return (
        <div className="cardapio-container">
            <div className="topo-fixo" ref={topoFixoRef}>
                <div className="topo-fixo-container">
                    <h1>Cardápio</h1>
                    <input
                        type="text"
                        placeholder="Buscar sabor ou ingrediente..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="input-busca"
                        ref={InputRef}
                    />
                    <div className="atalhos-container">
                        <button
                            className="atalho-btn"
                            onClick={() => scrollToSection("pizzas-section")}
                        >
                            Pizzas
                        </button>
                        <button
                            className="atalho-btn"
                            onClick={() => scrollToSection("esfihas-section")}
                        >
                            Esfihas
                        </button>
                        <button
                            className="atalho-btn"
                            onClick={() => scrollToSection("bebidas-section")}
                        >
                            Bebidas
                        </button>
                        <button
                            className="atalho-btn"
                            onClick={() => scrollToSection("doces-section")}
                        >
                            Doces
                        </button>
                    </div>
                </div>
            </div>

            <div className="conteudo-rolavel">
                <div className="secao-cardapio" id="pizzas-section">
                    <h2>Pizzas</h2>
                    <div className="card-grid">
                        {filtrarItens(cardapio.pizzas).map(pizza => (
                            <div className="card-item" key={pizza.id}>
                                <div
                                    className="sabor"
                                    dangerouslySetInnerHTML={{ __html: realceTexto(pizza.sabor) }}
                                />
                                <div
                                    className="ingredientes"
                                    dangerouslySetInnerHTML={{ __html: realceTexto(pizza.ingredientes || "") }}
                                />
                                <div className="precos">
                                    25cm: R$ {(Number(pizza.preco_25) || 0).toFixed(2)} | 35cm: R$ {(Number(pizza.preco_35) || 0).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="secao-cardapio" id="esfihas-section">
                    <h2>Esfihas</h2>
                    <div className="card-grid">
                        {filtrarItens(cardapio.esfihas).map(esfiha => (
                            <div className="card-item" key={esfiha.id}>
                                <div
                                    className="sabor"
                                    dangerouslySetInnerHTML={{ __html: realceTexto(esfiha.sabor) }}
                                />
                                <div className="ingredientes" />
                                <div className="precos">
                                    R$ {(Number(esfiha.preco) || 0).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="secao-cardapio" id="bebidas-section">
                    <h2>Bebidas</h2>
                    <div className="card-grid">
                        {filtrarItens(cardapio.bebidas || []).map(bebida => (
                            <div className="card-item" key={bebida.id}>
                                <div
                                    className="sabor"
                                    dangerouslySetInnerHTML={{ __html: realceTexto(bebida.nome) }}
                                />
                                <div
                                    className="tamanho_bebidas"
                                    dangerouslySetInnerHTML={{ __html: realceTexto(bebida.tamanho) }}
                                />
                                <div className="precos">
                                    R$ {(Number(bebida.preco) || 0).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="secao-cardapio" id="doces-section">
                    <h2>Doces</h2>
                    <div className="card-grid">
                        {filtrarItens(cardapio.doces || []).map(doce => (
                            <div className="card-item" key={doce.id}>
                                <div
                                    className="sabor"
                                    dangerouslySetInnerHTML={{ __html: realceTexto(doce.nome) }}
                                />
                                <div className="precos">
                                    R$ {(Number(doce.preco) || 0).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}