# Rotas administrativas para gerenciamento de usuários

import sqlite3
from datetime import datetime
from flask import jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash
import logging

def add_admin_routes(app, DATABASE):
    
    def require_admin():
        """Decorator para verificar se o usuário é admin"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        conn.close()
        
        if not user or user[0] != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        return None
    
    @app.route('/api/admin/users', methods=['GET'])
    def get_users():
        """Listar usuários com filtros e paginação (apenas admin)"""
        auth_error = require_admin()
        if auth_error:
            return auth_error
        
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        search = request.args.get('search', '')
        role = request.args.get('role')
        is_active = request.args.get('is_active')
        
        offset = (page - 1) * limit
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Query base
        query = '''
            SELECT id, username, email, role, created_at, last_login, is_active
            FROM users
            WHERE 1=1
        '''
        params = []
        
        # Filtros
        if search:
            query += ' AND (username LIKE ? OR email LIKE ?)'
            search_param = f'%{search}%'
            params.extend([search_param, search_param])
        
        if role:
            query += ' AND role = ?'
            params.append(role)
        
        if is_active is not None:
            query += ' AND is_active = ?'
            params.append(1 if is_active == 'true' else 0)
        
        # Contar total
        count_query = query.replace(
            'SELECT id, username, email, role, created_at, last_login, is_active',
            'SELECT COUNT(*)'
        )
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]
        
        # Paginação e ordenação
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        users = []
        for row in cursor.fetchall():
            user = {
                'id': row[0],
                'username': row[1],
                'email': row[2],
                'role': row[3],
                'created_at': row[4],
                'last_login': row[5],
                'is_active': bool(row[6])
            }
            users.append(user)
        
        conn.close()
        
        return jsonify({
            'data': users,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        })
    
    @app.route('/api/admin/users', methods=['POST'])
    def create_user():
        """Criar novo usuário (apenas admin)"""
        auth_error = require_admin()
        if auth_error:
            return auth_error
        
        data = request.get_json()
        
        # Validação
        required_fields = ['username', 'email', 'password', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Campo {field} é obrigatório'}), 400
        
        username = data['username'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        role = data['role']
        
        # Validações específicas
        if len(username) < 3:
            return jsonify({'error': 'Username deve ter pelo menos 3 caracteres'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
        
        if role not in ['admin', 'user']:
            return jsonify({'error': 'Role deve ser admin ou user'}), 400
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        try:
            # Verificar se username já existe
            cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
            if cursor.fetchone():
                return jsonify({'error': 'Username já existe'}), 400
            
            # Verificar se email já existe
            cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
            if cursor.fetchone():
                return jsonify({'error': 'Email já existe'}), 400
            
            # Criar usuário
            password_hash = generate_password_hash(password)
            cursor.execute('''
                INSERT INTO users (username, email, password_hash, role, created_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (username, email, password_hash, role, datetime.now(), True))
            
            user_id = cursor.lastrowid
            conn.commit()
            
            app.logger.info(f"Admin {session.get('username')} criou usuário: {username}")
            
            return jsonify({
                'message': 'Usuário criado com sucesso',
                'user': {
                    'id': user_id,
                    'username': username,
                    'email': email,
                    'role': role,
                    'is_active': True
                }
            })
            
        except Exception as e:
            conn.rollback()
            app.logger.error(f"Erro ao criar usuário: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
        finally:
            conn.close()
    
    @app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
    def update_user(user_id):
        """Atualizar usuário (apenas admin)"""
        auth_error = require_admin()
        if auth_error:
            return auth_error
        
        data = request.get_json()
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        try:
            # Verificar se usuário existe
            cursor.execute('SELECT id, username FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()
            if not user:
                return jsonify({'error': 'Usuário não encontrado'}), 404
            
            # Campos que podem ser atualizados
            updates = []
            params = []
            
            if 'username' in data:
                username = data['username'].strip()
                if len(username) < 3:
                    return jsonify({'error': 'Username deve ter pelo menos 3 caracteres'}), 400
                
                # Verificar se username já existe (exceto o próprio usuário)
                cursor.execute('SELECT id FROM users WHERE username = ? AND id != ?', (username, user_id))
                if cursor.fetchone():
                    return jsonify({'error': 'Username já existe'}), 400
                
                updates.append('username = ?')
                params.append(username)
            
            if 'email' in data:
                email = data['email'].strip().lower()
                
                # Verificar se email já existe (exceto o próprio usuário)
                cursor.execute('SELECT id FROM users WHERE email = ? AND id != ?', (email, user_id))
                if cursor.fetchone():
                    return jsonify({'error': 'Email já existe'}), 400
                
                updates.append('email = ?')
                params.append(email)
            
            if 'role' in data:
                role = data['role']
                if role not in ['admin', 'user']:
                    return jsonify({'error': 'Role deve ser admin ou user'}), 400
                
                updates.append('role = ?')
                params.append(role)
            
            if 'is_active' in data:
                # Não permitir desativar o próprio usuário
                if user_id == session['user_id'] and not data['is_active']:
                    return jsonify({'error': 'Não é possível desativar sua própria conta'}), 400
                
                updates.append('is_active = ?')
                params.append(data['is_active'])
            
            if 'password' in data:
                password = data['password']
                if len(password) < 6:
                    return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
                
                password_hash = generate_password_hash(password)
                updates.append('password_hash = ?')
                params.append(password_hash)
            
            if not updates:
                return jsonify({'error': 'Nenhum campo para atualizar'}), 400
            
            # Executar update
            params.append(user_id)
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(query, params)
            conn.commit()
            
            app.logger.info(f"Admin {session.get('username')} atualizou usuário ID {user_id}")
            
            return jsonify({'message': 'Usuário atualizado com sucesso'})
            
        except Exception as e:
            conn.rollback()
            app.logger.error(f"Erro ao atualizar usuário: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
        finally:
            conn.close()
    
    @app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
    def delete_user(user_id):
        """Excluir usuário (apenas admin)"""
        auth_error = require_admin()
        if auth_error:
            return auth_error
        
        # Não permitir excluir o próprio usuário
        if user_id == session['user_id']:
            return jsonify({'error': 'Não é possível excluir sua própria conta'}), 400
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        try:
            # Verificar se usuário existe
            cursor.execute('SELECT username FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()
            if not user:
                return jsonify({'error': 'Usuário não encontrado'}), 404
            
            # Excluir usuário
            cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
            conn.commit()
            
            app.logger.info(f"Admin {session.get('username')} excluiu usuário: {user[0]}")
            
            return jsonify({'message': 'Usuário excluído com sucesso'})
            
        except Exception as e:
            conn.rollback()
            app.logger.error(f"Erro ao excluir usuário: {e}")
            return jsonify({'error': 'Erro interno do servidor'}), 500
        finally:
            conn.close()
    
    @app.route('/api/admin/stats', methods=['GET'])
    def get_admin_stats():
        """Obter estatísticas administrativas (apenas admin)"""
        auth_error = require_admin()
        if auth_error:
            return auth_error
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        stats = {}
        
        # Estatísticas de usuários
        cursor.execute('SELECT COUNT(*) FROM users')
        stats['total_users'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM users WHERE is_active = 1')
        stats['active_users'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
        stats['admin_users'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM users WHERE created_at >= date("now", "-30 days")')
        stats['new_users_month'] = cursor.fetchone()[0]
        
        # Estatísticas de atividade
        cursor.execute('SELECT COUNT(*) FROM users WHERE last_login >= date("now", "-7 days")')
        stats['active_users_week'] = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify(stats)