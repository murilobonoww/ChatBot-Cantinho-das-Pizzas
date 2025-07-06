import requests
import os
from dotenv import load_dotenv

load_dotenv()
access_token = os.getenv('WHATSAPP_ACCESS_TOKEN')
fone_id = os.getenv('FONE_ID')
url = f"https://graph.facebook.com/v22.0/{fone_id}/messages"
payload = {
    "messaging_product": "whatsapp",
    "to": "554888484304",
    "type": "text",
    "text": {
        "body": "Olá! Tudo bem? Agora você está recebendo mensagens de texto dinâmicas 🚀"
    }
}

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
if(response.status_code):
    print("Msg enviada!")