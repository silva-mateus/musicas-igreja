using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;

namespace MusicasIgreja.Api.Services;

public class FileService : IFileService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FileService> _logger;
    private readonly string _organizedFolder;

    public FileService(AppDbContext context, IConfiguration configuration, ILogger<FileService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
        _organizedFolder = configuration["Storage:OrganizedFolder"] 
            ?? Path.Combine(Directory.GetCurrentDirectory(), "organized");
        
        Directory.CreateDirectory(_organizedFolder);
    }

    public async Task<PdfFile> SaveFileAsync(IFormFile file, FileUploadDto metadata, int workspaceId, string workspaceSlug)
    {
        string fileHash;
        using (var stream = file.OpenReadStream())
        {
            fileHash = ComputeFileHash(stream);
        }

        var existingFile = await _context.PdfFiles.FirstOrDefaultAsync(f => f.FileHash == fileHash);
        if (existingFile != null)
        {
            throw new InvalidOperationException($"Arquivo duplicado encontrado: {existingFile.Filename}");
        }

        var categoryName = metadata.Categories?.FirstOrDefault() ?? "Diversos";
        var categoryFolder = Path.Combine(_organizedFolder, workspaceSlug, categoryName);
        Directory.CreateDirectory(categoryFolder);

        var filename = GenerateFilename(metadata.SongName, metadata.Artist, file.FileName, metadata.MusicalKey);
        var uniqueFilename = GetUniqueFilename(categoryFolder, filename);
        var filePath = Path.Combine(categoryFolder, uniqueFilename);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var pageCount = GetPdfPageCount(filePath);

        var pdfFile = new PdfFile
        {
            Filename = uniqueFilename,
            OriginalName = file.FileName,
            SongName = FormatTitleCase(metadata.SongName),
            MusicalKey = metadata.MusicalKey,
            YoutubeLink = metadata.YoutubeLink,
            FilePath = $"organized/{workspaceSlug}/{categoryName}/{uniqueFilename}",
            FileSize = file.Length,
            FileHash = fileHash,
            PageCount = pageCount,
            Description = metadata.Description,
            UploadDate = DateTime.UtcNow,
            WorkspaceId = workspaceId
        };

        _context.PdfFiles.Add(pdfFile);

        // Batch category and artist relationships before saving
        if (metadata.Categories != null)
        {
            foreach (var catName in metadata.Categories)
            {
                var category = await _context.Categories.FirstOrDefaultAsync(c => c.Name == catName && c.WorkspaceId == workspaceId);
                if (category == null)
                {
                    category = new Category { Name = catName, WorkspaceId = workspaceId };
                    _context.Categories.Add(category);
                }
                pdfFile.FileCategories.Add(new FileCategory { Category = category });
            }
        }

        if (!string.IsNullOrWhiteSpace(metadata.Artist))
        {
            var artistName = FormatTitleCase(metadata.Artist)!;
            var artist = await _context.Artists.FirstOrDefaultAsync(a => a.Name == artistName);
            if (artist == null)
            {
                artist = new Artist { Name = artistName };
                _context.Artists.Add(artist);
            }
            pdfFile.FileArtists.Add(new FileArtist { Artist = artist });
        }

        await _context.SaveChangesAsync();
        return pdfFile;
    }

    public void DeleteFile(string filePath)
    {
        var absolutePath = GetAbsolutePath(filePath);
        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
        }
    }

    /// <summary>
    /// Converts any path format to the standard relative format: organized/Category/filename.pdf
    /// This ensures consistency between Windows (dev) and Linux (production) environments.
    /// </summary>
    public string NormalizeToRelativePath(string path)
    {
        if (string.IsNullOrEmpty(path))
            return string.Empty;

        // Normalize separators to forward slash for consistency
        var normalizedPath = path.Replace('\\', '/');
        const string organizedMarker = "/organized/";

        // Handle absolute WSL paths (e.g., /mnt/c/Users/.../organized/Category/file.pdf)
        if (normalizedPath.StartsWith("/mnt/"))
        {
            var organizedIndex = normalizedPath.IndexOf(organizedMarker);
            if (organizedIndex >= 0)
            {
                var startIndex = organizedIndex + organizedMarker.Length;
                return "organized/" + normalizedPath.Substring(startIndex);
            }
        }

        // Handle absolute Windows paths (e.g., C:/Users/.../organized/Category/file.pdf)
        var windowsOrganizedIndex = normalizedPath.IndexOf(organizedMarker, StringComparison.OrdinalIgnoreCase);
        if (windowsOrganizedIndex >= 0 && normalizedPath.Length > 2 && normalizedPath[1] == ':')
        {
            var startIndex = windowsOrganizedIndex + organizedMarker.Length;
            return "organized/" + normalizedPath.Substring(startIndex);
        }

        // Handle absolute Linux paths (e.g., /app/organized/Category/file.pdf)
        if (normalizedPath.StartsWith("/") && normalizedPath.Contains(organizedMarker))
        {
            var idx = normalizedPath.IndexOf(organizedMarker);
            var startIndex = idx + organizedMarker.Length;
            return "organized/" + normalizedPath.Substring(startIndex);
        }

        // Handle paths starting with /organized/ - remove leading slash
        if (normalizedPath.StartsWith("/organized/"))
        {
            return normalizedPath.Substring(1); // Remove leading slash
        }

        // Already in correct format (organized/Category/file.pdf)
        if (normalizedPath.StartsWith("organized/"))
        {
            return normalizedPath;
        }

        // Unknown format - return as is (might be just Category/file.pdf or a directory name)
        // Only log as debug since this can happen for directory paths like "organized" or "data"
        if (!string.IsNullOrEmpty(path) && path.Contains('.'))
        {
            // Only warn if it looks like a file path (has extension)
            _logger.LogDebug("Non-standard path format, returning as-is: {Path}", path);
        }
        return path;
    }

    /// <summary>
    /// Converts a relative path (organized/Category/file.pdf) to an absolute path based on the current environment.
    /// Works on both Windows and Linux.
    /// </summary>
    public string GetAbsolutePath(string relativePath)
    {
        if (string.IsNullOrEmpty(relativePath))
            return string.Empty;

        // First normalize the path to ensure consistent format
        var normalizedPath = NormalizeToRelativePath(relativePath);

        // Now extract the sub-path (Category/filename.pdf)
        if (normalizedPath.StartsWith("organized/"))
        {
            var subPath = normalizedPath["organized/".Length..];
            // Use Path.Combine for proper OS-specific path construction
            var parts = subPath.Split('/');
            var absolutePath = _organizedFolder;
            foreach (var part in parts)
            {
                absolutePath = Path.Combine(absolutePath, part);
            }
            return absolutePath;
        }

        // Fallback: try to construct path anyway
        return Path.Combine(_organizedFolder, relativePath.Replace('/', Path.DirectorySeparatorChar));
    }

    public string GenerateFilename(string? songName, string? artist, string originalFilename, string? musicalKey)
    {
        var formattedSong = FormatTitleCase(songName) ?? "";
        var formattedArtist = FormatTitleCase(artist) ?? "";

        string filename;

        if (!string.IsNullOrEmpty(formattedSong) && !string.IsNullOrEmpty(formattedArtist))
        {
            filename = !string.IsNullOrEmpty(musicalKey)
                ? $"{SanitizeFilename(formattedSong)} - {musicalKey} - {SanitizeFilename(formattedArtist)}.pdf"
                : $"{SanitizeFilename(formattedSong)} - {SanitizeFilename(formattedArtist)}.pdf";
        }
        else if (!string.IsNullOrEmpty(formattedSong))
        {
            filename = !string.IsNullOrEmpty(musicalKey)
                ? $"{SanitizeFilename(formattedSong)} - {musicalKey}.pdf"
                : $"{SanitizeFilename(formattedSong)}.pdf";
        }
        else if (!string.IsNullOrEmpty(formattedArtist))
        {
            filename = $"{SanitizeFilename(formattedArtist)}.pdf";
        }
        else
        {
            filename = originalFilename;
        }

        return filename;
    }

    public string ComputeFileHash(Stream stream)
    {
        using var md5 = MD5.Create();
        var hashBytes = md5.ComputeHash(stream);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    public int GetPdfPageCount(string filePath)
    {
        try
        {
            // Simple approach: read PDF and count /Page objects
            var content = File.ReadAllText(filePath, Encoding.Latin1);
            var matches = Regex.Matches(content, @"/Type\s*/Page[^s]");
            return Math.Max(matches.Count, 1);
        }
        catch
        {
            return 1;
        }
    }

    private static string SanitizeFilename(string text)
    {
        if (string.IsNullOrEmpty(text))
            return string.Empty;

        // Remove invalid characters
        var sanitized = Regex.Replace(text, @"[<>:""/\\|?*]", "_");
        // Remove extra whitespace
        sanitized = Regex.Replace(sanitized, @"\s+", " ").Trim();
        return sanitized;
    }

    /// <summary>
    /// Format text in title case: first letter of each word capitalized,
    /// except for small words (articles and connectors) that are not the first word.
    /// This matches the Portuguese language conventions.
    /// </summary>
    private static string? FormatTitleCase(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        // List of words that should remain lowercase (except when first word)
        // Based on Portuguese articles, prepositions, and connectors
        var smallWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "a", "e", "o", "as", "os", "da", "de", "do", "das", "dos",
            "em", "na", "no", "nas", "nos", "com", "por", "para", "que",
            "se", "te", "me", "lhe", "la", "le", "lo", "um", "uma", "uns", "umas",
            "ao", "aos", "à", "às", "pelo", "pela", "pelos", "pelas",
            "sob", "sobre", "sem", "até", "mas"
        };

        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var formattedWords = new List<string>();

        for (int i = 0; i < words.Length; i++)
        {
            var word = words[i];
            if (string.IsNullOrWhiteSpace(word))
            {
                formattedWords.Add(word);
                continue;
            }

            // Extract clean word for comparison (remove special characters)
            var cleanWord = Regex.Replace(word, @"[^\w]", "").ToLower();

            // First word always capitalized
            // Words with more than 2 letters always capitalized
            // Small words (1-2 letters) only lowercase if not first and in the list
            if (i == 0 || cleanWord.Length > 2 || !smallWords.Contains(cleanWord))
            {
                // Title case: first letter uppercase, rest lowercase
                var formattedWord = char.ToUpper(word[0]) + (word.Length > 1 ? word[1..].ToLower() : "");
                formattedWords.Add(formattedWord);
            }
            else
            {
                formattedWords.Add(word.ToLower());
            }
        }

        return string.Join(" ", formattedWords);
    }

    public string GetUniqueFilename(string directory, string filename)
    {
        if (!File.Exists(Path.Combine(directory, filename)))
            return filename;

        var baseName = Path.GetFileNameWithoutExtension(filename);
        var extension = Path.GetExtension(filename);
        var counter = 1;

        while (true)
        {
            var newFilename = $"{baseName} ({counter}){extension}";
            if (!File.Exists(Path.Combine(directory, newFilename)))
                return newFilename;
            counter++;
        }
    }
}

