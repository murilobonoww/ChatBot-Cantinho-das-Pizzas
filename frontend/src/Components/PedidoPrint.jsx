function PedidoPrint({ pedido }) {
  return (
    <div id="print">
      <h3>Cantinho das Pizzas</h3>
      <p>Pedido #{pedido.id_pedido}</p>

      <p>
        {new Date().toLocaleString("pt-BR")}
      </p>

      <hr />

      <p><b>Cliente:</b> {pedido.nome_cliente}</p>
      <p><b>Endereço:</b> {pedido.endereco_entrega}</p>

      <hr />

      {pedido.itens.map((i, idx) => (
        <p key={idx}>
          {i.quantidade}x {i.produto} {i.sabor} - R${i.preco}
        </p>
      ))}

      <hr />

      <p><b>Total:</b> R$ {pedido.preco_total}</p>
      <p>Pagamento: {pedido.forma_pagamento}</p>
    </div>
  );
}

export default PedidoPrint;