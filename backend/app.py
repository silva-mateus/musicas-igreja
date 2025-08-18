import os
import sqlite3
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, flash, session
from werkzeug.utils import secure_filename
import pypdf
from pypdf import PdfReader, PdfWriter
import hashlib
import mimetypes
import re
import tempfile
import time
import logging
from logging.handlers import TimedRotatingFileHandler
import sys
# Autenticação removida

app = Flask(__name__)

# Configuração CORS para desenvolvimento
@app.after_request
def after_request(response):
    # Permitir requisições do frontend durante desenvolvimento
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Vary', 'Origin')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Tratar preflight CORS
@app.route('/api/<path:any_path>', methods=['OPTIONS'])
def cors_preflight(any_path):
    response = app.make_response(('', 204))
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
    response.headers['Vary'] = 'Origin'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Max-Age'] = '86400'
    return response

# Configurações de produção com variáveis de ambiente
app.secret_key = os.environ.get('SECRET_KEY', 'musicas-igreja-secret-key-2024-security-enhanced')
MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 52428800))  # 50MB padrão
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)  # 8 hours session timeout

# Configuration - Suporte a variáveis de ambiente para Docker (definir antes do logging)
# Detectar execução dentro de Docker para escolher diretório padrão de dados
IN_DOCKER = os.path.exists('/.dockerenv') or os.environ.get('RUNNING_IN_DOCKER', '').lower() in ('1', 'true', 'yes')
DEFAULT_DATA_DIR = '/data' if IN_DOCKER else os.path.join(os.path.dirname(__file__), 'data')

UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(DEFAULT_DATA_DIR, 'uploads'))
ORGANIZED_FOLDER = os.environ.get('ORGANIZED_FOLDER', os.path.join(os.path.dirname(__file__), 'organized'))
DATABASE = os.environ.get('DATABASE_PATH', os.path.join(DEFAULT_DATA_DIR, 'pdf_organizer.db'))
LOG_FOLDER = os.environ.get('LOG_FOLDER', os.path.join(DEFAULT_DATA_DIR, 'logs'))
# Helpers para paths organizados: salvar relativo (/organized/...) e resolver para absoluto quando necessário
def to_relative_organized_path(path: str) -> str:
    try:
        # Já relativo
        if path.startswith('/organized/') or path.startswith('organized/'):
            return path if path.startswith('/organized/') else '/' + path
        # Se for dentro da pasta organizada absoluta
        if path.startswith(ORGANIZED_FOLDER):
            rel = os.path.relpath(path, ORGANIZED_FOLDER).replace('\\', '/')
            return f"/organized/{rel}"
    except Exception:
        pass
    return path


def to_absolute_organized_path(path: str) -> str:
    try:
        if path.startswith('/organized/'):
            rel = path[len('/organized/'):]
            return os.path.join(ORGANIZED_FOLDER, rel)
        if path.startswith('organized/'):
            rel = path[len('organized/'):]
            return os.path.join(ORGANIZED_FOLDER, rel)
    except Exception:
        pass
    return path

# OAuth (Google) - permitir HTTP em desenvolvimento local
if os.environ.get('FLASK_ENV', 'development') != 'production':
    os.environ.setdefault('OAUTHLIB_INSECURE_TRANSPORT', '1')
    os.environ.setdefault('OAUTHLIB_RELAX_TOKEN_SCOPE', '1')

# Setup logging to daily log file
def setup_logging():
    """Configure logging to write to daily log files."""
    # Ensure logs directory exists
    os.makedirs(LOG_FOLDER, exist_ok=True)

    # Generate daily log filename
    today = datetime.now().strftime('%Y-%m-%d')
    log_file = f'{LOG_FOLDER}/{today}_sistema.log'

    # Avoid duplicate handlers when the module is reloaded or setup is called twice
    if getattr(app, '_logging_configured', False):
        return log_file
    app.logger.handlers.clear()
    app.logger.propagate = False

    # Configure logging format
    formatter = logging.Formatter(
        '[%(asctime)s] [FLASK-%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Create file handler
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # Configure Flask app logger
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)

    # Also log to console for interactive mode
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)
    app.logger.addHandler(console_handler)

    # Disable default Flask logging to avoid duplicates
    logging.getLogger('werkzeug').setLevel(logging.WARNING)

    app._logging_configured = True
    return log_file

# Initialize logging
current_log_file = setup_logging()

# Log startup
app.logger.info("="*50)
app.logger.info("MUSICAS IGREJA - FLASK APPLICATION STARTING")
app.logger.info("="*50)
app.logger.info(f"Log file: {current_log_file}")
app.logger.info(f"Debug mode: {app.debug}")
app.logger.info(f"Max content length: {app.config['MAX_CONTENT_LENGTH'] / 1024 / 1024:.0f}MB")

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(ORGANIZED_FOLDER, exist_ok=True)

# ==========================================
# SISTEMA SIMPLIFICADO - SEM AUTENTICAÇÃO
# ==========================================

# API-only mode: desativa a interface HTML e permite apenas chamadas /api e /health
API_ONLY = os.environ.get('API_ONLY', 'true').lower() in ('1', 'true', 'yes')

@app.before_request
def enforce_api_only_mode():
    if API_ONLY:
        allowed_prefixes = ('/api', '/health')
        # Permitir arquivos estáticos do Flask? Não necessário para API-only
        if not request.path.startswith(allowed_prefixes):
            return jsonify({
                'success': False,
                'error': 'Interface HTML desativada (API_ONLY). Utilize os endpoints em /api'
            }), 404

# Funções auxiliares simplificadas

def sanitize_filename(text):
    """Sanitizar texto para uso em nomes de arquivos."""
    if not text:
        return ""
    # Remove caracteres inválidos e substitui por underscore
    text = re.sub(r'[<>:"/\\|?*]', '_', text)
    # Remove espaços extras e quebras de linha
    text = re.sub(r'\s+', ' ', text.strip())
    return text

def format_camel_case(text):
    """Formatar texto em title case: primeira letra de cada palavra maiúscula, 
    exceto palavras pequenas que não sejam a primeira palavra."""
    if not text:
        return ""
    
    # Lista de palavras que devem permanecer em minúscula (exceto se forem a primeira palavra)
    small_words = ['a', 'e', 'o', 'as', 'os', 'da', 'de', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 
                   'com', 'por', 'para', 'que', 'se', 'te', 'me', 'lhe', 'la', 'le', 'lo', 'um', 'uma', 'uns', 'umas',
                   'ao', 'aos', 'à', 'às', 'pelo', 'pela', 'pelos', 'pelas', 'sob', 'sobre', 'sem', 'até', 'mas']
    
    words = text.split()
    formatted_words = []
    
    for i, word in enumerate(words):
        # Preservar caracteres especiais e formatação
        if not word.strip():
            formatted_words.append(word)
            continue
            
        # Remove caracteres especiais temporariamente para análise
        clean_word = re.sub(r'[^\w]', '', word.lower())
        
        # Primeira palavra sempre com inicial maiúscula
        # Palavras com mais de 2 letras sempre com inicial maiúscula
        # Palavras de 1-2 letras só em minúscula se não forem a primeira e estiverem na lista
        if i == 0 or len(clean_word) > 2 or clean_word not in small_words:
            # Title case: primeira letra maiúscula, resto minúsculo
            formatted_word = word[0].upper() + word[1:].lower()
            formatted_words.append(formatted_word)
        else:
            formatted_words.append(word.lower())
    
    return ' '.join(formatted_words)

def generate_unique_filename(base_filename, target_directory):
    """Gerar nome de arquivo único, adicionando índice entre parênteses se necessário."""
    if not os.path.exists(target_directory):
        return base_filename
    
    base_name = os.path.splitext(base_filename)[0]
    extension = os.path.splitext(base_filename)[1]
    
    # Verificar se arquivo base já existe
    full_path = os.path.join(target_directory, base_filename)
    if not os.path.exists(full_path):
        return base_filename
    
    # Gerar nomes com índices
    counter = 1
    while True:
        new_filename = f"{base_name} ({counter}){extension}"
        full_path = os.path.join(target_directory, new_filename)
        if not os.path.exists(full_path):
            return new_filename
        counter += 1

def generate_filename(song_name, artist, original_filename, musical_key=None):
    """Gerar nome de arquivo baseado no padrão 'Música - Tom - Artista'."""
    print(f"    [FILENAME] Gerando nome do arquivo:")
    print(f"    [FILENAME] - song_name: '{song_name}'")
    print(f"    [FILENAME] - artist: '{artist}'")
    print(f"    [FILENAME] - musical_key: '{musical_key}'")
    print(f"    [FILENAME] - original_filename: '{original_filename}'")
    
    # Aplicar formatação camel case
    formatted_song = format_camel_case(song_name) if song_name else ""
    formatted_artist = format_camel_case(artist) if artist else ""
    
    print(f"    [FILENAME] - song_name formatado: '{formatted_song}'")
    print(f"    [FILENAME] - artist formatado: '{formatted_artist}'")
    
    # Gerar nome no novo padrão: "Música - Tom - Artista"
    if formatted_song and formatted_artist:
        if musical_key:
            filename = f"{sanitize_filename(formatted_song)} - {musical_key} - {sanitize_filename(formatted_artist)}.pdf"
            print(f"    [FILENAME] - Usando padrão completo 'Música - Tom - Artista': '{filename}'")
        else:
            filename = f"{sanitize_filename(formatted_song)} - {sanitize_filename(formatted_artist)}.pdf"
            print(f"    [FILENAME] - Usando padrão 'Música - Artista' (sem tom): '{filename}'")
    elif formatted_song:
        if musical_key:
            filename = f"{sanitize_filename(formatted_song)} - {musical_key}.pdf"
            print(f"    [FILENAME] - Usando 'Música - Tom': '{filename}'")
        else:
            filename = f"{sanitize_filename(formatted_song)}.pdf"
            print(f"    [FILENAME] - Usando apenas música: '{filename}'")
    elif formatted_artist:
        filename = f"{sanitize_filename(formatted_artist)}.pdf"
        print(f"    [FILENAME] - Usando apenas artista: '{filename}'")
    else:
        # Fallback para nome original
        filename = original_filename
        print(f"    [FILENAME] - Usando nome original: '{filename}'")
    
    print(f"    [FILENAME] - Resultado final: '{filename}'")
    return filename

def move_file_to_category(file_path, old_category, new_category, filename):
    """Mover arquivo entre diretórios de categorias."""
    try:
        print(f"    [MOVE] Iniciando movimentação:")
        print(f"    [MOVE] - Arquivo: {file_path}")
        print(f"    [MOVE] - Categoria antiga: {old_category}")
        print(f"    [MOVE] - Categoria nova: {new_category}")
        print(f"    [MOVE] - Nome desejado: {filename}")
        
        new_category_folder = os.path.join(ORGANIZED_FOLDER, new_category)
        
        # Criar novo diretório se não existir
        if not os.path.exists(new_category_folder):
            print(f"    [MOVE] - Criando diretório: {new_category_folder}")
            os.makedirs(new_category_folder, exist_ok=True)
        
        # Verificar se arquivo origem existe
        if not os.path.exists(file_path):
            print(f"    [MOVE] - ERRO: Arquivo origem não existe!")
            return file_path, os.path.basename(file_path)
        
        # Gerar nome único no destino
        unique_filename = generate_unique_filename(filename, new_category_folder)
        final_path = os.path.join(new_category_folder, unique_filename)
        
        print(f"    [MOVE] - Caminho origem: {file_path}")
        print(f"    [MOVE] - Caminho destino: {final_path}")
        print(f"    [MOVE] - Nome final: {unique_filename}")
        
        # Mover arquivo
        print(f"    [MOVE] - Executando movimentação...")
        shutil.move(file_path, final_path)
        print(f"    [MOVE] - Arquivo movido com sucesso!")
        
        return final_path, unique_filename
        
    except Exception as e:
        print(f"    [MOVE] - ERRO ao mover arquivo: {e}")
        import traceback
        traceback.print_exc()
        return file_path, os.path.basename(file_path)

def scan_and_fix_files():
    """Escanear e corrigir arquivos que precisam de renomeação ou reorganização."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, filename, song_name, artist, category, file_path, musical_key 
        FROM pdf_files
    ''')
    files = cursor.fetchall()
    
    print(f"[DEBUG] Encontrados {len(files)} arquivos no banco de dados")
    
    changes_made = []
    
    for file_data in files:
        file_id, current_filename, song_name, artist, category, current_path, musical_key = file_data
        
        print(f"[DEBUG] Processando arquivo ID {file_id}:")
        print(f"  - Nome atual: {current_filename}")
        print(f"  - Música: {song_name}")
        print(f"  - Artista: {artist}")
        print(f"  - Tom: {musical_key}")
        print(f"  - Categoria: {category}")
        print(f"  - Caminho atual: {current_path}")
        
        # Aplicar formatação camel case nos campos do banco
        formatted_song = format_camel_case(song_name) if song_name else song_name
        formatted_artist = format_camel_case(artist) if artist else artist
        
        # Verificar se precisa atualizar os campos do banco
        needs_db_update = (formatted_song != song_name) or (formatted_artist != artist)
        
        if needs_db_update:
            print(f"  - [FORMATAÇÃO] Aplicando camel case:")
            print(f"    - Música: '{song_name}' -> '{formatted_song}'")
            print(f"    - Artista: '{artist}' -> '{formatted_artist}'")
            
            # Atualizar banco com formatação camel case
            cursor.execute('''
                UPDATE pdf_files 
                SET song_name = ?, artist = ? 
                WHERE id = ?
            ''', (formatted_song, formatted_artist, file_id))
        
        # Gerar nome ideal do arquivo usando os dados formatados
        ideal_filename = generate_filename(formatted_song, formatted_artist, current_filename, musical_key)
        print(f"  - Nome ideal: {ideal_filename}")
        
        # Verificar se arquivo está no diretório correto
        expected_dir = os.path.join(ORGANIZED_FOLDER, category)
        current_dir = os.path.dirname(current_path) if current_path else ""
        
        print(f"  - Diretório atual: {current_dir}")
        print(f"  - Diretório esperado: {expected_dir}")
        
        needs_rename = current_filename != ideal_filename
        needs_move = os.path.normpath(current_dir) != os.path.normpath(expected_dir)
        
        print(f"  - Precisa renomear: {needs_rename}")
        print(f"  - Precisa mover: {needs_move}")
        print(f"  - Arquivo existe: {os.path.exists(current_path) if current_path else False}")
        
        if needs_rename or needs_move or needs_db_update:
            try:
                print(f"  - [AÇÃO] Processando correções...")
                
                # Garantir que o diretório de destino existe
                if not os.path.exists(expected_dir):
                    print(f"  - [AÇÃO] Criando diretório: {expected_dir}")
                    os.makedirs(expected_dir, exist_ok=True)
                
                # Gerar nome único para evitar conflitos
                unique_filename = generate_unique_filename(ideal_filename, expected_dir)
                
                if needs_move or needs_rename:
                    # Mover/renomear arquivo
                    if needs_move:
                        print(f"  - [AÇÃO] Movendo de {current_dir} para {expected_dir}")
                        new_path, new_filename = move_file_to_category(
                            current_path, 
                            os.path.basename(current_dir), 
                            category, 
                            unique_filename
                        )
                        print(f"  - [RESULTADO] Novo caminho: {new_path}")
                        print(f"  - [RESULTADO] Novo nome: {new_filename}")
                    else:
                        # Apenas renomear no mesmo diretório
                        print(f"  - [AÇÃO] Renomeando no mesmo diretório...")
                        new_path = os.path.join(current_dir, unique_filename)
                        
                        if current_path != new_path:
                            if os.path.exists(current_path):
                                print(f"  - [AÇÃO] Renomeando {current_path} -> {new_path}")
                                os.rename(current_path, new_path)
                                new_filename = unique_filename
                            else:
                                print(f"  - [AVISO] Arquivo origem não existe!")
                                new_filename = current_filename
                                new_path = current_path
                        else:
                            print(f"  - [INFO] Caminhos são iguais, sem necessidade de renomear")
                            new_filename = current_filename
                            new_path = current_path
                else:
                    # Só atualização do banco, sem mudança de arquivo
                    new_path = current_path
                    new_filename = current_filename
                
                # Atualizar banco de dados com novos dados
                print(f"  - [AÇÃO] Atualizando banco de dados...")
                cursor.execute('''
                    UPDATE pdf_files 
                    SET filename = ?, file_path = ?, song_name = ?, artist = ? 
                    WHERE id = ?
                ''', (new_filename, new_path, formatted_song, formatted_artist, file_id))
                
                changes_made.append({
                    'id': file_id,
                    'old_filename': current_filename,
                    'new_filename': new_filename,
                    'old_path': current_path,
                    'new_path': new_path,
                    'song_updated': formatted_song != song_name,
                    'artist_updated': formatted_artist != artist
                })
                
                print(f"  - [SUCESSO] Arquivo processado com sucesso!")
                
            except Exception as e:
                print(f"  - [ERRO] Erro ao processar arquivo {file_id}: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"  - [INFO] Arquivo já está correto, nenhuma ação necessária")
        
        print(f"  - [SEPARADOR] " + "="*50)
    
    conn.commit()
    conn.close()
    
    print(f"[DEBUG] Escaneamento concluído. {len(changes_made)} alterações feitas.")
    return changes_made

def get_categories():
    """Buscar todas as categorias do banco de dados."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM categories ORDER BY name')
    categories = [row[0] for row in cursor.fetchall()]
    conn.close()
    return categories

def get_artists():
    """Obter lista de artistas do banco de dados."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM artists ORDER BY name')
    artists = [row[0] for row in cursor.fetchall()]
    conn.close()
    return artists

def get_liturgical_times():
    """Buscar todos os tempos litúrgicos do banco de dados."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM liturgical_times ORDER BY name')
    times = [row[0] for row in cursor.fetchall()]
    conn.close()
    return times

def get_musical_keys():
    """Obter lista de tons musicais."""
    return [
    # Tons maiores
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
    # Tons menores
    'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm'
]

def create_category(name, description=""):
    """Criar nova categoria."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO categories (name, description) VALUES (?, ?)', (name, description))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def create_artist(name, description=""):
    """Criar novo artista."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO artists (name, description) VALUES (?, ?)', (name, description))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def create_liturgical_time(name, description=""):
    """Criar novo tempo litúrgico."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO liturgical_times (name, description) VALUES (?, ?)', (name, description))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def add_file_categories(file_id, category_names):
    """Adicionar múltiplas categorias a um arquivo."""
    if not category_names:
        return
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Primeiro, remover categorias existentes
    cursor.execute('DELETE FROM file_categories WHERE file_id = ?', (file_id,))
    
    for category_name in category_names:
        # Obter ou criar categoria
        cursor.execute('SELECT id FROM categories WHERE name = ?', (category_name,))
        category_result = cursor.fetchone()
        
        if not category_result:
            cursor.execute('INSERT INTO categories (name) VALUES (?)', (category_name,))
            category_id = cursor.lastrowid
        else:
            category_id = category_result[0]
        
        # Adicionar relacionamento
        cursor.execute('''
            INSERT OR IGNORE INTO file_categories (file_id, category_id) 
            VALUES (?, ?)
        ''', (file_id, category_id))
    
    conn.commit()
    conn.close()

def add_file_liturgical_times(file_id, liturgical_time_names):
    """Adicionar múltiplos tempos litúrgicos a um arquivo."""
    if not liturgical_time_names:
        return
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Primeiro, remover tempos litúrgicos existentes
    cursor.execute('DELETE FROM file_liturgical_times WHERE file_id = ?', (file_id,))
    
    for time_name in liturgical_time_names:
        # Obter ou criar tempo litúrgico
        cursor.execute('SELECT id FROM liturgical_times WHERE name = ?', (time_name,))
        time_result = cursor.fetchone()
        
        if not time_result:
            cursor.execute('INSERT INTO liturgical_times (name) VALUES (?)', (time_name,))
            time_id = cursor.lastrowid
        else:
            time_id = time_result[0]
        
        # Adicionar relacionamento
        cursor.execute('''
            INSERT OR IGNORE INTO file_liturgical_times (file_id, liturgical_time_id) 
            VALUES (?, ?)
        ''', (file_id, time_id))
    
    conn.commit()
    conn.close()

def get_file_categories(file_id):
    """Obter todas as categorias de um arquivo."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.name 
        FROM categories c
        JOIN file_categories fc ON c.id = fc.category_id
        WHERE fc.file_id = ?
        ORDER BY c.name
    ''', (file_id,))
    categories = [row[0] for row in cursor.fetchall()]
    conn.close()
    return categories

def get_file_liturgical_times(file_id):
    """Obter todos os tempos litúrgicos de um arquivo."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT lt.name 
        FROM liturgical_times lt
        JOIN file_liturgical_times flt ON lt.id = flt.liturgical_time_id
        WHERE flt.file_id = ?
        ORDER BY lt.name
    ''', (file_id,))
    times = [row[0] for row in cursor.fetchall()]
    conn.close()
    return times

def rename_merge_list(list_id, new_name):
    """Renomear lista de fusão."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE merge_lists 
            SET name = ?, updated_date = CURRENT_TIMESTAMP 
            WHERE id = ?
        ''', (new_name, list_id))
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()

def clean_orphaned_list_items():
    """Limpar itens órfãos de listas que não existem mais."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Encontrar itens órfãos
    cursor.execute('''
        SELECT mli.id, mli.merge_list_id, mli.pdf_file_id
        FROM merge_list_items mli
        LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
        WHERE ml.id IS NULL
    ''')
    orphaned_items = cursor.fetchall()
    
    if orphaned_items:
        print(f"[CLEANUP] Encontrados {len(orphaned_items)} itens órfãos:")
        for item_id, list_id, file_id in orphaned_items:
            print(f"  - Item {item_id}: Lista {list_id} (não existe) -> Arquivo {file_id}")
        
        # Remover itens órfãos
        cursor.execute('''
            DELETE FROM merge_list_items 
            WHERE merge_list_id NOT IN (SELECT id FROM merge_lists)
        ''')
        
        conn.commit()
        print(f"[CLEANUP] {len(orphaned_items)} itens órfãos removidos.")
    else:
        print("[CLEANUP] Nenhum item órfão encontrado.")
    
    conn.close()
    return len(orphaned_items)

