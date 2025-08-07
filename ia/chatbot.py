import eventlet
eventlet.monkey_patch()
from time import sleep
import traceback
from flask import Flask, jsonify, request
import requests
from openai import OpenAI
import pymysql
from datetime import datetime
import pytz
from dotenv import load_dotenv
import os
import re
import json
import socketio
import signal
from eventlet import wsgi
import uuid
from flask_cors import CORS
from eventlet.green import urllib

app = Flask(__name__)
sio = socketio.Server(cors_allow_origins=["http://localhost:5173"], logger=True, engineio_logger=True)
CORS(app, resources={r"/*": {"origins": "*"}})
app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)


load_dotenv()

keys = [
    "MAPS_API_KEY", "GPT_API_KEY", "DB_PASS", "DB_NAME", "APP_ID",
    "WHATSAPP_ACCESS_TOKEN", "FONE_ID", "CLIENT_SECRET", "WEBHOOK_VERIFY_TOKEN", "MEDIA_ID"
]

(
    maps_api_key,
    gpt_api_key,
    db_pass,
    db_name,
    app_id,
    access_token,
    fone_id,
    client_secret,
    webhook_verify_token,
    media_id
) = map(os.getenv, keys)

client = OpenAI(api_key=gpt_api_key)
historico_usuarios = {}
notificacoes_ativas = {}


def shutdown_server(signum, frame):
        print("🛑 Recebido sinal de interrupção, encerrando servidor...")
        wsgi.server_socket.close()  # Fecha o socket do servidor
        exit(0)

# Função para limpar notificações expiradas (mais de 1 hora)
def limpar_notificacoes_expiradas():
    print("🧹 Iniciando limpeza de notificações expiradas...")
    while True:
        try:
            agora = datetime.now(pytz.timezone("America/Sao_Paulo"))
            print("🕒 Verificando notificações expiradas...")
            for id_notif, notif in list(notificacoes_ativas.items()):
                try:
                    # Converter timestamp para datetime offset-aware
                    timestamp = datetime.strptime(notif['timestamp'], "%Y-%m-%d %H:%M:%S")
                    timestamp = pytz.timezone("America/Sao_Paulo").localize(timestamp)
                    if (agora - timestamp).total_seconds() > 3600:  # 1 hora
                        del notificacoes_ativas[id_notif]
                        sio.emit('notificacao_removida', {'id_notificacao': id_notif})
                        print(f"🗑️ Notificação {id_notif} removida (expirada)")
                except Exception as e:
                    print(f"❌ Erro ao processar notificação {id_notif}: {e}")
            eventlet.sleep(60)  # Substitui sleep para compatibilidade com eventlet
        except Exception as e:
            print(f"❌ Erro na limpeza de notificações: {e}")
            eventlet.sleep(60)
    print("🧹 Iniciando limpeza de notificações expiradas...")
    while True:
        try:
            agora = datetime.now(pytz.timezone("America/Sao_Paulo"))
            print("🕒 Verificando notificações expiradas...")
            for id_notif, notif in list(notificacoes_ativas.items()):
                try:
                    timestamp = datetime.strptime(notif['timestamp'], "%Y-%m-%d %H:%M:%S")
                    if (agora - timestamp).total_seconds() > 3600:  # 1 hora
                        del notificacoes_ativas[id_notif]
                        sio.emit('notificacao_removida', {'id_notificacao': id_notif})
                        print(f"🗑️ Notificação {id_notif} removida (expirada)")
                except Exception as e:
                    print(f"❌ Erro ao processar notificação {id_notif}: {e}")
            eventlet.sleep(60)  # Substitui sleep para compatibilidade com eventlet
        except Exception as e:
            print(f"❌ Erro na limpeza de notificações: {e}")
            eventlet.sleep(60)
        
        
# Iniciar limpeza em uma thread separada
eventlet.spawn(limpar_notificacoes_expiradas)


def pegar_ultimo_id_pedido():
    try:
        conn = conectar_banco()
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(id_pedido) FROM pedido")
        resultado = cursor.fetchone()
        cursor.close()
        conn.close()
        return resultado[0]
    except Exception as e:
        print("❌ Erro ao buscar último ID do pedido:", e)
        return None

def extrair_rua_numero(endereco):
    """Extrai rua e número do endereço completo."""
    try:
        # Regex para capturar rua e número (ex: "R. Oceano Pacífico, 75")
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

def saudacao():
    hora = datetime.now(pytz.timezone("America/Sao_Paulo")).hour
    if hora < 12:
        return "Bom dia!"
    elif hora < 18:
        return "Boa tarde!"
    else:
        return "Boa noite!"

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
            "caption": "Claro! Aqui está o nosso cardápio completo 🍕📖\n\n",
            "filename": "cardapio.pdf"
        }
    }

    response = requests.post(url, headers=headers, json=body)
    print("✅ PDF enviado:", response.json())

