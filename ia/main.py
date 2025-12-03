import copy
import eventlet
eventlet.monkey_patch()
import asyncio
from datetime import datetime, timedelta
import pytz
from fastapi import FastAPI, WebSocket, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from time import sleep
import traceback
import requests
from openai import OpenAI
import pymysql
from pymysql.cursors import DictCursor
from dotenv import load_dotenv
import os
import re
import json
import uuid
import uvicorn
from typing import Dict, List
from pydantic import BaseModel
import threading
# from rabbitmq import publish_message

app = FastAPI()

mensagens_nao_respondidas = {}  
usuario_processando = set()

# Configuração do CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://cantinho-das-pizzas.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

keys = [
    "MAPS_API_KEY", "GPT_API_KEY", "DB_PASS", "DB_NAME", "DB_HOST", "DB_USER", "DB_PORT","APP_ID",
    "WHATSAPP_ACCESS_TOKEN", "FONE_ID", "CLIENT_SECRET", "WEBHOOK_VERIFY_TOKEN", "MEDIA_ID", "GETNET_ACCESS_TOKEN", "AUTH"
]

(
    maps_api_key,
    gpt_api_key,
    db_pass,
    db_name,
    db_host,
    db_user,
    db_port,
    app_id,
    access_token,
    fone_id,
    client_secret,
    webhook_verify_token,
    media_id,
    getnet_access_token,
    auth
) = map(os.getenv, keys)

print(f"🔑 access_token: {access_token}")
print(f"🔑 fone_id: {fone_id}")

client = OpenAI(api_key=gpt_api_key)
historico_usuarios: Dict[str, List[dict]] = {}
notificacoes_ativas: Dict[str, dict] = {}
websocket_connections: List[WebSocket] = []
last_msgs: Dict[str, str] = {}
last_msg_text = ""

getnet_url_generate_payment_link = "https://api-homologacao.getnet.com.br/v1/payment-links"

num_orders = []
processed_ids = set()

def associar_order_ids_a_numeros (num, order_id):
    num_orders.append({'num': f"{num}", 'order_id': order_id})
    print("num_orders logo após inserção:",num_orders)
    # threading.Timer(60 * 60, remover_num, args=[num]).start()
    
def remover_num (num): #isto é pra remover da memória os pedidos que (provavelmente) já foram entregues
    obj = next((o for o in num_orders if o['num'] == num), None)
    if obj:
        num_orders.remove(obj)
        
def get_order_id_from_num (num):
    orderIDS_list = []
    
    for o in num_orders:
        if o['num'] == num:
            orderIDS_list.append(o['order_id'])
            
    orderIDS_list.sort(reverse=True)
    return orderIDS_list[0]


def setTokensToGetnet ():
    url_ = "https://api-homologacao.getnet.com.br/auth/oauth/v2/token"
    header_t = {
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/x-www-form-urlencoded"}
    
    payload_t = {
        "scope": "oob",
        "grant_type": "client_credentials"}
    
    response = requests.post(url=url_, headers=header_t, data=payload_t)
    if(response.status_code == 200):
        token = (response.json()).get("access_token")
        return token
    else:
        print("Erro ao gerar token", response.text)
        return None

def generate_GetNet_payment_link (token, total_pedido, frete, json_pedido):
    headers_payment_link = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json; charset=utf-8"
    }
    expiration = (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"

    payload = {
        "label": "teste_pedido",
        "expiration": expiration,
        "max_orders": 1,
        "order": {
            "product_type": "physical_goods",
            "title": "Pedido",  
            "description": "Pagamento do pedido",
            "order_prefix": "order-",
            "shipping_amount": int(frete*100),
            "amount": int((total_pedido-frete)*100)
        },
        "payment": {
            "credit": {
                "enable": True,
                "max_installments": 1,
                "not_authenticated": False,
                "authenticated": True
            },
            "debit": {
            "enable": True,
            "caixa_virtual_card": False,
            "not_authenticated": False,
            "authenticated": True
            },
            "pix": {
                "enable": True
            }
        }
    }

    response = requests.post(url=getnet_url_generate_payment_link, headers=headers_payment_link, json=payload)
    link_id = (response.json()).get("link_id")
    payment_link = (response.json()).get("url")
    # publish_message("fila_pagamentos", {"orderID": pegar_ultimo_id_pedido()+1, "link": payment_link, "link_id": link_id, "json_pedido": json_pedido})
    
    return payment_link

def conectar_banco():
    return pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_pass,
        database=db_name,
        port=11367,
        cursorclass=DictCursor  
    )

def conectar_db(): #função criada para evitar múltiplas linhas de código repetidas
    conn = conectar_banco()
    cursor = conn.cursor()
    return conn, cursor

def enviar_pdf_para_cliente(numero_cliente):
    token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    phone_number_id = os.getenv("FONE_ID")
    media_id = carregar_media_id()

    if not media_id:
        print("❌ Não foi possível enviar o cardápio (media_id inválido)")
        return

    url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    body = {
        "messaging_product": "whatsapp",
        "to": numero_cliente,
        "type": "document",
        "document": {
            "id": media_id,
            "caption": "Aqui está o nosso menu completo 🍕📖\n\n",
            "filename": "cardapio.pdf"
        }
    }

    response = requests.post(url, headers=headers, json=body)
    print("✅ PDF enviado:", response.json())

