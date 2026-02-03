using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Database configuration
var dbPath = builder.Configuration.GetValue<string>("Database:Path") 
    ?? Path.Combine(Directory.GetCurrentDirectory(), "data", "musicas.db");
var dbDirectory = Path.GetDirectoryName(dbPath);
if (!string.IsNullOrEmpty(dbDirectory))
{
    Directory.CreateDirectory(dbDirectory);
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// Services
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.AddScoped<IMigrationService, MigrationService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Session configuration
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(24);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.Name = ".MusicasIgreja.Session";
});

// Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower;
    });

// CORS - allow frontend
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5000",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5000"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Músicas Igreja API", Version = "v1" });
});

var app = builder.Build();

// Apply migrations and normalizations on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var fileService = scope.ServiceProvider.GetRequiredService<IFileService>();
    var migrationService = scope.ServiceProvider.GetRequiredService<IMigrationService>();
    var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    // Create database if it doesn't exist
    if (!File.Exists(dbPath))
    {
        logger.LogInformation("Creating database at {DbPath}...", dbPath);
        context.Database.EnsureCreated();
    }
    
    // Migrate users table schema if needed (from old email-based to new full_name-based)
    await MigrateUsersTableSchemaAsync(context, logger, authService);
    
    // Check and log password hash migration status (legacy SHA256 -> BCrypt)
    await authService.MigratePasswordHashesAsync();
    
    // Run SQL migration scripts (handles table creation and schema updates)
    await migrationService.RunMigrationsAsync();
    
    // Normalize all file paths to the standard relative format (organized/Category/file.pdf)
    // This ensures compatibility between Windows (dev) and Linux (production) environments
    var filesWithBadPaths = context.PdfFiles
        .Where(f => f.FilePath.StartsWith("/mnt/") || 
                    f.FilePath.StartsWith("/app/") ||
                    f.FilePath.StartsWith("/organized/") ||
                    (f.FilePath.Length > 2 && f.FilePath.Substring(1, 1) == ":"))
        .ToList();
    
    if (filesWithBadPaths.Any())
    {
        logger.LogInformation("Normalizing {Count} file paths to relative format...", filesWithBadPaths.Count);
        
        foreach (var file in filesWithBadPaths)
        {
            var oldPath = file.FilePath;
            var newPath = fileService.NormalizeToRelativePath(oldPath);
            
            if (oldPath != newPath)
            {
                logger.LogInformation("Normalizing path: {OldPath} -> {NewPath}", oldPath, newPath);
                file.FilePath = newPath;
            }
        }
        
        context.SaveChanges();
        logger.LogInformation("File paths normalized successfully.");
    }
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Músicas Igreja API v1"));
}

