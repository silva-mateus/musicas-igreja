# Backend API - Músicas Igreja (Flask)

Backend em Flask responsável por gerenciar PDFs de músicas, categorias, tempos litúrgicos, artistas e listas de mescla. Este backend foi adaptado para operar como API (JSON), mantendo o schema de banco de dados e a estrutura de arquivos existentes.

## Features

### 📁 File Organization
- **Automatic categorization** - Organize PDFs into categories like Documents, Books, Reports, etc.
- **Folder structure** - Files are automatically organized into category-based folders
- **Duplicate detection** - Prevents duplicate files using MD5 hashing
- **Metadata extraction** - Automatically extracts page count and file information

### 🔍 Search & Discovery
- **Full-text search** - Search through filenames, original names, and descriptions
- **Category filtering** - Filter files by specific categories
- **Advanced search** - Combine text search with category filters
- **Real-time results** - Fast search results with detailed file information

### 📄 PDF Operations
- **File viewing** - View PDFs directly in your browser
- **File downloading** - Download files with original names
- **PDF merging** - Combine multiple PDFs into a single document
- **Batch operations** - Select multiple files for merging

### 🧩 API-First
- **Endpoints JSON** para upload, listagem, detalhamento, atualização, deleção e download/stream de PDFs
- **Gestão de listas**: criar/editar/excluir listas de mescla via API e exportar PDF
- **Entidades auxiliares**: categorias, tempos litúrgicos e artistas expostos via API

## Installation

### Prerequisites
- Python 3.7 or higher
- pip (Python package manager)

### Setup

1. **Clone or download the project**
   ```bash
   # Or download the files to your preferred directory
   cd pdf-organizer
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   python app.py
   ```

4. **Access the application**
   API base: `http://localhost:5000`

### API-only mode
- Por padrão, o backend roda em modo API (sem páginas HTML).
- Para manter esse comportamento, garanta `API_ONLY=true` no ambiente.
- Se quiser reativar temporariamente as páginas HTML legadas, defina `API_ONLY=false` (não recomendado).

## Database Schema (SQLite)

Tabelas criadas por `init_db()` em `app.py` (schema não foi alterado):

```sql
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
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS liturgical_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merge_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  observations TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merge_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merge_list_id INTEGER NOT NULL,
  pdf_file_id INTEGER NOT NULL,
  order_position INTEGER NOT NULL,
  FOREIGN KEY (merge_list_id) REFERENCES merge_lists (id) ON DELETE CASCADE,
  FOREIGN KEY (pdf_file_id) REFERENCES pdf_files (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS file_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  UNIQUE(file_id, category_id)
);

CREATE TABLE IF NOT EXISTS file_liturgical_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  liturgical_time_id INTEGER NOT NULL,
  UNIQUE(file_id, liturgical_time_id)
);
```

Observações:
- Colunas como `liturgical_time`, `musical_key`, `youtube_link`, `song_name`, `artist` em `pdf_files` podem ser adicionadas dinamicamente se ausentes (compatibilidade com versões antigas).
- Relacionamentos N:N são mantidos via `file_categories` e `file_liturgical_times`.

## API Reference

Base URL: `http://localhost:5000`

Autenticação: não há autenticação neste backend (uso interno).

### Arquivos (PDFs)

- GET `/api/files`
  - Query params: `q`, `category`, `liturgical_time`, `page` (1), `per_page` (10|25|50)
  - Resposta: `{ files: [...], pagination: { page, per_page, total, total_pages } }`

- POST `/api/files` (multipart/form-data)
  - Campos: `file`(PDF), `song_name`, `artist`, `new_artist`, `categories[]`, `liturgical_times[]`, `musical_key`, `youtube_link`, `description`
  - Resposta: `201 { success, file_id, filename }`

- GET `/api/files/{id}`
  - Resposta: `{ success, file: { ... } }`

- PUT `/api/files/{id}` (application/json)
  - Body: `song_name`, `artist`, `musical_key`, `youtube_link`, `description`, `categories`, `new_categories`, `liturgical_times`, `new_liturgical_times`
  - Resposta: `{ success: true }`

- DELETE `/api/files/{id}`
  - Resposta: `{ success: true, deleted_filename }`

- POST `/api/files/{id}/replace_pdf` (multipart/form-data)
  - Campo: `replacement_pdf`(PDF)
  - Resposta: `{ success, new_filename, new_size, new_pages }`

- GET `/api/files/{id}/download`
  - Resposta: arquivo para download (404 em JSON se não encontrado)

- GET `/api/files/{id}/stream`
  - Resposta: stream inline do PDF (404 em JSON se não encontrado)

### Categorias / Tempos / Artistas

- GET `/api/categories` → `{ categories: [...] }`
- POST `/api/categories` (json: `{ name }`) → cria categoria
- GET `/api/liturgical_times` → `{ liturgical_times: [...] }`
- POST `/api/artists` (json: `{ artist_name, artist_description }`) → cria artista

### Listas de Mescla

