# Backend API Flask para Sistema de Músicas da Igreja
# Baseado no app.py original, adaptado para ser uma API REST pura

import sys
import os
import sqlite3
import hashlib
from datetime import datetime
from flask import Flask, request, jsonify, send_file, send_from_directory, session
# from flask_session import Session  # Removido para usar sessão padrão do Flask
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import bcrypt
from functools import wraps
from pypdf import PdfReader
import tempfile
import logging
from pathlib import Path
import traceback

# ===============================
# CONFIGURAÇÃO DA APLICAÇÃO
# ===============================

app = Flask(__name__)

# Configuração de ambiente
if os.environ.get('FLASK_ENV') == 'production':
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-secret-key-change-in-production')
else:
    app.config['SECRET_KEY'] = 'dev-secret-key-not-for-production'

# Configuração de sessão (usando sessão padrão do Flask por compatibilidade)
app.config['SESSION_PERMANENT'] = False
# Session(app)  # Comentado para usar sessão padrão do Flask

# Configuração de CORS para desenvolvimento
@app.after_request
def after_request(response):
    # Em produção, especifique os domínios permitidos
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Origin', frontend_url)
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Configuração de caminhos
BASE_DIR = Path(__file__).parent
DATABASE = os.environ.get('DATABASE_PATH', str(BASE_DIR / 'data' / 'pdf_organizer.db'))
UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', str(BASE_DIR / 'uploads'))
ORGANIZED_FOLDER = os.environ.get('ORGANIZED_FOLDER', str(BASE_DIR / 'organized'))
LOG_FOLDER = os.environ.get('LOG_FOLDER', str(BASE_DIR / 'logs'))

# Criar diretórios se não existirem
for folder in [UPLOAD_FOLDER, ORGANIZED_FOLDER, LOG_FOLDER, os.path.dirname(DATABASE)]:
    os.makedirs(folder, exist_ok=True)

# IMPORTAR E REGISTRAR ROTAS ADICIONAIS AQUI (após definição das variáveis)
try:
    # Imports relativos quando executado a partir do diretório backend
    try:
        from app_routes import add_music_routes
        from app_routes_lists import add_list_routes  
        from app_routes_dashboard import add_dashboard_routes
        from app_routes_admin import add_admin_routes
    except ModuleNotFoundError:
        # Imports absolutos quando executado a partir da raiz
        from backend.app_routes import add_music_routes
        from backend.app_routes_lists import add_list_routes  
        from backend.app_routes_dashboard import add_dashboard_routes
        from backend.app_routes_admin import add_admin_routes
    
    # Registrar todas as rotas
    add_music_routes(app, DATABASE, UPLOAD_FOLDER, ORGANIZED_FOLDER)
    add_list_routes(app, DATABASE)
    add_dashboard_routes(app, DATABASE)
    add_admin_routes(app, DATABASE)
    
    # Rotas carregadas com sucesso
    pass
    
except Exception as e:
    print(f"ERRO AO CARREGAR ROTAS: {e}")
    print(f"Stacktrace: {traceback.format_exc()}")

# Configuração de logging
def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(os.path.join(LOG_FOLDER, 'app.log')),
            logging.StreamHandler()
        ]
    )

# ===============================
# UTILITÁRIOS E DECORADORES
# ===============================

