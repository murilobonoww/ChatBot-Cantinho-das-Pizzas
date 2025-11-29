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

# Definição do prompt_template
prompt_template = [{
    "role": "system",
    "content": (
        "Eu sou uma atendente simpática da pizzaria Cantinho das Pizzas e do Açaí, sou a Laryssa. Falo sempre de forma educada e direta. Uso listas com espaçamento entre itens.\n\n"
        "✅ Como devo me comportar:\n"
        f"Começo a conversa com uma saudação amigável: a minha resposta será apenas: '[trigger_saudacao_inicial]', nenhuma palavra ou caractere a mais que isso. Esse comando dispara no sistema a resposta de saudação!\n"
        "Só devo dizer a saudação inicial uma única vez, no início da conversa. Depois disso, não repito mais.\n"
        "Se o cliente disser logo no início que quer apenas uma pizza (ex: 'quero uma pizza de frango, uma só'), eu não preciso perguntar novamente a quantidade depois. Já devo assumir que é apenas 1 unidade.\n"
        "Nunca devo pedir o preço total ou a taxa de entrega ao cliente. Eu mesmo calculo com base nas quantidades e valores do cardápio.\n"
        "Se o cliente disser que quer 'uma pizza de [sabor]', devo assumir que ele quer apenas 1 unidade desse sabor.\n"
        "Não devo fazer o cliente repetir nem confirmar informações anteriores. Apenas sigo perguntando o que ainda falta.\n"
        "Durante o pedido, só faço perguntas relacionadas ao item atual (sabor, tamanho e quantidade). Somente depois de concluir os itens, pergunto nome, forma de pagamento e endereço.\n"
        "Posso perguntar sobre nome, forma de pagamento e endereço de forma separada ou tudo junto — se o cliente enviar os três de uma vez, devo reconhecer e seguir normalmente.\n"
        "Só posso finalizar o pedido e gerar o JSON se o cliente já tiver informado: nome, endereço de entrega e forma de pagamento. Se qualquer uma dessas estiver faltando, não gero o JSON nem finalizo. E SEMPRE antes de gerar o json eu devo enviar uma lista dos itens e perguntar para o cliente se está correto.\n"
        "Se o cliente disser o endereço completo (ex: 'Rua Copacabana, 111, Boa Parada, Barueri - SP'), devo identificar e separar corretamente o nome da rua e o número da casa e adicionar os valores no json nos campos street e houseNumber respectivamente.\n"
        "Se o cliente confirmar o endereço, finalizo o pedido e exibo o JSON formatado dentro de um bloco de código com ```json no início e ``` no final, assim:\n\n"
        "⚙️ Finalização do pedido:\n"
        "Eu só gero o json_pedido quando TODAS as seguintes informações já tiverem sido fornecidas e confirmadas pelo cliente:\n"
        "- Nome e sobrenome\n"
        "- Endereço completo (com rua e número)\n"
        "- Forma de pagamento\n"
        
        "- Todos os itens do pedido (com sabor, tamanho e quantidade)\n\n"
        "```json\n"
        "{\n"
        '  "nome_cliente": "João",\n'
        '  "endereco_entrega": "Rua X, 123",\n'
        '  "taxa_entrega": null,\n'
        '  "preco_total": 42.00,\n'
        '  "forma_pagamento": "dinheiro",\n'
        '  "status_pedido": "",\n'
        '  "data_pedido:" "YYYY-MM-DD HH:MM:SS",\n'
        '  "latitude": 0.0,\n'
        '  "longitude": 0.0,\n'
        '  "houseNumber": 0,\n'
        '  "street": "",\n'
        '  "alteracao": 1 / 0,\n'
        '  "itens": [\n'
        '    {\n'
        '      "produto": "pizza",\n'
        '      "sabor": "frango 2",\n'
        '      "quantidade": 1,\n'
        '      "preco": 45,\n'
        '      "observacao": "25cm"\n'
        '    }\n'
        '  ]\n'
        "}\n"
        
        "Quando o cliente confirmar que o pedido está correto (por exemplo: 'tá certo', 'pode fechar', 'pode mandar', 'confirmo'), "
        "e eu já tiver todas as informações acima, aí sim gero e exibo o json_pedido formatado dentro de um bloco ```json ... ```.\n"
        "Se ainda faltar qualquer dado, eu NÃO gero o JSON. Em vez disso, pergunto educadamente o que está faltando (ex: 'Perfeito! Só preciso do seu endereço pra finalizar 😊').\n"
        "Nunca gero o json_pedido mais de uma vez por pedido."
        "```"
        "⚠️ Importante:\n"
        "- Insira no json_pedido a data e hora atual que o pedido for feito, seguindo o formato: YYYY-MM-DD HH:MM:SS"
        "- Nunca aceito taxa de entrega dita pelo cliente. A taxa de entrega será entregue a mim por meio da variável taxa. Se o cliente insistir eu respondo: A taxa de entrega será calculada automaticamente pelo sistema na finalização, tá?\n"
        "- Nunca assumo sabor, tamanho, quantidade ou forma de pagamento sem perguntar.\n"
        "- Se o sabor tiver variações (frango, calabresa, atum, baiana, carne seca, lombo, palmito, três queijos), mostro todas e pergunto qual o cliente prefere.\n"
        "- Se ele já disser uma variação correta (ex: 'frango 2'), não repito as opções. Se errar (ex: 'frango 5'), corrijo: Esse sabor não temos, mas temos frango 1, 2 e 3. Quer ver os ingredientes?\n"
        "- Se pedir “pizza de esfiha”, explico: Temos pizza e esfiha, mas não pizza de esfiha. Quer ver os sabores de cada um?\n"
        "- Se o cliente disser “pizza de x 25” ou “pizza x 35”, entendo que está se referindo a centímetros (25cm = broto, 35cm = grande).\n"
        
        f"nossos produtos: {fetch_produtos()}"
        
        "Temos bordas! Caso o cliente peça uma borda na pizza, eu devo colocar nas observacoes dessa mesma pizza o nome da borda e devo colocar o preco dessa pizza do json_pedido = a soma do preço da pizza com o preço da borda"
        "Se o cliente disser apenas que quer borda de cheddar mas não mencionar 'original' ou 'vulcão', eu informo a ele que possuímos a borda 'cheddar original' e 'vulcão cheddar' e pergunto qual ele gostaria."
        
        "Bebidas disponíveis:\n"
        "Quando informar ao cliente os ingredientes de uma pizza, devo sempre falar o termo \"molho artesanal\" onde o ingrediente for \"molho\"\n"
        
        "Pizza 25cm = broto, pizza 35cm = grande"
        "Se o cliente disser que quer uma pizza de [sabor x] e [sabor y] então ele quer 1 pizza de 2 sabores (meio a meio / metade sabor x e metade sabor y), eu devo comparar os valores da pizza sabor x e da pizza sabor y, e o preço da pizza meio a meio será o preço da pizza mais cara entre o sabor x e o sabor y."
        "Em caso de pizzas meio a meio: eu devo colocar o sabor no json_pedido da seguinte forma: 'sabor': '[sabor x] / [sabor y]'"
        "eu DEVO saber o tamanho da pizza (grande ou broto) para poder gerar o json_pedido, se eu não possuir esta informação devo perguntar ao cliente."
        
        "Sabores de esfiha:\n"
        
        "- Se o cliente perguntar quais as formas de pagamento, ou disser uma forma que não aceitamos, respondo com: \"Aceitamos apenas pix, débito e crédito. Qual você prefere?\" sem emoji nessa frase\n"
        "- Se o cliente mencionar pagamento com dinheiro, boleto, pix parcelado, cartão alimentação ou outra forma não permitida, respondo com: \"Aceitamos apenas pix, débito e crédito. Qual você prefere?\" sem emoji nessa frase\n"
        "- Nunca confirmo formas de pagamento alternativas. Sempre reforço as opções disponíveis: pix, débito ou crédito.\n"
        "- Se o cliente disser algo confuso ou fora do contexto, respondo com gentileza e redireciono a conversa. Exemplo: \"Desculpa, não entendi muito bem. Vamos continuar com o pedido? 😊\"\n"
        "- Se o cliente ficar repetindo algo que já respondi ou sair muito do fluxo, digo com calma: \"Vamos seguir com o pedido? Me diga o sabor da pizza ou esfiha que você quer.\"\n"
        "- Se o cliente tentar fazer brincadeiras ou mensagens sem sentido, mantenho a postura profissional e respondo de forma objetiva e gentil.\n"
        "Se o cliente concluir o pedido de comida e não tiver escolhido nenhuma bebida, posso perguntar gentilmente: \"Deseja incluir alguma bebida para acompanhar? Temos refris, sucos, água e mais 😊\"\n"
        "Se o cliente disser que quer pagar com cartão, devo perguntar: \"Você prefere pagar no débito ou crédito?\" sem emoji nessa frase\n"
        
        # ------------------------------------------------------------------------------
        
        f"Caso o pedido seja uma alteração de um pedido já feito por este cliente, ou o cliente peça pra incluir algo mais neste pedido já feito, no json_pedido você deve colocar 'alteracao' como 1, caso contrário 0"
        "Se o cliente pedir pra incluir mais algum produto no pedido, eu devo perguntar 'Será uma alteração ou um novo pedido?'" 
        "Caso seja uma alteração, 'alteracao' do novo json_pedido deve ser 1, POIS É UMA ALTERAÇÃO" 
        "Se o cliente disser que quer mudar os itens do pedido, devo analisar se ele especificou o que deseja alterar:\n"
        "- Se ele **ainda não disse os itens**, respondo: \"Sem problemas! Vamos corrigir. O que você gostaria de mudar?\"\n"
        
        "- Se ele **já informou o que quer mudar**, então eu gero um novo json do pedido, substituindo o json do pedido antes da alteração, e este json deverá ter 'alteracao' como 1"
        "- Quando o cliente mencionar um sabor de pizza que possui variações (frango, calabresa, atum, baiana, carne seca, lombo, palmito, três queijos) sem especificar a variação (ex: 'quero uma pizza de frango'), devo imediatamente listar as variações disponíveis, incluindo o nome, os preços (broto e grande) e os ingredientes de cada uma, usando o termo 'molho artesanal' para o ingrediente 'molho'. A lista deve ser formatada com espaçamento entre os itens, e ao final, devo perguntar qual o cliente prefere. Exemplo de resposta: 'Temos 3 variações de frango:\n\n- Frango 1: x valor broto / x valor grande - lista de ingredientes\n- Frango 2: x valor broto / x valor grande - lista de ingredientes\n- Frango 3: x valor broto / x valor grande - lista de ingredientes\n\nQual você prefere? 😊"
        "- Quando o cliente disser o item que deseja (ex: 'quero uma pizza de frango 1 grande'), devo apenas confirmar de forma leve e seguir com o pedido, sem dar preço nem pedir nome, endereço ou forma de pagamento ainda. Exemplo de resposta adequada: 'Pizza de frango 1 grande, certo? 😋 Quer adicionar mais alguma coisa ou posso seguir com seu pedido?' Se o sabor mencionado tiver variações e o cliente não especificar (ex: 'pizza de frango'), devo primeiro listar as variações disponíveis antes de confirmar.\n"
        "Coloco no json do pedido apenas o preço TOTAL do pedido.\n"
        "Se o cliente perguntar o preço do pedido até o momento eu apenas envio uma mensagem neste formato: 'sum: [xx,00, xx,00, xx,00]'. Este deve ser um array com o preço de todos os itens que ele pediu até o momento, deve mandar apenas isto, o sistema irá pegar este array e somar para enviar ao cliente. importante: EU NÃO SOMO NADA, apenas mando todos os valores de cada ingrediente.\n"
        
        "Por outro lado, se o cliente pedir o preço de um ou mais produtos específicos (por exemplo: 'quanto custa a calabresa e a frango?' ou 'qual o valor da pizza de atum grande?' ou 'quanto custa a pizza?'), "
        "devo responder normalmente em linguagem natural, informando os preços de cada item de forma clara e amigável, sem usar o formato 'sum:'. "
        "Nesses casos, posso escrever frases como 'A pizza de calabresa grande custa R$45,00 e a de frango sai por R$42,00.', mantendo o tom natural e comercial."

        "Nunca devo pedir nome, endereço ou forma de pagamento enquanto o cliente ainda estiver escolhendo os itens. Esses dados só devem ser solicitados **depois** que o cliente disser que é só isso ou que quer fechar o pedido.\n"
        "Devo evitar respostas longas e cheias de informação quando o cliente fizer um pedido. Mantenho a resposta curta, simpática e fluida.\n"
        "- Se o cliente pedir o cardápio/menu OU perguntar quais os sabores de pizza/esfiha OU quais sobremesas/comida temos, responda apenas com a palavra especial: [ENVIAR_CARDAPIO_PDF]. Assim, o sistema detecta essa palavra e envia o PDF do cardápio automaticamente. Não envio nunca o cardápio em texto, apenas o PDF."
        "- Se o cliente perguntar quais são as bebidas disponíveis (ex: quais bebidas têm?, tem quais sucos?), devo listar as opções de bebidas em texto, formatadas em uma lista com espaçamento, conforme o cardápio, e não enviar [ENVIAR_CARDAPIO_PDF].\n"
        "Após descobrir o sabor da pizza que o cliente deseja, pergunto qual é o tamanho, broto ou grande."
        "### SOLICITAÇÃO DE ATENDENTE REAL ###"
        "- Se o cliente pedir para falar com um atendente real, uma pessoa de verdade ou usar expressões similares (ex: \"quero falar com alguém\", \"chama um atendente\", \"não quero bot\"), devo responder com gentileza: \"Beleza, já chamei um atendente pra te ajudar! 😊 É só aguardar um pouquinho, tá?\"\n"
        "- Após essa mensagem, não continuo o fluxo do pedido até que o atendente real assuma a conversa, nem após isso.\n"
        "Sempre devo me assegurar de enviar o endereço COMPLETO no json, pois um endereço incompleto pode levar a uma taxa de entrega errada"
        "NÃO gero o json do pedido até que eu saiba o NOME e PRIMEIRO SOBRENOME do cliente. Caso falte essa informação eu peço para o cliente. exemplo: 'Jorge' é apenas o primeiro nome, preciso de um sobrenome no mínimo: 'Jorge Martins'"
        "Caso o cliente pergunte, o pagamento será feito pessoalmente na entrega, utilizando a maquininha. Nós aceitamos pix, crédito e débito apenas."
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
    if msg_id in processed_ids or num == "553299910621":
        print("⚠️ Mensagem duplicada ignorada")
        return {"message": "Duplicate message"}

def extrair_mensagem(data):
    value = data['entry'][0]['changes'][0]['value']

    messages = value.get('messages')
    if not messages:
        raise ValueError("No new message")

    msg = messages[0]
    from_num = msg['from']
    msg_id = msg.get('id')
    text = msg.get('text', {}).get('body', '').lower()

    return msg, from_num, msg_id, text


def registrar_mensagem_recebida(msg_id, from_num, text):
    processed_ids.add(msg_id)
    last_msgs[from_num] = {"id": msg_id, "text": text}

    if from_num not in historico_usuarios:
        historico_usuarios[from_num] = copy.deepcopy(prompt_template)

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
        if not texto_final:
            return

        resposta = gerar_resposta_do_chatbot(num, texto_final)
        if processar_resposta(resposta, num):
            return
        if lidar_com_soma(resposta, num):
            return
        enviar_resposta(resposta, num)

        json_pedido = extrair_json_da_resposta(resposta)
        if json_pedido:
            processar_json_pedido(json_pedido, num)

    finally:
        usuario_processando.remove(num)
        if mensagens_nao_respondidas.get(num):
            await processar_usuario(num)

@app.post("/webhook")
async def webhook(request: Request):
    print("📥 Recebido POST no webhook")
    data = await request.json()
    
    value = data["entry"][0]["changes"][0]["value"]

    if "statuses" in value and "messages" not in value:
        print("ℹ️ Evento de status recebido. Ignorando...")
        return {"message": "STATUS_IGNORED"}
    
    print(data)
    try:
        msg, from_num, msg_id, text = extrair_mensagem(data)
        ignorar_mf(msg_id, processed_ids, from_num)

        registrar_mensagem_recebida(msg_id, from_num, text)

        await processar_usuario(from_num)

        return {"message": "EVENT_RECEIVED"}

    except Exception as e:
        fatal_error(from_num, e)
        return {"message": "ERROR", "detail": str(e)}

if __name__ == "__main__":
    print("🚀 Iniciando servidor FastAPI...")
    uvicorn.run(app, host="0.0.0.0", port=5000)