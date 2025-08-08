# Rotas para gerenciamento de listas de músicas

import os
import sqlite3
import json
from datetime import datetime
from flask import request, jsonify, session, send_file
import tempfile
from pypdf import PdfWriter, PdfReader

def add_list_routes(app, DATABASE):
    
    @app.route('/api/lists', methods=['GET'])
    def get_lists():
        """Listar todas as listas do usuário"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        search = request.args.get('search', '')
        
        offset = (page - 1) * limit
        
        # DEBUG: Mostrar qual banco está sendo usado
        print(f"\n=== DEBUG DATABASE CONNECTION get_lists ===")
        print(f"DATABASE path: {DATABASE}")
        print("=" * 40)
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Query base
        query = '''
            SELECT l.*, 'Sistema' as created_by_name,
                   COUNT(li.id) as music_count
            FROM merge_lists l

            LEFT JOIN merge_list_items li ON l.id = li.merge_list_id
            WHERE 1=1
        '''
        params = []
        
        # Filtro de busca
        if search:
            query += ' AND l.name LIKE ?'
            params.append(f'%{search}%')
        
        query += ' GROUP BY l.id ORDER BY l.updated_date DESC'
        
        # Contar total - query separada para evitar problemas com GROUP BY
        count_query = '''
            SELECT COUNT(DISTINCT l.id)
            FROM merge_lists l

            LEFT JOIN merge_list_items li ON l.id = li.merge_list_id
            WHERE 1=1
        '''
        count_params = []
        
        # Adicionar filtro de busca à query de contagem
        if search:
            count_query += ' AND l.name LIKE ?'
            count_params.append(f'%{search}%')
        
        cursor.execute(count_query, count_params)
        total = cursor.fetchone()[0]
        
        # Paginação
        query += ' LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        # DEBUG: Mostrar query executada
        print(f"\n=== DEBUG QUERY get_lists ===")
        print(f"Query: {query}")
        print(f"Params: {params}")
        print("=" * 40)
        
        cursor.execute(query, params)
        lists = []
        for row in cursor.fetchall():
            # row order: id, name, created_date, updated_date, observations, created_by, created_by_name, music_count
            list_item = {
                'id': row[0],
                'name': row[1],
                'created_at': row[2],  # created_date
                'updated_at': row[3],  # updated_date
                'observations': row[4],
                'created_by': row[5],  # created_by
                'created_by_name': row[6],  # 'Sistema' fixo
                'music_count': row[7]
            }
            lists.append(list_item)
        
        conn.close()
        
        return jsonify({
            'data': lists,
            'pagination': {
                'total': total,
                'page': page,
                'limit': limit,
                'totalPages': (total + limit - 1) // limit
            }
        })

    @app.route('/api/lists', methods=['POST'])
    def create_list():
        """Criar nova lista"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({'error': 'List name is required'}), 400
        
        name = data['name'].strip()
        observations = data.get('observations', '').strip()
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se já existe lista com mesmo nome
        cursor.execute('''
            SELECT id FROM merge_lists 
            WHERE name = ? AND created_by = ?
        ''', (name, session['user_id']))
        
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'List with this name already exists'}), 409
        
        # Criar lista
        cursor.execute('''
            INSERT INTO merge_lists (name, observations, created_by)
            VALUES (?, ?, ?)
        ''', (name, observations, session['user_id']))
        
        list_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        app.logger.info(f"List created: {name} by user {session['user_id']}")
        return jsonify({
            'message': 'List created successfully',
            'id': list_id,
            'name': name
        })

    @app.route('/api/lists/<int:list_id>', methods=['GET'])
    def get_list(list_id):
        """Obter detalhes de uma lista específica com suas músicas"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se lista existe e pertence ao usuário
        cursor.execute('''
            SELECT l.*, 'Sistema' as created_by_name
            FROM merge_lists l

            WHERE l.id = ? AND l.created_by = ?
        ''', (list_id, session['user_id']))
        
        list_row = cursor.fetchone()
        if not list_row:
            conn.close()
            return jsonify({'error': 'List not found'}), 404
        
        # Obter músicas da lista
        cursor.execute('''
            SELECT li.*, p.original_name, p.song_name, p.artist, 
                   p.category, p.musical_key, p.pages
            FROM merge_list_items li
            JOIN pdf_files p ON li.pdf_file_id = p.id
            WHERE li.merge_list_id = ?
            ORDER BY li.order_index ASC
        ''', (list_id,))
        
        musics = []
        for row in cursor.fetchall():
            music = {
                'id': row[0],
                'list_id': row[1],
                'pdf_file_id': row[2],
                'order_index': row[3],
                'added_at': row[4],
                'original_name': row[5],
                'song_name': row[6],
                'artist': row[7],
                'category': row[8],
                'musical_key': row[9],
                'pages': row[10]
            }
            musics.append(music)
        
        conn.close()
        
        list_data = {
            'id': list_row[0],
            'name': list_row[1],
            'observations': list_row[2],
            'created_by': list_row[3],
            'created_at': list_row[4],
            'updated_at': list_row[5],
            'created_by_name': list_row[6],
            'musics': musics
        }
        
        return jsonify(list_data)

    @app.route('/api/lists/<int:list_id>', methods=['PUT'])
    def update_list(list_id):
        """Atualizar uma lista"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se lista existe e pertence ao usuário
        cursor.execute('''
            SELECT id FROM merge_lists 
            WHERE id = ? AND created_by = ?
        ''', (list_id, session['user_id']))
        
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'List not found'}), 404
        
        # Atualizar campos
        update_fields = []
        params = []
        
        if 'name' in data:
            update_fields.append('name = ?')
            params.append(data['name'].strip())
        
        if 'observations' in data:
            update_fields.append('observations = ?')
            params.append(data['observations'].strip())
        
        if update_fields:
            update_fields.append('updated_at = ?')
            params.append(datetime.now())
            params.append(list_id)
            
            query = f'UPDATE merge_lists SET {", ".join(update_fields)} WHERE id = ?'
            cursor.execute(query, params)
            conn.commit()
        
        conn.close()
        app.logger.info(f"List {list_id} updated by user {session['user_id']}")
        return jsonify({'message': 'List updated successfully'})

    @app.route('/api/lists/<int:list_id>', methods=['DELETE'])
    def delete_list(list_id):
        """Deletar uma lista"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se lista existe e pertence ao usuário
        cursor.execute('''
            SELECT name FROM merge_lists 
            WHERE id = ? AND created_by = ?
        ''', (list_id, session['user_id']))
        
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': 'List not found'}), 404
        
        list_name = row[0]
        
        # Deletar lista (items são deletados automaticamente por CASCADE)
        cursor.execute('DELETE FROM merge_lists WHERE id = ?', (list_id,))
        conn.commit()
        conn.close()
        
        app.logger.info(f"List {list_name} deleted by user {session['user_id']}")
        return jsonify({'message': 'List deleted successfully'})

    @app.route('/api/lists/<int:list_id>/musics', methods=['POST'])
    def add_music_to_list(list_id):
        """Adicionar música à lista"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json()
        if not data or not data.get('pdf_file_id'):
            return jsonify({'error': 'pdf_file_id is required'}), 400
        
        pdf_file_id = data['pdf_file_id']
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se lista existe e pertence ao usuário
        cursor.execute('''
            SELECT id FROM merge_lists 
            WHERE id = ? AND created_by = ?
        ''', (list_id, session['user_id']))
        
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'List not found'}), 404
        
        # Verificar se música existe
        cursor.execute('SELECT id FROM pdf_files WHERE id = ?', (pdf_file_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Music not found'}), 404
        
        # Verificar se música já está na lista
        cursor.execute('''
            SELECT id FROM merge_list_items 
            WHERE list_id = ? AND pdf_file_id = ?
        ''', (list_id, pdf_file_id))
        
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Music already in list'}), 409
        
        # Obter próximo order_index
        cursor.execute('''
            SELECT COALESCE(MAX(order_index), 0) + 1 
            FROM merge_list_items WHERE list_id = ?
        ''', (list_id,))
        next_order = cursor.fetchone()[0]
        
        # Adicionar música à lista
        cursor.execute('''
            INSERT INTO merge_list_items (list_id, pdf_file_id, order_index)
            VALUES (?, ?, ?)
        ''', (list_id, pdf_file_id, next_order))
        
        # Atualizar timestamp da lista
        cursor.execute('''
            UPDATE merge_lists SET updated_at = ? WHERE id = ?
        ''', (datetime.now(), list_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Music added to list successfully'})

    @app.route('/api/lists/<int:list_id>/musics/<int:item_id>', methods=['DELETE'])
    def remove_music_from_list(list_id, item_id):
        """Remover música da lista"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se lista pertence ao usuário
        cursor.execute('''
            SELECT id FROM merge_lists 
            WHERE id = ? AND created_by = ?
        ''', (list_id, session['user_id']))
        
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'List not found'}), 404
        
        # Remover item
        cursor.execute('''
            DELETE FROM merge_list_items 
            WHERE id = ? AND list_id = ?
        ''', (item_id, list_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Item not found in list'}), 404
        
        # Atualizar timestamp da lista
        cursor.execute('''
            UPDATE merge_lists SET updated_at = ? WHERE id = ?
        ''', (datetime.now(), list_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Music removed from list successfully'})

    @app.route('/api/lists/<int:list_id>/reorder', methods=['PUT'])
    def reorder_list_items(list_id):
        """Reordenar itens da lista"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json()
        if not data or 'items' not in data:
            return jsonify({'error': 'Items array is required'}), 400
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se lista pertence ao usuário
        cursor.execute('''
            SELECT id FROM merge_lists 
            WHERE id = ? AND created_by = ?
        ''', (list_id, session['user_id']))
        
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'List not found'}), 404
        
        # Atualizar order_index dos itens
        for index, item in enumerate(data['items']):
            cursor.execute('''
                UPDATE merge_list_items 
                SET order_index = ? 
                WHERE id = ? AND list_id = ?
            ''', (index + 1, item['id'], list_id))
        
        # Atualizar timestamp da lista
        cursor.execute('''
            UPDATE merge_lists SET updated_at = ? WHERE id = ?
        ''', (datetime.now(), list_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'List reordered successfully'})

    @app.route('/api/lists/<int:list_id>/merge', methods=['POST'])
    def merge_list_pdf_files(list_id):
        """Fazer merge dos PDFs da lista"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Verificar se lista pertence ao usuário
        cursor.execute('''
            SELECT l.name FROM merge_lists l
            WHERE l.id = ? AND l.created_by = ?
        ''', (list_id, session['user_id']))
        
        list_row = cursor.fetchone()
        if not list_row:
            conn.close()
            return jsonify({'error': 'List not found'}), 404
        
        list_name = list_row[0]
        
        # Obter arquivos da lista ordenados
        cursor.execute('''
            SELECT p.filename, p.original_name
            FROM merge_list_items li
            JOIN pdf_files p ON li.pdf_file_id = p.id
            WHERE li.merge_list_id = ?
            ORDER BY li.order_index ASC
        ''', (list_id,))
        
        files = cursor.fetchall()
        conn.close()
        
        if not files:
            return jsonify({'error': 'No files in list'}), 400
        
        try:
            # Criar PDF merged
            merger = PdfWriter()
            
            for filename, _ in files:
                # Procurar arquivo nos diretórios
                file_path = None
                for folder in [app.config.get('ORGANIZED_FOLDER', 'organized'), 
                              app.config.get('UPLOAD_FOLDER', 'uploads')]:
                    potential_path = os.path.join(folder, filename)
                    if os.path.exists(potential_path):
                        file_path = potential_path
                        break
                
                if file_path:
                    with open(file_path, 'rb') as f:
                        merger.append(PdfReader(f))
            
            # Salvar arquivo merged temporário
            temp_dir = tempfile.gettempdir()
            merged_filename = f"lista_{list_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            merged_path = os.path.join(temp_dir, merged_filename)
            
            with open(merged_path, 'wb') as output_file:
                merger.write(output_file)
            
            merger.close()
            
            app.logger.info(f"List {list_id} merged by user {session['user_id']}")
            
            return send_file(
                merged_path,
                as_attachment=True,
                download_name=merged_filename,
                mimetype='application/pdf'
            )
            
        except Exception as e:
            app.logger.error(f"Error merging list {list_id}: {e}")
            return jsonify({'error': 'Error merging PDFs'}), 500