def consultar_preco(sabor, tipo):
    try:
        conn, cursor = conectar_db() 

        if tipo == "pizzas":
            query = f"""SELECT sabor, preco_25, preco_35 FROM {tipo} WHERE sabor = '{sabor}'"""
        elif tipo == "esfihas":
            query = f"""SELECT sabor, preco FROM {tipo} WHERE sabor = '{sabor}'"""
        else:
            query = f"""SELECT nome, preco FROM {tipo} WHERE nome = '{sabor}'"""
        
        cursor.execute(query)
        
        results = cursor.fetchall()
        conn.commit()
        cursor.close()
        conn.close()
        return results
    
    except Exception as e:
        print(f"Erro ao buscar no database: {e}")
        
def consultar_ingredientes(sabor):
    try:
        conn, cursor = conectar_db()
        
        query = f""" SELECT sabor, ingredientes FROM pizzas WHERE sabor = '{sabor}' """
        
        cursor.execute(query)
        
        results = cursor.fetchall()
        conn.commit()
        cursor.close()
        conn.close()
        return results
    
    except Exception as e:
        print(f"Erro ao buscar no database: {e}")

def get_sabores_or_nomes_from_db(tipo):
    lista_sabores = []
    try:
        conn, cursor = conectar_db()

        match tipo:
            case "pizzas" | "esfihas":
                query = f"select sabor from {tipo}" #tipos: pizzas, esfihas, bebidas, doces e outros
            case _:
                query = f"select nome from {tipo}" #tipos: pizzas, esfihas, bebidas, doces e outros
        
        cursor.execute(query)
        
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        
        for item in results:
            if tipo in ("pizzas", "esfihas"):
                valor = item['sabor']
            else:
                valor = item['nome']
                
            lista_sabores.append(valor)
        
        return lista_sabores
        
    except Exception as e:
        print("erro:", e)

def fetch_produtos():
    categorias = ['pizzas', 'esfihas', 'bebidas', 'doces', 'outros']

    nomes_e_precos = {
            'pizzas': {
                'itens': [],
                'ingredientes': []
            },
            'esfihas': [],
            'bebidas': [],
            'doces': [],
            'outros': []
        }

    for categoria in categorias:
        nomes = get_sabores_or_nomes_from_db(categoria)

        for nome in nomes:
            if categoria == 'pizzas':
                nomes_e_precos['pizzas']['itens'].append(consultar_preco(nome, categoria))
                nomes_e_precos['pizzas']['ingredientes'].append(consultar_ingredientes(nome))
            else:
                nomes_e_precos[categoria].append(consultar_preco(nome, categoria))

    return nomes_e_precos

json_model = """{"endereco": "",
   "pagamento": "",
   "itens": [
     {
       "categoria": "",
       "nome": "",
       "tamanho": "",
       "borda": "",
       "quantidade": 0,
       "preco": 0
     }
   ]
}"""

# Definição do prompt_template
# prompt = [{
#     "role": "system",
#     "content": (
#         "1- IDENTIDADE: Você é Laryssa, assistente virtual da pizzaria Cantinho das Pizzas e do Açaí. Seu objetivo é montar o pedido do cliente de forma rápida, clara e educada."
#         #------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         "2- FLUXO PRINCIPAL DO PEDIDO: O fluxo é sempre nesta ordem - 1.Categoria (pizza, esfiha, bebida, doce, outros); 2.Sabor; 3.Tamanho (se for pizza ou esfiha); 4.Borda (somente pizzas); 5.Quantidade; 6.Fechamento do item; 7.Adicionar mais itens ou finalizar pedido; 8.Pedir endereço; 9.Pedir forma de pagamento; 10.Gerar JSON do pedido; Nunca pule etapas, nunca volte etapas, nunca repita perguntas já respondidas."
#         #-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         "3- REGRAS DE DIÁLOGO: *Nunca repita a mesma pergunta duas vezes - Se o cliente não responder a pergunta atual, repita uma única vez com outra frase. Após isso, siga a conversa assumindo a opção mais neutra possível (ex: sem borda, quantidade 1). *Nunca peça confirmação óbvia: Exemplos proibidos - 'É isso mesmo?' / 'Confirma?' / 'Certo?' *Trate mensagens malformadas como complementos - O usuário pode enviar respostas separadas como: 'Quero pizza' / 'Portuguesa' / 'grande', Você deve interpretar corretamente e continuar o fluxo."
#         #-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         "4- SABORES, TAMANHOS E BORDAS: *PIZZAS - Pergunte SEMPRE borda após tamanho. Opções: cheddar, catupiry, vulcão cheddar, vulcão catupiry, vulcão chocolate, chocolate, muçarela. *ESFIHAS - Não têm borda. Podem ter sabor + quantidade. *BEBIDAS, DOCES E OUTROS: Apenas nome e quantidade."
#         #-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         "5- REGRAS DE QUANTIDADE: Se o cliente disser “quero X pizzas”, use esse X. Se não informar quantidade, pergunte. Se não responder, assuma 1."
#         #-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         "6- QUANDO GERAR O JSON: Você só gera JSON quando: categoria, sabor, tamanho (se aplicável), borda (se aplicável) e quantidade estiverem definidos. Nunca envie JSON incompleto. Nunca envie JSON repetido. Nunca envie dois JSON na mesma resposta."
#         #-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         f"7- MODELO DO JSON: O JSON deve seguir exatamente: {json_model}"
#         #-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         "8- REGRAS DE ENDEREÇO E PAGAMENTO: Após fechar TODOS os itens: 1.Pergunte endereço; 2.Pergunte forma de pagamento; 3.Envie o JSON completo."
#         #-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         "9- TRIGGERS: 1.Se o usuário pedir cardápio, envie o marcador: '[ENVIAR_CARDAPIO_PDF]'; 2.Se o usuário pedir humano/atendente: '[trigger_saudacao_inicial]'"
#         #-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         "10- ESTILO E FALA: Curta, Educada mas direta, Sem parágrafos grandes, Sem firulas, Nunca repita informações, Nunca explique regras internas, Fale sempre como atendente humana educada"
#         #-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#         f"11- PRODUTOS: Nós temos {fetch_produtos()}"
#     )
# }]


