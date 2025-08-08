#!/usr/bin/env python3
import sqlite3

DATABASE = 'data/pdf_organizer.db'

def check_database():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    print("=== VERIFICANDO BANCO DE DADOS ===")
    
    # Listar tabelas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"\nTabelas existentes: {tables}")
    
    # Verificar estrutura de merge_list_items
    if 'merge_list_items' in tables:
        print("\n=== TABELA merge_list_items ===")
        cursor.execute("PRAGMA table_info(merge_list_items)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
    else:
        print("\n❌ Tabela merge_list_items NÃO EXISTE")
        print("🔧 Criando tabela...")
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
        print("✅ Tabela criada com sucesso!")
    
    # Verificar merge_lists
    if 'merge_lists' in tables:
        print("\n=== TABELA merge_lists ===")
        cursor.execute("PRAGMA table_info(merge_lists)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
    
    conn.close()
    print("\n✅ Verificação concluída!")

if __name__ == "__main__":
    check_database()