prompt_template = [{
    "role": "system",
    "content": (
        "Eu sou um atendente simpático da pizzaria Cantinho das Pizzas e do Açaí. Falo sempre de forma educada e direta. Uso listas com espaçamento entre itens.\n\n"
        "✅ Como devo me comportar:\n"
        f"Começo a conversa com uma saudação amigável: \"Olá, {saudacao()}! Como posso ajudar você hoje? 😊\"\n"
        "Só devo dizer a saudação inicial (bom dia, boa tarde, ou boa noite) uma única vez, no início da conversa. Depois disso, não repito mais.\n"
        "Se o cliente falou que quer uma pizza ele quer apenas 1.\n"
        "Se o cliente disser logo no início que quer apenas uma pizza (ex: 'quero uma pizza de frango, uma só'), eu não preciso perguntar novamente a quantidade depois. Já devo assumir que é 1 unidade.\n"
        "Nunca devo pedir o preço total ou a taxa de entrega ao cliente. Eu mesmo calculo com base nas quantidades e valores do cardápio.\n"
        "Se o cliente disser que quer 'uma pizza de [sabor]', devo assumir que ele quer apenas uma unidade desse sabor.\n"
        "Não devo fazer o cliente repetir nem confirmar informações anteriores. Apenas sigo perguntando o que ainda falta.\n"
        "Durante o pedido, só faço perguntas relacionadas ao item atual (sabor, tamanho e quantidade). Somente depois de concluir os itens, pergunto nome, forma de pagamento e endereço.\n"
        "Posso perguntar sobre nome, forma de pagamento e endereço de forma separada ou tudo junto — se o cliente enviar os três de uma vez, devo reconhecer e seguir normalmente.\n"
        "Só posso finalizar o pedido e gerar o JSON se o cliente já tiver informado: nome, endereço de entrega e forma de pagamento. Se qualquer uma dessas estiver faltando, não gero o JSON nem finalizo.\n"
        "Se o cliente disser o endereço completo (ex: 'Rua Copacabana, 111, Boa Parada, Barueri - SP'), devo identificar e separar corretamente o nome da rua e o número da casa e adicionar os valores no json nos campos street e houseNumber respectivamente.\n"
        "Se o cliente confirmar o endereço, finalizo o pedido e exibo o JSON formatado dentro de um bloco de código com ```json no início e ``` no final, assim:\n\n"
        "```json\n"
        "{\n"
        '  "nome_cliente": "João",\n'
        '  "endereco_entrega": "Rua X, 123",\n'
        '  "taxa_entrega": null,\n'
        '  "preco_total": 42.00,\n'
        '  "forma_pagamento": "dinheiro",\n'
        '  "status_pedido": "",\n'
        '  "latitude": 0.0,\n'
        '  "longitude": 0.0,\n'
        '  "houseNumber": 0,\n'
        '  "street": "",\n'
        '  "itens": [\n'
        '    {\n'
        '      "produto": "pizza",\n'
        '      "sabor": "frango 2",\n'
        '      "quantidade": 1,\n'
        '      "observacao": "25cm"\n'
        '    }\n'
        '  ]\n'
        "}\n"
        "```"
        "⚠️ Importante:\n"
        "- Nunca aceito taxa de entrega dita pelo cliente. A taxa de entrega será entregue a mim por meio da variável taxa. Se o cliente insistir eu respondo: A taxa de entrega será calculada automaticamente pelo sistema na finalização, tá?\n"
        "- Nunca assumo sabor, tamanho, quantidade ou forma de pagamento sem perguntar.\n"
        "- Se o sabor tiver variações (frango, calabresa, atum, baiana, carne seca, lombo, palmito, três queijos), mostro todas e pergunto qual o cliente prefere.\n"
        "- Se ele já disser uma variação correta (ex: 'frango 2'), não repito as opções. Se errar (ex: 'frango 5'), corrijo: Esse sabor não temos, mas temos frango 1, 2 e 3. Quer ver os ingredientes?\n"
        "- Se pedir “pizza de esfiha”, explico: Temos pizza e esfiha, mas não pizza de esfiha. Quer ver os sabores de cada um?\n"
        "- Se o cliente disser “pizza de x 25” ou “pizza x 35”, entendo que está se referindo a centímetros (25cm = média, 35cm = grande).\n"
        "Doces:\n"
        "Suflair 5,50\nKit Kat ao leite 5,50\nKit Kat branco 5,50\nKit Kat dark 5,50\nBis extra original 5,50\nAzedinho 1,00\nCaribe 4,00\nHalls 2,00\nTrident 2,50\n"
        "outros:\n"
        "salgadinho fofura - R$ 4,00\npipoca - R$ 4,00\n"
        "Bebidas disponíveis:\n"
        "Sucos Prats • 900ml (uva ou laranja) — R$ 18,00 • 1,5L (uva ou laranja) — R$ 30,00\n"
        "Suco Natural One • 300ml (uva ou laranja) — R$ 5,00 • 900ml (uva, laranja ou pêssego) — R$ 18,00 • 2L (uva ou laranja) — R$ 30,00\n"
        "Suco Del Valle • 1 litro — R$ 15,00 • Lata 290ml (pêssego, maracujá, goiaba ou manga) — R$ 7,00\n"
        "Água mineral • Com ou sem gás — R$ 3,00\n"
        "Refrigerantes 2 litros • Coca-Cola — R$ 15,00 • Fanta Laranja — R$ 15,00 • Sprite — R$ 15,00 • Sukita (uva ou laranja) — R$ 12,00\n"
        "Cervejas em lata • Skol 350ml — R$ 5,00 • Skol Latão — R$ 7,00 • Brahma Latão — R$ 7,00 • Brahma Duplo Malte — R$ 8,00\n"
        "Cervejas long neck — R$ 10,00 • Budweiser (normal ou zero) • Amstel • Stella Artois • Heineken\n"
        "Cervejas 600ml — R$ 15,00 • Original • Stella Artois\n"
        "Vinho Pérgola — R$ 30,00 • Opções: seco ou suave\n"
        "Outras bebidas:  • Cabaré Ice — R$ 12,00 • Smirnoff — R$ 12,00 • Energético Monster — R$ 12,00 • Schweppes — R$ 6,00\n"
        "Quando informar ao cliente os ingredientes de uma pizza, devo sempre falar o termo \"molho artesanal\" onde o ingrediente for \"molho\"\n"
        "Sabores de pizza:\n"
        "alho: 32.00 / 42.00 - molho, muçarela, alho, azeitona e orégano\n"
        "atum 1: 34.00 / 57.00 - molho, atum, cebola, azeitona e orégano\n"
        "atum 2: 35.00 / 55.00 - molho, atum, muçarela, cebola, tomate picado, azeitona e orégano\n"
        "bacon: 28.00 / 47.00 - molho, muçarela, bacon, azeitona e orégano\n"
        "baiana 1: 29.00 / 45.00 - molho, calabresa, ovo, cebola, pimenta, azeitona e orégano\n"
        "baiana 2: 30.00 / 50.00 - molho, calabresa, muçarela, ovo, cebola, pimenta, azeitona e orégano\n"
        "batata palha: 30.00 / 42.00 - molho, muçarela, batata palha, azeitona e orégano\n"
        "bauru: 29.00 / 48.00 - molho, presunto ralado, tomate picado, muçarela, azeitona e orégano\n"
        "brócolis: 35.00 / 51.00 - molho, brócolis, bacon, muçarela, azeitona e orégano\n"
        "caipira: 38.00 / 55.00 - molho, frango, muçarela, milho, bacon, azeitona e orégano\n"
        "calabacon: 35.00 / 50.00 - molho, calabresa, catupiry, bacon, azeitona e orégano\n"
        "calabresa 1: 26.00 / 39.00 - molho, calabresa, cebola, azeitona e orégano\n"
        "calabresa 2: 32.00 / 46.00 - molho, calabresa, tomate, ovo, bacon, azeitona e orégano\n"
        "carne seca 1: 35.00 / 55.00 - molho, carne seca com muçarela, azeitona e orégano\n"
        "carne seca 2: 38.00 / 60.00 - molho, carne seca com vinagrete, muçarela, azeitona e orégano\n"
        "catubresa: 33.00 / 48.00 - molho, calabresa, catupiry, azeitona e orégano\n"
        "champion: 30.00 / 45.00 - molho, champion, azeitona e orégano\n"
        "cinco queijos: 38.00 / 60.00 - molho, catupiry, gorgonzola, muçarela, provolone, parmesão, azeitona e orégano\n"
        "cubana: 35.00 / 48.00 - molho, calabresa, vinagrete, parmesão, bacon, azeitona e orégano\n"
        "dois queijos: 31.00 / 45.00 - molho, catupiry, muçarela, azeitona e orégano\n"
        "escarola: 31.00 / 48.00 - molho, escarola, muçarela, bacon, azeitona e orégano\n"
        "frango 1: 32.00 / 49.00 - molho, frango com catupiry, azeitona e orégano\n"
        "frango 2: 32.00 / 49.00 - molho, frango com muçarela, azeitona e orégano\n"
        "frango 3: 32.00 / 49.00 - molho, frango com cheddar, azeitona e orégano\n"
        "hot-dog: 35.00 / 50.00 - molho, salsicha, batata palha, azeitona, catupiry e orégano\n"
        "lombo 1: 35.00 / 52.00 - molho, muçarela, lombo, tomate, azeitona e orégano\n"
        "lombo 2: 38.00 / 55.00 - molho, lombo, catupiry, azeitona e orégano\n"
        "marguerita: 32.00 / 48.00 - molho, muçarela, manjericão, tomate seco, azeitona e orégano\n"
        "meio a meio: 26.00 / 39.00 - molho, muçarela, calabresa, azeitona e orégano\n"
        "mexicana: 33.00 / 45.00 - molho, calabresa, parmesão, azeitona e orégano\n"
        "muçabresa: 32.00 / 45.00 - molho, muçarela, calabresa, azeitona e orégano\n"
        "muçarela: 26.00 / 39.00 - molho, muçarela, azeitona e orégano\n"
        "palmito 1: 32.00 / 50.00 - molho, palmito, muçarela, azeitona e orégano\n"
        "palmito 2: 35.00 / 55.00 - molho, palmito, catupiry, azeitona e orégano\n"
        "peperone: 35.00 / 58.00 - molho, peperone, muçarela, azeitona e orégano\n"
        "portuguesa: 32.00 / 48.00 - molho, presunto, ovo, milho, ervilha, palmito, cebola, muçarela, azeitona e orégano\n"
        "à moda: 35.00 / 55.00 - calabresa, ovo, pimentão, catupiry, muçarela e orégano\n"
        "toscana: 30.00 / 46.00 - molho, linguiça ralada, cebola, muçarela, tomate, azeitona e orégano\n"
        "três queijos 1: 32.00 / 46.00 - molho, catupiry, muçarela, cheddar, azeitona e orégano\n"
        "três queijos 2: 33.00 / 49.00 - molho, catupiry, provolone, muçarela, azeitona e orégano\n"
        "quatro queijos: 35.00 / 54.00 - molho, catupiry, muçarela, parmesão, provolone, azeitona e orégano\n"
        "banana: 33.00 / 45.00 - banana, leite condensado, canela e chocolate\n"
        "brigadeiro: 33.00 / 45.00 - chocolate e granulado\n"
        "carmela: 31.00 / 43.00 - banana e chocolate branco\n"
        "romeu e julieta: 35.00 / 55.00 - muçarela e goiabada\n"
        "morango: 30.00 / 45.00 - chocolate ao leite e morango\n"
        "mm's: 33.00 / 50.00 - chocolate ao leite e MM's\n"
        "ovo maltine: 35.00 / 55.00 - chocolate ao leite e ovo maltine\n"
        "prestígio: 31.00 / 43.00 - chocolate ao leite e coco\n"
        "chocolate: 29.00 / 40.00 - chocolate ao leite\n\n"
        "Sabores de esfiha:\n"
        "Carne: 3.50\nCalabresa: 3.50\nQueijo: 4.00\nMilho: 4.20\nAlho: 4.20\nBauru: 4.40\n"
        "Carne c/ Queijo: 4.40\nCarne c/ Catupiry: 4.40\nCalabresa c/ Queijo: 4.40\nCalabresa c/ Cheddar: 4.40\n"
        "Calabresa c/ Catupiry: 4.40\nEscarola: 4.40\nBacon: 4.40\nAtum: 4.40\nPalmito c/ Catupiry: 4.40\n"
        "Palmito c/ Queijo: 4.40\nFrango c/ Catupiry: 4.40\nFrango c/ Queijo: 4.40\nFrango c/ Cheddar: 4.40\n"
        "Frango c/ Queijo e Milho: 4.80\nFrango c/ Queijo, Milho e Bacon: 4.80\nFrango c/ Catupiry e Bacon: 4.80\n"
        "Calabresa c/ Queijo e Bacon: 4.80\nCalabresa c/ Catupiry e Bacon: 4.80\nAtum c/ Queijo: 4.80\n"
        "Atum c/ Catupiry: 4.80\nAtum c/ Cheddar: 4.80\nBrócolis: 4.80\nCarne Seca: 4.80\nDois Queijos: 4.80\n"
        "Sonho de Valsa: 8.00\nM&M’s: 8.00\nBrigadeiro: 8.00\nCarmela: 8.00\nPrestígio: 8.00\n"
        "Ovo Maltine: 8.00\nRomeu e Julieta: 8.00\nChocolate: 8.00\nPaçoca: 8.00\nMorango: 8.00\nOuro Branco: 8.00\nUva: 8.00\n\n"
        "Bomba chocolate: 29.00\n Bomba Sonho de Valsa: 35.00\n Bomba Avelã: 29.00\n Bomba Prestígio: 31.00\n Bomba OvoMaltine: 32.00\n Bomba MM's: 35.00\n Bomba Brigadeiro: 31.00\n"
        "- Se o cliente perguntar quais as formas de pagamento, ou disser uma forma que não aceitamos, respondo com: \"Aceitamos apenas pix, débito e crédito. Qual você prefere?\" sem emoji nessa frase\n"
        "- Se o cliente mencionar pagamento com dinheiro, boleto, pix parcelado, cartão alimentação ou outra forma não permitida, respondo com: \"Aceitamos apenas pix, débito e crédito. Qual você prefere?\" sem emoji nessa frase\n"
        "- Nunca confirmo formas de pagamento alternativas. Sempre reforço as opções disponíveis: pix, débito ou crédito.\n"
        "- Se o cliente disser algo confuso ou fora do contexto, respondo com gentileza e redireciono a conversa. Exemplo: \"Desculpa, não entendi muito bem. Vamos continuar com o pedido? 😊\"\n"
        "- Se o cliente ficar repetindo algo que já respondi ou sair muito do fluxo, digo com calma: \"Vamos seguir com o pedido? Me diga o sabor da pizza ou esfiha que você quer.\"\n"
        "- Se o cliente tentar fazer brincadeiras ou mensagens sem sentido, mantenho a postura profissional e respondo de forma objetiva e gentil.\n"
        "Se o cliente concluir o pedido de comida e não tiver escolhido nenhuma bebida, posso perguntar gentilmente: \"Deseja incluir alguma bebida para acompanhar? Temos refris, sucos, água e mais 😊\"\n"
        "Se o cliente disser que quer pagar com cartão, devo perguntar: \"Você prefere pagar no débito ou crédito?\" sem emoji nessa frase\n"
        "Se o cliente disser que quer mudar o pedido (isso não se aplica a endereços), devo analisar se ele especificou o que deseja alterar:\n"
        "- Se ele **ainda não disse os itens**, respondo: \"Sem problemas! Vamos corrigir. O que você gostaria de mudar?\"\n"
        "- Se ele **já informou o que quer mudar**, respondo: \"Claro! Só 1 minutinho, vou verificar com a equipe se ainda é possível fazer a alteração no seu pedido. 😊\"\n"
        "Quando o cliente disser o item que deseja (ex: 'quero uma pizza de frango 1 grande'), devo apenas confirmar de forma leve e seguir com o pedido, sem dar preço nem pedir nome, endereço ou forma de pagamento ainda. Exemplo de resposta adequada: 'Pizza de frango 1 grande, certo? 😋 Quer adicionar mais alguma coisa ou posso seguir com seu pedido?'\n"
        "Nunca devo dar o preço do item sozinho. O preço será mostrado apenas ao final do pedido, com o total calculado automaticamente.\n"
        "Nunca devo pedir nome, endereço ou forma de pagamento enquanto o cliente ainda estiver escolhendo os itens. Esses dados só devem ser solicitados **depois** que o cliente disser que é só isso ou que quer fechar o pedido.\n"
        "Devo evitar respostas longas e cheias de informação quando o cliente fizer um pedido. Mantenho a resposta curta, simpática e fluida.\n"
        "Se o cliente pedir o cardápio OU perguntar quais os sabores de pizza/esfiha OU quais bebidas/sobremesas/comida temos, responda apenas com a palavra especial: [ENVIAR_CARDAPIO_PDF]. Assim, o sistema detecta essa palavra e envia o PDF do cardápio automaticamente. Não envio nunca o cardápio em texto, apenas o PDF.\n"
        "Após descobrir o sabor da pizza que o cliente deseja, pergunto qual é o tamanho, média ou grande."
        "### SOLICITAÇÃO DE ATENDENTE REAL ###"
        "- Se o cliente pedir para falar com um atendente real, uma pessoa de verdade ou usar expressões similares (ex: \"quero falar com alguém\", \"chama um atendente\", \"não quero bot\"), devo responder com gentileza: \"Beleza, já chamei um atendente pra te ajudar! 😊 É só aguardar um pouquinho, tá?\"\n"
        "- Após essa mensagem, não continuo o fluxo do pedido até que o atendente real assuma a conversa, nem após isso.\n"
    )
}]

