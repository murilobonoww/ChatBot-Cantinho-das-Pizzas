import pika
import json
import requests
from time import sleep
from dotenv import load_dotenv
import os

load_dotenv()

auth = os.getenv("AUTH")

def verify_payment(ch, method, properties, body):
    
    try:
        data = json.loads(body)
        pedido_id = data["orderID"]
        link = data["link"]
        link_id = data["link_id"]
        json_pedido = data["json_pedido"]
    
        while True:
            res = requests.get(f"https://api-homologacao.getnet.com.br/v1/payment-links/{link_id}",
            headers = { "Authorization": f"Bearer {auth}" }
            )
        
            if res.status_code == 200:
                data_req = res.json()
                status_link = data_req.get("status")
                print("status_link")
            
                if status_link == "ACTIVE":
                    print("Pedido ainda não foi pago, confirmando novamente em 5 segundos...")
                    sleep(5)
                elif status_link == "SUCCESSFUL":
                    print(f"Pagamento do pedido {pedido_id} foi confirmado!")
                    r = requests.post("http://192.168.3.5:3000/pedido/post", json=json_pedido)
                    if r.status_code == 200:
                        print(f"Pedido {pedido_id} enviado ao back-end!")
                    else:
                        print(f"Erro ao enviar pedido {pedido_id} para o back-end :(  {r.status_code, r.text}")
                    break
                elif status_link == "SUSPENDED" or status_link == "EXPIRED":
                    print("Link de pagamento suspendido ou expirado :(")
                    break
            else:
                print(res.status_code, res)
                
    except Exception as e:
        print(f"Erro ao verificar pagamento: {e}")
        
    finally:
        ch.basic_ack(delivery_tag=method.delivery_tag)
    
def start_worker():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host='127.0.0.1'))
    channel = connection.channel()
    channel.queue_declare(queue="fila_pagamentos", durable=True)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue="fila_pagamentos", on_message_callback=verify_payment)
    channel.start_consuming()
    
if __name__ == "__main__":
    start_worker()