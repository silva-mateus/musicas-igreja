# Rotas complementares para o Sistema de Músicas da Igreja
# Este arquivo contém todas as rotas adicionais necessárias

import os
import sqlite3
import json
from datetime import datetime, timedelta
from flask import request, jsonify, send_file, session, send_from_directory
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from pypdf import PdfReader
import tempfile
import shutil
from pathlib import Path

# ===============================
# ROTAS DE MÚSICAS
# ===============================

def add_music_routes(app, DATABASE, UPLOAD_FOLDER, ORGANIZED_FOLDER):
    
    @app.route('/api/music', methods=['GET'])
    def get_musics():
        """Listar músicas com filtros e paginação"""
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        search = request.args.get('search', '')
        category = request.args.get('category')
        liturgical_time = request.args.get('liturgical_time')
        musical_key = request.args.get('musical_key')
        
        offset = (page - 1) * limit
        
        # DEBUG: Mostrar qual banco está sendo usado
        print(f"\n=== DEBUG DATABASE CONNECTION get_musics ===")
        print(f"DATABASE path: {DATABASE}")
        print("=" * 40)
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Query base - simplificada sem JOIN com users por enquanto
        query = '''
            SELECT p.id, p.original_name, p.filename, p.song_name as title, p.artist,
                   p.category, p.liturgical_time, p.musical_key, p.file_size, p.page_count,
                   p.upload_date, p.uploaded_by, p.youtube_link, p.observations
            FROM pdf_files p
            WHERE 1=1
        '''
        params = []
        
        # Filtros
        if search:
            query += ' AND (p.song_name LIKE ? OR p.artist LIKE ? OR p.original_name LIKE ?)'
            search_param = f'%{search}%'
            params.extend([search_param, search_param, search_param])
        
        # Novos filtros da API frontend
        title = request.args.get('title')
        artist = request.args.get('artist')
        has_youtube = request.args.get('has_youtube')
        sort_by = request.args.get('sort_by', 'upload_date')
        sort_order = request.args.get('sort_order', 'desc')
        
        if title:
            query += ' AND p.song_name LIKE ?'
            params.append(f'%{title}%')
        
        if artist:
            query += ' AND p.artist LIKE ?'
            params.append(f'%{artist}%')
        
        if category:
            query += ' AND p.category LIKE ?'
            params.append(f'%{category}%')
        
        if liturgical_time:
            query += ' AND p.liturgical_time LIKE ?'
            params.append(f'%{liturgical_time}%')
        
        if musical_key:
            query += ' AND p.musical_key = ?'
            params.append(musical_key)
        
        if has_youtube:
            if has_youtube.lower() == 'true':
                query += ' AND p.youtube_link IS NOT NULL AND p.youtube_link != ""'
            elif has_youtube.lower() == 'false':
                query += ' AND (p.youtube_link IS NULL OR p.youtube_link = "")'
        
        # Contar total - query separada sem JOIN
        count_query = '''
            SELECT COUNT(*)
            FROM pdf_files p
            WHERE 1=1
        '''
        count_params = []
        
        # Replicar os mesmos filtros da query principal
        if search:
            count_query += ' AND (p.song_name LIKE ? OR p.artist LIKE ? OR p.original_name LIKE ?)'
            search_param = f'%{search}%'
            count_params.extend([search_param, search_param, search_param])
        
        if title:
            count_query += ' AND p.song_name LIKE ?'
            count_params.append(f'%{title}%')
        
        if artist:
            count_query += ' AND p.artist LIKE ?'
            count_params.append(f'%{artist}%')
        
        if category:
            count_query += ' AND p.category LIKE ?'
            count_params.append(f'%{category}%')
        
        if liturgical_time:
            count_query += ' AND p.liturgical_time LIKE ?'
            count_params.append(f'%{liturgical_time}%')
        
        if musical_key:
            count_query += ' AND p.musical_key LIKE ?'
            count_params.append(f'%{musical_key}%')
        
        if has_youtube:
            if has_youtube.lower() == 'true':
                count_query += ' AND p.youtube_link IS NOT NULL AND p.youtube_link != ""'
            elif has_youtube.lower() == 'false':
                count_query += ' AND (p.youtube_link IS NULL OR p.youtube_link = "")'
        
        cursor.execute(count_query, count_params)
        total = cursor.fetchone()[0]
        
        # Paginação e ordenação
        valid_sort_columns = ['upload_date', 'song_name', 'artist', 'category', 'file_size']
        if sort_by not in valid_sort_columns:
            sort_by = 'upload_date'
        
        if sort_order.lower() not in ['asc', 'desc']:
            sort_order = 'desc'
        
        query += f' ORDER BY p.{sort_by} {sort_order.upper()} LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        # DEBUG: Mostrar query executada
        print(f"\n=== DEBUG QUERY get_musics ===")
        print(f"Query: {query}")
        print(f"Params: {params}")
        print("=" * 40)
        
        cursor.execute(query, params)
        musics = []
        for row in cursor.fetchall():
            music = {
                'id': row[0],
                'original_name': row[1],
                'filename': row[2],
                'title': row[3],  # song_name as title
                'artist': row[4],
                'category': row[5],
                'liturgical_time': row[6],
                'musical_key': row[7],
                'file_size': row[8],
                'pages': row[9],  # page_count field
                'upload_date': row[10],
                'uploaded_by': row[11],
                'youtube_link': row[12],
                'observations': row[13],  # observations field
                'uploaded_by_name': None  # Será implementado depois
            }
            musics.append(music)
        
        conn.close()
        
        return jsonify({
            'data': musics,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'totalPages': (total + limit - 1) // limit
            }
        })

    @app.route('/api/music/<int:music_id>', methods=['GET'])
    def get_music(music_id):
        """Obter detalhes de uma música específica"""
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT p.*
            FROM pdf_files p
            WHERE p.id = ?
        ''', (music_id,))
        
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': 'Music not found'}), 404
        
        music = {
            'id': row[0],
            'original_name': row[1],
            'filename': row[2],
            'song_name': row[3],
            'artist': row[4],
            'category': row[5],
            'liturgical_time': row[6],
            'musical_key': row[7],
            'youtube_link': row[8],
            'file_size': row[9],
            'upload_date': row[10],
            'pages': row[11],
            'description': row[12],
            'file_hash': row[13],
            'uploaded_by': row[14],
            'uploaded_by_name': row[15] if len(row) > 15 else None
        }
        
        conn.close()
        return jsonify(music)

    @app.route('/api/music/<int:music_id>', methods=['PUT'])
    def update_music(music_id):
        """Atualizar metadados de uma música"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se música existe
        cursor.execute('SELECT id FROM pdf_files WHERE id = ?', (music_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Music not found'}), 404
        
        # Atualizar campos permitidos
        update_fields = []
        params = []
        
        allowed_fields = ['song_name', 'artist', 'category', 'liturgical_time', 
                         'musical_key', 'youtube_link', 'description']
        
        for field in allowed_fields:
            if field in data:
                update_fields.append(f'{field} = ?')
                params.append(data[field])
        
        if update_fields:
            params.append(music_id)
            query = f'UPDATE pdf_files SET {", ".join(update_fields)} WHERE id = ?'
            cursor.execute(query, params)
            conn.commit()
        
        conn.close()
        app.logger.info(f"Music {music_id} updated by user {session['user_id']}")
        return jsonify({'message': 'Music updated successfully'})

    @app.route('/api/music/<int:music_id>', methods=['DELETE'])
    def delete_music(music_id):
        """Deletar uma música"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Obter informações do arquivo
        cursor.execute('SELECT filename FROM pdf_files WHERE id = ?', (music_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': 'Music not found'}), 404
        
        filename = row[0]
        
        # Deletar do banco
        cursor.execute('DELETE FROM pdf_files WHERE id = ?', (music_id,))
        
        # Deletar arquivos físicos
        try:
            upload_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(upload_path):
                os.remove(upload_path)
            
            organized_path = os.path.join(ORGANIZED_FOLDER, filename)
            if os.path.exists(organized_path):
                os.remove(organized_path)
        except Exception as e:
            app.logger.error(f"Error deleting files for music {music_id}: {e}")
        
        conn.commit()
        conn.close()
        
        app.logger.info(f"Music {music_id} deleted by user {session['user_id']}")
        return jsonify({'message': 'Music deleted successfully'})

    @app.route('/api/music/<int:music_id>/download', methods=['GET'])
    def download_music(music_id):
        """Download do arquivo PDF"""
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT filename, original_name FROM pdf_files WHERE id = ?', (music_id,))
        
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': 'Music not found'}), 404
        
        filename, original_name = row
        conn.close()
        
        # Tentar localizar arquivo
        file_path = None
        for folder in [ORGANIZED_FOLDER, UPLOAD_FOLDER]:
            potential_path = os.path.join(folder, filename)
            if os.path.exists(potential_path):
                file_path = potential_path
                break
        
        if not file_path:
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=original_name,
            mimetype='application/pdf'
        )

    # ===============================
    # ROTAS DE UPLOAD
    # ===============================

    @app.route('/api/upload', methods=['POST'])
    def upload_files():
        """Upload de múltiplos arquivos PDF"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('files')
        if not files or all(f.filename == '' for f in files):
            return jsonify({'error': 'No files selected'}), 400
        
        results = []
        
        for i, file in enumerate(files):
            if file and file.filename.lower().endswith('.pdf'):
                try:
                    # Extrair metadados do formulário se disponíveis
                    metadata = {}
                    for field in ['title', 'artist', 'category', 'liturgical_time', 'musical_key', 'youtube_link', 'observations']:
                        key = f'metadata[{i}][{field}]'
                        if key in request.form:
                            metadata[field] = request.form[key]
                    
                    result = process_uploaded_file(file, session['user_id'], metadata)
                    results.append(result)
                except Exception as e:
                    app.logger.error(f"Error processing file {file.filename}: {e}")
                    results.append({
                        'filename': file.filename,
                        'success': False,
                        'error': str(e)
                    })
            else:
                results.append({
                    'filename': file.filename,
                    'success': False,
                    'error': 'Invalid file type. Only PDF files are allowed.'
                })
        
        return jsonify({'results': results})

    def process_uploaded_file(file, user_id, metadata=None):
        """Processar um arquivo individual"""
        if metadata is None:
            metadata = {}
        filename = secure_filename(file.filename)
        
        # Gerar nome único se já existir
        base_name, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(os.path.join(UPLOAD_FOLDER, filename)):
            filename = f"{base_name}_{counter}{ext}"
            counter += 1
        
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        # Extrair metadados
        try:
            file_size = os.path.getsize(file_path)
            file_hash = get_file_hash(file_path)
            pages = extract_pdf_metadata(file_path)
            
            # Salvar no banco
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            
            # Usar metadados fornecidos ou valores padrão
            title = metadata.get('title', os.path.splitext(file.filename)[0])
            artist = metadata.get('artist', '')
            category = metadata.get('category', '')
            liturgical_time = metadata.get('liturgical_time', '')
            musical_key = metadata.get('musical_key', '')
            youtube_link = metadata.get('youtube_link', '')
            observations = metadata.get('observations', '')
            
            cursor.execute('''
                INSERT INTO pdf_files 
                (original_name, filename, song_name, artist, category, liturgical_time, 
                 musical_key, youtube_link, observations, file_size, file_hash, pages, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (file.filename, filename, title, artist, category, liturgical_time, 
                  musical_key, youtube_link, observations, file_size, file_hash, pages, user_id))
            
            file_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            app.logger.info(f"File uploaded successfully: {filename} by user {user_id}")
            
            return {
                'id': file_id,
                'filename': filename,
                'original_name': file.filename,
                'success': True,
                'file_size': file_size,
                'pages': pages
            }
            
        except Exception as e:
            # Remover arquivo se houver erro
            if os.path.exists(file_path):
                os.remove(file_path)
            raise e

    def get_file_hash(file_path):
        """Calcular hash SHA-256 do arquivo"""
        import hashlib
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