def gerar_mensagem_amigavel(json_pedido, id_pedido):
    try:
        itens = json_pedido.get("itens", [])
        total_pedido = json_pedido.get("preco_total", 0)
        taxa = json_pedido.get("taxa_entrega", 0)
        nome = json_pedido.get("nome_cliente", "cliente")
        pagamento = json_pedido.get("forma_pagamento", "").capitalize()
        endereco = json_pedido.get("endereco_entrega", "")

        itens_formatados = []
        for item in itens:
            sabor = item.get("sabor", "sabor desconhecido")
            qtd = item.get("quantidade", 1)
            obs = item.get("observacao", "")
            linha = f"- {qtd}x {sabor} ({obs})"
            itens_formatados.append(linha)

        numero = f"*{id_pedido}*" if id_pedido else ""
        mensagem = (
            f"Pedido {numero}\n"
            f"🍕 Seu pedido ficou assim:\n\n"
            f"{chr(10).join(itens_formatados)}\n"
            f"- Taxa de entrega: R$ {taxa:.2f}\n"
            f"- Total a pagar: R$ {total_pedido}\n\n"
            f"🧾 Pagamento: {pagamento}\n"
            f"📍 Entrega em: {endereco}\n\n"
            f"Obrigado pelo pedido, {nome}! Em breve estaremos aí. 😄"
        )
        return mensagem
    except Exception as e:
        return f"⚠️ Erro ao montar resumo amigável: {str(e)}"

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

