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
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    // Create database if it doesn't exist
    if (!File.Exists(dbPath))
    {
        logger.LogInformation("Creating database at {DbPath}...", dbPath);
        context.Database.EnsureCreated();
    }
    
    // Run SQL migration scripts
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
app.UseAuthorization();
app.MapControllers();

app.Run();
