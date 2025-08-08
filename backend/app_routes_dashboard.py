# Rotas para dashboard e estatísticas

import sqlite3
from datetime import datetime, timedelta
from flask import jsonify, session, request

def add_dashboard_routes(app, DATABASE):
    
    @app.route('/api/dashboard/stats', methods=['GET'])
    def get_dashboard_stats():
        """Obter estatísticas principais do dashboard"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        stats = {}
        
        # Estatísticas básicas
        cursor.execute('SELECT COUNT(*) FROM pdf_files')
        stats['total_musics'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM merge_lists')
        stats['total_lists'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(DISTINCT category) FROM pdf_files WHERE category IS NOT NULL')
        stats['total_categories'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(DISTINCT liturgical_time) FROM pdf_files WHERE liturgical_time IS NOT NULL')
        stats['total_liturgical_times'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM users WHERE is_active = 1')
        stats['total_users'] = cursor.fetchone()[0]
        
        # Tamanho total dos arquivos (em MB)
        cursor.execute('SELECT SUM(file_size) FROM pdf_files')
        total_size = cursor.fetchone()[0] or 0
        stats['total_file_size_mb'] = round(total_size / (1024 * 1024), 2)
        
        # Total de páginas (coluna pode não existir)
        try:
            cursor.execute('SELECT SUM(pages) FROM pdf_files WHERE pages IS NOT NULL')
            stats['total_pages'] = cursor.fetchone()[0] or 0
        except sqlite3.OperationalError:
            stats['total_pages'] = 0
        
        # Músicas com YouTube
        cursor.execute('SELECT COUNT(*) FROM pdf_files WHERE youtube_link IS NOT NULL AND youtube_link != ""')
        stats['musics_with_youtube'] = cursor.fetchone()[0]
        
        # Média de músicas por lista
        try:
            cursor.execute('''
                SELECT AVG(music_count) FROM (
                    SELECT COUNT(li.id) as music_count
                    FROM merge_lists l
                    LEFT JOIN merge_list_items li ON l.id = li.merge_list_id
                    GROUP BY l.id
                )
            ''')
            avg_result = cursor.fetchone()[0]
            stats['avg_musics_per_list'] = round(avg_result if avg_result else 0, 1)
        except sqlite3.OperationalError as e:
            app.logger.warning(f"Erro ao calcular média de músicas por lista: {e}")
            stats['avg_musics_per_list'] = 0
        
        # Lista com mais músicas
        try:
            cursor.execute('''
                SELECT l.name, COUNT(li.id) as count
                FROM merge_lists l
                LEFT JOIN merge_list_items li ON l.id = li.merge_list_id
                GROUP BY l.id, l.name
                ORDER BY count DESC
                LIMIT 1
            ''')
            largest_list = cursor.fetchone()
            if largest_list:
                stats['largest_list'] = {'name': largest_list[0], 'count': largest_list[1]}
            else:
                stats['largest_list'] = {'name': 'Nenhuma', 'count': 0}
        except sqlite3.OperationalError as e:
            app.logger.warning(f"Erro ao buscar maior lista: {e}")
            stats['largest_list'] = {'name': 'Erro', 'count': 0}
        
        # Categoria mais popular
        cursor.execute('''
            SELECT category, COUNT(*) as count
            FROM pdf_files
            WHERE category IS NOT NULL AND category != ""
            GROUP BY category
            ORDER BY count DESC
            LIMIT 1
        ''')
        popular_category = cursor.fetchone()
        if popular_category:
            stats['most_popular_category'] = {'name': popular_category[0], 'count': popular_category[1]}
        
        conn.close()
        return jsonify(stats)

    @app.route('/api/dashboard/charts/categories', methods=['GET'])
    def get_categories_chart():
        """Dados para gráfico de categorias"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT category, COUNT(*) as count
            FROM pdf_files
            WHERE category IS NOT NULL AND category != ""
            GROUP BY category
            ORDER BY count DESC
            LIMIT 10
        ''')
        
        data = cursor.fetchall()
        conn.close()
        
        labels = [row[0] for row in data]
        values = [row[1] for row in data]
        
        chart_data = {
            'labels': labels,
            'datasets': [{
                'label': 'Número de Músicas',
                'data': values,
                'backgroundColor': [
                    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
                    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
                ]
            }]
        }
        
        return jsonify(chart_data)

    @app.route('/api/dashboard/charts/liturgical-times', methods=['GET'])
    def get_liturgical_times_chart():
        """Dados para gráfico de tempos litúrgicos"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT liturgical_time, COUNT(*) as count
            FROM pdf_files
            WHERE liturgical_time IS NOT NULL AND liturgical_time != ""
            GROUP BY liturgical_time
            ORDER BY count DESC
        ''')
        
        data = cursor.fetchall()
        conn.close()
        
        labels = [row[0] for row in data]
        values = [row[1] for row in data]
        
        chart_data = {
            'labels': labels,
            'datasets': [{
                'label': 'Número de Músicas',
                'data': values,
                'backgroundColor': [
                    '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
                    '#3b82f6', '#84cc16', '#f97316', '#ec4899', '#6366f1'
                ]
            }]
        }
        
        return jsonify(chart_data)

    @app.route('/api/dashboard/charts/uploads-timeline', methods=['GET'])
    def get_uploads_timeline():
        """Timeline de uploads por mês"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Últimos 12 meses
        cursor.execute('''
            SELECT strftime('%Y-%m', upload_date) as month, COUNT(*) as count
            FROM pdf_files
            WHERE upload_date >= date('now', '-12 months')
            GROUP BY month
            ORDER BY month ASC
        ''')
        
        data = cursor.fetchall()
        conn.close()
        
        # Preencher meses sem dados
        from datetime import datetime, timedelta
        import calendar
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        
        months = []
        current = start_date.replace(day=1)
        while current <= end_date:
            month_str = current.strftime('%Y-%m')
            months.append((month_str, current.strftime('%b %Y')))
            # Próximo mês
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        
        # Mapear dados
        data_dict = {row[0]: row[1] for row in data}
        
        labels = [month[1] for month in months]
        values = [data_dict.get(month[0], 0) for month in months]
        
        chart_data = {
            'labels': labels,
            'datasets': [{
                'label': 'Uploads por Mês',
                'data': values,
                'borderColor': '#3b82f6',
                'backgroundColor': 'rgba(59, 130, 246, 0.1)',
                'borderWidth': 2,
                'fill': True
            }]
        }
        
        return jsonify(chart_data)

    @app.route('/api/dashboard/top-artists', methods=['GET'])
    def get_top_artists():
        """Top artistas com mais músicas"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        limit = int(request.args.get('limit', 10))
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT artist, COUNT(*) as music_count
            FROM pdf_files
            WHERE artist IS NOT NULL AND artist != ""
            GROUP BY artist
            ORDER BY music_count DESC
            LIMIT ?
        ''', (limit,))
        
        data = cursor.fetchall()
        conn.close()
        
        artists = []
        for row in data:
            artists.append({
                'artist': row[0],
                'music_count': row[1]
            })
        
        return jsonify(artists)

    @app.route('/api/dashboard/recent-activity', methods=['GET'])
    def get_recent_activity():
        """Atividades recentes do sistema"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        limit = int(request.args.get('limit', 20))
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        activities = []
        
        # Músicas recentes
        cursor.execute('''
            SELECT 'upload' as type, p.original_name as title, p.upload_date as date,
                   'Sistema' as user_name
            FROM pdf_files p
            ORDER BY p.upload_date DESC
            LIMIT ?
        ''', (limit // 2,))
        
        for row in cursor.fetchall():
            activities.append({
                'type': row[0],
                'title': row[1],
                'date': row[2],
                'user_name': row[3],
                'description': f'Upload da música: {row[1]}'
            })
        
        # Listas recentes
        cursor.execute('''
            SELECT 'list' as type, l.name as title, l.created_date as date,
                   'Sistema' as user_name
            FROM merge_lists l
            ORDER BY l.created_date DESC
            LIMIT ?
        ''', (limit // 2,))
        
        for row in cursor.fetchall():
            activities.append({
                'type': row[0],
                'title': row[1],
                'date': row[2],
                'user_name': row[3],
                'description': f'Lista criada: {row[1]}'
            })
        
        conn.close()
        
        # Ordenar por data
        activities.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify(activities[:limit])

    @app.route('/api/dashboard/search-suggestions', methods=['GET'])
    def get_search_suggestions():
        """Sugestões para busca baseadas nos dados"""
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        suggestions = {
            'artists': [],
            'categories': [],
            'liturgical_times': [],
            'musical_keys': []
        }
        
        # Artistas
        cursor.execute('''
            SELECT DISTINCT artist
            FROM pdf_files
            WHERE artist IS NOT NULL AND artist != ""
            ORDER BY artist
            LIMIT 20
        ''')
        suggestions['artists'] = [row[0] for row in cursor.fetchall()]
        
        # Categorias
        cursor.execute('''
            SELECT DISTINCT category
            FROM pdf_files
            WHERE category IS NOT NULL AND category != ""
            ORDER BY category
        ''')
        suggestions['categories'] = [row[0] for row in cursor.fetchall()]
        
        # Tempos litúrgicos
        cursor.execute('''
            SELECT DISTINCT liturgical_time
            FROM pdf_files
            WHERE liturgical_time IS NOT NULL AND liturgical_time != ""
            ORDER BY liturgical_time
        ''')
        suggestions['liturgical_times'] = [row[0] for row in cursor.fetchall()]
        
        # Tonalidades
        cursor.execute('''
            SELECT DISTINCT musical_key
            FROM pdf_files
            WHERE musical_key IS NOT NULL AND musical_key != ""
            ORDER BY musical_key
        ''')
        suggestions['musical_keys'] = [row[0] for row in cursor.fetchall()]
        
        conn.close()
        return jsonify(suggestions)