#!/usr/bin/env python3
"""
Script para testar as queries com debug ativado
"""
import sys
import os

# Adicionar backend ao path
sys.path.insert(0, 'backend')

try:
    # Importar backend correto
    import backend.app as backend_app
    app = backend_app.app
    
    print("=== TESTE COM DEBUG DAS QUERIES ===")
    print("Executando requisições para ativar o debug...")
    
    with app.test_client() as client:
        print("\n1. Testando GET /api/music...")
        response = client.get('/api/music?page=1&limit=1')
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   Erro: {response.get_data(as_text=True)}")
        
        print("\n2. Testando GET /api/lists...")
        response = client.get('/api/lists?page=1&limit=1')
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   Erro: {response.get_data(as_text=True)}")
            
    print("\n=== FIM DO TESTE ===")
    
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()
