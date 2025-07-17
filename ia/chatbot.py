from time import sleep
from flask import Flask, request
import requests
from openai import OpenAI
import mysql.connector
from datetime import datetime
import pytz
from dotenv import load_dotenv
import os
import re
import json

load_dotenv()

maps_api_key = os.getenv("MAPS_API_KEY")
gpt_api_key = os.getenv("GPT_API_KEY")
db_pass = os.getenv("DB_PASS")
db_name = os.getenv("DB_NAME")
app_id = os.getenv("APP_ID")
access_token = os.getenv('WHATSAPP_ACCESS_TOKEN')
fone_id = os.getenv('FONE_ID')
client_secret = os.getenv('CLIENT_SECRET')

client = OpenAI(api_key=gpt_api_key)

historico_usuarios = {}

def saudacao():
    hora = datetime.now(pytz.timezone("America/Sao_Paulo")).hour
    if hora < 12:
        return "Bom dia!"
    elif hora < 18:
        return "Boa tarde!"
    else:
        return "Boa noite!"

# Prompt fixo
prompt_template = [{
    "role": "system",
    "content": (
        "Eu sou um atendente simpático da pizzaria Cantinho das Pizzas e do Açaí. Falo sempre de forma educada e direta. Uso listas com espaçamento entre itens.\n\n"
        "✅ Como devo me comportar:\n"
        f"Começo a conversa com uma saudação amigável: \"Olá, {saudacao()}! Como posso ajudar você hoje? 😊\"\n"        "Só devo dizer a saudação inicial (bom dia, boa tarde, ou boa noite) uma única vez, no início da conversa. Depois disso, não repito mais.\n"
        "Se o cliente falou que quer uma pizza ele quer apenas 1.\n"
        "Se o cliente disser logo no início que quer apenas uma pizza (ex: 'quero uma pizza de frango, uma só'), eu não preciso perguntar novamente a quantidade depois. Já devo assumir que é 1 unidade.\n"
        "Nunca devo pedir o preço total ou a taxa de entrega ao cliente. Eu mesmo calculo com base nas quantidades e valores do cardápio.\n"
        "Se o cliente disser que quer 'uma pizza de [sabor]', devo assumir que ele quer apenas uma unidade desse sabor.\n"
        "Não devo fazer o cliente repetir nem confirmar informações anteriores. Apenas sigo perguntando o que ainda falta.\n"
        "Durante o pedido, só faço perguntas relacionadas ao item atual (sabor, tamanho e quantidade). Somente depois de concluir os itens, pergunto nome, forma de pagamento e endereço.\n"
        "Posso perguntar sobre nome, forma de pagamento e endereço de forma separada ou tudo junto — se o cliente enviar os três de uma vez, devo reconhecer e seguir normalmente.\n"
        "Só posso finalizar o pedido e gerar o JSON se o cliente já tiver informado: nome, endereço de entrega e forma de pagamento. Se qualquer uma dessas estiver faltando, não gero o JSON nem finalizo.\n"
        "Se o cliente confirmar o endereço, finalizo o pedido e exibo o JSON formatado dentro de um bloco de código com ```json no início e ``` no final, assim:\n\n"
"```json\n"
"{\n"
'  "nome_cliente": "João",\n'
'  "endereco_entrega": "Rua X, 123",\n'
'  "taxa_entrega": null,\n'
'  "preco_total": 42.00,\n'
'  "forma_pagamento": "dinheiro",\n'
'  "status_pedido": "pendente",\n'
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
        "- Se ele já disser uma variação correta (ex: 'frango 2'), não repito as opções. Se errar (ex: 'frango 5'), corrijo: Esse sabor não temos, mas temos frango 1, 2 e 3. Quer ver os ingredientes de cada um?\n"
        "- Se pedir “pizza de esfiha”, explico: Temos pizza e esfiha, mas não pizza de esfiha. Quer ver os sabores de cada um?\n"
        "- Se o cliente disser “pizza de x 25” ou “pizza x 35”, entendo que está se referindo a centímetros (25cm = média, 35cm = grande).\n"


        "Doces:"
        "Suflair 5,50"
        "Kit ket ao leite 5,50"
        "Kit ket branco 5,50"
        "Kit ket dark 5,50"
        "Bis extra original 5,50"
        "Azedinho 1,00"
        "Caribe 4,00"
        "Halls 2,00"
        "Trident 2,50"
        
        "outros:"
        "salgadinho fofura - R$ 4,00"
        "pipoca - R$ 4,00"

        "Bebidas disponíveis:" 
        "Sucos Prats • 900ml (uva ou laranja) — R$ 18,00 • 1,5L (uva ou laranja) — R$ 30,00"
        "Suco Natural One • 300ml (uva ou laranja) — R$ 5,00 • 900ml (uva, laranja ou pêssego) — R$ 18,00 • 2L (uva ou laranja) — R$ 30,00"
        "Suco Del Valle • 1 litro — R$ 15,00 • Lata 290ml (pêssego, maracujá, goiaba ou manga) — R$ 7,00"
        "Água mineral • Com ou sem gás — R$ 3,00"
        "Refrigerantes 2 litros • Coca-Cola — R$ 15,00 • Fanta Laranja — R$ 15,00 • Sprite — R$ 15,00 • Sukita (uva ou laranja) — R$ 12,00"
        "Cervejas em lata • Skol 350ml — R$ 5,00 • Skol Latão — R$ 7,00 • Brahma Latão — R$ 7,00 • Brahma Duplo Malte — R$ 8,00"
        "Cervejas long neck — R$ 10,00 • Budweiser (normal ou zero) • Amstel • Stella Artois • Heineken"
        "Cervejas 600ml — R$ 15,00 • Original • Stella Artois"
        "Vinho Pérgola — R$ 30,00 • Opções: seco ou suave"
        "Outras bebidas:  • Cabaré Ice — R$ 12,00 • Smirnoff Ice — R$ 12,00 • Energético Monster — R$ 12,00 • Schweppes — R$ 6,00"

        "Sabores de pizza:\n"
        "alho: 32.00 / 42.00 - molho, muçarela e alho frito\n"
        "atum 1: 34.00 / 57.00 - molho, muçarela, atum e cebola\n"
        "atum 2: 35.00 / 55.00 - molho, atum e cebola\n"
        "bacon: 28.00 / 47.00 - molho, muçarela e bacon\n"
        "baiana 1: 29.00 / 45.00 - molho, muçarela, calabresa, cebola e pimenta\n"
        "baiana 2: 30.00 / 50.00 - molho, calabresa, cebola, pimenta e ovo\n"
        "batata palha: 30.00 / 42.00 - molho, muçarela e batata palha\n"
        "bauru: 29.00 / 48.00 - molho, muçarela, presunto e tomate\n"
        "brócolis: 35.00 / 51.00 - molho, muçarela, brócolis e catupiry\n"
        "caipira: 38.00 / 55.00 - molho, frango, milho e catupiry\n"
        "calabacon: 35.00 / 50.00 - molho, calabresa, bacon e muçarela\n"
        "calabresa 1: 26.00 / 39.00 - molho, muçarela, calabresa e cebola\n"
        "calabresa 2: 32.00 / 46.00 - molho, calabresa e cebola\n"
        "carne seca 1: 35.00 / 55.00 - molho, muçarela, carne seca e cebola\n"
        "carne seca 2: 38.00 / 60.00 - molho, carne seca e catupiry\n"
        "catubresa: 33.00 / 48.00 - molho, calabresa, catupiry e muçarela\n"
        "champion: 30.00 / 45.00 - molho, muçarela e champignon\n"
        "cinco queijos: 38.00 / 60.00 - molho, muçarela, catupiry, provolone, gorgonzola e parmesão\n"
        "cubana: 35.00 / 48.00 - molho, presunto, banana, canela e açúcar\n"
        "dois queijos: 31.00 / 45.00 - molho, muçarela e catupiry\n"
        "escarola: 31.00 / 48.00 - molho, escarola refogada e muçarela\n"
        "frango 1: 32.00 / 49.00 - molho, muçarela e frango\n"
        "frango 2: 32.00 / 49.00 - molho, frango e catupiry\n"
        "frango 3: 32.00 / 49.00 - molho, frango, requeijão e milho\n"
        "hot-dog: 35.00 / 50.00 - molho, salsicha, milho, batata palha, ketchup e mostarda\n"
        "lombo 1: 35.00 / 52.00 - molho, muçarela e lombo canadense\n"
        "lombo 2: 38.00 / 55.00 - molho, lombo e catupiry\n"
        "marguerita: 32.00 / 48.00 - molho, muçarela, tomate e manjericão\n"
        "meio a meio: 26.00 / 39.00 - escolha 2 sabores\n"
        "mexicana: 33.00 / 45.00 - molho, carne moída, milho, pimenta e cebola\n"
        "mucabresa: 32.00 / 45.00 - molho, muçarela e calabresa\n"
        "muçarela: 26.00 / 39.00 - molho e muçarela\n"
        "palmito 1: 32.00 / 50.00 - molho, muçarela e palmito\n"
        "palmito 2: 35.00 / 55.00 - molho, palmito e catupiry\n"
        "peperone: 35.00 / 58.00 - molho, muçarela e peperone\n"
        "portuguesa: 32.00 / 48.00 - molho, muçarela, presunto, ovo, cebola, azeitona e pimentão\n"
        "à moda: 35.00 / 55.00 - molho, muçarela, presunto, calabresa, bacon, ovo, cebola e azeitona\n"
        "toscana: 30.00 / 46.00 - molho, muçarela e linguiça toscana\n"
        "três queijos 1: 32.00 / 46.00 - molho, muçarela, catupiry e provolone\n"
        "três queijos 2: 33.00 / 49.00 - molho, muçarela, gorgonzola e catupiry\n"
        "quatro queijos: 35.00 / 54.00 - molho, muçarela, catupiry, provolone e gorgonzola\n"
        "banana: 33.00 / 45.00 - banana, canela e açúcar\n"
        "brigadeiro: 33.00 / 45.00 - chocolate e granulado\n"
        "carmela: 31.00 / 43.00 - banana, doce de leite e canela\n"
        "romeu e julieta: 35.00 / 55.00 - goiabada e muçarela\n"
        "morango: 30.00 / 45.00 - chocolate e morango\n"
        "mm's: 33.00 / 50.00 - chocolate e MM's\n"
        "ovo maltine: 35.00 / 55.00 - chocolate e Ovomaltine\n"
        "prestígio: 31.00 / 43.00 - chocolate e coco ralado\n"
        "chocolate: 29.00 / 40.00 - chocolate\n\n"

        "Sabores de esfiha:\n"
        "Carne: 3.50\nCalabresa: 3.50\nQueijo: 4.00\nMilho: 4.20\nAlho: 4.20\nBauru: 4.40\n"
        "Carne c/ Queijo: 4.40\nCarne c/ Catupiry: 4.40\nCalabresa c/ Queijo: 4.40\nCalabresa c/ Cheddar: 4.40\n"
        "Calabresa c/ Catupiry: 4.40\nEscarola: 4.40\nBacon: 4.40\nAtum: 4.40\nPalmito c/ Catupiry: 4.40\n"
        "Palmito c/ Queijo: 4.40\nFrango c/ Catupiry: 4.40\nFrango c/ Queijo: 4.40\nFrango c/ Cheddar: 4.40\n"
        "Frango c/ Queijo e Milho: 4.80\nFrango c/ Queijo, Milho e Bacon: 4.80\nFrango c/ Catupiry e Bacon: 4.80\n"
        "Calabresa c/ Queijo e Bacon: 4.80\nCalabresa c/ Catupiry Bacon: 4.80\nAtum c/ Queijo: 4.80\n"
        "Atum c/ Catupiry: 4.80\nAtum c/ Cheddar: 4.80\nBrócolis: 4.80\nCarne Seca: 4.80\nDois Queijos: 4.80\n"
        "Sonho de Valsa: 8.00\nM&M’s: 8.00\nBrigadeiro: 8.00\nCarmela: 8.00\nPrestígio: 8.00\n"
        "Ovo Maltine: 8.00\nRomeu e Julieta: 8.00\nChocolate: 8.00\nPaçoca: 8.00\nMorango: 8.00\nOuro Branco: 8.00\nUva: 8.00\n\n"
        
"        - Se o cliente perguntar quais as formas de pagamento, ou disser uma forma que não aceitamos, respondo com: \"Aceitamos apenas pix, débito e crédito. Qual você prefere?\"\n"
"        - Se o cliente mencionar pagamento com dinheiro, boleto, pix parcelado, cartão alimentação ou outra forma não permitida, respondo com: \"Aceitamos apenas pix, débito e crédito. Qual você prefere?\"\n"
"        - Nunca confirmo formas de pagamento alternativas. Sempre reforço as opções disponíveis: pix, débito ou crédito.\n"
"        - Se o cliente disser algo confuso ou fora do contexto, respondo com gentileza e redireciono a conversa. Exemplo: \"Desculpa, não entendi muito bem. Vamos continuar com o pedido? 😊\"\n"
"        - Se o cliente ficar repetindo algo que já respondi ou sair muito do fluxo, digo com calma: \"Vamos seguir com o pedido? Me diga o sabor da pizza ou esfiha que você quer.\"\n"
"        - Se o cliente tentar fazer brincadeiras ou mensagens sem sentido, mantenho a postura profissional e respondo de forma objetiva e gentil.\n"
"Se o cliente concluir o pedido de comida e não tiver escolhido nenhuma bebida, posso perguntar gentilmente: \"Deseja incluir alguma bebida para acompanhar? Temos refris, sucos, água e mais 😊\"\n"
"Se o cliente disser que quer pagar com cartão, devo perguntar: \"Você prefere pagar no débito ou crédito?\" \n"
    
    )
}]

