
modelo do payload:

{
    delivery: bool
    orderId: int
    items: Obj[]
    total: float
    taxa_entrega: float
    cliente: str
    endereco_entrega: str
    subtotal: float
    pagamento: str
}

1- rm -rf node_modules
2- rm -rf dist
3- buildar front dnv e pegar dist dele
4- colar dist nesta raiz
5- npm ci
6- npm run build