def clean_database_and_files():
    """APENAS PARA ADMIN: Limpar completamente banco e arquivos."""
    if not is_user_logged() or not is_admin_logged():
        return False, "Esta função requer acesso de administrador"
    
    try:
        # Remover arquivos organizados
        if os.path.exists(ORGANIZED_FOLDER):
            shutil.rmtree(ORGANIZED_FOLDER)
        os.makedirs(ORGANIZED_FOLDER, exist_ok=True)
        
        # Limpar uploads
        if os.path.exists(UPLOAD_FOLDER):
            for file in os.listdir(UPLOAD_FOLDER):
                os.remove(os.path.join(UPLOAD_FOLDER, file))
        
        # Salvar senha do admin antes de limpar
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT value FROM admin_settings WHERE key = ?', ('admin_password',))
        admin_password = cursor.fetchone()
        conn.close()
        
        # Recrear banco de dados
        if os.path.exists(DATABASE):
            os.remove(DATABASE)
        init_db()
        
        # Restaurar senha do admin
        if admin_password:
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            cursor.execute('INSERT INTO admin_settings (key, value) VALUES (?, ?)', 
                           ('admin_password', admin_password[0]))
            conn.commit()
            conn.close()
        
        return True, "Banco de dados e arquivos limpos com sucesso"
    except Exception as e:
        return False, f"Erro ao limpar: {str(e)}"

def init_db():
    """Inicializar o banco de dados com as tabelas necessárias."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pdf_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            song_name TEXT,
            artist TEXT,
            category TEXT NOT NULL,
            liturgical_time TEXT,
            musical_key TEXT,
            youtube_link TEXT,
            file_path TEXT NOT NULL,
            file_size INTEGER,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_hash TEXT UNIQUE,
            page_count INTEGER,
            description TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS liturgical_times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabela de usuários removida - aplicação sem autenticação
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS merge_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            observations TEXT,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS merge_list_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            merge_list_id INTEGER NOT NULL,
            pdf_file_id INTEGER NOT NULL,
            order_position INTEGER NOT NULL,
            FOREIGN KEY (merge_list_id) REFERENCES merge_lists (id) ON DELETE CASCADE,
            FOREIGN KEY (pdf_file_id) REFERENCES pdf_files (id) ON DELETE CASCADE
        )
    ''')
    
    # Tabelas para relacionamento muitos-para-muitos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS file_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            FOREIGN KEY (file_id) REFERENCES pdf_files (id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
            UNIQUE(file_id, category_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS file_liturgical_times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            liturgical_time_id INTEGER NOT NULL,
            FOREIGN KEY (file_id) REFERENCES pdf_files (id) ON DELETE CASCADE,
            FOREIGN KEY (liturgical_time_id) REFERENCES liturgical_times (id) ON DELETE CASCADE,
            UNIQUE(file_id, liturgical_time_id)
        )
    ''')
    
    # Adicionar colunas se não existirem (para compatibilidade)
    try:
        cursor.execute('ALTER TABLE pdf_files ADD COLUMN liturgical_time TEXT')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    try:
        cursor.execute('ALTER TABLE pdf_files ADD COLUMN musical_key TEXT')
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute('ALTER TABLE pdf_files ADD COLUMN youtube_link TEXT')
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute('ALTER TABLE pdf_files ADD COLUMN song_name TEXT')
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute('ALTER TABLE pdf_files ADD COLUMN artist TEXT')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE merge_lists ADD COLUMN observations TEXT')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Inserir dados padrão se as tabelas estiverem vazias
    default_categories = [
        'Entrada', 'Ato penitencial', 'Glória', 'Salmo', 'Aclamação', 
        'Ofertório', 'Santo', 'Cordeiro', 'Comunhão', 'Pós Comunhão', 
        'Final', 'Diversos', 'Maria', 'Espírito Santo'
    ]
    
    default_liturgical_times = [
        'Tempo Comum', 'Quaresma', 'Advento', 'Natal'
    ]
    
    default_artists = [
        'Padre Zezinho', 'Padre Marcelo Rossi', 'Padre Antônio Maria', 
        'Padre Fábio de Melo', 'Irmã Kelly Patrícia', 'Eliana Ribeiro',
        'Dunga', 'Ministério Adoração e Vida', 'Comunidade Católica Shalom',
        'Padre Joãozinho', 'Rosa de Saron', 'Anjos de Resgate',
        'Músicas Católicas', 'Cantoral Popular', 'Coral Diocesano'
    ]
    
    for category in default_categories:
        cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (category,))
    
    for time in default_liturgical_times:
        cursor.execute('INSERT OR IGNORE INTO liturgical_times (name) VALUES (?)', (time,))
    
    for artist in default_artists:
        cursor.execute('INSERT OR IGNORE INTO artists (name) VALUES (?)', (artist,))
    
    conn.commit()
    conn.close()

def reset_database():
    """Reset the database - remove all data and recreate tables with current categories."""
    # Remove database file
    if os.path.exists(DATABASE):
        os.remove(DATABASE)
    
    # Remove organized folder to start fresh
    if os.path.exists(ORGANIZED_FOLDER):
        shutil.rmtree(ORGANIZED_FOLDER)
    os.makedirs(ORGANIZED_FOLDER, exist_ok=True)
    
    # Recreate database
    init_db()
    print("Banco de dados resetado com sucesso! Categorias atualizadas.")

def get_pdf_info(file_path):
    """Extract basic information from PDF file."""
    try:
        reader = PdfReader(file_path)
        return {'page_count': len(reader.pages)}
    except Exception as e:
        print(f"Error reading PDF info: {e}")
        return {'page_count': 0}

def get_file_hash(file_path):
    """Generate MD5 hash of file for duplicate detection."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

@app.route('/')
def index():
    """Página inicial mostrando todos os arquivos PDF."""
    view_mode = request.args.get('view', 'list')  # Padrão alterado para 'list'
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, filename, original_name, song_name, artist, category, liturgical_time, 
               musical_key, youtube_link, file_size, upload_date, page_count, description FROM pdf_files
        ORDER BY upload_date DESC
    ''')
    files_raw = cursor.fetchall()
    
    # Enriquecer cada arquivo com suas múltiplas categorias e tempos litúrgicos
    files = []
    for file_data in files_raw:
        file_id = file_data[0]
        
        # Obter todas as categorias do arquivo
        cursor.execute('''
            SELECT c.name 
            FROM categories c
            JOIN file_categories fc ON c.id = fc.category_id
            WHERE fc.file_id = ?
            ORDER BY c.name
        ''', (file_id,))
        file_categories = [row[0] for row in cursor.fetchall()]
        
        # Se não tem categorias nas tabelas de relacionamento, usar a categoria principal
        if not file_categories and file_data[5]:  # file_data[5] é category
            file_categories = [file_data[5]]
        
        # Obter todos os tempos litúrgicos do arquivo
        cursor.execute('''
            SELECT lt.name 
            FROM liturgical_times lt
            JOIN file_liturgical_times flt ON lt.id = flt.liturgical_time_id
            WHERE flt.file_id = ?
            ORDER BY lt.name
        ''', (file_id,))
        file_liturgical_times = [row[0] for row in cursor.fetchall()]
        
        # Se não tem tempos nas tabelas de relacionamento, usar o tempo principal
        if not file_liturgical_times and file_data[6]:  # file_data[6] é liturgical_time
            file_liturgical_times = [file_data[6]]
        
        # Adicionar as listas ao tuple original
        files.append(file_data + (file_categories, file_liturgical_times))
    
    cursor.execute('SELECT name FROM categories ORDER BY name')
    categories = [row[0] for row in cursor.fetchall()]
    
    cursor.execute('''
        SELECT ml.id, ml.name, ml.observations, ml.created_date, ml.updated_date,
               COUNT(mli.id) as file_count
        FROM merge_lists ml
        LEFT JOIN merge_list_items mli ON ml.id = mli.merge_list_id
        GROUP BY ml.id, ml.name, ml.observations, ml.created_date, ml.updated_date
        ORDER BY ml.updated_date DESC
    ''')
    merge_lists = cursor.fetchall()
    
    conn.close()
    return render_template('index.html', files=files, categories=categories, 
                         liturgical_times=get_liturgical_times(), merge_lists=merge_lists, 
                         view_mode=view_mode)

@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    """Upload PDF files with metadata including categories and liturgical times."""
    if request.method == 'POST':
        upload_mode = request.form.get('upload_mode', 'single')
        
        if upload_mode == 'bulk':
            # Processar upload em lote
            if 'file' not in request.files:
                return 'Nenhum arquivo selecionado', 400
            
            file = request.files['file']
            song_name = request.form.get('song_name', '').strip()
            artist = request.form.get('artist', '').strip()
            new_artist = request.form.get('new_artist', '').strip()
            
            # Processar múltiplas categorias e tempos litúrgicos
            selected_categories = request.form.getlist('categories')
            selected_liturgical_times = request.form.getlist('liturgical_times')
            
            musical_key = request.form.get('musical_key', '')
            youtube_link = request.form.get('youtube_link', '')
            description = request.form.get('description', '')
            
            # Usar primeira categoria como principal (para compatibilidade)
            category = selected_categories[0] if selected_categories else 'Diversos'
            liturgical_time = selected_liturgical_times[0] if selected_liturgical_times else ''
            
            # Criar novo artista se especificado
            if new_artist and not artist:
                if create_artist(new_artist):
                    artist = new_artist
                else:
                    # Se artista já existe, usar o existente
                    artist = new_artist
            
            if file.filename == '' or file.filename is None:
                return 'Nenhum arquivo selecionado', 400
            
            if not file.filename.lower().endswith('.pdf'):
                return 'Arquivo deve ser PDF', 400
                
            try:
                # Gerar nome do arquivo baseado nas informações
                final_filename = generate_filename(song_name, artist, secure_filename(file.filename), musical_key)
                
                temp_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
                file.save(temp_path)
                
                file_hash = get_file_hash(temp_path)
                conn = sqlite3.connect(DATABASE)
                cursor = conn.cursor()
                cursor.execute('SELECT filename FROM pdf_files WHERE file_hash = ?', (file_hash,))
                existing = cursor.fetchone()
                
                if existing:
                    os.remove(temp_path)
                    conn.close()
                    return f'Arquivo já existe: {existing[0]}', 400
                
                category_folder = os.path.join(ORGANIZED_FOLDER, category)
                os.makedirs(category_folder, exist_ok=True)
                
                # Garantir nome único
                counter = 1
                base_name = os.path.splitext(final_filename)[0]
                final_path = os.path.join(category_folder, final_filename)
                
                while os.path.exists(final_path):
                    final_filename = f"{base_name}_{counter}.pdf"
                    final_path = os.path.join(category_folder, final_filename)
                    counter += 1
                
                shutil.move(temp_path, final_path)
                
                pdf_info = get_pdf_info(final_path)
                file_size = os.path.getsize(final_path)
                
                cursor.execute('''
                    INSERT INTO pdf_files 
                    (filename, original_name, song_name, artist, category, liturgical_time, musical_key, youtube_link, file_path, file_size, file_hash, page_count, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (final_filename, file.filename, song_name, artist, category, liturgical_time, musical_key, youtube_link, final_path, file_size, file_hash, pdf_info['page_count'], description))
                
                file_id = cursor.lastrowid
                
                # Adicionar múltiplas categorias
                for category in selected_categories:
                    if category.strip():
                        # Primeiro criar a categoria se não existir
                        cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (category.strip(),))
                        # Depois obter o ID e criar o relacionamento
                        cursor.execute('SELECT id FROM categories WHERE name = ?', (category.strip(),))
                        category_id = cursor.fetchone()[0]
                        cursor.execute('INSERT OR IGNORE INTO file_categories (file_id, category_id) VALUES (?, ?)', 
                                     (file_id, category_id))
                
                # Adicionar múltiplos tempos litúrgicos
                for liturgical_time in selected_liturgical_times:
                    if liturgical_time.strip():
                        # Primeiro criar o tempo litúrgico se não existir
                        cursor.execute('INSERT OR IGNORE INTO liturgical_times (name) VALUES (?)', (liturgical_time.strip(),))
                        # Depois obter o ID e criar o relacionamento
                        cursor.execute('SELECT id FROM liturgical_times WHERE name = ?', (liturgical_time.strip(),))
                        liturgical_id = cursor.fetchone()[0]
                        cursor.execute('INSERT OR IGNORE INTO file_liturgical_times (file_id, liturgical_time_id) VALUES (?, ?)', 
                                     (file_id, liturgical_id))
                
                conn.commit()
                conn.close()
                
                return f'Upload realizado com sucesso - ID: {file_id}', 200
                
            except Exception as e:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return f'Erro no upload: {str(e)}', 500
        
        else:
            # Modo single upload (comportamento original)
            if 'file' not in request.files:
                flash('Nenhum arquivo selecionado')
                return redirect(request.url)
            
            file = request.files['file']
            song_name = request.form.get('song_name', '').strip()
            artist = request.form.get('artist', '').strip()
            new_artist = request.form.get('new_artist', '').strip()
            
            # Processar múltiplas categorias e tempos litúrgicos
            selected_categories = request.form.getlist('categories')
            selected_liturgical_times = request.form.getlist('liturgical_times')
            
            # Usar primeira categoria como principal (para compatibilidade)
            category = selected_categories[0] if selected_categories else 'Diversos'
            liturgical_time = selected_liturgical_times[0] if selected_liturgical_times else ''
            
            musical_key = request.form.get('musical_key', '')
            youtube_link = request.form.get('youtube_link', '')
            description = request.form.get('description', '')
            
            # Criar novo artista se especificado
            if new_artist and not artist:
                if create_artist(new_artist):
                    artist = new_artist
                    flash(f'Novo artista "{new_artist}" criado!')
                else:
                    flash(f'Artista "{new_artist}" já existe')
                    artist = new_artist
            
            if file.filename == '' or file.filename is None:
                flash('Nenhum arquivo selecionado')
                return redirect(request.url)
                
            if file and file.filename.lower().endswith('.pdf'):
                # Gerar nome do arquivo baseado nas informações
                final_filename = generate_filename(song_name, artist, secure_filename(file.filename), musical_key)
                
                temp_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
                file.save(temp_path)
                
                file_hash = get_file_hash(temp_path)
                conn = sqlite3.connect(DATABASE)
                cursor = conn.cursor()
                cursor.execute('SELECT filename FROM pdf_files WHERE file_hash = ?', (file_hash,))
                existing = cursor.fetchone()
                
                if existing:
                    os.remove(temp_path)
                    flash(f'Arquivo já existe: {existing[0]}')
                    conn.close()
                    return redirect(url_for('index'))
                
                category_folder = os.path.join(ORGANIZED_FOLDER, category)
                os.makedirs(category_folder, exist_ok=True)
                
                # Garantir nome único
                counter = 1
                base_name = os.path.splitext(final_filename)[0]
                final_path = os.path.join(category_folder, final_filename)
                
                while os.path.exists(final_path):
                    final_filename = f"{base_name}_{counter}.pdf"
                    final_path = os.path.join(category_folder, final_filename)
                    counter += 1
                
                shutil.move(temp_path, final_path)
                
                pdf_info = get_pdf_info(final_path)
                file_size = os.path.getsize(final_path)
                
                cursor.execute('''
                    INSERT INTO pdf_files 
                    (filename, original_name, song_name, artist, category, liturgical_time, musical_key, youtube_link, file_path, file_size, file_hash, page_count, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (final_filename, file.filename, song_name, artist, category, liturgical_time, musical_key, youtube_link, final_path, file_size, file_hash, pdf_info['page_count'], description))
                
                file_id = cursor.lastrowid
                
                # Adicionar múltiplas categorias
                for category in selected_categories:
                    if category.strip():
                        # Primeiro criar a categoria se não existir
                        cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (category.strip(),))
                        # Depois obter o ID e criar o relacionamento
                        cursor.execute('SELECT id FROM categories WHERE name = ?', (category.strip(),))
                        category_id = cursor.fetchone()[0]
                        cursor.execute('INSERT OR IGNORE INTO file_categories (file_id, category_id) VALUES (?, ?)', 
                                     (file_id, category_id))
                
                # Adicionar múltiplos tempos litúrgicos
                for liturgical_time in selected_liturgical_times:
                    if liturgical_time.strip():
                        # Primeiro criar o tempo litúrgico se não existir
                        cursor.execute('INSERT OR IGNORE INTO liturgical_times (name) VALUES (?)', (liturgical_time.strip(),))
                        # Depois obter o ID e criar o relacionamento
                        cursor.execute('SELECT id FROM liturgical_times WHERE name = ?', (liturgical_time.strip(),))
                        liturgical_id = cursor.fetchone()[0]
                        cursor.execute('INSERT OR IGNORE INTO file_liturgical_times (file_id, liturgical_time_id) VALUES (?, ?)', 
                                     (file_id, liturgical_id))
                
                conn.commit()
                
                # Executar escaneamento automático para o arquivo recém-enviado
                try:
                    app.logger.info(f"Executando escaneamento automático para arquivo ID: {file_id}")
                    
                    # Gerar nome formatado baseado nas informações do arquivo
                    if song_name and artist:
                        new_filename = generate_filename(song_name, artist, final_filename, musical_key)
                        new_path = os.path.join(category_folder, new_filename)
                        
                        # Verificar se o novo nome é diferente do atual
                        if new_filename != final_filename and not os.path.exists(new_path):
                            # Renomear arquivo físico
                            os.rename(final_path, new_path)
                            
                            # Atualizar no banco de dados
                            cursor.execute('UPDATE pdf_files SET filename = ?, file_path = ? WHERE id = ?', 
                                         (new_filename, new_path, file_id))
                            final_filename = new_filename
                            app.logger.info(f"Arquivo automaticamente renomeado: {final_filename}")
                        
                        # Formatar nome da música e artista
                        formatted_song = format_camel_case(song_name)
                        formatted_artist = format_camel_case(artist)
                        
                        # Atualizar formatação no banco se necessário
                        if formatted_song != song_name or formatted_artist != artist:
                            cursor.execute('UPDATE pdf_files SET song_name = ?, artist = ? WHERE id = ?', 
                                         (formatted_song, formatted_artist, file_id))
                            app.logger.info(f"Formatação automática aplicada para: {formatted_song} / {formatted_artist}")
                    
                    conn.commit()
                    
                except Exception as scan_error:
                    app.logger.warning(f"Erro durante escaneamento automático: {str(scan_error)}")
                    # Não falhar o upload por causa do escaneamento
                    pass
                
                conn.close()
                
                flash(f'Arquivo enviado com sucesso: {final_filename}')
                return redirect(url_for('index'))
            else:
                flash('Por favor, envie um arquivo PDF válido')
    
    return render_template('upload.html', categories=get_categories(), liturgical_times=get_liturgical_times(), 
                         musical_keys=get_musical_keys(), artists=get_artists())

@app.route('/merge', methods=['GET', 'POST'])
def merge_pdfs():
    """Merge multiple PDF files into one."""
    if request.method == 'POST':
        selected_files = request.form.getlist('selected_files')
        output_name = request.form.get('output_name', 'merged_document.pdf')
        
        if not selected_files or len(selected_files) < 2:
            flash('É necessário selecionar pelo menos 2 arquivos para mesclar')
            return redirect(url_for('index'))
        
        try:
            writer = PdfWriter()
            
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            
            for file_id in selected_files:
                cursor.execute('SELECT file_path FROM pdf_files WHERE id = ?', (file_id,))
                result = cursor.fetchone()
                if result and os.path.exists(result[0]):
                    reader = PdfReader(result[0])
                    for page in reader.pages:
                        writer.add_page(page)
            
            conn.close()
            
            merged_folder = os.path.join(ORGANIZED_FOLDER, 'Merged')
            os.makedirs(merged_folder, exist_ok=True)
            
            counter = 1
            base_name = os.path.splitext(output_name)[0]
            final_output = output_name
            output_path = os.path.join(merged_folder, final_output)
            
            while os.path.exists(output_path):
                final_output = f"{base_name}_{counter}.pdf"
                output_path = os.path.join(merged_folder, final_output)
                counter += 1
            
            with open(output_path, 'wb') as output_file:
                writer.write(output_file)
            
            file_hash = get_file_hash(output_path)
            file_size = os.path.getsize(output_path)
            pdf_info = get_pdf_info(output_path)
            
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO pdf_files 
                (filename, original_name, category, file_path, file_size, file_hash, page_count, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (final_output, final_output, 'Merged', output_path, file_size, file_hash, pdf_info['page_count'], 'Merged PDF document'))
            
            conn.commit()
            conn.close()
            
            flash(f'Files merged successfully: {final_output}')
            return redirect(url_for('index'))
            
        except Exception as e:
            flash(f'Error merging files: {str(e)}')
    
    return render_template('merge.html')

@app.route('/merge_lists')
def merge_lists():
    """Gerenciar listas de fusão."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT ml.id, ml.name, ml.observations, ml.created_date, ml.updated_date,
               COUNT(mli.id) as file_count
        FROM merge_lists ml
        LEFT JOIN merge_list_items mli ON ml.id = mli.merge_list_id
        GROUP BY ml.id, ml.name, ml.observations, ml.created_date, ml.updated_date
        ORDER BY ml.updated_date DESC
    ''')
    lists = cursor.fetchall()
    
    conn.close()
    return render_template('merge_lists.html', lists=lists)

@app.route('/create_merge_list', methods=['POST'])
def create_merge_list():
    """Criar nova lista de fusão."""
    list_name = request.form.get('list_name', '').strip()
    selected_files = request.form.getlist('selected_files')
    
    if not list_name:
        flash('Nome da lista é obrigatório')
        return redirect(url_for('index'))
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Criar lista
    cursor.execute('INSERT INTO merge_lists (name) VALUES (?)', (list_name,))
    list_id = cursor.lastrowid
    
    # Adicionar arquivos selecionados
    for i, file_id in enumerate(selected_files):
        cursor.execute('''
            INSERT INTO merge_list_items (merge_list_id, pdf_file_id, order_position)
            VALUES (?, ?, ?)
        ''', (list_id, file_id, i + 1))
    
    conn.commit()
    conn.close()
    
    flash(f'Lista "{list_name}" criada com sucesso!')
    return redirect(url_for('edit_merge_list', list_id=list_id))