def calcular_taxa_entrega(endereco_destino):
    distancia = calcular_distancia_km(endereco_destino)
    taxa = distancia * 3 if distancia else 0
    return round(taxa, 2)

def conectar_banco():
    return pymysql.connect(
        host="localhost",
        user="root",
        password=db_pass,
        database=db_name
    )

def enviar_msg(msg, lista_msgs=[]):
    try:
        lista_msgs.append({"role": "user", "content": msg})
        resposta = client.chat.completions.create(
            model="gpt-4o",
            messages=lista_msgs
        )
        print(f"📥 Resposta da OpenAI: {resposta.choices[0].message.content}")
        return resposta.choices[0].message.content
    except Exception as e:
        print(f"❌ Erro ao chamar API da OpenAI: {e}")
        return "⚠️ Desculpe, estou com problemas para responder agora. Tente novamente em alguns minutos!"

def extrair_json_da_resposta(resposta):
    import re, json
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
        conn = conectar_banco()
        cursor = conn.cursor()
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
        response = requests.post(url, json=payload, headers=headers)
        print(f"📤 Resposta do WhatsApp API: {response.status_code} {response.text}")
        if response.status_code == 200:
            print("✅ Mensagem enviada com sucesso!")
        else:
            print(f"❌ Erro ao enviar mensagem: {response.status_code} {response.text}")
    except Exception as e:
        print(f"🔥 Exceção ao tentar enviar mensagem: {e}")