def login_required(f):
    """Decorador para verificar se o usuário está logado"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required', 'code': 'UNAUTHORIZED'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Decorador para verificar se o usuário é administrador"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required', 'code': 'UNAUTHORIZED'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        conn.close()
        
        if not user or user[0] != 'admin':
            return jsonify({'error': 'Admin access required', 'code': 'FORBIDDEN'}), 403
        return f(*args, **kwargs)
    return decorated_function

def get_file_hash(file_path):
    """Calcular hash SHA-256 do arquivo"""
    hash_sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()

def extract_pdf_metadata(file_path):
    """Extrair metadados do PDF"""
    try:
        with open(file_path, 'rb') as file:
            pdf = PdfReader(file)
            return len(pdf.pages)
    except Exception as e:
        app.logger.error(f"Error extracting PDF metadata: {e}")
        return None

def verify_password(stored_hash, password):
    """Verificar senha com suporte a bcrypt e werkzeug"""
    try:
        # Se o hash começa com $2b$, é bcrypt
        if stored_hash.startswith('$2b$'):
            return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
        else:
            # Caso contrário, usa werkzeug
            return check_password_hash(stored_hash, password)
    except Exception as e:
        app.logger.error(f"Erro na verificação de senha: {e}")
        return False

# ===============================
# INICIALIZAÇÃO DO BANCO DE DADOS
# ===============================

def init_db():
    """Inicializar banco de dados com todas as tabelas necessárias"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Tabela de usuários
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    # Tabela de arquivos PDF
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pdf_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_name TEXT NOT NULL,
            filename TEXT NOT NULL UNIQUE,
            song_name TEXT,
            artist TEXT,
            category TEXT,
            liturgical_time TEXT,
            musical_key TEXT,
            youtube_link TEXT,
            file_size INTEGER,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            pages INTEGER,
            description TEXT,
            file_hash TEXT,
            uploaded_by INTEGER,
            FOREIGN KEY (uploaded_by) REFERENCES users (id)
        )
    ''')
    
    # Tabela de categorias
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabela de tempos litúrgicos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS liturgical_times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabela de relação arquivo-categoria (muitos para muitos)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS file_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER,
            category_id INTEGER,
            FOREIGN KEY (file_id) REFERENCES pdf_files (id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
            UNIQUE(file_id, category_id)
        )
    ''')
    
    # Tabela de relação arquivo-tempo litúrgico (muitos para muitos)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS file_liturgical_times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER,
            liturgical_time_id INTEGER,
            FOREIGN KEY (file_id) REFERENCES pdf_files (id) ON DELETE CASCADE,
            FOREIGN KEY (liturgical_time_id) REFERENCES liturgical_times (id) ON DELETE CASCADE,
            UNIQUE(file_id, liturgical_time_id)
        )
    ''')
    
    # Tabela de listas de músicas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS merge_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            observations TEXT,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users (id)
        )
    ''')
    
    # Tabela de itens das listas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS merge_list_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            list_id INTEGER,
            pdf_file_id INTEGER,
            order_index INTEGER,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (list_id) REFERENCES merge_lists (id) ON DELETE CASCADE,
            FOREIGN KEY (pdf_file_id) REFERENCES pdf_files (id) ON DELETE CASCADE,
            UNIQUE(list_id, pdf_file_id)
        )
    ''')
    
    conn.commit()
    conn.close()
    app.logger.info("Database initialized successfully")

# ===============================
# ROTAS DE AUTENTICAÇÃO
# ===============================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Registrar novo usuário"""
    data = request.get_json()
    
    if not data or not all(k in data for k in ('username', 'email', 'password')):
        return jsonify({'error': 'Missing required fields'}), 400
    
    username = data['username'].strip()
    email = data['email'].strip().lower()
    password = data['password']
    
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Verificar se usuário já existe
    cursor.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'User already exists'}), 409
    
    # Criar usuário
    password_hash = generate_password_hash(password)
    cursor.execute('''
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
    ''', (username, email, password_hash))
    
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Login automático
    session['user_id'] = user_id
    session['username'] = username
    
    app.logger.info(f"New user registered: {username}")
    return jsonify({
        'message': 'User registered successfully',
        'user': {'id': user_id, 'username': username, 'email': email}
    })

# ===============================
# ROTAS DE SETUP INICIAL
# ===============================

@app.route('/api/setup/status', methods=['GET'])
def setup_status():
    """Verificar se o sistema precisa de configuração inicial"""
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
        admin_count = cursor.fetchone()[0]
        conn.close()
        
        return jsonify({
            'needs_setup': admin_count == 0,
            'admin_exists': admin_count > 0
        })
    except Exception as e:
        app.logger.error(f"Erro ao verificar status do setup: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/api/setup/init', methods=['POST'])
def setup_init():
    """Configuração inicial do sistema"""
    try:
        # Verificar se já existe admin
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
        admin_count = cursor.fetchone()[0]
        
        if admin_count > 0:
            conn.close()
            return jsonify({'error': 'Sistema já configurado'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
            
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        
        if not all([username, email, password, confirm_password]):
            conn.close()
            return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
            
        if password != confirm_password:
            conn.close()
            return jsonify({'error': 'Senhas não coincidem'}), 400
            
        if len(password) < 6:
            conn.close()
            return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
        
        # Verificar se username ou email já existem
        cursor.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Username ou email já existem'}), 400
        
        # Criar usuário admin
        password_hash = generate_password_hash(password)
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, role, is_active, created_at)
            VALUES (?, ?, ?, 'admin', 1, ?)
        ''', (username, email, password_hash, datetime.now()))
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        app.logger.info(f"Setup inicial concluído - Admin criado: {username}")
        
        return jsonify({
            'message': 'Sistema configurado com sucesso! Você pode fazer login agora.',
            'user': {
                'id': user_id,
                'username': username,
                'email': email,
                'role': 'admin'
            },
            'redirect_to_login': True
        })
        
    except Exception as e:
        app.logger.error(f"Erro no setup inicial: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/api/setup/reset', methods=['POST'])
def setup_reset():
    """APENAS PARA DESENVOLVIMENTO: Reset temporário para testar setup"""
    try:
        # Verificar se é desenvolvimento
        if app.config.get('ENV') != 'development' and not app.debug:
            return jsonify({'error': 'Endpoint disponível apenas em desenvolvimento'}), 403
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se já existe backup
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users_backup'")
        backup_exists = cursor.fetchone()
        
        if backup_exists:
            # Se já existe backup, apenas limpar tabela users atual
            cursor.execute('DELETE FROM users')
        else:
            # Se não existe backup, renomear tabela atual para backup
            cursor.execute('ALTER TABLE users RENAME TO users_backup')
            
            # Recriar tabela users vazia
            cursor.execute('''
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )
            ''')
        
        conn.commit()
        conn.close()
        
        app.logger.info("Reset temporário executado - tabela users limpa")
        
        return jsonify({
            'message': 'Reset temporário executado com sucesso',
            'note': 'Use /api/setup/restore para restaurar os dados originais'
        })
        
    except Exception as e:
        app.logger.error(f"Erro no reset temporário: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/api/setup/restore', methods=['POST'])
def setup_restore():
    """APENAS PARA DESENVOLVIMENTO: Restaurar dados originais"""
    try:
        # Verificar se é desenvolvimento
        if app.config.get('ENV') != 'development' and not app.debug:
            return jsonify({'error': 'Endpoint disponível apenas em desenvolvimento'}), 403
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se existe backup
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users_backup'")
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Nenhum backup encontrado'}), 400
        
        # Remover tabela atual e restaurar backup
        cursor.execute('DROP TABLE IF EXISTS users')
        cursor.execute('ALTER TABLE users_backup RENAME TO users')
        
        conn.commit()
        conn.close()
        
        app.logger.info("Dados originais restaurados com sucesso")
        
        return jsonify({
            'message': 'Dados originais restaurados com sucesso'
        })
        
    except Exception as e:
        app.logger.error(f"Erro na restauração: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

# ===============================
# ROTAS DE AUTENTICAÇÃO
# ===============================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login do usuário"""
    try:
        # Verificar se sistema precisa de setup
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
        admin_count = cursor.fetchone()[0]
        
        if admin_count == 0:
            conn.close()
            return jsonify({'error': 'Sistema precisa de configuração inicial', 'needs_setup': True}), 400
        
        data = request.get_json()
        
        if not data or not all(k in data for k in ('username', 'password')):
            conn.close()
            return jsonify({'error': 'Missing username or password'}), 400
        
        username = data['username'].strip()
        password = data['password']
        
        cursor.execute('''
            SELECT id, username, email, password_hash, role, is_active
            FROM users WHERE username = ?
        ''', (username,))
        user = cursor.fetchone()
        
        if not user or not user[5]:  # is_active
            conn.close()
            return jsonify({'error': 'Invalid credentials or inactive user'}), 401
        
        if not verify_password(user[3], password):
            conn.close()
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Atualizar último login
        cursor.execute('UPDATE users SET last_login = ? WHERE id = ?', 
                       (datetime.now(), user[0]))
        conn.commit()
        conn.close()
        
        # Criar sessão
        session['user_id'] = user[0]
        session['username'] = user[1]
        session['role'] = user[4]
        
        app.logger.info(f"User logged in: {username}")
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user[0],
                'username': user[1],
                'email': user[2],
                'role': user[4]
            }
        })
        
    except Exception as e:
        app.logger.error(f"Erro no login: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    """Logout do usuário"""
    username = session.get('username')
    session.clear()
    app.logger.info(f"User logged out: {username}")
    return jsonify({'message': 'Logout successful'})

@app.route('/api/auth/me', methods=['GET'])
@login_required
def get_current_user():
    """Obter informações do usuário atual"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username, email, role, created_at, last_login
        FROM users WHERE id = ?
    ''', (session['user_id'],))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'user': {
            'id': user[0],
            'username': user[1],
            'email': user[2],
            'role': user[3],
            'created_at': user[4],
            'last_login': user[5]
        }
    })

# ===============================
# ROTAS DE ARQUIVOS ESTÁTICOS
# ===============================

@app.route('/files/uploads/<path:filename>')
def serve_upload_file(filename):
    """Servir arquivos de upload"""
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/files/organized/<path:filename>')
def serve_organized_file(filename):
    """Servir arquivos organizados"""
    return send_from_directory(ORGANIZED_FOLDER, filename)

# ===============================
# HEALTH CHECK
# ===============================

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de health check"""
    try:
        # Verificar conectividade do banco
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        conn.close()
        
        # Verificar diretórios
        dirs_ok = all(os.path.exists(d) for d in [UPLOAD_FOLDER, ORGANIZED_FOLDER, LOG_FOLDER])
        
        if dirs_ok:
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'database': 'connected',
                'directories': 'ok',
                'version': '2.0.0'
            }), 200
        else:
            return jsonify({
                'status': 'unhealthy',
                'timestamp': datetime.now().isoformat(),
                'error': 'Missing directories'
            }), 503
            
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'timestamp': datetime.now().isoformat(),
            'error': str(e)
        }), 503

# ===============================
# INICIALIZAÇÃO
# ===============================

if __name__ == '__main__':
    setup_logging()
    init_db()
    
    app.logger.info("="*50)
    app.logger.info("MUSICAS IGREJA API - Iniciando...")
    app.logger.info("="*50)
    app.logger.info(f"Database: {DATABASE}")
    app.logger.info(f"Upload folder: {UPLOAD_FOLDER}")
    app.logger.info(f"Environment: {os.environ.get('FLASK_ENV', 'development')}")
    
    # Endpoint de debug para verificar banco
    @app.route('/api/debug/db', methods=['GET'])
    def debug_db():
        import sqlite3
        try:
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            
            # Verificar estrutura
            cursor.execute("PRAGMA table_info(pdf_files)")
            pdf_cols = [col[1] for col in cursor.fetchall()]
            
            cursor.execute("SELECT COUNT(*) FROM pdf_files")
            pdf_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            
            conn.close()
            
            return jsonify({
                'database_path': DATABASE,
                'pdf_files_columns': pdf_cols,
                'total_pdfs': pdf_count,
                'total_users': user_count,
                'uploaded_by_exists': 'uploaded_by' in pdf_cols
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    host = '0.0.0.0'
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    
    app.run(host=host, port=port, debug=debug)