@app.route('/edit_merge_list/<int:list_id>')
def edit_merge_list(list_id):
    """Editar lista de fusão ou criar nova lista se list_id=0."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    if list_id == 0:
        # Criar nova lista
        merge_list = (0, "Nova Lista de Música")
        list_files = []
    else:
        # Obter informações da lista existente
        cursor.execute('SELECT id, name, observations FROM merge_lists WHERE id = ?', (list_id,))
        merge_list = cursor.fetchone()
        
        if not merge_list:
            flash('Lista não encontrada')
            return redirect(url_for('merge_lists'))
        
        # Obter arquivos da lista
        cursor.execute('''
            SELECT mli.id, mli.order_position, pf.id as file_id, pf.filename, 
                   pf.original_name, pf.category, pf.page_count
            FROM merge_list_items mli
            JOIN pdf_files pf ON mli.pdf_file_id = pf.id
            WHERE mli.merge_list_id = ?
            ORDER BY mli.order_position
        ''', (list_id,))
        list_files = cursor.fetchall()
    
    # Obter todos os arquivos para adicionar com informações para filtros
    cursor.execute('''
        SELECT id, filename, original_name, song_name, artist, category, liturgical_time, youtube_link 
        FROM pdf_files ORDER BY filename
    ''')
    all_files_raw = cursor.fetchall()
    
    # Enriquecer cada arquivo com suas múltiplas categorias e tempos litúrgicos
    all_files = []
    for file_data in all_files_raw:
        file_id = file_data[0]
        
        # Obter todas as categorias do arquivo
        cursor.execute('''
            SELECT c.name 
            FROM categories c
            JOIN file_categories fc ON c.id = fc.category_id
            WHERE fc.file_id = ?
            ORDER BY c.name
        ''', (file_id,))
        file_categories = [row[0] for row in cursor.fetchall()]
        
        # Se não tem categorias nas tabelas de relacionamento, usar a categoria principal
        if not file_categories and file_data[5]:  # file_data[5] é category
            file_categories = [file_data[5]]
        
        # Obter todos os tempos litúrgicos do arquivo
        cursor.execute('''
            SELECT lt.name 
            FROM liturgical_times lt
            JOIN file_liturgical_times flt ON lt.id = flt.liturgical_time_id
            WHERE flt.file_id = ?
            ORDER BY lt.name
        ''', (file_id,))
        file_liturgical_times = [row[0] for row in cursor.fetchall()]
        
        # Se não tem tempos nas tabelas de relacionamento, usar o tempo principal
        if not file_liturgical_times and file_data[6]:  # file_data[6] é liturgical_time
            file_liturgical_times = [file_data[6]]
        
        # Adicionar as listas ao tuple original
        all_files.append(file_data + (file_categories, file_liturgical_times))
    
    # Obter categorias e tempos litúrgicos para filtros
    cursor.execute('SELECT name FROM categories ORDER BY name')
    categories = [row[0] for row in cursor.fetchall()]
    
    conn.close()
    return render_template('edit_merge_list.html', merge_list=merge_list, 
                         list_files=list_files, all_files=all_files,
                         categories=categories, liturgical_times=get_liturgical_times())

@app.route('/add_to_merge_list/<int:list_id>', methods=['POST'])
def add_to_merge_list(list_id):
    """Adicionar arquivo à lista de fusão."""
    file_id = request.form.get('file_id')
    
    if not file_id:
        flash('Nenhum arquivo selecionado')
        return redirect(url_for('edit_merge_list', list_id=list_id))
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Obter próxima posição
    cursor.execute('SELECT MAX(order_position) FROM merge_list_items WHERE merge_list_id = ?', (list_id,))
    max_pos = cursor.fetchone()[0] or 0
    
    # Adicionar arquivo
    cursor.execute('''
        INSERT INTO merge_list_items (merge_list_id, pdf_file_id, order_position)
        VALUES (?, ?, ?)
    ''', (list_id, file_id, max_pos + 1))
    
    # Atualizar data da lista
    cursor.execute('UPDATE merge_lists SET updated_date = CURRENT_TIMESTAMP WHERE id = ?', (list_id,))
    
    conn.commit()
    conn.close()
    
    flash('Arquivo adicionado à lista')
    return redirect(url_for('edit_merge_list', list_id=list_id))

@app.route('/remove_from_merge_list/<int:item_id>', methods=['POST'])
def remove_from_merge_list(item_id):
    """Remover arquivo da lista de fusão."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Obter list_id antes de deletar
    cursor.execute('SELECT merge_list_id FROM merge_list_items WHERE id = ?', (item_id,))
    result = cursor.fetchone()
    
    if result:
        list_id = result[0]
        cursor.execute('DELETE FROM merge_list_items WHERE id = ?', (item_id,))
        cursor.execute('UPDATE merge_lists SET updated_date = CURRENT_TIMESTAMP WHERE id = ?', (list_id,))
        conn.commit()
        flash('Arquivo removido da lista')
    else:
        flash('Item não encontrado')
        list_id = None
    
    conn.close()
    
    if list_id:
        return redirect(url_for('edit_merge_list', list_id=list_id))
    else:
        return redirect(url_for('merge_lists'))

@app.route('/reorder_merge_list/<int:list_id>', methods=['POST'])
def reorder_merge_list(list_id):
    """Reordenar arquivos na lista de fusão."""
    item_order = request.form.getlist('item_order')
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    for i, item_id in enumerate(item_order):
        cursor.execute('''
            UPDATE merge_list_items 
            SET order_position = ? 
            WHERE id = ? AND merge_list_id = ?
        ''', (i + 1, item_id, list_id))
    
    cursor.execute('UPDATE merge_lists SET updated_date = CURRENT_TIMESTAMP WHERE id = ?', (list_id,))
    conn.commit()
    conn.close()
    
    flash('Ordem dos arquivos atualizada')
    return redirect(url_for('edit_merge_list', list_id=list_id))

@app.route('/merge_from_list/<int:list_id>', methods=['POST'])
def merge_from_list(list_id):
    """Mesclar arquivos de uma lista e baixar diretamente."""
    output_name = request.form.get('output_name', 'Lista Mesclada')
    
    if not output_name.lower().endswith('.pdf'):
        output_name += '.pdf'
    
    output_name = secure_filename(output_name)
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Obter arquivos da lista em ordem
    cursor.execute('''
        SELECT pf.file_path, pf.filename
        FROM merge_list_items mli
        JOIN pdf_files pf ON mli.pdf_file_id = pf.id
        WHERE mli.merge_list_id = ?
        ORDER BY mli.order_position
    ''', (list_id,))
    
    files_to_merge = cursor.fetchall()
    conn.close()
    
    if len(files_to_merge) < 2:
        flash('É necessário pelo menos 2 arquivos para mesclar')
        return redirect(url_for('edit_merge_list', list_id=list_id))
    
    try:
        writer = PdfWriter()
        
        # Mesclar PDFs
        for file_path, filename in files_to_merge:
            if os.path.exists(file_path):
                reader = PdfReader(file_path)
                for page in reader.pages:
                    writer.add_page(page)
        
        # Criar arquivo temporário para download
        import tempfile
        temp_dir = tempfile.gettempdir()
        temp_output = os.path.join(temp_dir, output_name)
        
        with open(temp_output, 'wb') as output_file:
            writer.write(output_file)
        
        # Retornar arquivo para download e limpar depois
        def remove_file():
            try:
                os.remove(temp_output)
            except:
                pass
        
        response = send_file(temp_output, as_attachment=True, download_name=output_name)
        response.call_on_close(remove_file)
        
        return response
        
    except Exception as e:
        flash(f'Erro ao mesclar arquivos: {str(e)}')
        return redirect(url_for('edit_merge_list', list_id=list_id))

@app.route('/delete_merge_list/<int:list_id>', methods=['POST'])
def delete_merge_list(list_id):
    """Deletar lista de fusão e todos os seus itens."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT name FROM merge_lists WHERE id = ?', (list_id,))
    result = cursor.fetchone()
    
    if result:
        list_name = result[0]
        
        # Primeiro, remover todos os itens da lista
        cursor.execute('DELETE FROM merge_list_items WHERE merge_list_id = ?', (list_id,))
        
        # Depois, remover a lista
        cursor.execute('DELETE FROM merge_lists WHERE id = ?', (list_id,))
        
        conn.commit()
        flash(f'Lista "{list_name}" e todos os seus itens foram deletados')
    else:
        flash('Lista não encontrada')
    
    conn.close()
    return redirect(url_for('merge_lists'))

@app.route('/duplicate_merge_list/<int:list_id>', methods=['POST'])
def duplicate_merge_list(list_id):
    """Duplicar lista de fusão."""
    new_list_name = request.form.get('new_list_name', '').strip()
    
    if not new_list_name:
        flash('Nome da nova lista é obrigatório')
        return redirect(url_for('merge_lists'))
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Verificar se a lista original existe
    cursor.execute('SELECT name FROM merge_lists WHERE id = ?', (list_id,))
    original_list = cursor.fetchone()
    
    if not original_list:
        flash('Lista original não encontrada')
        conn.close()
        return redirect(url_for('merge_lists'))
    
    try:
        # Criar nova lista
        cursor.execute('INSERT INTO merge_lists (name) VALUES (?)', (new_list_name,))
        new_list_id = cursor.lastrowid
        
        # Copiar todos os itens da lista original
        cursor.execute('''
            INSERT INTO merge_list_items (merge_list_id, pdf_file_id, order_position)
            SELECT ?, pdf_file_id, order_position
            FROM merge_list_items
            WHERE merge_list_id = ?
            ORDER BY order_position
        ''', (new_list_id, list_id))
        
        conn.commit()
        flash(f'Lista "{new_list_name}" criada como cópia de "{original_list[0]}"')
        
        # Redirecionar para a nova lista
        return redirect(url_for('edit_merge_list', list_id=new_list_id))
        
    except Exception as e:
        conn.rollback()
        flash(f'Erro ao duplicar lista: {str(e)}')
    finally:
        conn.close()
    
    return redirect(url_for('merge_lists'))

@app.route('/categories')
def manage_categories():
    """Manage categories."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM categories ORDER BY name')
    categories = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    return render_template('categories.html', categories=categories)

@app.route('/add_category', methods=['POST'])
def add_category():
    """Add a new category."""
    category_name = request.form.get('category_name', '').strip()
    
    if category_name:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        try:
            cursor.execute('INSERT INTO categories (name) VALUES (?)', (category_name,))
            conn.commit()
            flash(f'Category added: {category_name}')
        except sqlite3.IntegrityError:
            flash(f'Category already exists: {category_name}')
        conn.close()
    
    return redirect(url_for('manage_categories'))

@app.route('/reset_db')
def reset_db_route():
    """Rota para resetar o banco de dados (apenas para desenvolvimento)."""
    reset_database()
    flash('Banco de dados resetado com sucesso!')
    return redirect(url_for('index'))

@app.route('/add_song_to_list/<int:file_id>/<int:list_id>', methods=['POST'])
def add_song_to_list(file_id, list_id):
    """Adicionar uma música individual à uma lista existente."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Verificar se a música já está na lista
    cursor.execute('''
        SELECT id FROM merge_list_items 
        WHERE merge_list_id = ? AND pdf_file_id = ?
    ''', (list_id, file_id))
    
    if cursor.fetchone():
        conn.commit()
        conn.close()
        return redirect(request.referrer or url_for('index', error='Esta música já está na lista'))
    else:
        # Obter próxima posição
        cursor.execute('SELECT MAX(order_position) FROM merge_list_items WHERE merge_list_id = ?', (list_id,))
        max_pos = cursor.fetchone()[0] or 0
        
        # Adicionar música
        cursor.execute('''
            INSERT INTO merge_list_items (merge_list_id, pdf_file_id, order_position)
            VALUES (?, ?, ?)
        ''', (list_id, file_id, max_pos + 1))
        
        # Atualizar data da lista
        cursor.execute('UPDATE merge_lists SET updated_date = CURRENT_TIMESTAMP WHERE id = ?', (list_id,))
        
        # Obter nome da música e da lista para feedback
        cursor.execute('SELECT song_name, original_name FROM pdf_files WHERE id = ?', (file_id,))
        music = cursor.fetchone()
        
        cursor.execute('SELECT name FROM merge_lists WHERE id = ?', (list_id,))
        list_name = cursor.fetchone()[0]
        
        music_name = music[0] or music[1]
        conn.commit()
        conn.close()
        
        return redirect(request.referrer or url_for('index', success=f'"{music_name}" adicionada à lista "{list_name}"'))

@app.route('/add_multiple_to_list/<int:list_id>', methods=['POST'])
def add_multiple_to_list(list_id):
    """Adicionar múltiplas músicas a uma lista existente."""
    file_ids = request.form.getlist('file_ids')
    
    if not file_ids:
        flash('Nenhuma música selecionada')
        return redirect(request.referrer or url_for('index'))
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Obter próxima posição
    cursor.execute('SELECT MAX(order_position) FROM merge_list_items WHERE merge_list_id = ?', (list_id,))
    max_pos = cursor.fetchone()[0] or 0
    
    added_count = 0
    for file_id in file_ids:
        # Verificar se a música já está na lista
        cursor.execute('''
            SELECT id FROM merge_list_items 
            WHERE merge_list_id = ? AND pdf_file_id = ?
        ''', (list_id, file_id))
        
        if not cursor.fetchone():
            max_pos += 1
            cursor.execute('''
                INSERT INTO merge_list_items (merge_list_id, pdf_file_id, order_position)
                VALUES (?, ?, ?)
            ''', (list_id, file_id, max_pos))
            added_count += 1
    
    # Atualizar data da lista
    cursor.execute('UPDATE merge_lists SET updated_date = CURRENT_TIMESTAMP WHERE id = ?', (list_id,))
    
    # Obter nome da lista para feedback
    cursor.execute('SELECT name FROM merge_lists WHERE id = ?', (list_id,))
    list_name = cursor.fetchone()[0]
    
    conn.commit()
    conn.close()
    
    if added_count > 0:
        flash(f'{added_count} música(s) adicionada(s) à lista "{list_name}"')
    else:
        flash('Todas as músicas selecionadas já estão na lista')
    
    return redirect(request.referrer or url_for('index'))

@app.route('/api/merge_lists')
def api_merge_lists():
    """API para obter listas de fusão."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT ml.id, ml.name, ml.observations, ml.created_date, ml.updated_date, COUNT(mli.id) as file_count
        FROM merge_lists ml
        LEFT JOIN merge_list_items mli ON ml.id = mli.merge_list_id
        GROUP BY ml.id, ml.name, ml.observations, ml.created_date, ml.updated_date
        ORDER BY ml.updated_date DESC
    ''')
    lists = cursor.fetchall()
    
    conn.close()
    
    app.logger.info(f"/api/merge_lists -> retornando {len(lists)} listas")
    return jsonify([{
        'id': row[0],
        'name': row[1],
        'observations': row[2],
        'created_date': row[3],
        'updated_date': row[4],
        'file_count': row[5]
    } for row in lists])

# ==========================================
# API - filtros/sugestões para frontend
# ==========================================

@app.route('/api/filters/suggestions')
def api_filters_suggestions():
    """Retorna categorias, tempos litúrgicos, artistas e tonalidades suportadas."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # Buscar categorias das tabelas normalizadas e da tabela principal (para compatibilidade)
    cursor.execute('''
        SELECT DISTINCT name FROM (
            SELECT name FROM categories
            UNION
            SELECT DISTINCT category as name FROM pdf_files WHERE category IS NOT NULL AND category != ''
        ) ORDER BY name
    ''')
    categories = [row[0] for row in cursor.fetchall() if row[0] and row[0].strip()]

    # Buscar tempos litúrgicos das tabelas normalizadas e da tabela principal
    cursor.execute('''
        SELECT DISTINCT name FROM (
            SELECT name FROM liturgical_times
            UNION
            SELECT DISTINCT liturgical_time as name FROM pdf_files WHERE liturgical_time IS NOT NULL AND liturgical_time != ''
        ) ORDER BY name
    ''')
    liturgical_times = [row[0] for row in cursor.fetchall() if row[0] and row[0].strip()]

    # Buscar artistas das tabelas normalizadas e da tabela principal
    cursor.execute('''
        SELECT DISTINCT name FROM (
            SELECT name FROM artists
            UNION
            SELECT DISTINCT artist as name FROM pdf_files WHERE artist IS NOT NULL AND artist != ''
        ) ORDER BY name
    ''')
    artists = [row[0] for row in cursor.fetchall() if row[0] and row[0].strip()]

    conn.close()

    musical_keys = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Cm','C#m','Dm','D#m','Em','Fm','F#m','Gm','G#m','Am','A#m','Bm']

    app.logger.info("/api/filters/suggestions -> categorias=%d tempos=%d artistas=%d", len(categories), len(liturgical_times), len(artists))
    return jsonify({
        'categories': categories,
        'liturgical_times': liturgical_times,
        'artists': artists,
        'musical_keys': musical_keys
    })

@app.route('/api/get_youtube_link/<int:file_id>')
def api_get_youtube_link(file_id):
    """API para obter link do YouTube de um arquivo."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT youtube_link FROM pdf_files WHERE id = ?', (file_id,))
    result = cursor.fetchone()
    
    conn.close()
    
    if result and result[0]:
        return jsonify({'success': True, 'youtube_link': result[0]})
    else:
        return jsonify({'success': False, 'message': 'Link do YouTube não encontrado'})

@app.route('/api/admin/verify-pdfs', methods=['GET'])
def api_verify_pdfs():
    """Verificar se os nomes dos PDFs seguem o padrão correto."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, filename, song_name, artist, musical_key, file_path
        FROM pdf_files
        ORDER BY id
    ''')
    
    files = cursor.fetchall()
    conn.close()
    
    mismatched_files = []
    
    for file_id, current_filename, song_name, artist, musical_key, file_path in files:
        if song_name and artist:
            expected_filename = generate_filename(song_name, artist, current_filename, musical_key)
            
            if current_filename != expected_filename:
                mismatched_files.append({
                    'id': file_id,
                    'current_filename': current_filename,
                    'expected_filename': expected_filename,
                    'song_name': song_name,
                    'artist': artist,
                    'musical_key': musical_key,
                    'file_path': file_path
                })
    
    return jsonify({
        'total_files': len(files),
        'mismatched_count': len(mismatched_files),
        'mismatched_files': mismatched_files
    })

@app.route('/api/admin/fix-pdf-names', methods=['POST'])
def api_fix_pdf_names():
    """Corrigir nomes dos PDFs que não seguem o padrão."""
    data = request.get_json() or {}
    file_ids = data.get('file_ids', [])
    
    if not file_ids:
        return jsonify({'success': False, 'error': 'Nenhum arquivo especificado'}), 400
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    fixed_files = []
    errors = []
    
    for file_id in file_ids:
        try:
            cursor.execute('''
                SELECT filename, song_name, artist, musical_key, file_path, category
                FROM pdf_files WHERE id = ?
            ''', (file_id,))
            
            result = cursor.fetchone()
            if not result:
                errors.append(f"Arquivo {file_id} não encontrado")
                continue
                
            current_filename, song_name, artist, musical_key, file_path, category = result
            
            if not song_name or not artist:
                errors.append(f"Arquivo {file_id}: nome da música ou artista não preenchido")
                continue
            
            new_filename = generate_filename(song_name, artist, current_filename, musical_key)
            
            # Verificar se o arquivo físico existe
            if not os.path.exists(file_path):
                errors.append(f"Arquivo {file_id}: arquivo físico não encontrado em {file_path}")
                continue
            
            # Gerar novo caminho baseado na categoria
            category_folder = os.path.join(ORGANIZED_FOLDER, category or 'Diversos')
            os.makedirs(category_folder, exist_ok=True)
            
            new_file_path = os.path.join(category_folder, new_filename)
            
            # Se já existe um arquivo com o novo nome, adicionar contador
            counter = 1
            base_name = os.path.splitext(new_filename)[0]
            while os.path.exists(new_file_path) and new_file_path != file_path:
                new_filename = f"{base_name}_{counter}.pdf"
                new_file_path = os.path.join(category_folder, new_filename)
                counter += 1
            
            # Mover/renomear arquivo se necessário
            app.logger.info(f"🔄 [RENAME] Arquivo {file_id}:")
            app.logger.info(f"   - Caminho atual: {file_path}")
            app.logger.info(f"   - Novo caminho: {new_file_path}")
            app.logger.info(f"   - Nome atual: {current_filename}")
            app.logger.info(f"   - Novo nome: {new_filename}")
            
            if file_path != new_file_path:
                app.logger.info(f"📁 [RENAME] Movendo arquivo...")
                shutil.move(file_path, new_file_path)
                app.logger.info(f"✅ [RENAME] Arquivo movido com sucesso")
            elif current_filename != new_filename:
                # Mesmo diretório, mas nome diferente - renomear in-place
                app.logger.info(f"📝 [RENAME] Apenas renomeando (mesmo diretório)...")
                directory = os.path.dirname(file_path)
                new_path_same_dir = os.path.join(directory, new_filename)
                os.rename(file_path, new_path_same_dir)
                new_file_path = new_path_same_dir
                app.logger.info(f"✅ [RENAME] Arquivo renomeado no mesmo diretório")
            else:
                app.logger.info(f"⏭️ [RENAME] Nenhuma alteração necessária")
            
            # Atualizar banco de dados
            cursor.execute('''
                UPDATE pdf_files 
                SET filename = ?, file_path = ?
                WHERE id = ?
            ''', (new_filename, new_file_path, file_id))
            
            fixed_files.append({
                'id': file_id,
                'old_filename': current_filename,
                'new_filename': new_filename,
                'old_path': file_path,
                'new_path': new_file_path
            })
            
        except Exception as e:
            errors.append(f"Erro ao processar arquivo {file_id}: {str(e)}")
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'fixed_count': len(fixed_files),
        'fixed_files': fixed_files,
        'errors': errors
    })

def remove_accents_sql(text):
    """Função auxiliar para remover acentos usando SQL REPLACE."""
    if not text:
        return text
    
    # Dicionário de caracteres acentuados para não acentuados
    replacements = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
        'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ç': 'c', 'ñ': 'n',
        'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
        'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
        'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
        'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
        'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
        'Ç': 'C', 'Ñ': 'N'
    }
    
    result = text
    for accented, plain in replacements.items():
        result = result.replace(accented, plain)
    
    return result