prompt = [{
    "role": "system",
    "content": (
        "IDENTIDADE: Você é Laryssa, assistente virtual da pizzaria Cantinho das Pizzas e do Açaí. "
        "Seu papel é montar o pedido do cliente de forma objetiva, educada e sempre seguindo o fluxo abaixo."

        "FLUXO PRINCIPAL: Sempre siga esta ordem fixa — "
        "1.Categoria (pizza, esfiha, bebida, doce, outros); "
        "2.Sabor; "
        "3.Tamanho (se for pizza ou esfiha); "
        "4.Borda (somente pizzas); "
        "5.Quantidade; "
        "6.Fechamento do item; "
        "7.Perguntar se deseja adicionar mais itens; "
        "8.Endereço; "
        "9.Forma de pagamento; "
        "10.Gerar o JSON final. "
        "Nunca pule etapas e nunca volte etapas."

        "REGRA ABSOLUTA PARA EVITAR FLOOD: "
        "Você só deve responder quando o cliente enviar uma nova mensagem que avance o fluxo. "
        "Se o cliente não responder, ficar em silêncio, enviar repetição ou algo sem relação com o fluxo atual, "
        "NÃO repita a pergunta, NÃO reformule, NÃO insista e NÃO envie mensagens extras. "
        "Se a mensagem não ajudar a avançar, simplesmente aguarde a próxima."

        "NUNCA repetir perguntas. NUNCA perguntar novamente. NUNCA tentar forçar uma resposta. "
        "Jamais envie duas mensagens seguidas sem que o cliente envie algo primeiro."

        "QUANDO O CLIENTE RESPONDE INCOMPLETO: "
        "Apenas avance o que for possível com o que ele enviou. "
        "Se faltar uma etapa, faça a próxima pergunta UMA vez. "
        "Se o cliente ignorar, não repita, apenas aguarde."

        "SABORES E REGRAS: "
        "Pizzas têm tamanho e borda. Borda: cheddar, catupiry, vulcão cheddar, vulcão catupiry, vulcão chocolate, chocolate, muçarela. "
        "Esfihas não têm borda. Bebidas/doce/itens diversos só têm nome e quantidade."

        "QUANTIDADE: "
        "Se o cliente não informar a quantidade, pergunte. "
        "Se ignorar, assuma 1 sem pedir novamente."

        f"MODELO JSON: Use exatamente este formato quando tudo estiver completo: {json_model} "

        "SOMENTE gere JSON quando o item estiver 100% completo. "
        "Nunca gere JSON incompleto. Nunca gere mais de um JSON por resposta."

        "ENDEREÇO E PAGAMENTO: "
        "Depois de finalizar TODOS os itens, peça endereço, depois pagamento, e só então envie o JSON final."

        "TRIGGERS: "
        "Se pedir cardápio → envie '[ENVIAR_CARDAPIO_PDF]'. "
        "Se pedir atendente → envie '[trigger_saudacao_inicial]'."

        "ESTILO: "
        "Curta, gentil e direta. Sem parágrafos longos. Não explique regras internas. "
        "Nunca peça confirmação óbvia ('certo?', 'confirma?')."

        f"PRODUTOS: Temos {fetch_produtos()}"
    )
}]


# Modelo para notificações
class Notificacao(BaseModel):
    id_notificacao: str
    numero_cliente: str
    mensagem: str
    tipo: str
    status: str
    timestamp: str

# Função para limpar notificações expiradas
async def limpar_notificacoes_expiradas():
    print("🧹 Iniciando limpeza de notificações expiradas...")
    while True:
        try:
            agora = datetime.now(pytz.timezone("America/Sao_Paulo"))
            print("🕒 Verificando notificações expiradas...")
            conn, cursor = conectar_db()
            for id_notif, notif in list(notificacoes_ativas.items()):
                try:
                    timestamp = datetime.strptime(notif['timestamp'], "%Y-%m-%d %H:%M:%S")
                    timestamp = pytz.timezone("America/Sao_Paulo").localize(timestamp)
                    if (agora - timestamp).total_seconds() > 3600:
                        query = "UPDATE notificacoes SET status = 'expirada' WHERE id_notificacao = %s"
                        cursor.execute(query, (id_notif,))
                        conn.commit()
                        del notificacoes_ativas[id_notif]
                        await broadcast({"event": "notificacao_removida", "data": {"id_notificacao": id_notif}})
                        print(f"🗑️ Notificação {id_notif} removida (expirada)")
                except Exception as e:
                    print(f"❌ Erro ao processar notificação {id_notif}: {e}")
            cursor.close()
            conn.close()
            await asyncio.sleep(60)
        except Exception as e:
            print(f"❌ Erro na limpeza de notificações: {e}")
            await asyncio.sleep(60)

