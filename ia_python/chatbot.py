import spacy
import re

nlp = spacy.load("pt_core_news_sm")

# Cardápio com preços por tamanho
cardapio = {
    "alho": {"preco": (32, 42), "ingredientes": ["molho", "muçarela", "alho frito"]},
    "atum 1": {"preco": (34, 57), "ingredientes": ["molho", "muçarela", "atum", "cebola"]},
    "atum 2": {"preco": (35, 55), "ingredientes": ["molho", "atum", "cebola"]},
    "bacon": {"preco": (28, 47), "ingredientes": ["molho", "muçarela", "bacon"]},
    "baiana 1": {"preco": (29, 45), "ingredientes": ["molho", "muçarela", "calabresa", "cebola", "pimenta"]},
    "baiana 2": {"preco": (30, 50), "ingredientes": ["molho", "calabresa", "cebola", "pimenta", "ovo"]},
    "batata palha": {"preco": (30, 42), "ingredientes": ["molho", "muçarela", "batata palha"]},
    "bauru": {"preco": (29, 48), "ingredientes": ["molho", "muçarela", "presunto", "tomate"]},
    "brócolis": {"preco": (35, 51), "ingredientes": ["molho", "muçarela", "brócolis", "catupiry"]},
    "caipira": {"preco": (38, 55), "ingredientes": ["molho", "frango", "milho", "catupiry"]},
    "calabacon": {"preco": (35, 50), "ingredientes": ["molho", "calabresa", "bacon", "muçarela"]},
    "calabresa 1": {"preco": (26, 39), "ingredientes": ["molho", "muçarela", "calabresa", "cebola"]},
    "calabresa 2": {"preco": (32, 46), "ingredientes": ["molho", "calabresa", "cebola"]},
    "carne seca 1": {"preco": (35, 55), "ingredientes": ["molho", "muçarela", "carne seca", "cebola"]},
    "carne seca 2": {"preco": (38, 60), "ingredientes": ["molho", "carne seca", "catupiry"]},
    "catubresa": {"preco": (33, 48), "ingredientes": ["molho", "calabresa", "catupiry", "muçarela"]},
    "champion": {"preco": (30, 45), "ingredientes": ["molho", "muçarela", "champignon"]},
    "cinco queijos": {"preco": (38, 60), "ingredientes": ["molho", "muçarela", "catupiry", "provolone", "gorgonzola", "parmesão"]},
    "cubana": {"preco": (35, 48), "ingredientes": ["molho", "presunto", "banana", "canela", "açúcar"]},
    "dois queijos": {"preco": (31, 45), "ingredientes": ["molho", "muçarela", "catupiry"]},
    "escarola": {"preco": (31, 48), "ingredientes": ["molho", "escarola refogada", "muçarela"]},
    "frango 1": {"preco": (32, 49), "ingredientes": ["molho", "muçarela", "frango"]},
    "frango 2": {"preco": (32, 49), "ingredientes": ["molho", "frango", "catupiry"]},
    "frango 3": {"preco": (32, 49), "ingredientes": ["molho", "frango", "requeijão", "milho"]},
    "hot-dog": {"preco": (35, 50), "ingredientes": ["molho", "salsicha", "milho", "batata palha", "ketchup", "mostarda"]},
    "lombo 1": {"preco": (35, 52), "ingredientes": ["molho", "muçarela", "lombo canadense"]},
    "lombo 2": {"preco": (38, 55), "ingredientes": ["molho", "lombo", "catupiry"]},
    "marguerita": {"preco": (32, 48), "ingredientes": ["molho", "muçarela", "tomate", "manjericão"]},
    "meio a meio": {"preco": (26, 39), "ingredientes": ["escolha 2 sabores"]},
    "mexicana": {"preco": (33, 45), "ingredientes": ["molho", "carne moída", "milho", "pimenta", "cebola"]},
    "mucabresa": {"preco": (32, 45), "ingredientes": ["molho", "muçarela", "calabresa"]},
    "muçarela": {"preco": (26, 39), "ingredientes": ["molho", "muçarela"]},
    "palmito 1": {"preco": (32, 50), "ingredientes": ["molho", "muçarela", "palmito"]},
    "palmito 2": {"preco": (35, 55), "ingredientes": ["molho", "palmito", "catupiry"]},
    "peperone": {"preco": (35, 58), "ingredientes": ["molho", "muçarela", "peperone"]},
    "portuguesa": {"preco": (32, 48), "ingredientes": ["molho", "muçarela", "presunto", "ovo", "cebola", "azeitona", "pimentão"]},
    "à moda": {"preco": (35, 55), "ingredientes": ["molho", "muçarela", "presunto", "calabresa", "bacon", "ovo", "cebola", "azeitona"]},
    "toscana": {"preco": (30, 46), "ingredientes": ["molho", "muçarela", "linguiça toscana"]},
    "três queijos 1": {"preco": (32, 46), "ingredientes": ["molho", "muçarela", "catupiry", "provolone"]},
    "três queijos 2": {"preco": (33, 49), "ingredientes": ["molho", "muçarela", "gorgonzola", "catupiry"]},
    "quatro queijos": {"preco": (35, 54), "ingredientes": ["molho", "muçarela", "catupiry", "provolone", "gorgonzola"]},
    "banana": {"preco": (None, None), "ingredientes": ["banana", "canela", "açúcar"]},
    "brigadeiro": {"preco": (33, 45), "ingredientes": ["chocolate", "granulado"]},
    "carmela": {"preco": (31, 43), "ingredientes": ["banana", "doce de leite", "canela"]},
    "romeu e julieta": {"preco": (35, 55), "ingredientes": ["goiabada", "muçarela"]},
    "morango": {"preco": (30, 45), "ingredientes": ["chocolate", "morango"]},
    "mm's": {"preco": (33, 50), "ingredientes": ["chocolate", "MM's"]},
    "ovo maltine": {"preco": (35, 55), "ingredientes": ["chocolate", "Ovomaltine"]},
    "prestígio": {"preco": (31, 43), "ingredientes": ["chocolate", "coco ralado"]},
    "chocolate": {"preco": (29, 40), "ingredientes": ["chocolate"]}
}


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

    frase_normalizada = frase.lower().replace("-", " ").replace(" e ", " e ")
    entidades = {"tamanho": None, "sabores": [], "borda": None}

    # Sabores
    for sabor in cardapio:
        if sabor in frase_normalizada and sabor not in entidades["sabores"]:
            entidades["sabores"].append(sabor)

    # Tamanhos
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
            print("Bot: Temos os seguintes sabores disponíveis:")
            print("pdf do cardápio mandado...")
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