last_msgs = {}

def limpar_notificacoes_expiradas():
    print("🧹 Iniciando limpeza de notificações expiradas...")
    while True:
        try:
            agora = datetime.now(pytz.timezone("America/Sao_Paulo"))
            print("🕒 Verificando notificações expiradas...")
            conn = conectar_banco()
            cursor = conn.cursor()
            for id_notif, notif in list(notificacoes_ativas.items()):
                try:
                    timestamp = datetime.strptime(notif['timestamp'], "%Y-%m-%d %H:%M:%S")
                    timestamp = pytz.timezone("America/Sao_Paulo").localize(timestamp)
                    if (agora - timestamp).total_seconds() > 3600:  # 1 hora
                        # Atualizar status no banco
                        query = "UPDATE notificacoes SET status = 'expirada' WHERE id_notificacao = %s"
                        cursor.execute(query, (id_notif,))
                        conn.commit()
                        # Remover do dicionário
                        del notificacoes_ativas[id_notif]
                        sio.emit('notificacao_removida', {'id_notificacao': id_notif})
                        print(f"🗑️ Notificação {id_notif} removida (expirada)")
                except Exception as e:
                    print(f"❌ Erro ao processar notificação {id_notif}: {e}")
            cursor.close()
            conn.close()
            eventlet.sleep(60)
        except Exception as e:
            print(f"❌ Erro na limpeza de notificações: {e}")
            eventlet.sleep(60)
      
    