# Função para broadcast de mensagens via WebSocket
async def broadcast(message: dict):
    for connection in websocket_connections:
        try:
            await connection.send_json(message)
        except Exception as e:
            print(f"❌ Erro ao enviar mensagem via WebSocket: {e}")
            websocket_connections.remove(connection)

# Funções auxiliares
def pegar_ultimo_id_pedido():
    try:
        conn, cursor = conectar_db()
        cursor.execute("SELECT MAX(id_pedido) FROM pedido")
        resultado = cursor.fetchone()
        cursor.close()
        conn.close()
        if resultado["MAX(id_pedido)"] != None:
            return resultado["MAX(id_pedido)"]
        else:
            return 1
    except Exception as e:
        print("❌ Erro ao buscar último ID do pedido:", e)
        return None

def extrair_rua_numero(endereco):
    try:
        match = re.match(r'^(.*?),\s*(\d+)(?:,.*)?$', endereco)
        if match:
            rua = match.group(1).strip()
            numero = match.group(2).strip()
            return rua, numero
        else:
            print(f"⚠️ Não foi possível extrair rua e número de: {endereco}")
            return endereco, "0"
    except Exception as e:
        print(f"❌ Erro ao extrair rua e número: {e}")
        return endereco, "0"

def pegar_coordenadas(endereco):
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={requests.utils.quote(endereco)}&key={maps_api_key}"
    response = requests.get(url)
    data = response.json()

    if data['status'] == 'OK':
        location = data['results'][0]['geometry']['location']
        lat = location['lat']
        lng = location['lng']
        print(f"🗺️ Coordenadas obtidas para {endereco}: lat={lat}, lng={lng}")
        return lat, lng
    else:
        print("❌ Erro ao obter coordenadas:", data.get('status'))
        return 0.0, 0.0

def get_or_upload_media_id():
    try:
        with open("media_id.txt", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return upload_pdf_para_whatsapp()

def upload_pdf_para_whatsapp():
    token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    phone_number_id = os.getenv("FONE_ID")
    url = f"https://graph.facebook.com/v19.0/{phone_number_id}/media"
    
    headers = {
        "Authorization": f"Bearer {token}"
    }

    files = {
        "file": ("cardapio.pdf", open("assets/cardapio.pdf", "rb"), "application/pdf")
    }

    data = {
        "messaging_product": "whatsapp",
        "type": "document"
    }

    response = requests.post(url, headers=headers, files=files, data=data)
    result = response.json()

    if "id" in result:
        media_id = result["id"]
        with open("media_id.txt", "w") as f:
            f.write(media_id)
        print("✅ media_id gerado:", media_id)
        return media_id
    else:
        print("❌ Erro ao enviar PDF:", result)
        return None

def carregar_media_id():
    if not os.path.exists("media_id.txt"):
        return None
    with open("media_id.txt", "r") as f:
        return f.read().strip()



def calcular_distancia_km(endereco_destino):
    origem = "R. Copacabana, 111 - Jardim Maria Helena, Barueri - SP, 06445-060"
    url = "https://routes.googleapis.com/directions/v2:computeRoutes"

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": maps_api_key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
    }

    body = {
        "origin": {"address": origem},
        "destination": {"address": endereco_destino},
        "travelMode": "DRIVE"
    }

    try:
        response = requests.post(url, headers=headers, json=body)
        data = response.json()
        print("🛰 API Google Maps:", response.status_code, response.text)

        routes = data.get("routes", [])
        if not routes or "distanceMeters" not in routes[0]:
            print("❌ 'distanceMeters' ausente na resposta.")
            return None

        distancia_metros = routes[0]["distanceMeters"]
        return distancia_metros / 1000
    except Exception as e:
        print("❌ Erro ao calcular distância:", e)
        return None

def calcular_taxa_entrega(endereco_destino=None, km=None):
    distancia = calcular_distancia_km(endereco_destino) if endereco_destino else km
    
    if distancia < 1:
        return round(4, 2)
    elif distancia < 3:
        return round(distancia * 3, 2)
    
    return round(distancia * 2, 2)

def enviar_msg(msg, lista_msgs=None):
    try:
        if(lista_msgs is None):
            lista_msgs = []
        lista_msgs.append({"role": "user", "content": msg})
        print(f"📤 Enviando mensagem para OpenAI: {lista_msgs[-1]}")
        resposta = client.chat.completions.create(
            model="gpt-5",
            messages=lista_msgs
        )
        print(f"📥 Resposta da OpenAI: {resposta.choices[0].message.content}")
        return resposta.choices[0].message.content
    except Exception as e:
        print(f"❌ Erro ao chamar API da OpenAI: {e}")
        return "⚠️ Desculpe, estou com problemas para responder agora. Tente novamente em alguns minutos!"

