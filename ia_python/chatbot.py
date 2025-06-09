import spacy
import re
import mysql.connector
from datetime import datetime

nlp = spacy.load("pt_core_news_sm")

# Conexão com banco de dados
def conectar_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="1234",
        database="pizzaria"
    )

def saudacao_por_horario():
    hora_atual = datetime.now().hour
    if 5 <= hora_atual < 12:
        return "Bom dia"
    elif 12 <= hora_atual < 18:
        return "Boa tarde"
    else:
        return "Boa noite"

# Buscar sabores do banco (pizzas + esfihas)
def obter_sabores_db():
    conn = conectar_db()
    cursor = conn.cursor()

    # Pegar sabores de pizzas
    cursor.execute("SELECT sabor FROM pizzas")
    sabores_pizzas = [linha[0].lower() for linha in cursor.fetchall()]

    # Pegar sabores de esfihas
    cursor.execute("SELECT sabor FROM esfihas")
    sabores_esfihas = [linha[0].lower() for linha in cursor.fetchall()]

    conn.close()
    return sabores_pizzas + sabores_esfihas


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
    elif any(p in frase for p in ["oi", "olá", "ola", "opa", "bom dia", "boa tarde", "boa noite", "eae", "eai", "eaí", "e aí", "fala"]):
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

    # Sabores (pizzas ou esfihas)
    for sabor in sabores_disponiveis:
        if sabor in frase_normalizada and sabor not in entidades["sabores"]:
            entidades["sabores"].append(sabor)

    # Tamanho e borda
    for token in doc:
        t = token.text.lower()
        if t in tamanhos:
            entidades["tamanho"] = t
        if t in bordas:
            entidades["borda"] = t

    return entidades


# Nova função para identificar tipo do pedido
def identificar_tipo_pedido(frase):
    if "esfiha" in frase.lower():
        return "esfiha"
    elif "pizza" in frase.lower():
        return "pizza"
    return "indefinido"

# ... [códigos anteriores mantidos] ...

# Buscar variações de um sabor genérico
def buscar_variacoes_sabor(sabor_base):
    conn = conectar_db()
    cursor = conn.cursor()

    consulta = """
        SELECT sabor FROM pizzas WHERE LOWER(sabor) LIKE %s
        UNION
        SELECT sabor FROM esfihas WHERE LOWER(sabor) LIKE %s
    """
    like_param = f"%{sabor_base.lower()}%"
    cursor.execute(consulta, (like_param, like_param))
    variacoes = [linha[0] for linha in cursor.fetchall()]
    conn.close()
    return variacoes


# Lista de sabores genéricos que possuem múltiplas versões
sabores_com_variacoes = ["atum", "três queijos", "palmito", "lombo", "frango", "carne seca", "calabresa", "baiana"]