@app.route("/notificacoes/ativas", methods=["GET"])
def listar_notificacoes_ativas():
    print("📥 Requisição recebida em /notificacoes/ativas")
    try:
        conn = conectar_banco()  # Função existente para conectar ao MySQL
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

        # Sincronizar com notificacoes_ativas (opcional)
        notificacoes_ativas.clear()  # Limpa o dicionário para evitar duplicatas
        for notif in notificacoes:
            # Converter timestamp para string no formato esperado
            notif['timestamp'] = notif['timestamp'].strftime("%Y-%m-%d %H:%M:%S")
            notificacoes_ativas[notif['id_notificacao']] = notif

        print(f"📋 Notificações ativas recuperadas do banco: {notificacoes_ativas}")
        return jsonify(list(notificacoes_ativas.values())), 200
    except Exception as e:
        print(f"❌ Erro ao listar notificações ativas: {e}")
        return {"error": str(e)}, 500
    
# Endpoint para atualizar status de notificação
@app.route("/notificacoes/<id_notificacao>/status", methods=["PUT"])
def atualizar_status_notificacao(id_notificacao):
    data = request.get_json()
    novo_status = data.get("status")
    if novo_status not in ["pendente", "atendida", "rejeitada"]:
        return {"error": "Status inválido"}, 400
    try:
        if id_notificacao in notificacoes_ativas:
            notificacoes_ativas[id_notificacao]["status"] = novo_status
            sio.emit("notificacao_atualizada", {
                "id_notificacao": id_notificacao,
                "status": novo_status
            })
            # Se atendida ou rejeitada, remover da lista
            if novo_status in ["atendida", "rejeitada"]:
                numero_cliente = notificacoes_ativas[id_notificacao]["numero_cliente"]
                mensagem_cliente = (
                    "Alteração confirmada! Seu pedido foi atualizado. 😊" if novo_status == "atendida" else
                    "Desculpe, não foi possível alterar o pedido no momento. 😔 Quer tentar outra alteração?"
                )
                if notificacoes_ativas[id_notificacao]["tipo"] == "mudanca":
                    enviar_whatsapp(numero_cliente, mensagem_cliente)
                del notificacoes_ativas[id_notificacao]
                sio.emit("notificacao_removida", {"id_notificacao": id_notificacao})
            print(f"✅ Status da notificação {id_notificacao} atualizado para {novo_status}")
            return {"message": "Status atualizado com sucesso"}, 200
        else:
            return {"error": "Notificação não encontrada"}, 404
    except Exception as e:
        print(f"❌ Erro ao atualizar status da notificação: {e}")
        return {"error": str(e)}, 500


