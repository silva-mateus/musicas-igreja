#!/usr/bin/env python3
import sqlite3
import os
from datetime import datetime
from werkzeug.security import generate_password_hash

# Conectar ao banco
db_path = 'backend/pdf_organizer.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=== CRIANDO TODAS AS TABELAS NECESSÁRIAS ===\n")

# Criar tabela users
print("👥 Criando tabela users...")
try:
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("  ✅ Tabela users criada")
except Exception as e:
    print(f"  ❌ Erro ao criar users: {e}")

# Criar tabela pdf_files
print("📄 Criando tabela pdf_files...")
try:
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pdf_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_name TEXT NOT NULL,
            filename TEXT NOT NULL,
            song_name TEXT,
            artist TEXT,
            category TEXT,
            liturgical_time TEXT,
            musical_key TEXT,
            youtube_link TEXT,
            observations TEXT,
            file_size INTEGER,
            file_hash TEXT,
            pages INTEGER,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            uploaded_by INTEGER,
            duplicate_of INTEGER,
            is_duplicate BOOLEAN DEFAULT 0,
            FOREIGN KEY (uploaded_by) REFERENCES users (id),
            FOREIGN KEY (duplicate_of) REFERENCES pdf_files (id)
        )
    ''')
    print("  ✅ Tabela pdf_files criada")
except Exception as e:
    print(f"  ❌ Erro ao criar pdf_files: {e}")

# Criar tabela merge_lists
print("🗂️  Criando tabela merge_lists...")
try:
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS merge_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            observations TEXT,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (created_by) REFERENCES users (id)
        )
    ''')
    print("  ✅ Tabela merge_lists criada")
except Exception as e:
    print(f"  ❌ Erro ao criar merge_lists: {e}")

# Criar tabela merge_list_items
print("📝 Criando tabela merge_list_items...")
try:
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS merge_list_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            merge_list_id INTEGER NOT NULL,
            music_id INTEGER NOT NULL,
            order_index INTEGER DEFAULT 0,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (merge_list_id) REFERENCES merge_lists (id) ON DELETE CASCADE,
            FOREIGN KEY (music_id) REFERENCES pdf_files (id) ON DELETE CASCADE
        )
    ''')
    print("  ✅ Tabela merge_list_items criada")
except Exception as e:
    print(f"  ❌ Erro ao criar merge_list_items: {e}")

# Verificar se há usuários
cursor.execute("SELECT COUNT(*) FROM users")
user_count = cursor.fetchone()[0]

if user_count == 0:
    print("\n👤 Criando usuário administrador padrão...")
    try:
        password_hash = generate_password_hash('admin123')
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, role)
            VALUES (?, ?, ?, ?)
        ''', ('admin', 'admin@igreja.com', password_hash, 'admin'))
        print("  ✅ Usuário admin criado (senha: admin123)")
    except Exception as e:
        print(f"  ❌ Erro ao criar usuário: {e}")

# Verificar se há músicas
cursor.execute("SELECT COUNT(*) FROM pdf_files")
music_count = cursor.fetchone()[0]

