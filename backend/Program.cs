using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Services;
using MusicasIgreja.Api.Services.Interfaces;
using Core.Auth.Extensions;
using Core.FileManagement.Extensions;
using Core.Infrastructure.Extensions;
using Core.Infrastructure.Events;

var builder = WebApplication.CreateBuilder(args);

// Database (PostgreSQL via Core.Infrastructure)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddCoreDatabase<AppDbContext>(connectionString);

// Core.Auth (session, RBAC, rate limiting)
builder.Services.AddCoreAuth(options =>
{
    options.CookieName = ".MusicasIgreja.Session";
    options.DefaultRoles = new()
    {
        ["viewer"]   = [Permissions.ViewMusic, Permissions.DownloadMusic],
        ["editor"]   = [Permissions.ViewMusic, Permissions.DownloadMusic, Permissions.EditMetadata, Permissions.ManageLists, Permissions.ManageCategories],
        ["uploader"] = [Permissions.ViewMusic, Permissions.DownloadMusic, Permissions.EditMetadata, Permissions.UploadMusic, Permissions.ManageLists, Permissions.ManageCategories],
        ["admin"]    = [Permissions.ViewMusic, Permissions.DownloadMusic, Permissions.EditMetadata, Permissions.UploadMusic, Permissions.DeleteMusic, Permissions.ManageLists, Permissions.ManageCategories, Permissions.ManageUsers, Permissions.ManageRoles, Permissions.AccessAdmin]
    };
});

// Core.FileManagement
builder.Services.AddCoreFileManagement(options =>
{
    options.StoragePath = builder.Configuration.GetValue<string>("Storage:OrganizedFolder") ?? "./organized";
    options.AllowedExtensions = [".pdf"];
    options.OrganizeByCategory = true;
});

// Real-time events (SSE)
builder.Services.AddCoreSse();

// Application services
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.AddScoped<IMusicService, MusicService>();
builder.Services.AddScoped<IListService, ListService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IArtistService, ArtistService>();
builder.Services.AddScoped<IWorkspaceService, WorkspaceService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<ICustomFilterService, CustomFilterService>();
builder.Services.AddScoped<IMigrationService, MigrationService>();
builder.Services.AddScoped<IMonitoringService, MonitoringService>();
builder.Services.AddScoped<IAlertConfigurationService, AlertConfigurationService>();

// Background services
builder.Services.AddHostedService<MetricsCollectorService>();

// Controllers (include Core.Auth assembly for CoreAuthController)
builder.Services.AddControllers()
    .AddApplicationPart(typeof(Core.Auth.Controllers.CoreAuthController).Assembly)
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower;
    });

// CORS
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

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Músicas Igreja API", Version = "v1" });
});

var app = builder.Build();

// Ensure database is created and seed auth roles
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var fileService = scope.ServiceProvider.GetRequiredService<IFileService>();
    var migrationService = scope.ServiceProvider.GetRequiredService<IMigrationService>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    await context.Database.EnsureCreatedAsync();
    await migrationService.RunMigrationsAsync();

    // Normalize file paths for cross-platform compatibility
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

// Seed default roles from Core.Auth configuration
await app.Services.SeedCoreAuthAsync();

// Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Músicas Igreja API v1"));
}

app.UseCors();
app.UseCoreAuth();
app.UseAuthorization();
app.MapControllers();

app.Run();