def extrair_json_da_resposta(resposta):
    resposta = re.sub(r"```json\s*(\{[\s\S]*?\})\s*```", r"\1", resposta)
    try:
        match = re.search(r'(\{[\s\S]*\})', resposta)
        if match:
            print("🔍 JSON encontrado na resposta:", match.group(1))
            return json.loads(match.group(1))
    except Exception as e:
        print("❌ Erro ao extrair JSON:", e)
    return None

def salvar_notificacao_no_banco(notificacao):
    try:
        conn, cursor = conectar_db()
        query = """
            INSERT INTO notificacoes (id_notificacao, numero_cliente, mensagem, tipo, status, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            notificacao["id_notificacao"],
            notificacao["numero_cliente"],
            notificacao["mensagem"],
            notificacao["tipo"],
            notificacao["status"],
            notificacao["timestamp"]
        ))
        conn.commit()
        cursor.close()
        conn.close()
        print("✅ Notificação salva no banco")
    except Exception as e:
        print(f"❌ Erro ao salvar notificação no banco: {e}")

def enviar_whatsapp(to, msg):
    print(f"📝 Preparando envio para {to}: {msg}")
    if not access_token or not fone_id:
        print(f"❌ Erro: access_token ou fone_id não configurados (access_token: {access_token}, fone_id: {fone_id})")
        return False
    
    url = f"https://graph.facebook.com/v22.0/{fone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": msg}
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    try:
        if to != 553299910621 or to != '553299910621':
            response = requests.post(url, json=payload, headers=headers)
            print(f"📤 Resposta do WhatsApp API: {response.status_code} {response.text}")
            if response.status_code == 200:
                print("✅ Mensagem enviada com sucesso!")
                return True
            else:
                print(f"❌ Erro ao enviar mensagem: {response.status_code} {response.text}")
                return False
    except Exception as e:
        print(f"🔥 Exceção ao tentar enviar mensagem: {e}")
        return False

def gerar_mensagem_amigavel(json_pedido, id_pedido):
    try:
        getnetAcessToken = setTokensToGetnet()
        itens = json_pedido.get("itens", [])
        taxa = round(json_pedido.get("taxa_entrega", 0), 2)
        total = taxa
        
        pagamento = json_pedido.get("forma_pagamento", "").capitalize()
        endereco = json_pedido.get("endereco_entrega", "")

        itens_formatados = []
        for item in itens:
            preco = item.get("preco")
            total += preco
            produto = item.get("produto")
            sabor = item.get("sabor", produto)
            
            qtd = item.get("quantidade", 1)
                
            if "pizza" in produto:
                obs_raw = item.get("observacao")
                obs_raw = (obs_raw.replace("25cm", "broto").replace("35cm", "G").replace(";", ","))
                
                if "broto" not in obs_raw or "G" not in obs_raw:
                    return "Tamanho de pizza é inválido ou ausente no json do pedido."

                obs = f"({obs_raw})"

            preco_str = f"{preco:.2f}".replace('.', ',')
            if "pizza" in produto or "esfiha" in produto:
                linha = f"- {qtd}x {produto} de {sabor} {obs} - R$ {preco_str} "
            else:
                linha = f"- {qtd}x {sabor} - R$ {preco_str} "
                
            itens_formatados.append(linha)
        
        mensagem = (
            f"🍕 Pedido *{id_pedido}*\n"
            f"{chr(10).join(itens_formatados)}\n"
            f"- 💳 {pagamento}\n"
            f"-📍 {endereco}\n\n"
            f"- Taxa de entrega: R$ {f'{taxa:.2f}'.replace('.',',')}\n"
            f"- Total: R$ {f'{total:.2f}'.replace('.',',')}\n\n"
            "*O pagamento será feito pessoalmente na entrega*\n\n"
            f"Obrigado pelo seu pedido! Em breve estaremos aí...🍕🛵\n"
            #comentado pois o link de pagamento será implementado apenas em uma versão futura.
            # f"{generate_GetNet_payment_link(getnetAcessToken, total, taxa, json_pedido)}"
        )
        return mensagem
    except Exception as e:
        return f"⚠️ Erro ao montar resumo amigável: {str(e)}"


def calculate_total (from_num, sum):
    preco_total = 0
            
    for preco in sum:
        p = float(preco)
        preco_total += p
        
    msg_ = f"O total até o momento ficou: R${preco_total:.2f}".replace(".", ",")            
    enviar_whatsapp(from_num, msg_)
    
    
# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_connections.append(websocket)
    print(f"✅ Cliente WebSocket conectado")
    try:
        while True:
            data = await websocket.receive_json()
            print(f"📥 Mensagem WebSocket recebida: {data}")
            await broadcast({"event": "mensagem_recebida", "data": data})
    except Exception as e:
        print(f"❌ Erro na conexão WebSocket: {e}")
    finally:
        websocket_connections.remove(websocket)
        print(f"🔌 Cliente WebSocket desconectado")

# Endpoints HTTP
@app.get("/")
async def index():
    return {"message": "Servidor FastAPI está rodando!"}

@app.get("/notificacoes/ativas")
async def listar_notificacoes_ativas():
    print("📥 Requisição recebida em /notificacoes/ativas")
    try:
        conn = conectar_banco()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        query = """
            SELECT id_notificacao, numero_cliente, mensagem, tipo, status, timestamp
            FROM notificacoes
            WHERE status = 'pendente'
        """
        cursor.execute(query)
        notificacoes = cursor.fetchall()
        cursor.close()
        conn.close()

        notificacoes_ativas.clear()
        for notif in notificacoes:
            notif['timestamp'] = notif['timestamp'].strftime("%Y-%m-%d %H:%M:%S")
            notificacoes_ativas[notif['id_notificacao']] = notif

        print(f"📋 Notificações ativas recuperadas do banco: {notificacoes_ativas}")
        return list(notificacoes_ativas.values())
    except Exception as e:
        print(f"❌ Erro ao listar notificações ativas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notificacoes/atender/{id_notificacao}")
async def atender_notificacao(id_notificacao: str):
    try:
        conn, cursor = conectar_db()
        query = "UPDATE notificacoes SET status = 'atendida' WHERE id_notificacao = %s"
        cursor.execute(query, (id_notificacao,))
        conn.commit()
        cursor.close()
        conn.close()
        if id_notificacao in notificacoes_ativas:
            notificacoes_ativas[id_notificacao]["status"] = "atendida"
            await broadcast({"event": "notificacao_atualizada", "data": {"id_notificacao": id_notificacao, "status": "atendida"}})
            print(f"📡 Notificação {id_notificacao} atualizada para atendida via WebSocket")
        return {"message": "Notificação marcada como atendida"}
    except Exception as e:
        print(f"❌ Erro ao atender notificação: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notificacoes/limpar")
async def limpar_notificacoes():
    try:
        conn = conectar_banco()
        cursor = conn.cursor()
        query = "UPDATE notificacoes SET status = 'atendida' WHERE status = 'pendente'"
        cursor.execute(query)
        conn.commit()
        cursor.close()
        conn.close()
        for id_notif in list(notificacoes_ativas.keys()):
            if notificacoes_ativas[id_notif]["status"] == "pendente":
                notificacoes_ativas[id_notif]["status"] = "atendida"
                await broadcast({"event": "notificacao_atualizada", "data": {"id_notificacao": id_notif, "status": "atendida"}})
                print(f"📡 Notificação {id_notif} atualizada para atendida via WebSocket")
        return {"message": "Todas as notificações foram marcadas como atendidas"}
    except Exception as e:
        print(f"❌ Erro ao limpar notificações: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/notificacoes/{id_notificacao}/status")
async def atualizar_status_notificacao(id_notificacao: str, data: dict):
    novo_status = data.get("status")
    if novo_status not in ["pendente", "atendida", "rejeitada"]:
        raise HTTPException(status_code=400, detail="Status inválido")
    try:
        if id_notificacao in notificacoes_ativas:
            notificacoes_ativas[id_notificacao]["status"] = novo_status
            await broadcast({"event": "notificacao_atualizada", "data": {"id_notificacao": id_notificacao, "status": novo_status}})
            if novo_status in ["atendida", "rejeitada"]:
                numero_cliente = notificacoes_ativas[id_notificacao]["numero_cliente"]
                mensagem_cliente = (
                    "Alteração confirmada! Seu pedido foi atualizado. 😊" if novo_status == "atendida" else
                    "Desculpe, não foi possível alterar o pedido no momento. 😔 Quer tentar outra alteração?"
                )
                if notificacoes_ativas[id_notificacao]["tipo"] == "mudanca":
                    enviar_whatsapp(numero_cliente, mensagem_cliente)
                del notificacoes_ativas[id_notificacao]
                await broadcast({"event": "notificacao_removida", "data": {"id_notificacao": id_notificacao}})
            print(f"✅ Status da notificação {id_notificacao} atualizado para {novo_status}")
            return {"message": "Status atualizado com sucesso"}
        else:
            raise HTTPException(status_code=404, detail="Notificação não encontrada")
    except Exception as e:
        print(f"❌ Erro ao atualizar status da notificação: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notificacoes")
async def criar_notificacao(notificacao: Notificacao):
    print("📥 Requisição recebida em /notificacoes (POST)")
    try:
        notificacao_dict = notificacao.dict()
        salvar_notificacao_no_banco(notificacao_dict)
        notificacoes_ativas[notificacao.id_notificacao] = notificacao_dict
        await broadcast({"event": "notificacao_nova", "data": notificacao_dict})
        print(f"📡 Notificação emitida via WebSocket: {notificacao.id_notificacao}")
        return {"message": "Notificação criada com sucesso", "id_notificacao": notificacao.id_notificacao}
    except Exception as e:
        print(f"❌ Erro ao criar notificação: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/webhook")
async def webhook_verify(request: Request):
    token = request.query_params.get('hub.verify_token')
    challenge = request.query_params.get('hub.challenge')
    print(f"📥 Recebido GET no webhook: token={token}, challenge={challenge}")
    if token == webhook_verify_token:
        return PlainTextResponse(challenge)
    raise HTTPException(status_code=403, detail="Token inválido!")

#funcoes auxiliares do webhook de post, que é o coração deste código

def saudacao(from_num):
    enviar_whatsapp(from_num, f"Olá! Sou a Laryssa, assistente virtual do Cantinho das Pizzas e do Açaí. Como posso ajudar você hoje? 😊")
    enviar_whatsapp(from_num, enviar_pdf_para_cliente(from_num))

async def solicitar_atendente(from_num, resposta):
    print(f"📞 Solicitação de atendente real para {from_num}")
    if enviar_whatsapp(from_num, resposta):
        id_notificacao = str(uuid.uuid4())
        timestamp = datetime.now(pytz.timezone("America/Sao_Paulo")).strftime("%Y-%m-%d %H:%M:%S")
        notificacao = {
                    "id_notificacao": id_notificacao,
                    "numero_cliente": from_num,
                    "mensagem": f"{from_num} está solicitando um atendente real.",
                    "tipo": "atendente_real",
                    "status": "pendente",
                    "timestamp": timestamp
        }
        salvar_notificacao_no_banco(notificacao)
        notificacoes_ativas[id_notificacao] = notificacao
        await broadcast({"event": "notificacao_nova", "data": notificacao})
        print(f"📡 Notificação emitida via WebSocket: {id_notificacao}")
    else:
        print(f"❌ Falha ao enviar mensagem de atendente real para {from_num}")

def get_from_json_pedido(pedido):
    return(
        pedido.get("endereco_entrega"),
        pedido.get("taxa_entrega"),
        pedido.get("itens"),
        pedido.get('alteracao')
    )

def tratar_excecoes_de_distancia (distancia, from_num):
    if distancia == None:
        enviar_whatsapp(from_num, "❌ Endereço inválido. Verifique e envie novamente.")
        return {"message": "ENDERECO_INVALIDO"}

    if distancia > 15:
        print("🚫 Endereço fora do raio de entrega")
        enviar_whatsapp(from_num, "🚫 Fora do nosso raio de entrega (15 km).")
        return {"message": "FORA_RAIO"}

    return {"message": "ok"}

async def handle_alteracao_de_pedido(json, from_num, alteracao):
    if alteracao == 1:
        json['alteracao'] = get_order_id_from_num(from_num)
                    
        id_notificacao = str(uuid.uuid4())
        timestamp = datetime.now(pytz.timezone("America/Sao_Paulo")).strftime("%Y-%m-%d %H:%M:%S")
        notificacao = {
            "id_notificacao": id_notificacao,
            "numero_cliente": from_num,
            "mensagem": f"Pedido {get_order_id_from_num(from_num)} foi alterado.",
            "tipo": "alteração",
            "status": "pendente",
            "timestamp": timestamp
            }
        salvar_notificacao_no_banco(notificacao)
        notificacoes_ativas[id_notificacao] = notificacao
        await broadcast({"event": "notificacao_nova", "data": notificacao})
        print(f"📡 Notificação emitida via WebSocket: {id_notificacao}")

def processar_resposta (resposta, num):
    resposta = resposta.strip()
    acoes = {
        "[trigger_saudacao_inicial]" : lambda: saudacao(num),
        "[ENVIAR_CARDAPIO_PDF]" : lambda: enviar_pdf_para_cliente(num),
        "Beleza, já chamei um atendente pra te ajudar! 😊 É só aguardar um pouquinho, tá?": lambda: solicitar_atendente(num, resposta)
    }

    if resposta in acoes:
        acoes[resposta]()
        return {'message': 'ok'}

    return None

def finalizar_pedido(num, pedido):
    resumo = gerar_mensagem_amigavel(pedido, id_pedido=pegar_ultimo_id_pedido()+1)
    enviar_whatsapp(num, resumo)
    res = requests.post("https://back-cantinho-das-pizzas.onrender.com/pedido/post", json=pedido, verify=False)
    if res.status_code == 200:
        print("Pedido enviado ao back-end!")
        associar_order_ids_a_numeros(num, pegar_ultimo_id_pedido())
    else:
        print(f"erro ao enviar ao back-end: {res.status_code, res}")

def fatal_error(num, e): #💀
    print("⚠️ Erro ao processar mensagem:", str(e))
    traceback.print_exc()
    enviar_whatsapp(num, "⚠️ Erro ao processar sua mensagem. Tente novamente!")

def inserir_data_no_json_pedido(pedido):
    agora = datetime.now()
    data_formatada = agora.strftime("%Y-%m-%d %H:%M:%S")
    pedido["data_pedido"] = f"{data_formatada}"

def handle_taxa_de_entrega(pedido, endereco, num, itens):
    print(f"📍 Processando endereço: {endereco}")
    street, houseNumber = extrair_rua_numero(endereco)
    pedido["street"] = street
    pedido["houseNumber"] = houseNumber

    distancia_km = calcular_distancia_km(endereco)
    tratar_excecoes_de_distancia(distancia_km, num)
                
    taxa = calcular_taxa_entrega(endereco_destino=None, km=distancia_km)
    pedido["taxa_entrega"] = taxa
                
    for i in itens:
        total += i.get("preco")
    pedido["preco_total"] = round(total, 2)
    print(f"💰 Taxa de entrega calculada: R${taxa}")

    lat, lng = pegar_coordenadas(endereco)
    pedido["latitude"] = lat if lat is not None else 0.0
    pedido["longitude"] = lng if lng is not None else 0.0
    print(f"🗺️ Coordenadas: lat={lat}, lng={lng}")

    historico_usuarios[num].append({
        "role": "system",
        "content": f"A taxa de entrega é {taxa:.2f} reais."
    })

def ignorar_mf(msg_id, processed_ids, num):
    if num == "553299910621":
        return True

def extrair_mensagem(data):
    value = data['entry'][0]['changes'][0]['value']

    messages = value.get('messages')
    if not messages:
        raise ValueError("No new message")

    msg = messages[0]
    from_num = msg['from']
    msg_id = msg.get('id')
    text = msg.get('text', {}).get('body', '').lower()
    type = msg.get('type')

    return msg, from_num, msg_id, text

def registrar_mensagem_recebida(msg_id, from_num, text):
    processed_ids.add(msg_id)
    last_msgs[from_num] = {"id": msg_id, "text": text}

    if from_num not in historico_usuarios:
        historico_usuarios[from_num] = copy.deepcopy(prompt)

    if from_num not in mensagens_nao_respondidas:
        mensagens_nao_respondidas[from_num] = []

    mensagens_nao_respondidas[from_num].append(text)

def obter_mensagem_unificada(num):
    mensagens = mensagens_nao_respondidas.get(num, [])

    if not mensagens:
        return ""

    texto_unificado = " ".join(mensagens)
    mensagens_nao_respondidas[num] = []

    return texto_unificado

def gerar_resposta_do_chatbot(num, text):
    historico_usuarios[num].append({"role": "user", "content": text})
    resposta = enviar_msg("", historico_usuarios[num])
    historico_usuarios[num].append({"role": "assistant", "content": resposta})

    print(f"🤖 Resposta: {resposta}")
    return resposta

def lidar_com_soma(resposta, num):
    if "sum:" not in resposta:
        return False

    valores = re.findall(r'\d+[.,]\d+', resposta)
    valores = [v.replace(",", ".") for v in valores]

    try:
        calculate_total(num, valores)
        return True
    except Exception as e:
        print("Erro ao calcular soma:", e)
        return False
    
def enviar_resposta(resposta, num):
    if "```json" not in resposta:
            print(f"📤 Enviando resposta para {num}: {resposta}")
            if not enviar_whatsapp(num, resposta):
                print(f"❌ Falha ao enviar resposta para {num}")
                enviar_whatsapp(num, "⚠️ Erro ao processar sua mensagem. Tente novamente!")

def processar_json_pedido(pedido, num):
    endereco, total, itens, alteracao = get_from_json_pedido(pedido)

    handle_taxa_de_entrega(pedido, endereco, num, itens)
    handle_alteracao_de_pedido(pedido, num, alteracao)

    inserir_data_no_json_pedido(pedido)
                
    print(pedido)
    try:
        finalizar_pedido(num, pedido)
    except Exception as e:
        print(f"❌ Erro de conexão com o backend: {e}")
        enviar_whatsapp(num, "⚠️ Erro ao conectar com o sistema. Tente novamente!")

async def processar_usuario(num):
    if num in usuario_processando:
        return

    usuario_processando.add(num)

    try:
        texto_final = obter_mensagem_unificada(num)

        if not texto_final.strip():
            return

        resposta = gerar_resposta_do_chatbot(num, texto_final)

        if processar_resposta(resposta, num):
            return

        if lidar_com_soma(resposta, num):
            return

        json_pedido = extrair_json_da_resposta(resposta)

        if json_pedido:
            processar_json_pedido(json_pedido, num)
            return

        enviar_resposta(resposta, num)

    finally:
        usuario_processando.remove(num)

def ignorar_duplicada(msg_id, processed_ids):
    if msg_id in processed_ids:
        return True
    
    return False

def ignorar_mensagens_que_nao_sejam_texto(type):
    return type != 'text'


async def processar_evento(from_num, text, msg_id, msg_type):
    try:
        if ignorar_mensagens_que_nao_sejam_texto(msg_type):
            return
        
        if ignorar_duplicada(msg_id, processed_ids):
            return
        
        if ignorar_mf(from_num) == True:
            return
        
        # Aqui sim você usa GPT e envia a resposta
        await processar_usuario(from_num)

    except Exception as e:
        print("❌ Erro no processamento assíncrono:", e)


@app.post("/webhook")
async def webhook(request: Request):
    try:
        data = await request.json()
        print("📥 Recebido POST no webhook: \n\n", data)
        value = data["entry"][0]["changes"][0]["value"]

        if "messages" not in value:
            return {"message": "STATUS_IGNORED"}
    
        msg, from_num, msg_id, text, msg_type = extrair_mensagem(data)

        registrar_mensagem_recebida(msg_id, from_num, text)

        asyncio.create_task(processar_evento(from_num, text, msg_id, msg_type))

        # Responde instantâneo para o WhatsApp
        return {"message": "EVENT_RECEIVED"}

    except Exception as e:
        print("❌ ERRO NO WEBHOOK:", e)
        return {"message": "EVENT_RECEIVED"}

if __name__ == "__main__":
    print("🚀 Iniciando servidor FastAPI...")
    uvicorn.run(app, host="0.0.0.0", port=5000)