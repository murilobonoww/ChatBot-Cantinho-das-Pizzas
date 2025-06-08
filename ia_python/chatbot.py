import spacy
import re
import mysql.connector

nlp = spacy.load("pt_core_news_sm")

# Conexão com banco de dados
def conectar_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="1234",
        database="pizzaria"
    )

# Buscar sabores do banco
def obter_sabores_db():
    conn = conectar_db()
    cursor = conn.cursor()
    cursor.execute("SELECT sabor FROM pizzas")
    sabores = [linha[0].lower() for linha in cursor.fetchall()]
    conn.close()
    return sabores

# Intenções
def detectar_intencao(frase):
    frase = frase.lower()
    if any(p in frase for p in ["pizza", "quero", "gostaria", "me vê", "pedir"]):
        return "pedir_pizza"
    elif any(p in frase for p in ["sim", "confirmar", "isso", "isso mesmo", "ok", "tá bom", "ta bom"]):
        return "confirmar_pedido"
    elif any(p in frase for p in ["sem borda", "sem recheio"]):
        return "sem_borda"
    elif any(p in frase for p in ["cardápio", "cardapio", "menu", "sabores", "opções", "tem o que", "quais pizzas", "quais sabores"]):
        return "ver_cardapio"
    elif any(p in frase for p in ["cancelar", "desistir", "apagar", "resetar", "cancela", "cancele"]):
        return "cancelar_pedido"
    elif any(p in frase for p in ["status", "rastrear", "acompanhar", "onde está"]):
        return "rastrear_pedido"
    elif any(p in frase for p in ["oi", "olá", "opa", "bom dia", "boa tarde", "boa noite", "eae", "e aí", "fala"]):
        return "saudacao"
    return "intencao_indefinida"

# Entidades
def extrair_entidades(frase):
    doc = nlp(frase.lower())
    tamanhos = ["25cm", "35cm", "25", "35", "média", "media", "grande"]
    bordas = ["cheddar", "catupiry", "recheada"]
    sabores_disponiveis = obter_sabores_db()

    frase_normalizada = frase.lower().replace("-", " ").replace(" e ", " e ")
    entidades = {"tamanho": None, "sabores": [], "borda": None}

    # Sabores
    for sabor in sabores_disponiveis:
        if sabor in frase_normalizada and sabor not in entidades["sabores"]:
            entidades["sabores"].append(sabor)

    # Tamanhos e bordas
    for token in doc:
        t = token.text.lower()
        if t in tamanhos:
            entidades["tamanho"] = t
        if t in bordas:
            entidades["borda"] = t

    return entidades

# Chatbot principal
def iniciar_chat():
    print("Chatbot Pizzaria 🍕 - Digite 'sair' para encerrar")
    pedido_atual = {"tamanho": None, "sabores": [], "borda": None}
    coletando_pedido = False
    aguardando_confirmacao = False

    while True:
        entrada = input("Você: ")
        if entrada.lower() in ["sair", "exit", "quit"]:
            print("Bot: Até a próxima!")
            break

        intencao = detectar_intencao(entrada)
        entidades = extrair_entidades(entrada)

        if entidades["tamanho"]:
            pedido_atual["tamanho"] = entidades["tamanho"]
        if entidades["sabores"]:
            pedido_atual["sabores"].extend([s for s in entidades["sabores"] if s not in pedido_atual["sabores"]])
        if entidades["borda"]:
            pedido_atual["borda"] = entidades["borda"]

        if intencao == "saudacao":
            if any(p in entrada.lower() for p in ["pizza", "quero", "me vê", "gostaria"]):
                intencao = "pedir_pizza"
            else:
                print("Bot: Olá! Seja bem-vindo ao Cantinho das Pizzas e do Açaí. Posso ajudar com seu pedido?")
                continue

        if intencao == "ver_cardapio":
            sabores = obter_sabores_db()
            print("Bot: Enviaremos o cardápio em PDF. Aguarde um instante...")
            print(">>> (Simulação) Enviando PDF do cardápio...")
            continue

        if intencao == "cancelar_pedido":
            pedido_atual = {"tamanho": None, "sabores": [], "borda": None}
            coletando_pedido = False
            aguardando_confirmacao = False
            print("Bot: Pedido cancelado. Deseja recomeçar?")
            continue

        if intencao == "rastrear_pedido":
            print("Bot: Seu pedido está a caminho. Previsão de entrega: 30 minutos.")
            continue

        if intencao == "sem_borda" and coletando_pedido and not pedido_atual["borda"]:
            pedido_atual["borda"] = "sem borda"

        if intencao == "confirmar_pedido" and aguardando_confirmacao:
            print("Bot: Pedido confirmado! Sua pizza está sendo preparada 🍕")
            pedido_atual = {"tamanho": None, "sabores": [], "borda": None}
            coletando_pedido = False
            aguardando_confirmacao = False
            continue

        if intencao == "pedir_pizza" or coletando_pedido:
            coletando_pedido = True

            faltando = []
            if not pedido_atual["tamanho"]:
                faltando.append("tamanho")
            if not pedido_atual["sabores"]:
                faltando.append("sabor")
            if not pedido_atual["borda"]:
                faltando.append("borda")

            if not faltando:
                sabores = ", ".join(pedido_atual["sabores"])
                print(f"Bot: Pedido completo! Uma pizza {pedido_atual['tamanho']} de {sabores} com borda {pedido_atual['borda']}. Confirmar?")
                aguardando_confirmacao = True
            else:
                partes = []
                if pedido_atual["sabores"]:
                    partes.append("sabor anotado")
                if pedido_atual["tamanho"]:
                    partes.append("tamanho anotado")
                if pedido_atual["borda"]:
                    partes.append("borda anotada")

                if partes:
                    print(f"Bot: {', '.join(partes)}. Agora me diga: " + ', '.join(faltando) + ".")
                else:
                    print("Bot: Qual o tamanho (25cm ou 35cm), sabor e borda da pizza?")

        else:
            print("Bot: Desculpe, não entendi. Pode repetir de outra forma?")

if __name__ == "__main__":
    iniciar_chat()