@app.route('/api/search_suggestions')
def api_search_suggestions():
    """API para busca de sugestões (autocomplete) baseado em fuzzy search."""
    query = request.args.get('q', '').strip()
    
    if not query or len(query) < 2:
        return jsonify({'suggestions': []})
    
    # Normalizar query removendo acentos
    normalized_query = remove_accents_sql(query.lower())
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Buscar todos os arquivos e fazer filtragem em Python para melhor controle
    cursor.execute('''
        SELECT id, filename, song_name, artist, musical_key
        FROM pdf_files 
        ORDER BY song_name, artist
    ''')
    
    all_results = cursor.fetchall()
    conn.close()
    
    # Filtrar e ordenar em Python com busca fuzzy sem acentos
    matches = []
    for row in all_results:
        file_id, filename, song_name, artist, musical_key = row
        
        # Normalizar campos para busca
        norm_song = remove_accents_sql((song_name or '').lower())
        norm_artist = remove_accents_sql((artist or '').lower())
        norm_filename = remove_accents_sql((filename or '').lower())
        
        # Verificar se a query está contida em algum campo
        priority = 0
        if normalized_query in norm_song:
            priority = 1 if norm_song.startswith(normalized_query) else 2
        elif normalized_query in norm_artist:
            priority = 3 if norm_artist.startswith(normalized_query) else 4
        elif normalized_query in norm_filename:
            priority = 5
        
        if priority > 0:
            matches.append((priority, row))
    
    # Ordenar por prioridade e pegar os 10 primeiros
    matches.sort(key=lambda x: x[0])
    results = [match[1] for match in matches[:10]]
    
    suggestions = []
    for row in results:
        suggestions.append({
            'id': row[0],
            'filename': row[1],
            'song_name': row[2],
            'artist': row[3],
            'musical_key': row[4]
        })
    
    return jsonify({'suggestions': suggestions})

@app.route('/api/search_artists')
def api_search_artists():
    """API para busca de artistas com autocomplete."""
    query = request.args.get('q', '').strip()
    
    if not query or len(query) < 1:
        return jsonify({'artists': []})
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Buscar artistas que começam com ou contêm a query
    search_query = f'%{query}%'
    cursor.execute('''
        SELECT name FROM artists 
        WHERE LOWER(name) LIKE LOWER(?)
        ORDER BY 
            CASE 
                WHEN LOWER(name) LIKE LOWER(?) THEN 1
                ELSE 2
            END,
            name
        LIMIT 20
    ''', (search_query, f'{query}%'))
    
    results = cursor.fetchall()
    conn.close()
    
    artists = [row[0] for row in results]
    return jsonify({'artists': artists})

@app.route('/api/create_artist', methods=['POST'])
def api_create_artist():
    """API para criar um novo artista."""
    try:
        artist_name = request.form.get('artist_name', '').strip()
        artist_description = request.form.get('artist_description', '').strip()
        
        if not artist_name:
            return jsonify({'success': False, 'message': 'Nome do artista é obrigatório'}), 400
        
        # Verificar se artista já existe
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM artists WHERE LOWER(name) = LOWER(?)', (artist_name,))
        exists = cursor.fetchone()[0] > 0
        
        if exists:
            conn.close()
            return jsonify({'success': False, 'message': 'Artista já existe no sistema'}), 400
        
        # Criar novo artista - usar a função já existente
        conn.close()
        success = create_artist(artist_name, artist_description)
        
        if success:
            return jsonify({
                'success': True, 
                'message': 'Artista criado com sucesso',
                'artist_name': artist_name
            })
        else:
            return jsonify({'success': False, 'message': 'Erro ao criar artista'}), 500
        
    except Exception as e:
        print(f"Erro ao criar artista: {e}")
        return jsonify({'success': False, 'message': 'Erro interno do servidor'}), 500

@app.route('/api/check_duplicate', methods=['POST'])
def api_check_duplicate():
    """API para verificar se um arquivo é duplicado baseado no hash."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Nenhum arquivo enviado'}), 400
        
        file = request.files['file']
        
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Arquivo deve ser PDF'}), 400
        
        print(f"[DEBUG] Verificando duplicado para arquivo: {file.filename}")
        
        # Abordagem mais segura para Windows - usar tempfile.mkstemp
        temp_fd, temp_path = tempfile.mkstemp(suffix='.pdf')
        try:
            print(f"[DEBUG] Salvando arquivo temporário: {temp_path}")
            
            # Fechar o file descriptor e salvar o arquivo
            os.close(temp_fd)
            file.save(temp_path)
            
            print(f"[DEBUG] Calculando hash do arquivo...")
            file_hash = get_file_hash(temp_path)
            print(f"[DEBUG] Hash calculado: {file_hash}")
            
        finally:
            # Tentar remover o arquivo temporário com retry
            for attempt in range(3):
                try:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                        print(f"[DEBUG] Arquivo temporário removido (tentativa {attempt + 1})")
                    break
                except PermissionError:
                    if attempt < 2:  # Não é a última tentativa
                        print(f"[DEBUG] Erro ao remover arquivo temporário, tentando novamente em 0.1s...")
                        time.sleep(0.1)
                    else:
                        print(f"[WARNING] Não foi possível remover arquivo temporário: {temp_path}")
        
        # Verificar se hash já existe no banco
        print(f"[DEBUG] Consultando banco de dados...")
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, filename, song_name, artist, category, upload_date 
            FROM pdf_files 
            WHERE file_hash = ?
        ''', (file_hash,))
        
        existing_file = cursor.fetchone()
        conn.close()
        
        if existing_file:
            file_id, filename, song_name, artist, category, upload_date = existing_file
            print(f"[DEBUG] Arquivo duplicado encontrado: ID {file_id} - {filename}")
            return jsonify({
                'isDuplicate': True,
                'existingFile': {
                    'id': file_id,
                    'filename': filename,
                    'song_name': song_name or filename,
                    'artist': artist or 'Não informado',
                    'category': category,
                    'upload_date': upload_date
                }
            })
        else:
            print(f"[DEBUG] Arquivo não é duplicado")
            return jsonify({'isDuplicate': False})
            
    except Exception as e:
        print(f"[ERROR] Erro na API check_duplicate: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Erro ao processar arquivo: {str(e)}'}), 500

@app.route('/admin/scan_files')
def admin_scan_files():
    """Rota administrativa para escanear e corrigir arquivos."""
    
    changes = scan_and_fix_files()
    
    # Preparar URL params para toasts
    url_params = []
    
    if changes:
        files_renamed = sum(1 for c in changes if c['old_filename'] != c['new_filename'])
        songs_formatted = sum(1 for c in changes if c.get('song_updated', False))
        artists_formatted = sum(1 for c in changes if c.get('artist_updated', False))
        
        # Toast principal
        url_params.append(f"toast_success=✅ Escaneamento concluído! {len(changes)} arquivo(s) processados.")
        
        # Toasts específicos
        if files_renamed > 0:
            url_params.append(f"toast_info=📝 {files_renamed} arquivo(s) renomeados com novo padrão: \"Música - Tom - Artista\"")
        
        if songs_formatted > 0:
            url_params.append(f"toast_info2=🎵 {songs_formatted} nome(s) de música(s) formatados em camel case")
            
        if artists_formatted > 0:
            url_params.append(f"toast_info3=🎤 {artists_formatted} nome(s) de artista(s) formatados em camel case")
        
        # Exemplos das mudanças (sem "Exemplo:")
        examples_shown = 0
        example_num = 1
        for change in changes:
            if examples_shown >= 3:  # Limitar a 3 exemplos
                break
            if change['old_filename'] != change['new_filename']:
                url_params.append(f"toast_warning{example_num}=📄 {change['old_filename']} → {change['new_filename']}")
                examples_shown += 1
                example_num += 1
        
        if files_renamed > 3:
            url_params.append(f"toast_info4=... e mais {files_renamed - 3} arquivos renomeados")
            
    else:
        url_params.append("toast_success=✅ Todos os arquivos já estão organizados corretamente com o novo padrão!")
    
    # Redirecionar com parâmetros para mostrar toasts
    redirect_url = url_for('index')
    if url_params:
        redirect_url += '?' + '&'.join(url_params)
    
    return redirect(redirect_url)

@app.route('/admin/clean_orphaned_items')
def admin_clean_orphaned_items():
    """Rota administrativa para limpar itens órfãos de listas."""
    
    orphaned_count = clean_orphaned_list_items()
    
    if orphaned_count > 0:
        flash(f'{orphaned_count} item(ns) órfão(s) de listas foram removidos!')
    else:
        flash('Nenhum item órfão encontrado. Banco de dados já está limpo!')
    
    return redirect(url_for('index'))

@app.route('/admin/debug_files')
def admin_debug_files():
    """Rota para debug detalhado dos arquivos e banco de dados."""
    
    print("\n" + "="*80)
    print("INÍCIO DO DEBUG DETALHADO")
    print("="*80)
    
    # Verificar estrutura do banco
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    print("\n[DEBUG] Verificando estrutura do banco de dados...")
    cursor.execute("SELECT COUNT(*) FROM pdf_files")
    total_files = cursor.fetchone()[0]
    print(f"[DEBUG] Total de arquivos no banco: {total_files}")
    
    if total_files == 0:
        print("[DEBUG] PROBLEMA: Nenhum arquivo encontrado no banco de dados!")
        flash('PROBLEMA: Nenhum arquivo encontrado no banco de dados!')
        conn.close()
        return redirect(url_for('index'))
    
    # Listar todos os arquivos no banco
    cursor.execute('''
        SELECT id, filename, song_name, artist, category, file_path 
        FROM pdf_files 
        ORDER BY id
    ''')
    files = cursor.fetchall()
    
    print(f"\n[DEBUG] Listando todos os {len(files)} arquivos:")
    for i, (file_id, filename, song, artist, category, path) in enumerate(files):
        print(f"\n[DEBUG] Arquivo {i+1}:")
        print(f"  ID: {file_id}")
        print(f"  Nome: {filename}")
        print(f"  Música: '{song}' (len={len(song) if song else 0})")
        print(f"  Artista: '{artist}' (len={len(artist) if artist else 0})")
        print(f"  Categoria: {category}")
        print(f"  Caminho: {path}")
        print(f"  Arquivo existe: {os.path.exists(path) if path else False}")
        
        # Gerar nome ideal (sem musical_key pois é apenas para debug)
        ideal_name = generate_filename(song, artist, filename)
        print(f"  Nome ideal: {ideal_name}")
        print(f"  Precisa renomear: {filename != ideal_name}")
        
        # Verificar diretório
        if path:
            current_dir = os.path.dirname(path)
            expected_dir = os.path.join(ORGANIZED_FOLDER, category)
            print(f"  Diretório atual: {current_dir}")
            print(f"  Diretório esperado: {expected_dir}")
            print(f"  Precisa mover: {os.path.normpath(current_dir) != os.path.normpath(expected_dir)}")
    
    conn.close()
    
    # Verificar estrutura de pastas
    print(f"\n[DEBUG] Verificando estrutura de pastas em: {ORGANIZED_FOLDER}")
    if os.path.exists(ORGANIZED_FOLDER):
        for root, dirs, files in os.walk(ORGANIZED_FOLDER):
            level = root.replace(ORGANIZED_FOLDER, '').count(os.sep)
            indent = ' ' * 2 * level
            print(f"{indent}{os.path.basename(root)}/")
            subindent = ' ' * 2 * (level + 1)
            for file in files:
                file_path = os.path.join(root, file)
                print(f"{subindent}{file} ({os.path.getsize(file_path)} bytes)")
    else:
        print(f"[DEBUG] PROBLEMA: Diretório {ORGANIZED_FOLDER} não existe!")
    
    print("\n" + "="*80)
    print("FIM DO DEBUG DETALHADO")
    print("="*80 + "\n")
    
    flash('Debug detalhado executado! Verifique o console/logs para informações completas.')
    return redirect(url_for('index'))

@app.route('/admin/clean_database', methods=['GET', 'POST'])
def admin_clean_database():
    """Rota administrativa para limpar banco e arquivos (APENAS DEV)."""
    
    if request.method == 'POST':
        confirmation = request.form.get('confirmation', '')
        if confirmation == 'CONFIRMAR_LIMPEZA':
            success, message = clean_database_and_files()
            if success:
                flash(message, 'success')
            else:
                flash(message, 'error')
            return redirect(url_for('index'))
        else:
            flash('Confirmação incorreta. Operação cancelada.')
    
    return render_template('admin_clean.html')

@app.route('/admin/create_entries', methods=['POST'])
def admin_create_entries():
    """Criar novas categorias, artistas ou tempos litúrgicos via API."""
    entry_type = request.form.get('type')
    name = request.form.get('name', '').strip()
    description = request.form.get('description', '').strip()
    
    if not name:
        return jsonify({'success': False, 'message': 'Nome é obrigatório'})
    
    success = False
    if entry_type == 'category':
        success = create_category(name, description)
    elif entry_type == 'artist':
        success = create_artist(name, description)
    elif entry_type == 'liturgical_time':
        success = create_liturgical_time(name, description)
    
    if success:
        return jsonify({'success': True, 'message': f'{entry_type} "{name}" criado com sucesso'})
    else:
        return jsonify({'success': False, 'message': f'{entry_type} "{name}" já existe'})

# ==========================================
# ROTAS PRINCIPAIS (SEM AUTENTICAÇÃO)
# ==========================================

# Rotas de usuários removidas - aplicação sem autenticação

# ==========================================
# FUNÇÕES AUXILIARES
# ==========================================

def get_merge_lists():
    """Obter todas as listas de fusão para usar nos templates."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT id, name FROM merge_lists ORDER BY updated_date DESC')
    lists = cursor.fetchall()
    conn.close()
    return lists

@app.context_processor
def inject_globals():
    """Injetar variáveis globais nos templates."""
    return {
        'get_merge_lists': get_merge_lists
    }

# Adicionar filtro personalizado para strftime
@app.template_filter('strftime')
def datetime_filter(dt, format='%Y-%m-%d %H:%M:%S'):
    """Filtro personalizado para formatação de data/hora."""
    from datetime import datetime
    if dt == 'now':
        dt = datetime.now()
    elif isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except:
            dt = datetime.now()
    return dt.strftime(format)

@app.route('/download_merged_list/<int:list_id>', methods=['POST'])
def download_merged_list(list_id):
    """Baixar lista de PDFs unidos como um único arquivo."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Obter informações da lista
    cursor.execute('SELECT name FROM merge_lists WHERE id = ?', (list_id,))
    list_info = cursor.fetchone()
    
    if not list_info:
        flash('Lista não encontrada')
        return redirect(url_for('merge_lists'))
    
    list_name = list_info[0]
    
    # Obter arquivos da lista em ordem
    cursor.execute('''
        SELECT pf.file_path, pf.filename
        FROM merge_list_items mli
        JOIN pdf_files pf ON mli.pdf_file_id = pf.id
        WHERE mli.merge_list_id = ? AND pf.file_path IS NOT NULL
        ORDER BY mli.order_position
    ''', (list_id,))
    files = cursor.fetchall()
    conn.close()
    
    if not files:
        flash('Nenhum arquivo válido encontrado na lista')
        return redirect(url_for('edit_merge_list', list_id=list_id))
    
    try:
        from tempfile import NamedTemporaryFile
        from pypdf import PdfWriter, PdfReader
        import tempfile
        import time
        
        # Criar arquivo temporário
        temp_file = NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_path = temp_file.name
        temp_file.close()
        
        writer = PdfWriter()
        
        # Adicionar páginas de cada arquivo
        for file_path, filename in files:
            if os.path.exists(file_path):
                try:
                    reader = PdfReader(file_path)
                    for page in reader.pages:
                        writer.add_page(page)
                except Exception as e:
                    flash(f'Erro ao processar {filename}: {str(e)}')
                    continue
        
        # Salvar arquivo mesclado
        with open(temp_path, 'wb') as output_file:
            writer.write(output_file)
        
        # Gerar nome do arquivo final
        safe_list_name = sanitize_filename(list_name)
        final_filename = f"{safe_list_name}.pdf"
        
        def remove_file():
            try:
                os.unlink(temp_path)
            except:
                pass
        
        response = send_file(
            temp_path,
            as_attachment=True,
            download_name=final_filename,
            mimetype='application/pdf'
        )
        
        response.call_on_close(remove_file)
        return response
        
    except Exception as e:
        flash(f'Erro ao criar arquivo mesclado: {str(e)}')
        return redirect(url_for('edit_merge_list', list_id=list_id))

@app.route('/update_merge_list_info/<int:list_id>', methods=['POST'])
def update_merge_list_info_route(list_id):
    """Atualizar informações da lista (nome e observações)."""
    new_name = request.form.get('list_name', '').strip()
    observations = request.form.get('observations', '').strip()
    
    if not new_name:
        flash('Nome da lista é obrigatório')
        return redirect(url_for('edit_merge_list', list_id=list_id))
    
    success = update_merge_list_info(list_id, new_name, observations)
    
    if success:
        flash('Informações da lista atualizadas com sucesso!')
    else:
        flash('Erro ao atualizar informações da lista')
    
    return redirect(url_for('edit_merge_list', list_id=list_id))

# Função de autenticação modal removida

@app.route('/delete/<int:file_id>', methods=['POST'])
def delete_file(file_id):
    """Deletar arquivo PDF."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT file_path, filename FROM pdf_files WHERE id = ?', (file_id,))
    result = cursor.fetchone()
    
    if result:
        file_path, filename = result
        
        # Deletar arquivo do sistema
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Deletar do banco de dados
        cursor.execute('DELETE FROM pdf_files WHERE id = ?', (file_id,))
        conn.commit()
        
        flash(f'Arquivo deletado: {filename}')
    else:
        flash('Arquivo não encontrado')
    
    conn.close()
    return redirect(url_for('index'))

@app.route('/update_music/<int:file_id>', methods=['POST'])
def update_music(file_id):
    """Atualizar informações da música."""
    song_name = request.form.get('song_name', '').strip()
    artist = request.form.get('artist', '').strip()
    new_artist = request.form.get('new_artist', '').strip()
    musical_key = request.form.get('musical_key', '')
    youtube_link = request.form.get('youtube_link', '')
    description = request.form.get('description', '')
    
    # Criar novo artista se especificado
    if new_artist and not artist:
        if create_artist(new_artist):
            artist = new_artist
        else:
            artist = new_artist
    
    # Processar categorias múltiplas
    selected_categories = request.form.getlist('categories')
    new_categories = request.form.getlist('new_categories')
    
    # Processar tempos litúrgicos múltiplos
    selected_liturgical_times = request.form.getlist('liturgical_times')
    new_liturgical_times = request.form.getlist('new_liturgical_times')
    
    # Adicionar novas categorias ao banco se não existirem
    for new_cat in new_categories:
        if new_cat.strip():
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (new_cat.strip(),))
            conn.commit()
            conn.close()
            selected_categories.append(new_cat.strip())
    
    # Adicionar novos tempos litúrgicos ao banco se não existirem
    for new_time in new_liturgical_times:
        if new_time.strip():
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            cursor.execute('INSERT OR IGNORE INTO liturgical_times (name) VALUES (?)', (new_time.strip(),))
            conn.commit()
            conn.close()
            selected_liturgical_times.append(new_time.strip())
    
    # Usar a primeira categoria como categoria principal (para compatibilidade)
    primary_category = selected_categories[0] if selected_categories else 'Diversos'
    primary_liturgical_time = selected_liturgical_times[0] if selected_liturgical_times else ''
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Atualizar informações básicas da música
    cursor.execute('''
        UPDATE pdf_files 
        SET song_name = ?, artist = ?, category = ?, liturgical_time = ?, 
            musical_key = ?, youtube_link = ?, description = ?
        WHERE id = ?
    ''', (song_name, artist, primary_category, primary_liturgical_time, 
          musical_key, youtube_link, description, file_id))
    
    # Limpar categorias e tempos litúrgicos existentes
    cursor.execute('DELETE FROM file_categories WHERE file_id = ?', (file_id,))
    cursor.execute('DELETE FROM file_liturgical_times WHERE file_id = ?', (file_id,))
    
    # Adicionar múltiplas categorias
    for category in selected_categories:
        if category.strip():
            # Primeiro criar a categoria se não existir
            cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (category.strip(),))
            # Depois obter o ID e criar o relacionamento
            cursor.execute('SELECT id FROM categories WHERE name = ?', (category.strip(),))
            category_id = cursor.fetchone()[0]
            cursor.execute('INSERT OR IGNORE INTO file_categories (file_id, category_id) VALUES (?, ?)', 
                         (file_id, category_id))
    
    # Adicionar múltiplos tempos litúrgicos
    for liturgical_time in selected_liturgical_times:
        if liturgical_time.strip():
            # Primeiro criar o tempo litúrgico se não existir
            cursor.execute('INSERT OR IGNORE INTO liturgical_times (name) VALUES (?)', (liturgical_time.strip(),))
            # Depois obter o ID e criar o relacionamento
            cursor.execute('SELECT id FROM liturgical_times WHERE name = ?', (liturgical_time.strip(),))
            liturgical_id = cursor.fetchone()[0]
            cursor.execute('INSERT OR IGNORE INTO file_liturgical_times (file_id, liturgical_time_id) VALUES (?, ?)', 
                         (file_id, liturgical_id))
    
    conn.commit()
    conn.close()
    
    return redirect(url_for('music_details', file_id=file_id, success='Informações da música atualizadas com sucesso!'))