@app.route("/notificacoes", methods=["POST"])
def criar_notificacao():
    print("📥 Requisição recebida em /notificacoes (POST)")
    try:
        data = request.get_json()
        id_notificacao = str(uuid.uuid4())  # Gera um ID único para a notificação
        numero_cliente = data.get("numero_cliente")
        mensagem = data.get("mensagem")
        tipo = data.get("tipo", "atendente_real")
        status = data.get("status", "pendente")
        timestamp = datetime.now(pytz.timezone("America/Sao_Paulo")).strftime("%Y-%m-%d %H:%M:%S")

        if not numero_cliente or not mensagem:
            print("❌ Dados incompletos na requisição")
            return {"error": "numero_cliente e mensagem são obrigatórios"}, 400

        notificacao = {
            "id_notificacao": id_notificacao,
            "numero_cliente": numero_cliente,
            "mensagem": mensagem,
            "tipo": tipo,
            "status": status,
            "timestamp": timestamp
        }

        notificacoes_ativas[id_notificacao] = notificacao
        print(f"✅ Notificação registrada: {notificacao}")

        # Emitir evento para o frontend
        sio.emit("notificacao_nova", notificacao)
        print(f"📡 Notificação emitida via Socket.IO: {id_notificacao}")

        return {"message": "Notificação criada com sucesso", "id_notificacao": id_notificacao}, 201
    except Exception as e:
        print(f"❌ Erro ao criar notificação: {e}")
        return {"error": str(e)}, 500


