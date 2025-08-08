#!/usr/bin/env python3
"""
Script para verificar e corrigir a estrutura do banco de dados
"""

import sqlite3
import os

DATABASE = 'data/pdf_organizer.db'

def check_table_structure():
    """Verifica a estrutura atual das tabelas"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    print("=== VERIFICANDO ESTRUTURA DO BANCO ===\n")
    
    # Verificar tabela pdf_files
    print("📄 Tabela pdf_files:")
    cursor.execute("PRAGMA table_info(pdf_files)")
    pdf_columns = cursor.fetchall()
    pdf_column_names = [col[1] for col in pdf_columns]
    
    for col in pdf_columns:
        print(f"  ✓ {col[1]} ({col[2]})")
    
    # Verificar se colunas necessárias existem
    required_columns = [
        'id', 'original_name', 'filename', 'song_name', 'artist', 
        'category', 'liturgical_time', 'musical_key', 'file_size', 
        'upload_date', 'uploaded_by', 'youtube_link', 'observations',
        'duplicate_of', 'is_duplicate', 'pages'
    ]
    
    missing_columns = []
    for col in required_columns:
        if col not in pdf_column_names:
            missing_columns.append(col)
    
    if missing_columns:
        print(f"\n❌ Colunas faltando: {missing_columns}")
    else:
        print("\n✅ Todas as colunas necessárias estão presentes")
    
    # Verificar tabela users
    print("\n👥 Tabela users:")
    cursor.execute("PRAGMA table_info(users)")
    user_columns = cursor.fetchall()
    for col in user_columns:
        print(f"  ✓ {col[1]} ({col[2]})")
    
    # Verificar tabela merge_lists
    print("\n📋 Tabela merge_lists:")
    try:
        cursor.execute("PRAGMA table_info(merge_lists)")
        list_columns = cursor.fetchall()
        for col in list_columns:
            print(f"  ✓ {col[1]} ({col[2]})")
    except Exception as e:
        print(f"  ❌ Erro: {e}")
    
    conn.close()
    return missing_columns

def add_missing_columns():
    """Adiciona colunas que estão faltando"""
    missing = check_table_structure()
    
    if not missing:
        print("\n✅ Nenhuma alteração necessária!")
        return
    
    print(f"\n🔧 Adicionando colunas faltando: {missing}")
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Mapeamento de colunas e seus tipos
        column_definitions = {
            'uploaded_by': 'INTEGER',
            'youtube_link': 'TEXT',
            'observations': 'TEXT',
            'duplicate_of': 'INTEGER',
            'is_duplicate': 'BOOLEAN DEFAULT 0',
            'pages': 'INTEGER',
            'musical_key': 'TEXT',
            'liturgical_time': 'TEXT',
            'song_name': 'TEXT',  # Se for title
            'artist': 'TEXT',
            'category': 'TEXT'
        }
        
        for col in missing:
            if col in column_definitions:
                sql = f"ALTER TABLE pdf_files ADD COLUMN {col} {column_definitions[col]}"
                print(f"  ➕ Executando: {sql}")
                cursor.execute(sql)
        
        conn.commit()
        print("✅ Colunas adicionadas com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro ao adicionar colunas: {e}")
        conn.rollback()
    finally:
        conn.close()

def fix_api_compatibility():
    """Corrige a compatibilidade com a nova API"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Verificar se existe coluna title, se não, criar alias
        cursor.execute("PRAGMA table_info(pdf_files)")
        columns = [col[1] for col in cursor.fetchall()]
        
        print("\n🔧 Corrigindo compatibilidade da API...")
        
        # Se não tiver title mas tiver song_name, não precisa fazer nada
        # A query pode usar song_name as title
        
        if 'title' not in columns and 'song_name' in columns:
            print("  ✓ Usando song_name como title")
        elif 'title' not in columns and 'song_name' not in columns:
            print("  ➕ Adicionando coluna title")
            cursor.execute("ALTER TABLE pdf_files ADD COLUMN title TEXT")
            conn.commit()
        
        print("✅ Compatibilidade corrigida!")
        
    except Exception as e:
        print(f"❌ Erro: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    if not os.path.exists(DATABASE):
        print(f"❌ Banco de dados não encontrado: {DATABASE}")
        exit(1)
    
    # Fazer backup
    import shutil
    backup_file = f"{DATABASE}.backup"
    shutil.copy2(DATABASE, backup_file)
    print(f"📁 Backup criado: {backup_file}")
    
    # Verificar e corrigir
    add_missing_columns()
    fix_api_compatibility()
    
    print("\n🎉 Processo concluído!")
    print("   Reinicie o backend para aplicar as mudanças.")