@app.route('/replace_pdf/<int:file_id>', methods=['POST'])
def replace_pdf(file_id):
    """Substituir arquivo PDF de uma música existente."""
    conn = None
    old_file_path = None
    new_file_path = None
    
    try:
        # Verificar se há arquivo na requisição
        if 'replacement_pdf' not in request.files:
            return jsonify({'success': False, 'error': 'Nenhum arquivo enviado'}), 400
        
        file = request.files['replacement_pdf']
        
        # Validações básicas
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            return jsonify({'success': False, 'error': 'Arquivo deve ser PDF'}), 400
        
        # Verificar tamanho (50MB max)
        file.seek(0, 2)  # Ir para o final do arquivo
        file_size = file.tell()  # Obter tamanho
        file.seek(0)  # Voltar para o início
        
        max_size = 50 * 1024 * 1024  # 50MB
        if file_size > max_size:
            return jsonify({'success': False, 'error': 'Arquivo muito grande. Tamanho máximo: 50MB'}), 400
        
        # ETAPA 1: Buscar informações da música (conexão rápida)
        conn = sqlite3.connect(DATABASE, timeout=30)  # 30 segundos de timeout
        cursor = conn.cursor()
        cursor.execute('''
            SELECT filename, file_path, song_name, artist, category, musical_key
            FROM pdf_files WHERE id = ?
        ''', (file_id,))
        
        music_info = cursor.fetchone()
        if not music_info:
            return jsonify({'success': False, 'error': 'Música não encontrada'}), 404
        
        old_filename, old_file_path, song_name, artist, category, musical_key = music_info
        conn.close()  # Fechar conexão imediatamente
        conn = None
        
        # ETAPA 2: Preparar novo arquivo (operações sem DB)
        secured_filename = secure_filename(file.filename)
        
        # Se tem nome da música e artista, usar padrão formatado
        if song_name and artist:
            new_filename = generate_filename(song_name, artist, secured_filename, musical_key)
        else:
            new_filename = secured_filename
        
        # Determinar pasta de destino
        category_folder = os.path.join(ORGANIZED_FOLDER, category or 'Diversos')
        os.makedirs(category_folder, exist_ok=True)
        
        # Gerar caminho único se arquivo já existir
        new_file_path = os.path.join(category_folder, new_filename)
        counter = 1
        base_name = os.path.splitext(new_filename)[0]
        
        while os.path.exists(new_file_path) and new_file_path != old_file_path:
            new_filename = f"{base_name}_{counter}.pdf"
            new_file_path = os.path.join(category_folder, new_filename)
            counter += 1
        
        # ETAPA 3: Salvar novo arquivo e calcular informações (sem DB)
        file.save(new_file_path)
        app.logger.info(f"Novo arquivo salvo: {new_file_path}")
        
        # Obter informações do novo arquivo
        pdf_info = get_pdf_info(new_file_path)
        new_file_size = os.path.getsize(new_file_path)
        new_file_hash = get_file_hash(new_file_path)
        
        # ETAPA 4: Atualizar banco de dados (conexão rápida)
        conn = sqlite3.connect(DATABASE, timeout=30)
        cursor = conn.cursor()
        
        # Usar transação explícita para garantir atomicidade
        cursor.execute('BEGIN IMMEDIATE')
        
        cursor.execute('''
            UPDATE pdf_files 
            SET filename = ?, file_path = ?, file_size = ?, file_hash = ?, page_count = ?
            WHERE id = ?
        ''', (new_filename, new_file_path, new_file_size, new_file_hash, pdf_info['page_count'], file_id))
        
        cursor.execute('COMMIT')
        
        # ETAPA 5: Remover arquivo antigo (após sucesso no DB)
        if old_file_path and os.path.exists(old_file_path) and old_file_path != new_file_path:
            try:
                os.remove(old_file_path)
                app.logger.info(f"Arquivo antigo removido: {old_file_path}")
            except Exception as e:
                app.logger.warning(f"Erro ao remover arquivo antigo: {str(e)}")
        
        app.logger.info(f"PDF substituído com sucesso para música ID {file_id}: {old_filename} -> {new_filename}")
        
        return jsonify({
            'success': True,
            'message': 'PDF substituído com sucesso',
            'new_filename': new_filename,
            'new_size': new_file_size,
            'new_pages': pdf_info['page_count']
        })
        
    except sqlite3.OperationalError as e:
        app.logger.error(f"Erro de banco SQLite ao substituir PDF: {str(e)}")
        
        # Se o arquivo novo foi criado mas falhou no DB, tentar remover
        if new_file_path and os.path.exists(new_file_path):
            try:
                os.remove(new_file_path)
                app.logger.info(f"Arquivo novo removido após erro no DB: {new_file_path}")
            except Exception:
                pass
                
        return jsonify({'success': False, 'error': f'Erro no banco de dados: {str(e)}'}), 500
        
    except Exception as e:
        app.logger.error(f"Erro ao substituir PDF: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Se o arquivo novo foi criado mas algo falhou, tentar remover
        if new_file_path and os.path.exists(new_file_path):
            try:
                os.remove(new_file_path)
                app.logger.info(f"Arquivo novo removido após erro: {new_file_path}")
            except Exception:
                pass
                
        return jsonify({'success': False, 'error': f'Erro interno: {str(e)}'}), 500
        
    finally:
        # Garantir que a conexão seja sempre fechada
        if conn:
            try:
                conn.close()
            except Exception:
                pass



@app.route('/search')
def search():
    """Buscar arquivos PDF com paginação."""
    query = request.args.get('q', '')
    category = request.args.get('category', '')
    liturgical_time = request.args.get('liturgical_time', '')
    view_mode = request.args.get('view', 'card')  # card or list
    
    # Paginação
    page = max(1, int(request.args.get('page', 1)))
    per_page = int(request.args.get('per_page', 10))  # Padrão 10 por página
    
    # Validar per_page
    if per_page not in [10, 25, 50]:
        per_page = 10
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Construir query base com JOINs para filtros de categoria e tempo litúrgico
    base_query = '''
        SELECT DISTINCT pf.id, pf.filename, pf.original_name, pf.song_name, pf.artist, pf.category, pf.liturgical_time, 
               pf.musical_key, pf.youtube_link, pf.file_size, pf.upload_date, pf.page_count, pf.description, pf.file_path
        FROM pdf_files pf
    '''
    
    count_query = 'SELECT COUNT(DISTINCT pf.id) FROM pdf_files pf'
    
    joins = []
    where_conditions = ['1=1']
    params = []
    
    # JOIN para filtro de categoria (usando tanto coluna principal quanto relacionamento)
    if category:
        joins.append('LEFT JOIN file_categories fc ON pf.id = fc.file_id')
        joins.append('LEFT JOIN categories c ON fc.category_id = c.id')
        where_conditions.append('(pf.category = ? OR c.name = ?)')
        params.extend([category, category])
    
    # JOIN para filtro de tempo litúrgico (usando tanto coluna principal quanto relacionamento)
    if liturgical_time:
        joins.append('LEFT JOIN file_liturgical_times flt ON pf.id = flt.file_id')
        joins.append('LEFT JOIN liturgical_times lt ON flt.liturgical_time_id = lt.id')
        where_conditions.append('(pf.liturgical_time = ? OR lt.name = ?)')
        params.extend([liturgical_time, liturgical_time])
    
    # Adicionar JOINs às queries
    if joins:
        join_clause = ' ' + ' '.join(joins)
        base_query += join_clause
        count_query += join_clause
    
    # Adicionar WHERE
    where_clause = ' WHERE ' + ' AND '.join(where_conditions)
    base_query += where_clause
    count_query += where_clause
    
    if query:
        search_condition = ''' AND (
            LOWER(pf.song_name) LIKE LOWER(?) OR 
            LOWER(pf.artist) LIKE LOWER(?) OR 
            LOWER(pf.filename) LIKE LOWER(?) OR 
            LOWER(pf.description) LIKE LOWER(?)
        )'''
        base_query += search_condition
        count_query += search_condition
        search_param = f'%{query}%'
        params.extend([search_param, search_param, search_param, search_param])
    
    # Obter contagem total
    cursor.execute(count_query, params)
    total_count = cursor.fetchone()[0]
    
    # Calcular paginação
    total_pages = (total_count + per_page - 1) // per_page
    offset = (page - 1) * per_page
    
    # Adicionar ordenação e limite
    base_query += ' ORDER BY upload_date DESC LIMIT ? OFFSET ?'
    params.extend([per_page, offset])
    
    # Executar query principal
    cursor.execute(base_query, params)
    files = cursor.fetchall()
    
    # Obter dados para filtros usando as tabelas de relacionamento
    cursor.execute('''
        SELECT DISTINCT c.name 
        FROM categories c
        WHERE c.id IN (
            SELECT category_id FROM file_categories
            UNION
            SELECT id FROM categories WHERE name IN (SELECT DISTINCT category FROM pdf_files WHERE category IS NOT NULL)
        )
        ORDER BY c.name
    ''')
    categories = [row[0] for row in cursor.fetchall()]
    
    cursor.execute('''
        SELECT DISTINCT lt.name 
        FROM liturgical_times lt
        WHERE lt.id IN (
            SELECT liturgical_time_id FROM file_liturgical_times
            UNION
            SELECT id FROM liturgical_times WHERE name IN (SELECT DISTINCT liturgical_time FROM pdf_files WHERE liturgical_time IS NOT NULL)
        )
        ORDER BY lt.name
    ''')
    liturgical_times = [row[0] for row in cursor.fetchall()]
    
    conn.close()
    
    # Obter listas de fusão para dropdowns
    merge_lists = get_merge_lists()
    
    # Dados de paginação
    pagination = {
        'page': page,
        'per_page': per_page,
        'total': total_count,
        'total_pages': total_pages,
        'has_prev': page > 1,
        'has_next': page < total_pages,
        'prev_num': page - 1 if page > 1 else None,
        'next_num': page + 1 if page < total_pages else None,
        'pages': list(range(max(1, page - 2), min(total_pages + 1, page + 3)))
    }
    
    return render_template('search_results.html', 
                         files=files, 
                         query=query, 
                         selected_category=category,
                         selected_liturgical=liturgical_time,
                         categories=categories, 
                         liturgical_times=liturgical_times,
                         merge_lists=merge_lists,
                         view_mode=view_mode,
                         pagination=pagination)

@app.route('/view/<int:file_id>')
def view_file(file_id):
    """Servir arquivo PDF para visualização."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT file_path, filename FROM pdf_files WHERE id = ?', (file_id,))
    result = cursor.fetchone()
    conn.close()
    
    if result and os.path.exists(result[0]):
        return send_file(result[0], as_attachment=False, download_name=result[1])
    
    flash('Arquivo não encontrado')
    return redirect(url_for('index'))

@app.route('/details/<int:file_id>')
def music_details(file_id):
    """Mostrar detalhes completos da música."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, filename, original_name, song_name, artist, category, liturgical_time, 
               musical_key, youtube_link, file_size, upload_date, page_count, description, file_path
        FROM pdf_files WHERE id = ?
    ''', (file_id,))
    music = cursor.fetchone()
    conn.close()
    
    if not music:
        flash('Música não encontrada')
        return redirect(url_for('index'))
    
    return render_template('music_details.html', music=music, categories=get_categories(), 
                         liturgical_times=get_liturgical_times(), musical_keys=get_musical_keys(), artists=get_artists())

@app.route('/download/<int:file_id>')
def download_file(file_id):
    """Download específico de arquivo PDF."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT file_path, filename FROM pdf_files WHERE id = ?', (file_id,))
    result = cursor.fetchone()
    conn.close()
    
    if result and os.path.exists(result[0]):
        return send_file(result[0], as_attachment=True, download_name=result[1])
    
    flash('Arquivo não encontrado')
    return redirect(url_for('index'))

@app.route('/api/generate_report')
@app.route('/api/generate_report/<int:list_id>')
def api_generate_report(list_id=None):
    """API para gerar relatório simples de lista de músicas."""
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        if list_id:
            # Gerar relatório de uma lista específica
            cursor.execute('SELECT name FROM merge_lists WHERE id = ?', (list_id,))
            list_info = cursor.fetchone()
            
            if not list_info:
                return jsonify({
                    'success': False,
                    'message': 'Lista não encontrada'
                }), 404
            
            list_name = list_info[0]
            
            # Buscar músicas da lista ordenadas por posição
            cursor.execute('''
                SELECT pf.song_name, pf.artist, pf.youtube_link, pf.filename
                FROM merge_list_items mli
                JOIN pdf_files pf ON mli.pdf_file_id = pf.id
                WHERE mli.merge_list_id = ?
                ORDER BY mli.order_position
            ''', (list_id,))
            
            files = cursor.fetchall()
            
        else:
            # Gerar relatório de todas as músicas
            cursor.execute('''
                SELECT song_name, artist, youtube_link, filename
                FROM pdf_files 
                ORDER BY song_name, artist
            ''')
            
            files = cursor.fetchall()
        
        conn.close()
        
        if not files:
            return jsonify({
                'success': False,
                'message': 'Nenhuma música encontrada'
            })
        
        # Gerar lista simples de músicas
        report_lines = []
        
        for song_name, artist, youtube_link, filename in files:
            # Usar song_name se disponível, senão usar filename
            music_title = song_name if song_name and song_name.strip() else filename.replace('.pdf', '')
            artist_name = artist if artist and artist.strip() else 'Não informado'
            
            # Formato básico: "Música - Artista"
            if youtube_link and youtube_link.strip():
                # Formato com YouTube: "Música - Artista - Link do YouTube"
                line = f"{music_title} - {artist_name} - {youtube_link}"
            else:
                # Formato sem YouTube: "Música - Artista"
                line = f"{music_title} - {artist_name}"
            
            report_lines.append(line)
        
        # Juntar todas as linhas
        report_content = "\n".join(report_lines)
        
        return jsonify({
            'success': True,
            'report': report_content
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao gerar relatório: {str(e)}'
        }), 500

@app.route('/dashboard')
def dashboard():
    """Dashboard com relatórios e estatísticas das músicas e listas."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # === ESTATÍSTICAS BÁSICAS ===
    # Total de músicas
    cursor.execute('SELECT COUNT(*) FROM pdf_files')
    total_musics = cursor.fetchone()[0]
    
    # Total de listas
    cursor.execute('SELECT COUNT(*) FROM merge_lists')
    total_lists = cursor.fetchone()[0]
    
    # Total de categorias
    cursor.execute('SELECT COUNT(*) FROM categories')
    total_categories = cursor.fetchone()[0]
    
    # Média de músicas por lista
    if total_lists > 0:
        cursor.execute('''
            SELECT AVG(music_count) FROM (
                SELECT COUNT(*) as music_count 
                FROM merge_list_items 
                GROUP BY merge_list_id
            )
        ''')
        avg_result = cursor.fetchone()[0]
        avg_musics_per_list = float(avg_result) if avg_result else 0.0
    else:
        avg_musics_per_list = 0.0
    
    # === DADOS PARA GRÁFICOS ===
    # Músicas por categoria (incluindo sem categoria)
    cursor.execute('''
        SELECT 
            CASE 
                WHEN c.name IS NOT NULL THEN c.name
                WHEN pf.category IS NOT NULL AND pf.category != '' THEN pf.category
                ELSE 'Sem categoria'
            END as category_name,
            COUNT(DISTINCT pf.id) as count
        FROM pdf_files pf
        LEFT JOIN file_categories fc ON pf.id = fc.file_id
        LEFT JOIN categories c ON fc.category_id = c.id
        GROUP BY category_name
        ORDER BY count DESC
        LIMIT 10
    ''')
    categories_data = [{'name': row[0], 'count': row[1]} for row in cursor.fetchall()]
    
    # Músicas por tempo litúrgico (incluindo sem tempo litúrgico)
    cursor.execute('''
        SELECT 
            CASE 
                WHEN lt.name IS NOT NULL THEN lt.name
                WHEN pf.liturgical_time IS NOT NULL AND pf.liturgical_time != '' THEN pf.liturgical_time
                ELSE 'Sem tempo litúrgico'
            END as liturgical_name,
            COUNT(DISTINCT pf.id) as count
        FROM pdf_files pf
        LEFT JOIN file_liturgical_times flt ON pf.id = flt.file_id
        LEFT JOIN liturgical_times lt ON flt.liturgical_time_id = lt.id
        GROUP BY liturgical_name
        ORDER BY count DESC
        LIMIT 10
    ''')
    liturgical_data = [{'name': row[0], 'count': row[1]} for row in cursor.fetchall()]
    
    # Uploads por mês (últimos 12 meses)
    cursor.execute('''
        SELECT strftime('%Y-%m', upload_date) as month_raw, COUNT(*) as count
        FROM pdf_files
        WHERE upload_date >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', upload_date)
        ORDER BY month_raw
    ''')
    
    # Converter formato do mês para "Jan/25", "Fev/25", etc.
    month_names = {
        '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
        '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
        '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
    }
    
    uploads_data = []
    for row in cursor.fetchall():
        year_month, count = row
        if year_month:
            year, month = year_month.split('-')
            formatted_month = f"{month_names.get(month, month)}/{year[2:]}"
            uploads_data.append({'month': formatted_month, 'count': count})
    
    # === TOP 10 MÚSICAS MAIS USADAS ===
    cursor.execute('''
        SELECT pf.id, pf.song_name, pf.filename, pf.artist, pf.category, COUNT(mli.id) as usage_count
        FROM pdf_files pf
        LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
        LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
        WHERE mli.id IS NOT NULL AND ml.id IS NOT NULL
        GROUP BY pf.id
        ORDER BY usage_count DESC, pf.song_name
        LIMIT 10
    ''')
    most_used_musics = []
    for row in cursor.fetchall():
        most_used_musics.append({
            'id': row[0],
            'song_name': row[1],
            'filename': row[2],
            'artist': row[3],
            'category': row[4],
            'usage_count': row[5]
        })
    
    # === ESTATÍSTICAS DETALHADAS ===
    # Tamanho total dos arquivos
    cursor.execute('SELECT SUM(file_size) FROM pdf_files WHERE file_size IS NOT NULL')
    total_size_bytes = cursor.fetchone()[0] or 0
    total_file_size_mb = total_size_bytes / (1024 * 1024)
    
    # Total de páginas
    cursor.execute('SELECT SUM(page_count) FROM pdf_files WHERE page_count IS NOT NULL')
    total_pages = cursor.fetchone()[0] or 0
    
    # Músicas com YouTube
    cursor.execute('SELECT COUNT(*) FROM pdf_files WHERE youtube_link IS NOT NULL AND youtube_link != ""')
    musics_with_youtube = cursor.fetchone()[0]
    
    # Maior lista
    cursor.execute('''
        SELECT ml.name, COUNT(mli.id) as count
        FROM merge_lists ml
        LEFT JOIN merge_list_items mli ON ml.id = mli.merge_list_id
        GROUP BY ml.id
        ORDER BY count DESC
        LIMIT 1
    ''')
    largest_list_result = cursor.fetchone()
    largest_list = {
        'name': largest_list_result[0],
        'count': largest_list_result[1]
    } if largest_list_result else None
    
    # Categoria mais popular
    cursor.execute('''
        SELECT c.name, COUNT(DISTINCT fc.file_id) as count
        FROM categories c
        LEFT JOIN file_categories fc ON c.id = fc.category_id
        GROUP BY c.id
        ORDER BY count DESC
        LIMIT 1
    ''')
    most_popular_cat_result = cursor.fetchone()
    most_popular_category = {
        'name': most_popular_cat_result[0],
        'count': most_popular_cat_result[1]
    } if most_popular_cat_result else None
    
    conn.close()
    
    # Converter dados para JSON para JavaScript
    import json
    categories_json = json.dumps(categories_data)
    liturgical_json = json.dumps(liturgical_data)
    uploads_json = json.dumps(uploads_data)
    
    return render_template('dashboard.html',
                         total_musics=total_musics,
                         total_lists=total_lists,
                         total_categories=total_categories,
                         avg_musics_per_list=avg_musics_per_list,
                         categories_data=categories_json,
                         liturgical_data=liturgical_json,
                         uploads_data=uploads_json,
                         most_used_musics=most_used_musics,
                         total_file_size_mb=total_file_size_mb,
                         total_pages=total_pages,
                         musics_with_youtube=musics_with_youtube,
                         largest_list=largest_list,
                                                   most_popular_category=most_popular_category)

@app.route('/api/dashboard/top_by_categories')
def api_dashboard_top_by_categories():
    """API para obter top 5 músicas por categoria."""
    selected_categories = request.args.getlist('categories')
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Se não especificou categorias, buscar todas
    if not selected_categories:
        cursor.execute('SELECT name FROM categories ORDER BY name')
        selected_categories = [row[0] for row in cursor.fetchall()]
        # Adicionar também "Sem categoria"
        selected_categories.append('Sem categoria')
    
    results = {}
    
    for category in selected_categories:
        if category == 'Sem categoria':
            # Buscar músicas sem categoria
            cursor.execute('''
                SELECT pf.id, pf.song_name, pf.filename, pf.artist, COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
                LEFT JOIN file_categories fc ON pf.id = fc.file_id
                WHERE (pf.category IS NULL OR pf.category = '' OR pf.category = 'Diversos') 
                  AND fc.file_id IS NULL
                  AND ml.id IS NOT NULL
                GROUP BY pf.id
                ORDER BY usage_count DESC, pf.song_name
                LIMIT 5
            ''')
        else:
            # Buscar músicas da categoria específica
            cursor.execute('''
                SELECT DISTINCT pf.id, pf.song_name, pf.filename, pf.artist, COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
                LEFT JOIN file_categories fc ON pf.id = fc.file_id
                LEFT JOIN categories c ON fc.category_id = c.id
                WHERE (pf.category = ? OR c.name = ?)
                  AND ml.id IS NOT NULL
                GROUP BY pf.id
                ORDER BY usage_count DESC, pf.song_name
                LIMIT 5
            ''', (category, category))
        
        musics = []
        for row in cursor.fetchall():
            if row[4] > 0:  # Só incluir se foi usada em pelo menos 1 lista
                musics.append({
                    'id': row[0],
                    'song_name': row[1],
                    'filename': row[2],
                    'artist': row[3],
                    'usage_count': row[4]
                })
        
        if musics:  # Só adicionar categoria se tem músicas
            results[category] = musics
    
    conn.close()
    return jsonify(results)

@app.route('/api/dashboard/top_by_liturgical_times')
def api_dashboard_top_by_liturgical_times():
    """API para obter top 5 músicas por tempo litúrgico."""
    selected_times = request.args.getlist('liturgical_times')
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Se não especificou tempos, buscar todos
    if not selected_times:
        cursor.execute('SELECT name FROM liturgical_times ORDER BY name')
        selected_times = [row[0] for row in cursor.fetchall()]
        # Adicionar também "Sem tempo litúrgico"
        selected_times.append('Sem tempo litúrgico')
    
    results = {}
    
    for liturgical_time in selected_times:
        if liturgical_time == 'Sem tempo litúrgico':
            # Buscar músicas sem tempo litúrgico
            cursor.execute('''
                SELECT pf.id, pf.song_name, pf.filename, pf.artist, COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
                LEFT JOIN file_liturgical_times flt ON pf.id = flt.file_id
                WHERE (pf.liturgical_time IS NULL OR pf.liturgical_time = '')
                  AND flt.file_id IS NULL
                  AND ml.id IS NOT NULL
                GROUP BY pf.id
                ORDER BY usage_count DESC, pf.song_name
                LIMIT 5
            ''')
        else:
            # Buscar músicas do tempo litúrgico específico
            cursor.execute('''
                SELECT DISTINCT pf.id, pf.song_name, pf.filename, pf.artist, COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
                LEFT JOIN file_liturgical_times flt ON pf.id = flt.file_id
                LEFT JOIN liturgical_times lt ON flt.liturgical_time_id = lt.id
                WHERE (pf.liturgical_time = ? OR lt.name = ?)
                  AND ml.id IS NOT NULL
                GROUP BY pf.id
                ORDER BY usage_count DESC, pf.song_name
                LIMIT 5
            ''', (liturgical_time, liturgical_time))
        
        musics = []
        for row in cursor.fetchall():
            if row[4] > 0:  # Só incluir se foi usada em pelo menos 1 lista
                musics.append({
                    'id': row[0],
                    'song_name': row[1],
                    'filename': row[2],
                    'artist': row[3],
                    'usage_count': row[4]
                })
        
        if musics:  # Só adicionar tempo se tem músicas
            results[liturgical_time] = musics
    
    conn.close()
    return jsonify(results)

@app.route('/api/dashboard/get_categories')
def api_dashboard_get_categories():
    """API para obter lista de todas as categorias."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT name FROM categories ORDER BY name')
    categories = [row[0] for row in cursor.fetchall()]
    
    # Verificar se existem músicas sem categoria
    cursor.execute('''
        SELECT COUNT(*) FROM pdf_files pf
        LEFT JOIN file_categories fc ON pf.id = fc.file_id
        WHERE (pf.category IS NULL OR pf.category = '' OR pf.category = 'Diversos') 
          AND fc.file_id IS NULL
    ''')
    
    if cursor.fetchone()[0] > 0:
        categories.append('Sem categoria')
    
    conn.close()
    return jsonify(categories)

@app.route('/api/dashboard/get_liturgical_times')
def api_dashboard_get_liturgical_times():
    """API para obter lista de todos os tempos litúrgicos."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT name FROM liturgical_times ORDER BY name')
    times = [row[0] for row in cursor.fetchall()]
    
    # Verificar se existem músicas sem tempo litúrgico
    cursor.execute('''
        SELECT COUNT(*) FROM pdf_files pf
        LEFT JOIN file_liturgical_times flt ON pf.id = flt.file_id
        WHERE (pf.liturgical_time IS NULL OR pf.liturgical_time = '')
          AND flt.file_id IS NULL
    ''')
    
    if cursor.fetchone()[0] > 0:
        times.append('Sem tempo litúrgico')
    
    conn.close()
    return jsonify(times)

def update_merge_list_info(list_id, new_name, observations):
    """Atualizar informações da lista de fusão (nome e observações)."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE merge_lists 
            SET name = ?, observations = ?, updated_date = CURRENT_TIMESTAMP 
            WHERE id = ?
        ''', (new_name, observations, list_id))
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()

