using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Services;
using MusicasIgreja.Api.Services.Auth;
using MusicasIgreja.Api.Services.Caching;
using MusicasIgreja.Api.Services.Events;
using MusicasIgreja.Api.Services.Interfaces;
using Core.Auth.Services;
using System.Threading.Channels;
using Core.Auth.Extensions;
using Core.Auth.Models;
using Core.FileManagement.Extensions;
using Core.Infrastructure.Extensions;
using Core.Infrastructure.Events;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Database (PostgreSQL via Core.Infrastructure)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddCoreDatabase<AppDbContext>(connectionString);

// Core.Auth (session, RBAC, rate limiting)
// Registers AddDistributedMemoryCache internally; the Redis block below overrides
// IDistributedCache (last registration wins) when Redis is configured.
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

// Redis cache (optional). Empty/missing connection string → NullCacheService + memory IDistributedCache.
// When configured, AddStackExchangeRedisCache overrides AddDistributedMemoryCache from AddCoreAuth,
// so sessions transparently move to Redis.
var redisConn = builder.Configuration.GetConnectionString("Redis");
if (!string.IsNullOrWhiteSpace(redisConn))
{
    try
    {
        var mux = ConnectionMultiplexer.Connect(redisConn);
        builder.Services.AddSingleton<IConnectionMultiplexer>(mux);
        builder.Services.AddSingleton<ICacheService, RedisCacheService>();
        builder.Services.AddStackExchangeRedisCache(o =>
        {
            o.Configuration = redisConn;
            o.InstanceName = builder.Configuration["Cache:InstanceName"] ?? "musicas:";
        });
        // Override Core.Auth's in-memory rate limiter with the Redis-backed variant.
        // Last registration wins for IRateLimitService.
        builder.Services.AddSingleton<IRateLimitService, RedisRateLimitService>();
        // Multi-instance SSE fanout via Redis pub/sub.
        builder.Services.AddSingleton<Core.Infrastructure.Events.ISseService, RedisSseService>();
        Console.WriteLine($"[Redis] Connected to {redisConn}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Redis] Connection failed ({ex.Message}); using in-memory fallback");
        builder.Services.AddSingleton<ICacheService, NullCacheService>();
    }
}
else
{
    builder.Services.AddSingleton<ICacheService, NullCacheService>();
}

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
builder.Services.AddScoped<IChordPdfRenderer, ChordPdfRenderer>();

// OCR Channel (singleton for background service)
var ocrChannel = System.Threading.Channels.Channel.CreateUnbounded<OcrJob>();
builder.Services.AddSingleton(ocrChannel.Writer);
builder.Services.AddSingleton(ocrChannel.Reader);

// Background services
builder.Services.AddHostedService<MetricsCollectorService>();
builder.Services.AddHostedService<OcrBackgroundService>();

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

// Seed default admin user if no users exist
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    if (!await context.Set<CoreUser>().AnyAsync())
    {
        var adminRole = await context.Set<CoreRole>()
            .FirstOrDefaultAsync(r => r.Name == "admin");

        if (adminRole is not null)
        {
            context.Set<CoreUser>().Add(new CoreUser
            {
                Username = "admin",
                FullName = "Administrador",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123", 12),
                RoleId = adminRole.Id,
                MustChangePassword = false,
                IsActive = true
            });
            await context.SaveChangesAsync();
            logger.LogInformation("Default admin user 'admin' seeded.");
        }
    }
}

// Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Músicas Igreja API v1"));
}

app.UseCoreExceptionHandler();
app.UseCors();
app.UseCoreAuth();
app.UseCoreSecurityHeaders();
app.UseAuthorization();
app.MapControllers();

app.Run();