def gerar_mensagem_amigavel(json_pedido):
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

        mensagem = (
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
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password=db_pass,
        database=db_name
    )

def enviar_msg(msg, lista_msgs=[]):
    lista_msgs.append({"role": "user", "content": msg})
    resposta = client.chat.completions.create(
        model="gpt-4o",
        messages=lista_msgs
    )
    return resposta.choices[0].message.content

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

def enviar_whatsapp(to, msg):
    print(f"📝 Mensagem: {msg}")

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

        if response.status_code == 200:
            print("✅ Mensagem enviada com sucesso!")
        else:
            print(f"❌ Erro ao enviar mensagem: {response.status_code} {response.text}")

    except Exception as e:
        print("🔥 Exceção ao tentar enviar mensagem:", e)

app = Flask(__name__)

last_msgs = {}

@app.route('/webhook', methods=['GET', 'POST'])
def webhook():
    if request.method == 'GET':
        token = request.args.get('hub.verify_token')
        challenge = request.args.get('hub.challenge')
        if token == os.getenv("WEBHOOK_VERIFY_TOKEN"):
            return challenge, 200
        print("❌ Token inválido!")
        return "Token inválido!", 403

    elif request.method == 'POST':
        data = request.json
        try:
            value = data['entry'][0]['changes'][0]['value']
            if 'messages' not in value:
                return 'No new message', 200

            msg = value['messages'][0]
            from_num = msg['from']
            msg_id = msg.get('id')
            text = msg.get('text', {}).get('body', '')

            # Proteção contra mensagens duplicadas
            if from_num in last_msgs and last_msgs[from_num] == msg_id:
                print("🔁 Mensagem já processada. Ignorando.")
                return 'Duplicate message', 200
            last_msgs[from_num] = msg_id

            print(f"📨 Mensagem recebida de {from_num}: {text}")

            # Histórico individual
            if from_num not in historico_usuarios:
                historico_usuarios[from_num] = prompt_template.copy()

            historico_usuarios[from_num].append({"role": "user", "content": text})
            
            
            resposta = enviar_msg("", historico_usuarios[from_num])
            historico_usuarios[from_num].append({"role": "assistant", "content": resposta})

            print("🤖 Resposta do chatbot:", resposta)
            # Verifica se a resposta contém JSON formatado
            if "```json" in resposta:
                print("📦 Detecção de JSON: não enviar essa resposta via WhatsApp.")
            else:
                enviar_whatsapp(from_num, resposta)


            # Extração e verificação do JSON de pedido
            json_pedido = extrair_json_da_resposta(resposta)
            
            if json_pedido and json_pedido.get("taxa_entrega") is None and json_pedido.get("endereco_entrega"):
                endereco = json_pedido["endereco_entrega"]
                taxa = calcular_taxa_entrega(endereco)

                historico_usuarios[from_num].append({
                    "role": "system",
                    "content": f"A taxa de entrega é {taxa:.2f} reais."
                })

                json_pedido["taxa_entrega"] = taxa
                json_pedido["preco_total"] = round(json_pedido.get("preco_total", 0) + taxa, 2)
                print("📦 JSON final antes do envio com taxa:")
                print(json.dumps(json_pedido, indent=2, ensure_ascii=False))

                try:
                    r = requests.post("http://localhost:3000/pedido/post", json=json_pedido)
                    print("🔁 Resposta do backend:", r.status_code, r.text)
                    if r.status_code == 200:
                        print("✅ Pedido enviado para o backend!")
                        resumo_amigavel = gerar_mensagem_amigavel(json_pedido)
                        sleep(2)
                        enviar_whatsapp(from_num, resumo_amigavel)
                    else:
                        print("❌ Erro ao enviar pedido:", r.status_code, r.text)
                except Exception as e:
                    print("❌ Erro de conexão com o backend:", e)


            elif json_pedido and json_pedido.get("taxa_entrega") is not None:
                try:
                    headers = {'Content-Type': 'application/json'}
                    r = requests.post("http://localhost:3000/pedido/post", json=json_pedido, headers=headers)
                    
                    print("📤 Tentando enviar ao backend:")
                    print(json.dumps(json_pedido, indent=2, ensure_ascii=False))

                    if r.status_code == 200:
                        print("✅ Pedido enviado para o backend!")
                    else:
                        print("❌ Erro ao enviar pedido:", r.status_code, r.text)
                except Exception as e:
                    print("❌ Erro de conexão com o backend:", e)

            return 'EVENT_RECEIVED', 200

        except Exception as e:
            print("⚠️ Erro ao extrair mensagem ou gerar resposta:", e)
            return 'No message', 200


if __name__ == '__main__':
    app.run(port=80)