@app.route('/api/dashboard/pivot_categories')
def api_dashboard_pivot_categories():
    """API para obter relatório pivot de categorias (formato tabular linear)."""
    selected_categories = request.args.getlist('categories')
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Se não especificou categorias, buscar todas
    if not selected_categories:
        cursor.execute('SELECT name FROM categories ORDER BY name')
        selected_categories = [row[0] for row in cursor.fetchall()]
        # Adicionar também "Sem categoria"
        selected_categories.append('Sem categoria')
    
    # Buscar músicas com suas informações para cada categoria
    results = []
    
    for category in selected_categories:
        if category == 'Sem categoria':
            # Buscar músicas sem categoria
            cursor.execute('''
                SELECT DISTINCT pf.id, pf.song_name, pf.filename, pf.artist, 
                       pf.musical_key, pf.youtube_link, COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
                LEFT JOIN file_categories fc ON pf.id = fc.file_id
                WHERE (pf.category IS NULL OR pf.category = '' OR pf.category = 'Diversos') 
                  AND fc.file_id IS NULL
                GROUP BY pf.id, pf.song_name, pf.filename, pf.artist, pf.musical_key, pf.youtube_link
                ORDER BY usage_count DESC, pf.song_name
            ''')
        else:
            # Buscar músicas da categoria específica
            cursor.execute('''
                SELECT DISTINCT pf.id, pf.song_name, pf.filename, pf.artist, 
                       pf.musical_key, pf.youtube_link, COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
                LEFT JOIN file_categories fc ON pf.id = fc.file_id
                LEFT JOIN categories c ON fc.category_id = c.id
                WHERE (pf.category = ? OR c.name = ?)
                GROUP BY pf.id, pf.song_name, pf.filename, pf.artist, pf.musical_key, pf.youtube_link
                ORDER BY usage_count DESC, pf.song_name
            ''', (category, category))
        
        for row in cursor.fetchall():
            music_name = row[1] if row[1] and row[1].strip() else row[2].replace('.pdf', '')
            artist = row[3] if row[3] and row[3].strip() else 'Não informado'
            musical_key = row[4] if row[4] and row[4].strip() else '-'
            youtube_link = row[5] if row[5] and row[5].strip() else ''
            usage_count = row[6]
            
            results.append({
                'id': row[0],
                'music_name': music_name,
                'artist': artist,
                'category': category,
                'musical_key': musical_key,
                'youtube_link': youtube_link,
                'usage_count': usage_count
            })
    
    conn.close()
    
    # Ordenar por contagem de uso (decrescente) e depois por nome
    results.sort(key=lambda x: (-x['usage_count'], x['music_name']))
    
    return jsonify(results)

@app.route('/api/dashboard/pivot_liturgical')
def api_dashboard_pivot_liturgical():
    """API para obter relatório pivot de tempos litúrgicos (formato tabular linear)."""
    selected_times = request.args.getlist('liturgical_times')
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Se não especificou tempos, buscar todos
    if not selected_times:
        cursor.execute('SELECT name FROM liturgical_times ORDER BY name')
        selected_times = [row[0] for row in cursor.fetchall()]
        # Adicionar também "Sem tempo litúrgico"
        selected_times.append('Sem tempo litúrgico')
    
    # Buscar músicas com suas informações para cada tempo litúrgico
    results = []
    
    for liturgical_time in selected_times:
        if liturgical_time == 'Sem tempo litúrgico':
            # Buscar músicas sem tempo litúrgico
            cursor.execute('''
                SELECT DISTINCT pf.id, pf.song_name, pf.filename, pf.artist, 
                       pf.musical_key, pf.youtube_link, COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
                LEFT JOIN file_liturgical_times flt ON pf.id = flt.file_id
                WHERE (pf.liturgical_time IS NULL OR pf.liturgical_time = '')
                  AND flt.file_id IS NULL
                GROUP BY pf.id, pf.song_name, pf.filename, pf.artist, pf.musical_key, pf.youtube_link
                ORDER BY usage_count DESC, pf.song_name
            ''')
        else:
            # Buscar músicas do tempo litúrgico específico
            cursor.execute('''
                SELECT DISTINCT pf.id, pf.song_name, pf.filename, pf.artist, 
                       pf.musical_key, pf.youtube_link, COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                LEFT JOIN merge_lists ml ON mli.merge_list_id = ml.id
                LEFT JOIN file_liturgical_times flt ON pf.id = flt.file_id
                LEFT JOIN liturgical_times lt ON flt.liturgical_time_id = lt.id
                WHERE (pf.liturgical_time = ? OR lt.name = ?)
                GROUP BY pf.id, pf.song_name, pf.filename, pf.artist, pf.musical_key, pf.youtube_link
                ORDER BY usage_count DESC, pf.song_name
            ''', (liturgical_time, liturgical_time))
        
        for row in cursor.fetchall():
            music_name = row[1] if row[1] and row[1].strip() else row[2].replace('.pdf', '')
            artist = row[3] if row[3] and row[3].strip() else 'Não informado'
            musical_key = row[4] if row[4] and row[4].strip() else '-'
            youtube_link = row[5] if row[5] and row[5].strip() else ''
            usage_count = row[6]
            
            results.append({
                'id': row[0],
                'music_name': music_name,
                'artist': artist,
                'liturgical_time': liturgical_time,
                'musical_key': musical_key,
                'youtube_link': youtube_link,
                'usage_count': usage_count
            })
    
    conn.close()
    
    # Ordenar por contagem de uso (decrescente) e depois por nome
    results.sort(key=lambda x: (-x['usage_count'], x['music_name']))
    
    return jsonify(results)

@app.route('/api/dashboard/liturgical_top_by_categories/<liturgical_time>')
def api_dashboard_liturgical_top_by_categories(liturgical_time):
    """API para obter top 5 músicas por categoria dentro de um tempo litúrgico específico."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Buscar todas as categorias que têm músicas neste tempo litúrgico
    cursor.execute('''
        SELECT DISTINCT 
            CASE 
                WHEN pf.category IS NOT NULL AND pf.category != '' THEN pf.category
                ELSE 'Sem categoria'
            END as category
        FROM pdf_files pf
        WHERE pf.liturgical_time = ? OR pf.id IN (
            SELECT flt.file_id 
            FROM file_liturgical_times flt 
            JOIN liturgical_times lt ON flt.liturgical_time_id = lt.id 
            WHERE lt.name = ?
        )
        ORDER BY category
    ''', (liturgical_time, liturgical_time))
    
    categories = [row[0] for row in cursor.fetchall()]
    
    result = {}
    
    for category in categories:
        if category == 'Sem categoria':
            # Buscar músicas sem categoria neste tempo litúrgico
            cursor.execute('''
                SELECT pf.id, pf.song_name, pf.original_name, pf.artist, pf.youtube_link,
                       COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                WHERE (pf.category IS NULL OR pf.category = '') 
                  AND (pf.liturgical_time = ? OR pf.id IN (
                      SELECT flt.file_id 
                      FROM file_liturgical_times flt 
                      JOIN liturgical_times lt ON flt.liturgical_time_id = lt.id 
                      WHERE lt.name = ?
                  ))
                GROUP BY pf.id, pf.song_name, pf.original_name, pf.artist, pf.youtube_link
                ORDER BY usage_count DESC, pf.song_name
                LIMIT 5
            ''', (liturgical_time, liturgical_time))
        else:
            # Buscar músicas desta categoria neste tempo litúrgico
            cursor.execute('''
                SELECT pf.id, pf.song_name, pf.original_name, pf.artist, pf.youtube_link,
                       COUNT(mli.id) as usage_count
                FROM pdf_files pf
                LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
                WHERE (pf.category = ? OR pf.id IN (
                          SELECT fc.file_id 
                          FROM file_categories fc 
                          JOIN categories c ON fc.category_id = c.id 
                          WHERE c.name = ?
                      ))
                  AND (pf.liturgical_time = ? OR pf.id IN (
                          SELECT flt.file_id 
                          FROM file_liturgical_times flt 
                          JOIN liturgical_times lt ON flt.liturgical_time_id = lt.id 
                          WHERE lt.name = ?
                      ))
                GROUP BY pf.id, pf.song_name, pf.original_name, pf.artist, pf.youtube_link
                ORDER BY usage_count DESC, pf.song_name
                LIMIT 5
            ''', (category, category, liturgical_time, liturgical_time))
        
        musics = []
        for row in cursor.fetchall():
            music_id, song_name, original_name, artist, youtube_link, usage_count = row
            musics.append({
                'id': music_id,
                'name': song_name or original_name,
                'artist': artist or 'Não informado',
                'youtube_link': youtube_link,
                'usage_count': usage_count
            })
        
        if musics:  # Só adicionar categorias que têm músicas
            result[category] = musics
    
    conn.close()
    return jsonify(result)

@app.route('/api/dashboard/category_top_musics/<category>')
def api_dashboard_category_top_musics(category):
    """API para obter top 5 músicas de uma categoria específica."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    if category == 'Sem categoria':
        # Buscar músicas sem categoria
        cursor.execute('''
            SELECT pf.id, pf.song_name, pf.original_name, pf.artist, pf.youtube_link,
                   pf.liturgical_time, COUNT(mli.id) as usage_count
            FROM pdf_files pf
            LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
            WHERE (pf.category IS NULL OR pf.category = '')
            GROUP BY pf.id, pf.song_name, pf.original_name, pf.artist, pf.youtube_link, pf.liturgical_time
            ORDER BY usage_count DESC, pf.song_name
            LIMIT 5
        ''')
    else:
        # Buscar músicas desta categoria
        cursor.execute('''
            SELECT pf.id, pf.song_name, pf.original_name, pf.artist, pf.youtube_link,
                   pf.liturgical_time, COUNT(mli.id) as usage_count
            FROM pdf_files pf
            LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
            WHERE pf.category = ? OR pf.id IN (
                SELECT fc.file_id 
                FROM file_categories fc 
                JOIN categories c ON fc.category_id = c.id 
                WHERE c.name = ?
            )
            GROUP BY pf.id, pf.song_name, pf.original_name, pf.artist, pf.youtube_link, pf.liturgical_time
            ORDER BY usage_count DESC, pf.song_name
            LIMIT 5
        ''', (category, category))
    
    musics = []
    for row in cursor.fetchall():
        music_id, song_name, original_name, artist, youtube_link, liturgical_time, usage_count = row
        musics.append({
            'id': music_id,
            'name': song_name or original_name,
            'artist': artist or 'Não informado',
            'youtube_link': youtube_link,
            'liturgical_time': liturgical_time or 'Não informado',
            'usage_count': usage_count
        })
    
    conn.close()
    return jsonify(musics)

