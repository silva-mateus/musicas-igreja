# REDIRECIONAMENTO PARA O BACKEND CORRETO
# Este arquivo agora é apenas um proxy para o backend/app.py
import sys
import os

# Adicionar backend ao path
sys.path.insert(0, 'backend')

# Importar o app do backend
try:
    import backend.app as backend_app
    app = backend_app.app
    print("✅ App redirecionado para backend/app.py")
except Exception as e:
    print(f"❌ Erro ao importar backend: {e}")
    raise

if __name__ == '__main__':
    print("🔄 Executando backend/app.py...")
    # Usar a configuração do backend
    host = '0.0.0.0'
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    
    app.run(host=host, port=port, debug=debug)