app.UseCors();
app.UseSession();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Helper function to migrate users and roles tables
static async Task MigrateUsersTableSchemaAsync(AppDbContext context, ILogger logger, IAuthService authService)
{
    try
    {
        var connection = context.Database.GetDbConnection();
        await connection.OpenAsync();

        // Step 1: Create roles table if not exists
        logger.LogInformation("Checking roles table...");
        await context.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                description TEXT,
                is_system_role INTEGER NOT NULL DEFAULT 0,
                priority INTEGER NOT NULL DEFAULT 0,
                can_view_music INTEGER NOT NULL DEFAULT 1,
                can_download_music INTEGER NOT NULL DEFAULT 1,
                can_edit_music_metadata INTEGER NOT NULL DEFAULT 0,
                can_upload_music INTEGER NOT NULL DEFAULT 0,
                can_delete_music INTEGER NOT NULL DEFAULT 0,
                can_manage_lists INTEGER NOT NULL DEFAULT 0,
                can_manage_categories INTEGER NOT NULL DEFAULT 0,
                can_manage_users INTEGER NOT NULL DEFAULT 0,
                can_manage_roles INTEGER NOT NULL DEFAULT 0,
                can_access_admin INTEGER NOT NULL DEFAULT 0,
                created_date TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");

        // Seed default roles
        await context.Database.ExecuteSqlRawAsync(@"
            INSERT OR IGNORE INTO roles (id, name, display_name, description, is_system_role, priority, 
                can_view_music, can_download_music, can_edit_music_metadata, can_upload_music, can_delete_music,
                can_manage_lists, can_manage_categories, can_manage_users, can_manage_roles, can_access_admin)
            VALUES 
            (1, 'viewer', 'Visualizador', 'Pode visualizar e baixar músicas', 1, 10, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0),
            (2, 'editor', 'Editor', 'Pode editar metadados de músicas e gerenciar listas', 1, 20, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0),
            (3, 'uploader', 'Uploader', 'Pode fazer upload de novas músicas', 1, 30, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0),
            (4, 'admin', 'Administrador', 'Acesso total ao sistema', 1, 100, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
        ");

        // Add is_default column to roles table (migration)
        try
        {
            logger.LogInformation("Checking for is_default column in roles table...");
            await context.Database.ExecuteSqlRawAsync(
                "ALTER TABLE roles ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0"
            );
            // Set viewer as default role
            await context.Database.ExecuteSqlRawAsync(
                "UPDATE roles SET is_default = 1 WHERE name = 'viewer'"
            );
            logger.LogInformation("Added is_default column to roles table.");
        }
        catch (Exception ex)
        {
            // Column likely already exists
            logger.LogDebug("is_default column check: {Message}", ex.Message);
        }

        // Step 2: Check users table structure
        using var checkTableCmd = connection.CreateCommand();
        checkTableCmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name='users'";
        var usersTableExists = await checkTableCmd.ExecuteScalarAsync() != null;

        if (!usersTableExists)
        {
            logger.LogInformation("Creating users table...");
            await context.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    full_name TEXT,
                    password_hash TEXT NOT NULL,
                    role_id INTEGER NOT NULL DEFAULT 1,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    must_change_password INTEGER NOT NULL DEFAULT 1,
                    created_date TEXT NOT NULL DEFAULT (datetime('now')),
                    last_login_date TEXT,
                    FOREIGN KEY (role_id) REFERENCES roles(id)
                )
            ");
            
            var adminHash = authService.HashPassword("admin123");
            await context.Database.ExecuteSqlRawAsync($@"
                INSERT INTO users (username, full_name, password_hash, role_id, is_active, must_change_password, created_date)
                VALUES ('admin', 'Administrador', '{adminHash}', 4, 1, 0, datetime('now'))
            ");
            logger.LogInformation("Users table created with admin user.");
            return;
        }

        // Check current schema
        using var checkSchemaCmd = connection.CreateCommand();
        checkSchemaCmd.CommandText = "PRAGMA table_info(users)";
        
        var hasRoleColumn = false;
        var hasRoleIdColumn = false;
        var hasFullNameColumn = false;
        var hasMustChangePasswordColumn = false;
        
        using (var reader = await checkSchemaCmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                var columnName = reader.GetString(1);
                if (columnName == "role") hasRoleColumn = true;
                if (columnName == "role_id") hasRoleIdColumn = true;
                if (columnName == "full_name") hasFullNameColumn = true;
                if (columnName == "must_change_password") hasMustChangePasswordColumn = true;
            }
        }

        // Add role_id column if it doesn't exist
        if (!hasRoleIdColumn)
        {
            logger.LogInformation("Adding role_id column to users table...");
            try
            {
                await context.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE users ADD COLUMN role_id INTEGER NOT NULL DEFAULT 1"
                );
                
                // Migrate old role values to role_id (old: 0-3, new: 1-4)
                if (hasRoleColumn)
                {
                    await context.Database.ExecuteSqlRawAsync(
                        "UPDATE users SET role_id = role + 1 WHERE role_id = 1"
                    );
                }
            }
            catch (Exception ex)
            {
                logger.LogDebug("Could not add role_id column: {Message}", ex.Message);
            }
        }

        // Add must_change_password column if it doesn't exist
        if (!hasMustChangePasswordColumn)
        {
            logger.LogInformation("Adding must_change_password column...");
            try
            {
                await context.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"
                );
            }
            catch (Exception ex)
            {
                logger.LogDebug("Could not add must_change_password column: {Message}", ex.Message);
            }
        }

        // Add full_name column if it doesn't exist
        if (!hasFullNameColumn)
        {
            logger.LogInformation("Adding full_name column...");
            try
            {
                await context.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE users ADD COLUMN full_name TEXT"
                );
                // Copy username to full_name for existing users
                await context.Database.ExecuteSqlRawAsync(
                    "UPDATE users SET full_name = username WHERE full_name IS NULL"
                );
            }
            catch (Exception ex)
            {
                logger.LogDebug("Could not add full_name column: {Message}", ex.Message);
            }
        }

        // Ensure admin user exists
        using var checkAdminCmd = connection.CreateCommand();
        checkAdminCmd.CommandText = "SELECT COUNT(*) FROM users WHERE username = 'admin'";
        var adminCount = Convert.ToInt32(await checkAdminCmd.ExecuteScalarAsync());
        
        if (adminCount == 0)
        {
            logger.LogInformation("Seeding admin user...");
            var adminHash = authService.HashPassword("admin123");
            await context.Database.ExecuteSqlRawAsync($@"
                INSERT INTO users (username, full_name, password_hash, role_id, is_active, must_change_password, created_date)
                VALUES ('admin', 'Administrador', '{adminHash}', 4, 1, 0, datetime('now'))
            ");
        }
        
        logger.LogInformation("Users and roles migration completed.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error during users/roles table migration");
    }
}
