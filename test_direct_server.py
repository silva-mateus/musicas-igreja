#!/usr/bin/env python3
"""
Teste executando o servidor diretamente
"""
import subprocess
import time
import requests
import threading

def test_server():
    time.sleep(2)  # Aguardar servidor inicializar
    
    try:
        print("\n=== TESTANDO SERVIDOR DIRETO ===")
        
        # Teste 1: GET /api/music
        print("1. Testando GET /api/music...")
        response = requests.get('http://localhost:5000/api/music?page=1&limit=1', timeout=5)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   Erro: {response.text[:200]}...")
        else:
            print("   ✅ Funcionando!")
            
        # Teste 2: GET /health
        print("2. Testando GET /health...")
        response = requests.get('http://localhost:5000/health', timeout=5)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   Erro: {response.text[:200]}...")
        else:
            print("   ✅ Funcionando!")
            
    except Exception as e:
        print(f"❌ Erro ao testar: {e}")

# Iniciar teste em thread separada
test_thread = threading.Thread(target=test_server)
test_thread.start()

print("Iniciando servidor backend...")
print("OBSERVE AS QUERIES DEBUG NO OUTPUT ABAIXO:")
print("=" * 50)

# Executar servidor (vai mostrar as queries debug)
subprocess.run(["python", "app.py"], timeout=10)