@app.route('/api/dashboard/top_musics')
def api_dashboard_top_musics():
    """API para obter top músicas mais utilizadas em listas."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            pf.id,
            COALESCE(pf.song_name, pf.original_name) as name,
            COALESCE(pf.artist, 'Não informado') as artist,
            COALESCE(pf.category, 'Sem categoria') as category,
            pf.youtube_link,
            COUNT(mli.id) as usage_count
        FROM pdf_files pf
        LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
        GROUP BY pf.id, pf.song_name, pf.original_name, pf.artist, pf.category, pf.youtube_link
        HAVING usage_count > 0
        ORDER BY usage_count DESC, name
        LIMIT 10
    ''')
    
    results = []
    for row in cursor.fetchall():
        file_id, name, artist, category, youtube_link, usage_count = row
        results.append({
            'id': file_id,
            'name': name,
            'artist': artist,
            'category': category,
            'youtube_link': youtube_link,
            'usage_count': usage_count
        })
    
    conn.close()
    return jsonify(results)

@app.route('/api/dashboard/top_artists')
def api_dashboard_top_artists():
    """API para obter top 10 artistas com mais músicas."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            artist,
            COUNT(*) as music_count
        FROM pdf_files 
        WHERE artist IS NOT NULL AND artist != '' AND artist != 'Não informado'
        GROUP BY artist
        ORDER BY music_count DESC, artist ASC
        LIMIT 10
    ''')
    
    results = []
    for row in cursor.fetchall():
        artist, music_count = row
        results.append({
            'artist': artist,
            'music_count': music_count
        })
    
    conn.close()
    return jsonify(results)

# ==========================================
# API-ONLY ENDPOINTS (JSON)
# ==========================================

@app.route('/api/dashboard/stats', methods=['GET'])
def api_dashboard_stats():
    """Obter estatísticas do dashboard."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Total de músicas
        cursor.execute('SELECT COUNT(*) FROM pdf_files')
        total_musics = cursor.fetchone()[0]
        
        # Total de listas
        cursor.execute('SELECT COUNT(*) FROM merge_lists')
        total_lists = cursor.fetchone()[0]
        
        # Total de categorias
        cursor.execute('SELECT COUNT(*) FROM categories')
        total_categories = cursor.fetchone()[0]
        
        # Total de tempos litúrgicos
        cursor.execute('SELECT COUNT(*) FROM liturgical_times')
        total_liturgical_times = cursor.fetchone()[0]
        
        # Total de artistas únicos
        cursor.execute('SELECT COUNT(DISTINCT artist) FROM pdf_files WHERE artist IS NOT NULL AND artist != ""')
        total_artists = cursor.fetchone()[0]
        
        # Tamanho total dos arquivos em MB
        cursor.execute('SELECT SUM(file_size) FROM pdf_files WHERE file_size IS NOT NULL')
        total_size_bytes = cursor.fetchone()[0] or 0
        total_file_size_mb = round(total_size_bytes / (1024 * 1024), 2)
        
        # Total de páginas
        cursor.execute('SELECT SUM(page_count) FROM pdf_files WHERE page_count IS NOT NULL')
        total_pages = cursor.fetchone()[0] or 0
        
        # Músicas com YouTube
        cursor.execute('SELECT COUNT(*) FROM pdf_files WHERE youtube_link IS NOT NULL AND youtube_link != ""')
        musics_with_youtube = cursor.fetchone()[0]
        
        # Média de músicas por lista
        cursor.execute('SELECT AVG(item_count) FROM (SELECT COUNT(*) as item_count FROM merge_list_items GROUP BY merge_list_id)')
        avg_result = cursor.fetchone()[0]
        avg_musics_per_list = round(avg_result if avg_result else 0, 1)
        
        # Lista com mais músicas
        cursor.execute('''
            SELECT ml.name, COUNT(mli.id) as count
            FROM merge_lists ml
            LEFT JOIN merge_list_items mli ON ml.id = mli.merge_list_id
            GROUP BY ml.id, ml.name
            ORDER BY count DESC
            LIMIT 1
        ''')
        largest_list_result = cursor.fetchone()
        largest_list = {'name': largest_list_result[0], 'count': largest_list_result[1]} if largest_list_result else None
        
        # Categoria mais popular
        cursor.execute('''
            SELECT c.name, COUNT(fc.file_id) as count
            FROM categories c
            LEFT JOIN file_categories fc ON c.id = fc.category_id
            GROUP BY c.id, c.name
            ORDER BY count DESC
            LIMIT 1
        ''')
        popular_category_result = cursor.fetchone()
        most_popular_category = {'name': popular_category_result[0], 'count': popular_category_result[1]} if popular_category_result else None
        
        stats = {
            'total_musics': total_musics,
            'total_lists': total_lists,
            'total_categories': total_categories,
            'total_liturgical_times': total_liturgical_times,
            'total_artists': total_artists,
            'total_file_size_mb': total_file_size_mb,
            'total_pages': total_pages,
            'musics_with_youtube': musics_with_youtube,
            'avg_musics_per_list': avg_musics_per_list,
            'largest_list': largest_list,
            'most_popular_category': most_popular_category
        }
        
        conn.close()
        return jsonify(stats)
        
    except Exception as e:
        conn.close()
        app.logger.error(f"❌ [DASHBOARD] Erro ao buscar estatísticas: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@app.route('/api/dashboard/top-songs-by-category', methods=['GET'])
def api_top_songs_by_category():
    """Top 5 músicas por categoria."""
    category = request.args.get('category', '').strip()
    if not category:
        return jsonify({'error': 'Categoria é obrigatória'}), 400
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Buscar músicas da categoria (via tabela relacional)
        cursor.execute('''
            SELECT pf.id, pf.song_name, pf.artist, pf.musical_key,
                   COUNT(mli.id) as usage_count
            FROM pdf_files pf
            LEFT JOIN file_categories fc ON pf.id = fc.file_id
            LEFT JOIN categories c ON fc.category_id = c.id
            LEFT JOIN merge_list_items mli ON pf.id = mli.pdf_file_id
            WHERE c.name = ? OR pf.category = ?
            GROUP BY pf.id, pf.song_name, pf.artist, pf.musical_key
            ORDER BY usage_count DESC, pf.song_name ASC
            LIMIT 5
        ''', (category, category))
        
        songs = []
        for row in cursor.fetchall():
            songs.append({
                'id': row[0],
                'song_name': row[1],
                'artist': row[2] or 'Artista não informado',
                'musical_key': row[3] or '-',
                'usage_count': row[4]
            })
        
        conn.close()
        return jsonify({'songs': songs, 'category': category})
        
    except Exception as e:
        conn.close()
        app.logger.error(f"❌ [DASHBOARD] Erro ao buscar top músicas: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@app.route('/api/dashboard/top-artists', methods=['GET'])
def api_top_artists():
    """Top 5 artistas com mais músicas."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT artist, COUNT(*) as song_count
            FROM pdf_files 
            WHERE artist IS NOT NULL AND artist != ''
            GROUP BY LOWER(TRIM(artist))
            ORDER BY song_count DESC
            LIMIT 5
        ''')
        
        artists = []
        for row in cursor.fetchall():
            artists.append({
                'artist': row[0],
                'song_count': row[1]
            })
        
        conn.close()
        return jsonify({'artists': artists})
        
    except Exception as e:
        conn.close()
        app.logger.error(f"❌ [DASHBOARD] Erro ao buscar top artistas: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@app.route('/api/dashboard/uploads-timeline', methods=['GET'])
def api_uploads_timeline():
    """Timeline de uploads dos últimos 12 meses."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Últimos 12 meses
        cursor.execute('''
            SELECT 
                strftime('%Y-%m', upload_date) as month,
                COUNT(*) as upload_count
            FROM pdf_files 
            WHERE upload_date >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', upload_date)
            ORDER BY month ASC
        ''')
        
        # Preencher meses sem uploads com 0
        from datetime import datetime, timedelta
        import calendar
        
        data_dict = {}
        for row in cursor.fetchall():
            data_dict[row[0]] = row[1]
        
        # Gerar últimos 12 meses
        now = datetime.now()
        timeline = []
        for i in range(12):
            date = now - timedelta(days=30*i)
            month_key = date.strftime('%Y-%m')
            month_name = f"{calendar.month_name[date.month]} {date.year}"
            timeline.append({
                'month': month_key,
                'month_name': month_name,
                'upload_count': data_dict.get(month_key, 0)
            })
        
        timeline.reverse()  # Ordem cronológica
        
        conn.close()
        return jsonify({'timeline': timeline})
        
    except Exception as e:
        conn.close()
        app.logger.error(f"❌ [DASHBOARD] Erro ao buscar timeline: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@app.route('/api/files', methods=['GET'])
def api_list_files():
    """Listar arquivos com filtros e paginação (JSON)."""
    query = request.args.get('q', '').strip()
    category = request.args.get('category', '').strip()
    liturgical_time = request.args.get('liturgical_time', '').strip()
    page = max(1, int(request.args.get('page', 1)))
    per_page = int(request.args.get('per_page', 10))
    if per_page not in [10, 25, 50]:
        per_page = 10

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    base_query = '''
        SELECT DISTINCT pf.id, pf.filename, pf.original_name, pf.song_name, pf.artist, pf.category, pf.liturgical_time,
               pf.musical_key, pf.youtube_link, pf.file_size, pf.upload_date, pf.page_count, pf.description, pf.file_path
        FROM pdf_files pf
    '''
    count_query = 'SELECT COUNT(DISTINCT pf.id) FROM pdf_files pf'
    joins = []
    where_conditions = ['1=1']
    params = []

    if category:
        joins.append('LEFT JOIN file_categories fc ON pf.id = fc.file_id')
        joins.append('LEFT JOIN categories c ON fc.category_id = c.id')
        where_conditions.append('(pf.category = ? OR c.name = ?)')
        params.extend([category, category])

    if liturgical_time:
        joins.append('LEFT JOIN file_liturgical_times flt ON pf.id = flt.file_id')
        joins.append('LEFT JOIN liturgical_times lt ON flt.liturgical_time_id = lt.id')
        where_conditions.append('(pf.liturgical_time = ? OR lt.name = ?)')
        params.extend([liturgical_time, liturgical_time])

    if joins:
        join_clause = ' ' + ' '.join(joins)
        base_query += join_clause
        count_query += join_clause

    where_clause = ' WHERE ' + ' AND '.join(where_conditions)
    base_query += where_clause
    count_query += where_clause

    if query:
        search_condition = ''' AND (
            LOWER(pf.song_name) LIKE LOWER(?) OR 
            LOWER(pf.artist) LIKE LOWER(?) OR 
            LOWER(pf.filename) LIKE LOWER(?) OR 
            LOWER(pf.description) LIKE LOWER(?)
        )'''
        base_query += search_condition
        count_query += search_condition
        search_param = f'%{query}%'
        params.extend([search_param, search_param, search_param, search_param])

    cursor.execute(count_query, params)
    total_count = cursor.fetchone()[0]
    total_pages = (total_count + per_page - 1) // per_page
    offset = (page - 1) * per_page

    base_query += ' ORDER BY upload_date DESC LIMIT ? OFFSET ?'
    params_with_limit = params + [per_page, offset]
    cursor.execute(base_query, params_with_limit)
    rows = cursor.fetchall()

    files = []
    for row in rows:
        file_id = row[0]
        # categorias
        cursor.execute('''
            SELECT c.name FROM categories c
            JOIN file_categories fc ON c.id = fc.category_id
            WHERE fc.file_id = ? ORDER BY c.name
        ''', (file_id,))
        file_categories = [r[0] for r in cursor.fetchall()]
        if not file_categories and row[5]:
            file_categories = [row[5]]
        # tempos litúrgicos
        cursor.execute('''
            SELECT lt.name FROM liturgical_times lt
            JOIN file_liturgical_times flt ON lt.id = flt.liturgical_time_id
            WHERE flt.file_id = ? ORDER BY lt.name
        ''', (file_id,))
        file_times = [r[0] for r in cursor.fetchall()]
        if not file_times and row[6]:
            file_times = [row[6]]

        file_data = {
            'id': row[0],
            'filename': row[1],
            'original_name': row[2],
            'song_name': row[3],
            'artist': row[4],
            'primary_category': row[5],
            'primary_liturgical_time': row[6],
            'categories': file_categories,
            'liturgical_times': file_times,
            'musical_key': row[7],
            'youtube_link': row[8],
            'file_size': row[9],
            'upload_date': row[10],
            'page_count': row[11],
            'description': row[12],
            'file_path': row[13]
        }
        
        # Debug log para verificar dados
        if len(file_categories) > 1 or len(file_times) > 1:
            app.logger.info(f"🔍 [FILES] Arquivo {row[0]} tem múltiplas categorias/tempos: cats={file_categories}, times={file_times}")
        
        files.append(file_data)

    conn.close()
    return jsonify({
        'files': files,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total_count,
            'total_pages': total_pages
        }
    })


@app.route('/api/files', methods=['POST'])
def api_upload_file():
    """Upload de PDF (multipart/form-data) retornando JSON."""
    app.logger.info("📤 [UPLOAD] Recebendo requisição de upload...")
    app.logger.info(f"📋 [UPLOAD] Form keys: {list(request.form.keys())}")
    app.logger.info(f"📁 [UPLOAD] Files keys: {list(request.files.keys())}")
    
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'Nenhum arquivo selecionado'}), 400

    file = request.files['file']
    song_name = request.form.get('song_name', '').strip()
    artist = request.form.get('artist', '').strip()
    new_artist = request.form.get('new_artist', '').strip()
    selected_categories = request.form.getlist('categories') or []
    selected_liturgical_times = request.form.getlist('liturgical_times') or []
    new_categories = request.form.getlist('new_categories') or []
    new_liturgical_times = request.form.getlist('new_liturgical_times') or []
    musical_key = request.form.get('musical_key', '')
    youtube_link = request.form.get('youtube_link', '')
    description = request.form.get('description', '')

    # Adicionar novas categorias à lista de selecionadas
    for new_cat in new_categories:
        if new_cat.strip():
            selected_categories.append(new_cat.strip())

    # Adicionar novos tempos litúrgicos à lista de selecionados
    for new_time in new_liturgical_times:
        if new_time.strip():
            selected_liturgical_times.append(new_time.strip())

    category = selected_categories[0] if selected_categories else 'Diversos'
    liturgical_time = selected_liturgical_times[0] if selected_liturgical_times else ''

    if new_artist and not artist:
        if create_artist(new_artist):
            artist = new_artist
        else:
            artist = new_artist

    if not file.filename or not file.filename.lower().endswith('.pdf'):
        return jsonify({'success': False, 'error': 'Arquivo deve ser PDF'}), 400

    temp_path = None
    try:
        final_filename = generate_filename(song_name, artist, secure_filename(file.filename), musical_key)
        temp_path = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
        file.save(temp_path)

        file_hash = get_file_hash(temp_path)
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT id, filename FROM pdf_files WHERE file_hash = ?', (file_hash,))
        existing = cursor.fetchone()
        if existing:
            os.remove(temp_path)
            conn.close()
            return jsonify({'success': False, 'error': f"Arquivo já existe: {existing[1]}", 'file_id': existing[0]}), 409

        category_folder = os.path.join(ORGANIZED_FOLDER, category)
        os.makedirs(category_folder, exist_ok=True)

        counter = 1
        base_name = os.path.splitext(final_filename)[0]
        final_path = os.path.join(category_folder, final_filename)
        while os.path.exists(final_path):
            final_filename = f"{base_name}_{counter}.pdf"
            final_path = os.path.join(category_folder, final_filename)
            counter += 1

        shutil.move(temp_path, final_path)

        pdf_info = get_pdf_info(final_path)
        file_size = os.path.getsize(final_path)

        relative_path = to_relative_organized_path(final_path)
        cursor.execute('''
            INSERT INTO pdf_files 
            (filename, original_name, song_name, artist, category, liturgical_time, musical_key, youtube_link, file_path, file_size, file_hash, page_count, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (final_filename, file.filename, song_name, artist, category, liturgical_time, musical_key, youtube_link, relative_path, file_size, file_hash, pdf_info['page_count'], description))

        file_id = cursor.lastrowid

        for cat in selected_categories:
            if cat.strip():
                cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (cat.strip(),))
                cursor.execute('SELECT id FROM categories WHERE name = ?', (cat.strip(),))
                category_id = cursor.fetchone()[0]
                cursor.execute('INSERT OR IGNORE INTO file_categories (file_id, category_id) VALUES (?, ?)', (file_id, category_id))

        for time_name in selected_liturgical_times:
            if time_name.strip():
                cursor.execute('INSERT OR IGNORE INTO liturgical_times (name) VALUES (?)', (time_name.strip(),))
                cursor.execute('SELECT id FROM liturgical_times WHERE name = ?', (time_name.strip(),))
                liturgical_id = cursor.fetchone()[0]
                cursor.execute('INSERT OR IGNORE INTO file_liturgical_times (file_id, liturgical_time_id) VALUES (?, ?)', (file_id, liturgical_id))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'file_id': file_id, 'filename': final_filename}), 201

    except Exception as e:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/files/<int:file_id>', methods=['GET'])
def api_get_file(file_id):
    """Obter detalhes de um arquivo (JSON)."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, filename, original_name, song_name, artist, category, liturgical_time,
               musical_key, youtube_link, file_size, upload_date, page_count, description, file_path
        FROM pdf_files WHERE id = ?
    ''', (file_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'success': False, 'error': 'Arquivo não encontrado'}), 404

    cursor.execute('''
        SELECT c.name FROM categories c
        JOIN file_categories fc ON c.id = fc.category_id
        WHERE fc.file_id = ? ORDER BY c.name
    ''', (file_id,))
    categories = [r[0] for r in cursor.fetchall()]
    if not categories and row[5]:
        categories = [row[5]]

    cursor.execute('''
        SELECT lt.name FROM liturgical_times lt
        JOIN file_liturgical_times flt ON lt.id = flt.liturgical_time_id
        WHERE flt.file_id = ? ORDER BY lt.name
    ''', (file_id,))
    times = [r[0] for r in cursor.fetchall()]
    if not times and row[6]:
        times = [row[6]]

    conn.close()
    return jsonify({
        'success': True,
        'file': {
            'id': row[0],
            'filename': row[1],
            'original_name': row[2],
            'song_name': row[3],
            'artist': row[4],
            'primary_category': row[5],
            'primary_liturgical_time': row[6],
            'categories': categories,
            'liturgical_times': times,
            'musical_key': row[7],
            'youtube_link': row[8],
            'file_size': row[9],
            'upload_date': row[10],
            'page_count': row[11],
            'description': row[12],
            'file_path': row[13]
        }
    })


@app.route('/api/files/<int:file_id>', methods=['DELETE'])
def api_delete_file(file_id):
    """Deletar arquivo (JSON)."""
    app.logger.info(f"🗑️ [DELETE] Tentando deletar arquivo ID: {file_id}")
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT file_path, filename FROM pdf_files WHERE id = ?', (file_id,))
    result = cursor.fetchone()
    if not result:
        app.logger.warning(f"❌ [DELETE] Arquivo não encontrado ID: {file_id}")
        conn.close()
        return jsonify({'success': False, 'error': 'Arquivo não encontrado'}), 404

    file_path, filename = result
    app.logger.info(f"📁 [DELETE] Arquivo encontrado: {filename} em {file_path}")
    
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            app.logger.info(f"✅ [DELETE] Arquivo físico removido: {file_path}")
        except Exception as e:
            app.logger.warning(f"⚠️ [DELETE] Erro ao remover arquivo físico: {e}")
    else:
        app.logger.warning(f"⚠️ [DELETE] Arquivo físico não encontrado: {file_path}")
    
    cursor.execute('DELETE FROM pdf_files WHERE id = ?', (file_id,))
    conn.commit()
    conn.close()
    app.logger.info(f"✅ [DELETE] Registro removido do banco: {filename}")
    return jsonify({'success': True, 'deleted_filename': filename})


@app.route('/api/files/<int:file_id>', methods=['PUT'])
def api_update_file(file_id):
    """Atualizar metadados do arquivo (JSON)."""
    app.logger.info(f"📝 [UPDATE] Atualizando arquivo ID: {file_id}")
    data = request.get_json(silent=True) or {}
    app.logger.info(f"📋 [UPDATE] Dados recebidos: {data}")

    song_name = (data.get('song_name') or '').strip()
    artist = (data.get('artist') or '').strip()
    musical_key = (data.get('musical_key') or '').strip()
    youtube_link = (data.get('youtube_link') or '').strip()
    description = (data.get('description') or '').strip()
    selected_categories = data.get('categories') or []
    new_categories = data.get('new_categories') or []
    selected_liturgical_times = data.get('liturgical_times') or []
    new_liturgical_times = data.get('new_liturgical_times') or []
    
    app.logger.info(f"🏷️ [UPDATE] Categorias selecionadas: {selected_categories}")
    app.logger.info(f"🏷️ [UPDATE] Tempos litúrgicos selecionados: {selected_liturgical_times}")

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    for new_cat in new_categories:
        if (new_cat or '').strip():
            cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (new_cat.strip(),))
            selected_categories.append(new_cat.strip())

    for new_time in new_liturgical_times:
        if (new_time or '').strip():
            cursor.execute('INSERT OR IGNORE INTO liturgical_times (name) VALUES (?)', (new_time.strip(),))
            selected_liturgical_times.append(new_time.strip())

    primary_category = selected_categories[0] if selected_categories else 'Diversos'
    primary_liturgical_time = selected_liturgical_times[0] if selected_liturgical_times else ''

    cursor.execute('''
        UPDATE pdf_files 
        SET song_name = ?, artist = ?, category = ?, liturgical_time = ?, 
            musical_key = ?, youtube_link = ?, description = ?
        WHERE id = ?
    ''', (song_name, artist, primary_category, primary_liturgical_time, musical_key, youtube_link, description, file_id))

    cursor.execute('DELETE FROM file_categories WHERE file_id = ?', (file_id,))
    cursor.execute('DELETE FROM file_liturgical_times WHERE file_id = ?', (file_id,))

    for cat in selected_categories:
        if (cat or '').strip():
            cursor.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (cat.strip(),))
            cursor.execute('SELECT id FROM categories WHERE name = ?', (cat.strip(),))
            category_id = cursor.fetchone()[0]
            cursor.execute('INSERT OR IGNORE INTO file_categories (file_id, category_id) VALUES (?, ?)', (file_id, category_id))

    for time_name in selected_liturgical_times:
        if (time_name or '').strip():
            cursor.execute('INSERT OR IGNORE INTO liturgical_times (name) VALUES (?)', (time_name.strip(),))
            cursor.execute('SELECT id FROM liturgical_times WHERE name = ?', (time_name.strip(),))
            liturgical_id = cursor.fetchone()[0]
            cursor.execute('INSERT OR IGNORE INTO file_liturgical_times (file_id, liturgical_time_id) VALUES (?, ?)', (file_id, liturgical_id))

    # Atualizar nome do arquivo se nome da música ou artista mudaram
    cursor.execute('SELECT filename, file_path, category FROM pdf_files WHERE id = ?', (file_id,))
    file_data = cursor.fetchone()
    if file_data and song_name and artist:
        current_filename, current_file_path, current_category = file_data
        current_file_path_abs = to_absolute_organized_path(current_file_path)
        new_filename = generate_filename(song_name, artist, current_filename, musical_key)
        
        if new_filename != current_filename:
            app.logger.info(f"📝 [UPDATE] Renomeando arquivo: {current_filename} → {new_filename}")
            
            # Determinar nova pasta baseada na categoria principal
            new_category_folder = os.path.join(ORGANIZED_FOLDER, primary_category)
            os.makedirs(new_category_folder, exist_ok=True)
            
            new_file_path = os.path.join(new_category_folder, new_filename)
            
            # Verificar se já existe arquivo com o novo nome
            counter = 1
            base_name = os.path.splitext(new_filename)[0]
            while os.path.exists(new_file_path) and new_file_path != current_file_path_abs:
                new_filename = f"{base_name}_{counter}.pdf"
                new_file_path = os.path.join(new_category_folder, new_filename)
                counter += 1
            
            # Mover/renomear arquivo se necessário
            if current_file_path_abs != new_file_path and os.path.exists(current_file_path_abs):
                try:
                    shutil.move(current_file_path_abs, new_file_path)
                    # Atualizar nome e caminho no banco
                    cursor.execute('UPDATE pdf_files SET filename = ?, file_path = ? WHERE id = ?', 
                                 (new_filename, to_relative_organized_path(new_file_path), file_id))
                    app.logger.info(f"✅ [UPDATE] Arquivo renomeado: {new_filename}")
                except Exception as e:
                    app.logger.error(f"❌ [UPDATE] Erro ao renomear arquivo: {e}")

    conn.commit()
    conn.close()
    app.logger.info(f"✅ [UPDATE] Arquivo {file_id} atualizado com sucesso")
    app.logger.info(f"📊 [UPDATE] Total categorias salvas: {len(selected_categories)}")
    app.logger.info(f"📊 [UPDATE] Total tempos litúrgicos salvos: {len(selected_liturgical_times)}")
    return jsonify({'success': True})


@app.route('/api/files/<int:file_id>/replace_pdf', methods=['POST'])
def api_replace_pdf(file_id):
    """Alias JSON para substituir PDF (usa mesmo payload de 'replacement_pdf')."""
    return replace_pdf(file_id)


@app.route('/api/files/<int:file_id>/download', methods=['GET'])
def api_download_file(file_id):
    """Download de arquivo (mesmo comportamento, erros em JSON)."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT file_path, filename FROM pdf_files WHERE id = ?', (file_id,))
    result = cursor.fetchone()
    conn.close()
    if result:
        abs_path = to_absolute_organized_path(result[0])
        if os.path.exists(abs_path):
            return send_file(abs_path, as_attachment=True, download_name=result[1])
    return jsonify({'success': False, 'error': 'Arquivo não encontrado'}), 404


@app.route('/api/files/<int:file_id>/stream', methods=['GET'])
def api_stream_file(file_id):
    """Visualização/stream do PDF (erros em JSON)."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT file_path, filename FROM pdf_files WHERE id = ?', (file_id,))
    result = cursor.fetchone()
    conn.close()
    if result:
        abs_path = to_absolute_organized_path(result[0])
        if os.path.exists(abs_path):
            return send_file(abs_path, as_attachment=False, download_name=result[1])
    return jsonify({'success': False, 'error': 'Arquivo não encontrado'}), 404


# ==========================================
# GOOGLE DRIVE API ENDPOINTS (sincronização básica)
# ==========================================

from threading import Thread, Lock

SYNC_STATE = {
    'in_progress': False,
    'total': 0,
    'done': 0,
    'last_file': '',
    'message': '',
}
SYNC_LOCK = Lock()

def _update_sync_state(**kwargs):
    with SYNC_LOCK:
        SYNC_STATE.update(kwargs)

def _load_google_credentials():
    try:
        import json
        from google.oauth2.credentials import Credentials
        # Procurar token.json salvo pelo callback
        for p in [
            os.path.join(os.path.dirname(__file__), 'token.json'),
            os.path.join(os.getcwd(), 'token.json'),
            '/app/token.json',
        ]:
            if os.path.exists(p):
                with open(p, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                creds = Credentials(
                    token=data.get('token'),
                    refresh_token=data.get('refresh_token'),
                    token_uri=data.get('token_uri'),
                    client_id=data.get('client_id'),
                    client_secret=data.get('client_secret'),
                    scopes=data.get('scopes') or ['https://www.googleapis.com/auth/drive']
                )
                return creds
    except Exception as e:
        app.logger.error(f"[DRIVE] Falha ao carregar credenciais: {e}")
    return None

def _ensure_drive_folder(service, parent_id: str, name: str) -> str:
    # Retorna o ID da subpasta (cria se não existir)
    from googleapiclient.errors import HttpError
    try:
        q = f"name = '{name.replace('\'', "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '{parent_id}' in parents and trashed = false"
        res = service.files().list(q=q, fields='files(id, name)', spaces='drive').execute()
        files = res.get('files', [])
        if files:
            return files[0]['id']
        file_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(body=file_metadata, fields='id').execute()
        return folder['id']
    except HttpError as e:
        app.logger.error(f"[DRIVE] Erro ao garantir pasta '{name}': {e}")
        raise

def _file_exists_in_folder(service, parent_id: str, name: str) -> bool:
    from googleapiclient.errors import HttpError
    try:
        q = f"name = '{name.replace('\'', "\\'")}' and '{parent_id}' in parents and trashed = false"
        res = service.files().list(q=q, fields='files(id)', spaces='drive').execute()
        return len(res.get('files', [])) > 0
    except HttpError as e:
        app.logger.error(f"[DRIVE] Erro ao procurar arquivo '{name}': {e}")
        return False

def _upload_file_to_folder(service, parent_id: str, abs_path: str, name: str):
    from googleapiclient.http import MediaFileUpload
    file_metadata = { 'name': name, 'parents': [parent_id] }
    media = MediaFileUpload(abs_path, mimetype='application/pdf', resumable=False)
    return service.files().create(body=file_metadata, media_body=media, fields='id').execute()

def _sync_worker(root_folder_id: str):
    try:
        from googleapiclient.discovery import build
        creds = _load_google_credentials()
        if not creds:
            _update_sync_state(in_progress=False, message='Credenciais não encontradas')
            return
        service = build('drive', 'v3', credentials=creds, cache_discovery=False)

        # Carregar itens do DB
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT id, filename, category, file_path FROM pdf_files ORDER BY id')
        items = cursor.fetchall()
        conn.close()

        _update_sync_state(in_progress=True, total=len(items), done=0, last_file='', message='Iniciando')

        for _id, filename, category, rel_path in items:
            abs_path = to_absolute_organized_path(rel_path)
            _update_sync_state(last_file=filename)

            # Ignorar se arquivo não existe localmente
            if not abs_path or not os.path.exists(abs_path):
                _update_sync_state(done=SYNC_STATE['done'] + 1)
                continue

            # Pasta por categoria
            category_name = category or 'Diversos'
            try:
                cat_folder_id = _ensure_drive_folder(service, root_folder_id, category_name)
                # Se já existir, pula
                if not _file_exists_in_folder(service, cat_folder_id, filename):
                    _upload_file_to_folder(service, cat_folder_id, abs_path, filename)
            except Exception as e:
                app.logger.error(f"[DRIVE] Erro ao sincronizar '{filename}': {e}")

            _update_sync_state(done=SYNC_STATE['done'] + 1)

        _update_sync_state(in_progress=False, message='Concluído')
    except Exception as e:
        app.logger.error(f"[DRIVE] Falha na sincronização: {e}")
        _update_sync_state(in_progress=False, message=f'Erro: {e}')

@app.route('/api/google-drive/status', methods=['GET'])
def api_google_drive_status():
    """Retorna status simplificado da integração do Google Drive."""
    try:
        token_path_candidates = [
            os.path.join(os.path.dirname(__file__), 'token.json'),
            os.path.join(os.getcwd(), 'token.json'),
            '/app/token.json',
        ]
        token_exists = any(os.path.exists(p) for p in token_path_candidates)
        return jsonify({
            'connected': bool(token_exists),
            'user_email': None,
            'message': 'Conectado' if token_exists else 'Não autorizado ou não configurado'
        })
    except Exception as e:
        return jsonify({'connected': False, 'message': f'Erro: {e}'}), 200


@app.route('/api/google-drive/settings', methods=['GET'])
def api_google_drive_settings_get():
    """Lê configurações do Google Drive a partir de admin_settings (prefixo drive_)."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM admin_settings WHERE key LIKE 'drive_%'")
    rows = cursor.fetchall()
    conn.close()
    settings = {k: v for k, v in rows}
    # Defaults
    settings.setdefault('drive_auto_sync_enabled', 'false')
    settings.setdefault('drive_sync_interval', '30')
    return jsonify({'settings': settings})


@app.route('/api/google-drive/settings', methods=['POST'])
def api_google_drive_settings_post():
    """Atualiza configurações do Google Drive em admin_settings."""
    data = request.get_json(silent=True) or {}
    allowed_keys = {'drive_sync_folder_id', 'drive_auto_sync_enabled', 'drive_sync_interval'}
    updates = {k: str(v) for k, v in data.items() if k in allowed_keys}

    if not updates:
        return jsonify({'success': False, 'error': 'Nenhuma configuração válida fornecida'}), 400

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    for k, v in updates.items():
        cursor.execute('INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', (k, v))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Configurações salvas'})


@app.route('/api/google-drive/auth-url', methods=['GET'])
def api_google_drive_auth_url():
    """Gera a URL de autorização OAuth do Google Drive (produção)."""
    try:
        from google_auth_oauthlib.flow import Flow
        import json
        # Localizar credentials.json
        candidates = [
            os.path.join(os.path.dirname(__file__), 'credentials.json'),
            os.path.join(os.getcwd(), 'credentials.json'),
            '/app/credentials.json',
        ]
        cred_path = next((p for p in candidates if os.path.exists(p)), None)
        if not cred_path:
            return jsonify({'success': False, 'error': 'credentials.json não encontrado no servidor'}), 200

        redirect_uri = request.host_url.rstrip('/') + '/api/google-drive/callback'
        scopes = ['https://www.googleapis.com/auth/drive']

        flow = Flow.from_client_secrets_file(
            cred_path,
            scopes=scopes,
            redirect_uri=redirect_uri,
        )
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
        )
        session['google_oauth_state'] = state
        return jsonify({'success': True, 'authorization_url': authorization_url})
    except Exception as e:
        return jsonify({'success': False, 'error': f'Erro ao gerar URL de autorização: {e}'}), 200


@app.route('/api/google-drive/callback', methods=['GET'])
def api_google_drive_callback():
    """Callback OAuth para receber o código e salvar token.json."""
    try:
        from google_auth_oauthlib.flow import Flow
        import json
        candidates = [
            os.path.join(os.path.dirname(__file__), 'credentials.json'),
            os.path.join(os.getcwd(), 'credentials.json'),
            '/app/credentials.json',
        ]
        cred_path = next((p for p in candidates if os.path.exists(p)), None)
        if not cred_path:
            return jsonify({'success': False, 'error': 'credentials.json não encontrado'}), 400

        state = session.get('google_oauth_state')
        redirect_uri = request.host_url.rstrip('/') + '/api/google-drive/callback'
        scopes = ['https://www.googleapis.com/auth/drive']
        flow = Flow.from_client_secrets_file(
            cred_path,
            scopes=scopes,
            redirect_uri=redirect_uri,
            state=state,
        )
        flow.fetch_token(authorization_response=request.url)

        creds = flow.credentials
        token_data = {
            'token': creds.token,
            'refresh_token': creds.refresh_token,
            'token_uri': creds.token_uri,
            'client_id': creds.client_id,
            'client_secret': creds.client_secret,
            'scopes': creds.scopes,
        }

        # Salvar token.json próximo ao app
        token_save_candidates = [
            os.path.join(os.path.dirname(__file__), 'token.json'),
            os.path.join(os.getcwd(), 'token.json'),
            '/app/token.json',
        ]
        saved = False
        error_save = ''
        for p in token_save_candidates:
            try:
                with open(p, 'w', encoding='utf-8') as f:
                    json.dump(token_data, f, ensure_ascii=False, indent=2)
                saved = True
                break
            except Exception as e:
                error_save = str(e)
                continue

        html = """
<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <title>Google Drive Auth</title>
  </head>
  <body>
    <p>Autorização concluída. Esta janela fechará automaticamente.</p>
    <script>
      try { if (window.opener) { window.opener.postMessage({ type: 'DRIVE_AUTH_SUCCESS' }, '*'); } } catch (e) {}
      setTimeout(function(){ try { window.close(); } catch(e){} }, 500);
    </script>
  </body>
  </html>
        """
        response = app.make_response(html)
        response.headers['Content-Type'] = 'text/html; charset=utf-8'
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
        response.headers['Vary'] = 'Origin'
        return response
    except Exception as e:
        return jsonify({'success': False, 'error': f'Erro no callback: {e}'}), 400


@app.route('/api/google-drive/mock-auth', methods=['GET'])
def api_google_drive_mock_auth():
    """Página simples que simula autorização bem-sucedida do Google e notifica o opener."""
    html = """
<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <title>Google Drive Mock Auth</title>
  </head>
  <body>
    <p>Autorização simulada com sucesso. Esta janela fechará automaticamente.</p>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'DRIVE_AUTH_SUCCESS' }, '*');
        }
      } catch (e) { /* ignore */ }
      setTimeout(function(){ try { window.close(); } catch(e){} }, 500);
    </script>
  </body>
  </html>
    """
    response = app.make_response(html)
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
    response.headers['Vary'] = 'Origin'
    return response


@app.route('/api/google-drive/sync', methods=['POST'])
def api_google_drive_sync():
    """Inicia sincronização em background com Google Drive.
    Requer token.json e drive_sync_folder_id configurados.
    """
    # Verificar configuração
    token_exists = any(os.path.exists(p) for p in [
        os.path.join(os.path.dirname(__file__), 'token.json'),
        os.path.join(os.getcwd(), 'token.json'),
        '/app/token.json',
    ])
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM admin_settings WHERE key = 'drive_sync_folder_id'")
    row = cursor.fetchone()
    conn.close()
    folder_id = row[0] if row else ''

    if not token_exists:
        return jsonify({'success': False, 'error': 'Credenciais ausentes (token.json)'}), 400
    if not folder_id:
        return jsonify({'success': False, 'error': 'ID da pasta do Google Drive não configurado'}), 400

    with SYNC_LOCK:
        if SYNC_STATE.get('in_progress'):
            return jsonify({'success': True, 'message': 'Sincronização já em andamento'}), 200
        # reset state e iniciar thread
        SYNC_STATE.update({'in_progress': True, 'total': 0, 'done': 0, 'last_file': '', 'message': 'Preparando'})

    Thread(target=_sync_worker, args=(folder_id,), daemon=True).start()
    return jsonify({'success': True, 'message': 'Sincronização iniciada'}), 200


@app.route('/api/google-drive/debug', methods=['GET'])
def api_google_drive_debug():
    """Retorna informações de debug/progresso da sincronização."""
    with SYNC_LOCK:
        state = dict(SYNC_STATE)
    return jsonify({'sync_progress': state})


@app.route('/api/google-drive/clear-cache', methods=['POST'])
def api_google_drive_clear_cache():
    """Remove token.json para forçar nova autorização."""
    removed = False
    errors = []
    for p in [
        os.path.join(os.path.dirname(__file__), 'token.json'),
        os.path.join(os.getcwd(), 'token.json'),
        '/app/token.json',
    ]:
        try:
            if os.path.exists(p):
                os.remove(p)
                removed = True
        except Exception as e:
            errors.append(str(e))
    return jsonify({'success': True, 'removed': removed, 'errors': errors})


@app.route('/api/categories', methods=['GET'])
def api_list_categories():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM categories ORDER BY name')
    items = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify({'categories': items})


@app.route('/api/categories', methods=['POST'])
def api_create_category():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'success': False, 'error': 'Nome é obrigatório'}), 400
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO categories (name) VALUES (?)', (name,))
        conn.commit()
        return jsonify({'success': True}), 201
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Categoria já existe'}), 409
    finally:
        conn.close()


@app.route('/api/liturgical_times', methods=['GET'])
def api_list_liturgical_times():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM liturgical_times ORDER BY name')
    items = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify({'liturgical_times': items})


@app.route('/api/artists', methods=['POST'])
def api_create_artist_json():
    data = request.get_json(silent=True) or {}
    artist_name = (data.get('artist_name') or '').strip()
    artist_description = (data.get('artist_description') or '').strip()
    if not artist_name:
        return jsonify({'success': False, 'message': 'Nome do artista é obrigatório'}), 400
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM artists WHERE LOWER(name) = LOWER(?)', (artist_name,))
    exists = cursor.fetchone()[0] > 0
    if exists:
        conn.close()
        return jsonify({'success': False, 'message': 'Artista já existe no sistema'}), 400
    cursor.execute('INSERT INTO artists (name, description) VALUES (?, ?)', (artist_name, artist_description))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 201


@app.route('/api/merge_lists', methods=['POST'])
def api_create_merge_list():
    data = request.get_json(silent=True) or {}
    list_name = (data.get('name') or '').strip()
    file_ids = data.get('file_ids') or []
    if not list_name:
        return jsonify({'success': False, 'error': 'Nome da lista é obrigatório'}), 400
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO merge_lists (name) VALUES (?)', (list_name,))
    list_id = cursor.lastrowid
    max_pos = 0
    for fid in file_ids:
        max_pos += 1
        cursor.execute('INSERT INTO merge_list_items (merge_list_id, pdf_file_id, order_position) VALUES (?, ?, ?)', (list_id, fid, max_pos))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': list_id}), 201


@app.route('/api/merge_lists/<int:list_id>', methods=['GET'])
def api_get_merge_list(list_id):
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, observations, created_date, updated_date FROM merge_lists WHERE id = ?', (list_id,))
    info = cursor.fetchone()
    if not info:
        conn.close()
        return jsonify({'success': False, 'error': 'Lista não encontrada'}), 404
    cursor.execute('''
        SELECT mli.id, mli.order_position, pf.id as file_id, pf.filename, pf.song_name, pf.artist, pf.musical_key
        FROM merge_list_items mli
        JOIN pdf_files pf ON mli.pdf_file_id = pf.id
        WHERE mli.merge_list_id = ?
        ORDER BY mli.order_position
    ''', (list_id,))
    items = []
    for row in cursor.fetchall():
        items.append({
            'item_id': row[0],
            'order_position': row[1],
            'file': {
                'id': row[2],
                'filename': row[3],
                'song_name': row[4],
                'artist': row[5],
                'musical_key': row[6]
            }
        })
    conn.close()
    return jsonify({'success': True, 'list': {
        'id': info[0], 'name': info[1], 'observations': info[2], 'created_date': info[3], 'updated_date': info[4], 'items': items
    }})


@app.route('/api/merge_lists/<int:list_id>', methods=['PUT'])
def api_update_merge_list(list_id):
    data = request.get_json(silent=True) or {}
    new_name = (data.get('name') or '').strip()
    observations = data.get('observations') or ''
    if not new_name:
        return jsonify({'success': False, 'error': 'Nome é obrigatório'}), 400
    ok = update_merge_list_info(list_id, new_name, observations)
    if not ok:
        return jsonify({'success': False, 'error': 'Erro ao atualizar informações'}), 400
    return jsonify({'success': True})


@app.route('/api/merge_lists/<int:list_id>', methods=['DELETE'])
def api_delete_merge_list(list_id):
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT 1 FROM merge_lists WHERE id = ?', (list_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'error': 'Lista não encontrada'}), 404
    cursor.execute('DELETE FROM merge_list_items WHERE merge_list_id = ?', (list_id,))
    cursor.execute('DELETE FROM merge_lists WHERE id = ?', (list_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/merge_lists/<int:list_id>/duplicate', methods=['POST'])
def api_duplicate_merge_list(list_id):
    """Duplicar uma lista com novo nome."""
    app.logger.info(f"📋 [DUPLICATE] Duplicando lista ID: {list_id}")
    
    data = request.get_json(silent=True) or {}
    new_name = (data.get('name') or '').strip()
    
    if not new_name:
        return jsonify({'success': False, 'error': 'Nome da nova lista é obrigatório'}), 400
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Verificar se a lista original existe
        cursor.execute('SELECT name, observations FROM merge_lists WHERE id = ?', (list_id,))
        original_list = cursor.fetchone()
        if not original_list:
            return jsonify({'success': False, 'error': 'Lista original não encontrada'}), 404
        
        original_observations = original_list[1] or ''
        
        # Criar nova lista
        cursor.execute('''
            INSERT INTO merge_lists (name, observations, created_date, updated_date)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''', (new_name, original_observations))
        
        new_list_id = cursor.lastrowid
        app.logger.info(f"✅ [DUPLICATE] Nova lista criada com ID: {new_list_id}")
        
        # Copiar todos os itens da lista original
        cursor.execute('''
            INSERT INTO merge_list_items (merge_list_id, pdf_file_id, order_position)
            SELECT ?, pdf_file_id, order_position
            FROM merge_list_items
            WHERE merge_list_id = ?
            ORDER BY order_position
        ''', (new_list_id, list_id))
        
        items_copied = cursor.rowcount
        app.logger.info(f"📁 [DUPLICATE] {items_copied} itens copiados")
        
        conn.commit()
        
        return jsonify({
            'success': True, 
            'new_list_id': new_list_id,
            'items_copied': items_copied,
            'message': f'Lista "{new_name}" criada com {items_copied} música(s)'
        })
        
    except Exception as e:
        app.logger.error(f"❌ [DUPLICATE] Erro: {e}")
        conn.rollback()
        return jsonify({'success': False, 'error': 'Erro interno do servidor'}), 500
    finally:
        conn.close()


@app.route('/api/merge_lists/<int:list_id>/items', methods=['POST'])
def api_add_items_to_merge_list(list_id):
    data = request.get_json(silent=True) or {}
    file_ids = data.get('file_ids') or []
    file_id = data.get('file_id')
    if file_id is not None:
        file_ids.append(file_id)
    if not file_ids:
        return jsonify({'success': False, 'error': 'Nenhuma música informada'}), 400
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT MAX(order_position) FROM merge_list_items WHERE merge_list_id = ?', (list_id,))
    max_pos = cursor.fetchone()[0] or 0
    added = 0
    for fid in file_ids:
        cursor.execute('SELECT id FROM merge_list_items WHERE merge_list_id = ? AND pdf_file_id = ?', (list_id, fid))
        if not cursor.fetchone():
            max_pos += 1
            cursor.execute('INSERT INTO merge_list_items (merge_list_id, pdf_file_id, order_position) VALUES (?, ?, ?)', (list_id, fid, max_pos))
            added += 1
    cursor.execute('UPDATE merge_lists SET updated_date = CURRENT_TIMESTAMP WHERE id = ?', (list_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'added': added})


@app.route('/api/merge_list_items/<int:item_id>', methods=['DELETE'])
def api_remove_item_from_merge_list(item_id):
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT merge_list_id FROM merge_list_items WHERE id = ?', (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'success': False, 'error': 'Item não encontrado'}), 404
    list_id = row[0]
    cursor.execute('DELETE FROM merge_list_items WHERE id = ?', (item_id,))
    cursor.execute('UPDATE merge_lists SET updated_date = CURRENT_TIMESTAMP WHERE id = ?', (list_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/merge_lists/<int:list_id>/reorder', methods=['POST'])
def api_reorder_merge_list(list_id):
    data = request.get_json(silent=True) or {}
    item_order = data.get('item_order') or []
    if not item_order:
        return jsonify({'success': False, 'error': 'Ordem não informada'}), 400
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    for i, item_id in enumerate(item_order):
        cursor.execute('UPDATE merge_list_items SET order_position = ? WHERE id = ? AND merge_list_id = ?', (i + 1, item_id, list_id))
    cursor.execute('UPDATE merge_lists SET updated_date = CURRENT_TIMESTAMP WHERE id = ?', (list_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/merge_lists/<int:list_id>/export', methods=['GET'])
def api_export_merge_list(list_id):
    """Gera um PDF temporário mesclado e retorna o arquivo para download."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT pf.file_path, pf.filename
        FROM merge_list_items mli
        JOIN pdf_files pf ON mli.pdf_file_id = pf.id
        WHERE mli.merge_list_id = ?
        ORDER BY mli.order_position
    ''', (list_id,))
    files_to_merge = cursor.fetchall()
    conn.close()
    if len(files_to_merge) < 2:
        return jsonify({'success': False, 'error': 'É necessário pelo menos 2 arquivos para mesclar'}), 400
    writer = PdfWriter()
    for file_path, _ in files_to_merge:
        if os.path.exists(file_path):
            reader = PdfReader(file_path)
            for page in reader.pages:
                writer.add_page(page)
    import tempfile
    temp_dir = tempfile.gettempdir()
    output_name = f'merge_list_{list_id}.pdf'
    temp_output = os.path.join(temp_dir, output_name)
    with open(temp_output, 'wb') as output_file:
        writer.write(output_file)
    response = send_file(temp_output, as_attachment=True, download_name=output_name)
    def remove_file():
        try:
            os.remove(temp_output)
        except Exception:
            pass
    response.call_on_close(remove_file)
    return response