def iniciar_chat():
    print("Chatbot Pizzaria 🍕 - Digite 'sair' para encerrar")
    pedido_atual = {"tipo": None, "tamanho": None, "sabores": [], "borda": None}
    coletando_pedido = False
    aguardando_confirmacao = False
    aguardando_variacao = None  # ← Novo estado

    while True:
        entrada = input("Você: ")
        if entrada.lower() in ["sair", "exit", "quit"]:
            print("Bot: Até a próxima!")
            break

        # Se estamos aguardando variação de sabor
        if aguardando_variacao:
            variacoes = buscar_variacoes_sabor(aguardando_variacao)
            escolha = entrada.strip().lower()

            # Verifica se a resposta do cliente corresponde a alguma variação
            encontrada = None
            for v in variacoes:
                if escolha in v.lower():
                    encontrada = v
                    break

            if encontrada:
                if encontrada.lower() not in pedido_atual["sabores"]:
                    pedido_atual["sabores"].append(encontrada.lower())
                print(f"Bot: Sabor registrado: {encontrada}.")
            else:
                print("Bot: Não encontrei essa variação. Por favor, escolha uma das seguintes:")
                for v in variacoes:
                    print(f"- {v}")
                continue  # Ainda aguardando variação

            aguardando_variacao = None  # Reset
            continue  # Volta ao loop principal

        intencao = detectar_intencao(entrada)
        entidades = extrair_entidades(entrada)
        tipo = identificar_tipo_pedido(entrada)

        # Atualiza tipo do pedido se identificado
        if tipo != "indefinido":
            pedido_atual["tipo"] = tipo

        if entidades["tamanho"]:
            pedido_atual["tamanho"] = entidades["tamanho"]
        if entidades["borda"]:
            pedido_atual["borda"] = entidades["borda"]

        # Verifica sabores com variações
        for sabor in entidades["sabores"]:
            if pedido_atual["tipo"] is None:
                print("Bot: Você gostaria de uma pizza ou uma esfiha?")
                pedido_atual["sabores"] = []  # limpa sabores até saber tipo
                break

            if any(sabor_base in sabor for sabor_base in sabores_com_variacoes):
                variacoes = buscar_variacoes_sabor(sabor)

        # Filtrar variações pelo tipo correto (pizza ou esfiha)
            if pedido_atual["tipo"] == "pizza":
                variacoes = [v for v in variacoes if v.lower() in obter_sabores_db()[:len(obter_sabores_db())//2]]  # pizzas
            elif pedido_atual["tipo"] == "esfiha":
                variacoes = [v for v in variacoes if v.lower() in obter_sabores_db()[len(obter_sabores_db())//2:]]  # esfihas

            if len(variacoes) > 1:
                aguardando_variacao = sabor
                print(f"Bot: Existem várias opções para '{sabor}'. Qual delas você deseja?")
                for v in variacoes:
                    print(f"- {v}")
                print("Bot: Você gostaria de ver os ingredientes de cada uma?")
                break  # aguarda resposta antes de continuar
            else:
                if sabor not in pedido_atual["sabores"]:
                    pedido_atual["sabores"].append(sabor)

                


        if intencao == "saudacao":
            if any(p in entrada.lower() for p in ["pizza", "quero", "me vê", "gostaria"]):
                intencao = "pedir_pizza"
            else:
                print(f"Bot: {saudacao_por_horario()}! Posso ajudar com seu pedido?")
                continue

        if intencao == "ver_cardapio":
            print("Bot: Enviaremos o cardápio em PDF. Aguarde um instante...")
            print(">>> (Simulação) Enviando PDF do cardápio...")
            continue

        if intencao == "cancelar_pedido":
            pedido_atual = {"tipo": None, "tamanho": None, "sabores": [], "borda": None}
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
            print(f"Bot: Pedido confirmado! Sua {pedido_atual['tipo']} está sendo preparada 🍽️")
            pedido_atual = {"tipo": None, "tamanho": None, "sabores": [], "borda": None}
            coletando_pedido = False
            aguardando_confirmacao = False
            continue

        if intencao == "pedir_pizza" or coletando_pedido:
            coletando_pedido = True

            if not pedido_atual["tipo"]:
                print("Bot: Você gostaria de uma pizza ou uma esfiha?")
                continue

            faltando = []
            if pedido_atual["tipo"] == "pizza":
                if not pedido_atual["tamanho"]:
                    faltando.append("tamanho")
                if not pedido_atual["sabores"]:
                    faltando.append("sabor")
                if not pedido_atual["borda"]:
                    faltando.append("borda")
            elif pedido_atual["tipo"] == "esfiha":
                if not pedido_atual["sabores"]:
                    faltando.append("sabor")

            if not faltando:
                sabores = ", ".join(pedido_atual["sabores"])
                if pedido_atual["tipo"] == "pizza":
                    print(f"Bot: Pedido completo! Uma pizza {pedido_atual['tamanho']} de {sabores} com borda {pedido_atual['borda']}. Confirmar?")
                elif pedido_atual["tipo"] == "esfiha":
                    print(f"Bot: Pedido completo! Uma esfiha de {sabores}. Confirmar?")
                aguardando_confirmacao = True
            else:
                partes = []
                if pedido_atual["sabores"]:
                    partes.append("sabor anotado")
                if pedido_atual["tamanho"]:
                    partes.append("tamanho anotado")
                if pedido_atual["borda"]:
                    partes.append("borda anotada")

                faltando_texto = ', '.join(faltando)
                if partes:
                    print(f"Bot: {', '.join(partes)}. Agora me diga: {faltando_texto}.")
                else:
                    if pedido_atual["tipo"] == "pizza":
                        print("Bot: Qual o tamanho (25cm ou 35cm), sabor e borda da pizza?")
                    else:
                        print("Bot: Qual sabor da esfiha você deseja?")
        else:
            print("Bot: Desculpe, não entendi. Pode repetir de outra forma?")



if __name__ == "__main__":
    iniciar_chat()