- GET `/api/merge_lists` → lista resumida
- POST `/api/merge_lists` (json: `{ name, file_ids[] }`) → cria lista
- GET `/api/merge_lists/{id}` → detalhes + itens
- PUT `/api/merge_lists/{id}` (json: `{ name, observations }`) → atualiza
- DELETE `/api/merge_lists/{id}` → remove lista e itens
- POST `/api/merge_lists/{id}/items` (json: `{ file_ids[] }`) → adiciona itens
- DELETE `/api/merge_list_items/{item_id}` → remove item
- POST `/api/merge_lists/{id}/reorder` (json: `{ item_order: [item_id...] }`) → reordena
- GET `/api/merge_lists/{id}/export` → download de PDF temporário mesclado
- POST `/api/merge_lists/{id}/create_pdf` → cria PDF mesclado em `organized/Merged` e registra em `pdf_files`

## Usage Guide

### Getting Started

1. **Launch the application** - Run `python app.py` and open `http://localhost:5000`
2. **Upload your first PDF** - Click "Add PDF" or use the Upload page
3. **Choose a category** - Select from default categories or create new ones
4. **Add descriptions** - Optionally add descriptions to make files easier to find

### Uploading Files

1. Navigate to the **Upload** page
2. Select a PDF file (max 50MB)
3. Choose a category from the dropdown
4. Add an optional description
5. Click "Upload PDF"

**Tips:**
- Only PDF files are supported
- Duplicate files are automatically detected
- Files are organized into category folders
- Use descriptions to make files searchable

### Searching Files

**Quick Search:**
- Use the search bar in the navigation
- Search through filenames and descriptions
- Results appear instantly

**Advanced Search:**
- Use the search page for more options
- Combine text search with category filters
- View detailed results with file information

### Merging PDFs

1. Go to the **Merge PDFs** page
2. Select 2 or more files to merge
3. Enter a name for the merged document
4. Click "Merge Selected Files"
5. The new merged PDF will appear in the "Merged" category

### Managing Files

**Viewing Files:**
- Click the "View" button to open PDFs in your browser
- Files open in a new tab for easy viewing

**Deleting Files:**
- Click the "Delete" button on any file card
- Confirm the deletion in the popup dialog
- Files are removed from both the database and filesystem

**Organizing:**
- Files are automatically organized by category
- Categories create separate folders in the `organized/` directory
- Use the category filter buttons to browse by category

## File Structure

```
pdf-organizer/
├── app.py                 # Main application file
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── templates/            # HTML templates
│   ├── base.html         # Base template with navigation
│   ├── index.html        # Main dashboard
│   ├── upload.html       # Upload form
│   ├── merge.html        # PDF merge interface
│   └── search_results.html # Search results page
├── static/               # Static files (CSS, JS)
│   ├── css/
│   └── js/
├── uploads/              # Temporary upload directory
├── organized/            # Organized PDF files by category
│   ├── Documents/
│   ├── Books/
│   ├── Reports/
│   └── ...
└── pdf_organizer.db      # SQLite database (created automatically)
```

## Configuration

### Default Categories
The application comes with these default categories:
- Documents
- Books  
- Reports
- Manuals
- Articles
- Forms
- Presentations
- Uncategorized

You can add more categories through the application interface.

### File Limits
- Maximum file size: 50MB per PDF
- Supported format: PDF only
- No limit on number of files

### Database
- Uses SQLite for simplicity
- Database file: `/data/pdf_organizer.db`
- Automatically created on first run

## Troubleshooting

### Common Issues

**"Module not found" errors:**
```bash
pip install -r requirements.txt
```

**Port already in use:**
- Change the port in `app.py` (last line): `app.run(port=5001)`
- Or kill the process using port 5000

**Permission errors:**
- Ensure you have write permissions in the application directory
- The app needs to create `uploads/` and `organized/` folders

**PDF files not displaying:**
- Ensure your browser supports PDF viewing
- Check browser settings for PDF handling

### Development Mode
The application runs in debug mode by default. For production use:
1. Set `debug=False` in `app.py`
2. Change the secret key to a secure random value
3. Use a production WSGI server like Gunicorn

## Technical Details

### Dependencies
- **Flask** - Web framework
- **Werkzeug** - WSGI utilities and file handling
- **pypdf** - PDF processing and manipulation
- **SQLite** - Database (built into Python)
- **Bootstrap 5** - Frontend framework (CDN)
- **Font Awesome** - Icons (CDN)

### Security Features
- File type validation (PDF only)
- Secure filename handling
- Duplicate detection
- File size limits
- SQL injection protection

### Browser Compatibility
- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## Contributing

This is a standalone application. To extend functionality:

1. **Add new routes** in `app.py`
2. **Create new templates** in `templates/`
3. **Add CSS/JS** in `static/`
4. **Modify database schema** in the `init_db()` function

## License

This project is open source and available under the MIT License.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify all dependencies are installed correctly
3. Ensure Python 3.7+ is being used
4. Check file permissions in the application directory 