@app.route('/api/merge_lists/<int:list_id>/create_pdf', methods=['POST'])
def api_create_pdf_from_merge_list(list_id):
    """Cria um PDF mesclado persistido em 'Merged' e registra no banco."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM merge_lists WHERE id = ?', (list_id,))
    info = cursor.fetchone()
    if not info:
        conn.close()
        return jsonify({'success': False, 'error': 'Lista não encontrada'}), 404
    list_name = info[0]
    cursor.execute('''
        SELECT pf.file_path
        FROM merge_list_items mli
        JOIN pdf_files pf ON mli.pdf_file_id = pf.id
        WHERE mli.merge_list_id = ?
        ORDER BY mli.order_position
    ''', (list_id,))
    files_to_merge = cursor.fetchall()
    conn.close()
    if len(files_to_merge) < 2:
        return jsonify({'success': False, 'error': 'É necessário pelo menos 2 arquivos para mesclar'}), 400
    writer = PdfWriter()
    for (file_path,) in files_to_merge:
        if os.path.exists(file_path):
            reader = PdfReader(file_path)
            for page in reader.pages:
                writer.add_page(page)
    merged_folder = os.path.join(ORGANIZED_FOLDER, 'Merged')
    os.makedirs(merged_folder, exist_ok=True)
    base_name = secure_filename(list_name) or 'Lista Mesclada'
    if not base_name.lower().endswith('.pdf'):
        base_name += '.pdf'
    output_name = base_name
    output_path = os.path.join(merged_folder, output_name)
    counter = 1
    while os.path.exists(output_path):
        name_no_ext = os.path.splitext(base_name)[0]
        output_name = f"{name_no_ext}_{counter}.pdf"
        output_path = os.path.join(merged_folder, output_name)
        counter += 1
    with open(output_path, 'wb') as output_file:
        writer.write(output_file)
    file_hash = get_file_hash(output_path)
    file_size = os.path.getsize(output_path)
    pdf_info = get_pdf_info(output_path)
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO pdf_files (filename, original_name, category, file_path, file_size, file_hash, page_count, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (output_name, output_name, 'Merged', output_path, file_size, file_hash, pdf_info['page_count'], 'Merged PDF document'))
    new_file_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'file_id': new_file_id, 'filename': output_name})

# ==========================================
# HEALTH CHECK ENDPOINT (Para Docker)
# ==========================================

@app.route('/health')
def health_check():
    """Endpoint de health check para Docker e monitoramento."""
    try:
        # Verificar conectividade do banco de dados
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        conn.close()
        
        # Verificar se os diretórios essenciais existem
        dirs_ok = all(os.path.exists(d) for d in [UPLOAD_FOLDER, ORGANIZED_FOLDER, LOG_FOLDER])
        
        if dirs_ok:
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'database': 'connected',
                'directories': 'ok',
                'version': '1.0.0'
            }), 200
        else:
            return jsonify({
                'status': 'unhealthy',
                'timestamp': datetime.now().isoformat(),
                'error': 'Missing required directories'
            }), 503
            
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'timestamp': datetime.now().isoformat(),
            'error': str(e)
        }), 503

if __name__ == '__main__':
    # Em modo desenvolvimento, evite duplicação de logs por causa do reloader do Flask
    # O setup_logging já é chamado no import; aqui só reforçamos caso necessário
    setup_logging()
    init_db()
    
    # Informações de configuração para Docker/Produção
    app.logger.info("="*50)
    app.logger.info("🎵 MÚSICAS IGREJA - Iniciando aplicação...")
    app.logger.info("="*50)
    app.logger.info(f"Ambiente: {os.environ.get('FLASK_ENV', 'development')}")
    app.logger.info(f"Banco de dados: {DATABASE}")
    app.logger.info(f"Upload folder: {UPLOAD_FOLDER}")
    app.logger.info(f"Organized folder: {ORGANIZED_FOLDER}")
    app.logger.info(f"Log folder: {LOG_FOLDER}")
    
    # Configuração flexível para Docker e desenvolvimento
    host = '0.0.0.0'  # Permite acesso externo
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    
    print("="*60)
    print("🎵 SISTEMA MÚSICAS IGREJA - SERVIDOR INICIADO 🎵")
    print("="*60)
    print()
    print("📍 Acesse o sistema através dos seguintes endereços:")
    print("   • http://localhost:5000")
    print("   • http://127.0.0.1:5000") 
    print("   • http://musicas-igreja.local:5000")
    print("   • http://192.168.15.11:5000 (rede local)")
    print()
    print("🔧 Para configurar o domínio customizado:")
    print("   1. Execute como Administrador: start_musicas_igreja.bat")
    print("   2. Ou siga as instruções no README")
    print()
    print("⏹️  Para parar o servidor: Ctrl+C")
    print("="*60)
    print()
    
    # Evita duplicação: desative o reloader se já estiver em IDE/ambiente que reexecuta
    use_reloader = False if os.environ.get('DISABLE_FLASK_RELOADER', '1') == '1' else True
    app.run(debug=debug, host=host, port=port, use_reloader=use_reloader)