@app.route("/webhook", methods=["GET", "POST"])
def webhook():
    if request.method == 'GET':
        token = request.args.get('hub.verify_token')
        challenge = request.args.get('hub.challenge')
        print(f"📥 Recebido GET no webhook: token={token}, challenge={challenge}")
        if token == webhook_verify_token:
            return challenge, 200
        return "Token inválido!", 403

    elif request.method == 'POST':
        print("📥 Recebido POST no webhook")
        data = request.get_json()
        try:
            value = data['entry'][0]['changes'][0]['value']
            if 'messages' not in value:
                print("⚠️ Nenhuma mensagem nova encontrada")
                return 'No new message', 200

            msg = value['messages'][0]
            from_num = msg['from']
            msg_id = msg.get('id')
            text = msg.get('text', {}).get('body', '').lower()
            print(f"📨 Mensagem recebida de {from_num}: {text}, ID: {msg_id}")

            # Verificação de duplicidade
            if from_num in last_msgs and last_msgs[from_num] == msg_id:
                print("⚠️ Mensagem duplicada ignorada")
                return 'Duplicate message', 200
            last_msgs[from_num] = msg_id

            # Histórico individual
            if from_num not in historico_usuarios:
                historico_usuarios[from_num] = prompt_template.copy()

            historico_usuarios[from_num].append({"role": "user", "content": text})
            resposta = enviar_msg("", historico_usuarios[from_num])
            print(f"🤖 Resposta do chatbot: {resposta}")
            historico_usuarios[from_num].append({"role": "assistant", "content": resposta})

            # Enviar PDF se pedir o cardápio
            if resposta.strip() == "[ENVIAR_CARDAPIO_PDF]":
                print("📄 Solicitação de envio de cardápio PDF")
                resultado_upload = upload_pdf_para_whatsapp()
                media_id = resultado_upload
                if media_id:
                    enviar_pdf_para_cliente(from_num)
                else:
                    print("❌ Erro ao fazer upload do PDF:", resultado_upload)
                return "ok", 200


            if resposta.strip() == "Beleza, já chamei um atendente pra te ajudar! 😊 É só aguardar um pouquinho, tá?":
                print(f"📞 Solicitação de atendente real para {from_num}")
                enviar_whatsapp(from_num, resposta)

                # Registrar notificação diretamente
                print("📞 Preparando para registrar notificação...")
                try:
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
                    # Salvar no banco
                    conn = conectar_banco()
                    cursor = conn.cursor()
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

                    # Adicionar ao dicionário
                    notificacoes_ativas[id_notificacao] = notificacao
                    print(f"✅ Notificação registrada diretamente: {notificacao}")
                    sio.emit("notificacao_nova", notificacao)
                    print(f"📡 Notificação emitida via Socket.IO: {id_notificacao}")
                except Exception as e:
                    print(f"❌ Erro ao registrar notificação: {e}")

                return "ok", 200
            
            if "```json" not in resposta:
                print(f"📤 Enviando resposta para {from_num}: {resposta}")
                enviar_whatsapp(from_num, resposta)

            json_pedido = extrair_json_da_resposta(resposta)
            print(f"📋 JSON extraído: {json_pedido}")

            if json_pedido:
                endereco = json_pedido.get("endereco_entrega")
                if endereco:
                    print(f"📍 Processando endereço: {endereco}")
                    # Extrair rua e número
                    street, houseNumber = extrair_rua_numero(endereco)
                    json_pedido["street"] = street
                    json_pedido["houseNumber"] = houseNumber

                    # Calcular taxa de entrega
                    distancia_km = calcular_distancia_km(endereco)
                    if distancia_km is None:
                        print("❌ Endereço inválido detectado")
                        enviar_whatsapp(from_num, "❌ Endereço inválido. Verifique e envie novamente.")
                        return 'ENDERECO_INVALIDO', 200

                    if distancia_km > 15:
                        print("🚫 Endereço fora do raio de entrega")
                        enviar_whatsapp(from_num, "🚫 Fora do nosso raio de entrega (15 km).")
                        return 'FORA_RAIO', 200

                    taxa = round(distancia_km * 3, 2)
                    json_pedido["taxa_entrega"] = taxa
                    json_pedido["preco_total"] = round(json_pedido.get("preco_total", 0) + taxa, 2)
                    print(f"💰 Taxa de entrega calculada: R${taxa}")

                    # Obter coordenadas
                    lat, lng = pegar_coordenadas(endereco)
                    json_pedido["latitude"] = lat if lat is not None else 0.0
                    json_pedido["longitude"] = lng if lng is not None else 0.0
                    print(f"🗺️ Coordenadas: lat={lat}, lng={lng}")

                    historico_usuarios[from_num].append({
                        "role": "system",
                        "content": f"A taxa de entrega é {taxa:.2f} reais."
                    })

                try:
                    print(f"📤 Enviando pedido ao backend: {json_pedido}")
                    r = requests.post("http://localhost:3000/pedido/post", json=json_pedido)
                    if r.status_code == 200:
                        resumo = gerar_mensagem_amigavel(json_pedido, id_pedido=pegar_ultimo_id_pedido())
                        sleep(2)
                        enviar_whatsapp(from_num, resumo)
                        print("✅ Pedido enviado ao backend!")
                    else:
                        print(f"❌ Erro ao enviar pedido: {r.status_code} {r.text}")
                        enviar_whatsapp(from_num, "⚠️ Erro ao processar o pedido. Tente novamente!")
                except Exception as e:
                    print(f"❌ Erro de conexão com o backend: {e}")
                    enviar_whatsapp(from_num, "⚠️ Erro ao conectar com o sistema. Tente novamente!")

            return 'EVENT_RECEIVED', 200

        except Exception as e:
            print("⚠️ Erro ao processar mensagem:", str(e))
            traceback.print_exc()
            return 'erro', 400
        
def carregar_notificacoes_do_banco():
    print("📦 Carregando notificações do banco para notificacoes_ativas...")
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

        print(f"✅ {len(notificacoes)} notificações carregadas: {notificacoes_ativas}")
    except Exception as e:
        print(f"❌ Erro ao carregar notificações do banco: {e}")

if __name__ == '__main__':
    print("🚀 Iniciando configuração do servidor Flask...")
    signal.signal(signal.SIGINT, shutdown_server)  # Captura Ctrl+C
    signal.signal(signal.SIGTERM, shutdown_server)  # Captura SIGTERM
    try:
        wsgi.server_socket = eventlet.listen(('0.0.0.0', 80))
        eventlet.wsgi.server(wsgi.server_socket, app)
        print("✅ Servidor Flask iniciado com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao iniciar o servidor: {e}")