if music_count == 0:
    print("\n🎵 Criando músicas de exemplo...")
    
    # Buscar usuário admin
    cursor.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    admin_result = cursor.fetchone()
    
    if admin_result:
        admin_id = admin_result[0]
        
        sample_musics = [
            ("Ave Maria - Schubert", "Franz Schubert", "Adoração", "Tempo Comum", "F", "Clássica tradicional de adoração", "https://youtube.com/watch?v=2bosouX_d8Y"),
            ("Pange Lingua", "Gregoriano", "Adoração", "Quaresma", "G", "Hino tradicional para Quinta-feira Santa", ""),
            ("Alegrai-vos, Ó Céus", "Ir. Miria T. Kolling", "Louvor", "Natal", "C", "Canto natalino tradicional", ""),
            ("Buscai Primeiro o Reino de Deus", "Pe. Zezinho", "Comunhão", "Tempo Comum", "D", "Música para reflexão", ""),
            ("Senhor, Tende Piedade", "Tradicional", "Entrada", "Tempo Comum", "Em", "Kyrie para início da missa", ""),
            ("Santo, Santo, Santo", "Tradicional", "Santíssimo", "Tempo Comum", "F", "Santo tradicional", ""),
            ("Cordeiro de Deus", "Tradicional", "Comunhão", "Tempo Comum", "G", "Agnus Dei tradicional", ""),
            ("Ide em Paz", "Tradicional", "Final", "Tempo Comum", "C", "Canto de envio", "")
        ]
        
        for i, (title, artist, category, liturgical_time, musical_key, observations, youtube_link) in enumerate(sample_musics):
            try:
                filename = f"musica_{i+1:03d}.pdf"
                cursor.execute('''
                    INSERT INTO pdf_files 
                    (original_name, filename, song_name, artist, category, liturgical_time, 
                     musical_key, youtube_link, observations, file_size, pages, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (f"{title}.pdf", filename, title, artist, category, liturgical_time, 
                      musical_key, youtube_link, observations, 1024*50, 2, admin_id))
                print(f"  ✅ Música criada: {title}")
            except Exception as e:
                print(f"  ❌ Erro ao criar música {title}: {e}")

# Agora criar listas com as músicas
cursor.execute("SELECT COUNT(*) FROM merge_lists")
list_count = cursor.fetchone()[0]

if list_count == 0:
    print("\n📋 Criando listas de exemplo...")
    
    cursor.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    admin_result = cursor.fetchone()
    
    if admin_result:
        admin_id = admin_result[0]
        
        sample_lists = [
            ("Missa Dominical", "Lista padrão para missas de domingo"),
            ("Adoração Eucarística", "Músicas para momentos de adoração"),
            ("Natal 2024", "Repertório especial para o Natal"),
            ("Quaresma", "Músicas para o tempo quaresmal")
        ]
        
        for name, observations in sample_lists:
            try:
                cursor.execute('''
                    INSERT INTO merge_lists (name, observations, created_by) 
                    VALUES (?, ?, ?)
                ''', (name, observations, admin_id))
                list_id = cursor.lastrowid
                
                # Adicionar algumas músicas à lista
                if name == "Missa Dominical":
                    # Lista completa para missa
                    cursor.execute('''
                        SELECT id FROM pdf_files 
                        WHERE category IN ('Entrada', 'Santo', 'Comunhão', 'Final')
                        LIMIT 4
                    ''')
                elif name == "Adoração Eucarística":
                    # Músicas de adoração
                    cursor.execute('''
                        SELECT id FROM pdf_files 
                        WHERE category = 'Adoração' OR song_name LIKE '%Ave Maria%'
                        LIMIT 3
                    ''')
                elif name == "Natal 2024":
                    # Músicas natalinas
                    cursor.execute('''
                        SELECT id FROM pdf_files 
                        WHERE liturgical_time = 'Natal' OR song_name LIKE '%Alegrai%'
                        LIMIT 2
                    ''')
                else:
                    # Músicas gerais
                    cursor.execute("SELECT id FROM pdf_files LIMIT 3")
                
                music_ids = cursor.fetchall()
                
                for i, (music_id,) in enumerate(music_ids):
                    cursor.execute('''
                        INSERT INTO merge_list_items (merge_list_id, music_id, order_index)
                        VALUES (?, ?, ?)
                    ''', (list_id, music_id, i))
                
                print(f"  ✅ Lista criada: {name} ({len(music_ids)} músicas)")
                
            except Exception as e:
                print(f"  ❌ Erro ao criar lista {name}: {e}")

conn.commit()

# Verificar dados criados
print("\n📊 Resumo dos dados:")
cursor.execute("SELECT COUNT(*) FROM users")
print(f"  👥 Usuários: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM pdf_files")
print(f"  🎵 Músicas: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM merge_lists")
print(f"  📋 Listas: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM merge_list_items")
print(f"  📝 Itens de lista: {cursor.fetchone()[0]}")

conn.close()
print("\n✅ Banco de dados configurado com sucesso!")