using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services.Caching;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Services;

public class MusicService : IMusicService
{
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ILogger<MusicService> _logger;
    private readonly ICacheService _cache;

    private static readonly TimeSpan ListTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan DetailTtl = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan GroupedTtl = TimeSpan.FromMinutes(5);

    public MusicService(AppDbContext context, IFileService fileService, ILogger<MusicService> logger, ICacheService cache)
    {
        _context = context;
        _fileService = fileService;
        _logger = logger;
        _cache = cache;
    }

    private static string MusicTag(int workspaceId) => $"music:{workspaceId}";

    private static string HashKey(params object?[] parts)
    {
        var json = JsonSerializer.Serialize(parts);
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(hash)[..12].ToLowerInvariant();
    }

    private async Task InvalidateMusicCacheAsync(int workspaceId, int? fileId = null)
    {
        await _cache.InvalidateTagAsync(MusicTag(workspaceId));
        await _cache.InvalidateTagAsync("music:any");  // global suggestions/artist autocomplete
        if (fileId.HasValue) await _cache.InvalidateAsync($"music:{fileId.Value}");
    }

    public async Task<FileListResponseDto> GetMusicsAsync(int workspaceId, string? query,
        List<string>? categorySlugs, Dictionary<string, List<string>>? customFilterSlugs,
        List<string>? artistSlugs, string? musicalKey,
        int page, int perPage, string? sortBy, string? sortOrder, bool? hasYoutube = null)
    {
        var keyHash = HashKey(workspaceId, query, categorySlugs, customFilterSlugs, artistSlugs, musicalKey, page, perPage, sortBy, sortOrder, hasYoutube);
        var cacheKey = $"search:{workspaceId}:{keyHash}";
        return (await _cache.GetOrSetAsync<FileListResponseDto>(cacheKey, ListTtl, async () =>
        {
            return (FileListResponseDto?)await GetMusicsCoreAsync(workspaceId, query, categorySlugs, customFilterSlugs, artistSlugs, musicalKey, page, perPage, sortBy, sortOrder, hasYoutube);
        }, MusicTag(workspaceId)))!;
    }

    private async Task<FileListResponseDto> GetMusicsCoreAsync(int workspaceId, string? query,
        List<string>? categorySlugs, Dictionary<string, List<string>>? customFilterSlugs,
        List<string>? artistSlugs, string? musicalKey,
        int page, int perPage, string? sortBy, string? sortOrder, bool? hasYoutube)
    {
        var q = _context.PdfFiles
            .AsNoTracking()
            .Where(f => f.WorkspaceId == workspaceId)
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileCustomFilters).ThenInclude(fcf => fcf.FilterValue).ThenInclude(v => v.FilterGroup)
            .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var pattern = $"%{query}%";
            q = q.Where(f =>
                (f.SongName != null && EF.Functions.ILike(AppDbContext.Unaccent(f.SongName), AppDbContext.Unaccent(pattern))) ||
                (f.Filename != null && EF.Functions.ILike(AppDbContext.Unaccent(f.Filename), AppDbContext.Unaccent(pattern))) ||
                f.FileArtists.Any(fa => fa.Artist.Name != null && EF.Functions.ILike(AppDbContext.Unaccent(fa.Artist.Name), AppDbContext.Unaccent(pattern))));
        }

        if (categorySlugs is { Count: > 0 })
        {
            var catIds = await _context.Categories
                .Where(c => c.WorkspaceId == workspaceId && categorySlugs.Contains(c.Slug))
                .Select(c => c.Id).ToListAsync();
            if (catIds.Count > 0)
                q = q.Where(f => f.FileCategories.Any(fc => catIds.Contains(fc.CategoryId)));
        }

        if (customFilterSlugs is { Count: > 0 })
        {
            foreach (var (groupSlug, valueSlugs) in customFilterSlugs)
            {
                if (valueSlugs.Count == 0) continue;
                var valueIds = await _context.CustomFilterValues
                    .Where(v => v.FilterGroup.WorkspaceId == workspaceId
                        && v.FilterGroup.Slug == groupSlug
                        && valueSlugs.Contains(v.Slug))
                    .Select(v => v.Id)
                    .ToListAsync();
                if (valueIds.Count > 0)
                    q = q.Where(f => f.FileCustomFilters.Any(fcf => valueIds.Contains(fcf.FilterValueId)));
            }
        }

        if (artistSlugs is { Count: > 0 })
        {
            var artistIds = await _context.Artists
                .Where(a => artistSlugs.Contains(a.Slug))
                .Select(a => a.Id).ToListAsync();
            if (artistIds.Count > 0)
                q = q.Where(f => f.FileArtists.Any(fa => artistIds.Contains(fa.ArtistId)));
        }

        if (!string.IsNullOrWhiteSpace(musicalKey))
            q = q.Where(f => f.MusicalKey == musicalKey);

        if (hasYoutube == true)
            q = q.Where(f => f.YoutubeLink != null && f.YoutubeLink != "");
        else if (hasYoutube == false)
            q = q.Where(f => f.YoutubeLink == null || f.YoutubeLink == "");

        var total = await q.CountAsync();
        var totalPages = (int)Math.Ceiling(total / (double)perPage);

        q = (sortBy?.ToLower(), sortOrder?.ToLower()) switch
        {
            ("song_name", "asc") => q.OrderBy(f => f.SongName),
            ("song_name", "desc") => q.OrderByDescending(f => f.SongName),
            ("artist", "asc") => q.OrderBy(f => f.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault()),
            ("artist", "desc") => q.OrderByDescending(f => f.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault()),
            ("category", "asc") => q.OrderBy(f => f.FileCategories.Select(fc => fc.Category.Name).FirstOrDefault()),
            ("category", "desc") => q.OrderByDescending(f => f.FileCategories.Select(fc => fc.Category.Name).FirstOrDefault()),
            ("upload_date", "asc") => q.OrderBy(f => f.UploadDate),
            _ => q.OrderByDescending(f => f.UploadDate)
        };

        var files = await q.Skip((page - 1) * perPage).Take(perPage).ToListAsync();
        var dtos = files.Select(MapToFileDto).ToList();
        return new FileListResponseDto(dtos, new PaginationDto(page, perPage, total, totalPages));
    }

    public async Task<FileDto?> GetMusicByIdAsync(int id)
    {
        return await _cache.GetOrSetAsync<FileDto>($"music:{id}", DetailTtl, async () =>
        {
            var file = await _context.PdfFiles
                .AsNoTracking()
                .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
                .Include(f => f.FileCustomFilters).ThenInclude(fcf => fcf.FilterValue).ThenInclude(v => v.FilterGroup)
                .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
                .FirstOrDefaultAsync(f => f.Id == id);
            return file != null ? MapToFileDto(file) : null;
        });
    }

    public async Task<PdfFile?> GetFileRecordByIdAsync(int id)
    {
        return await _context.PdfFiles.FirstOrDefaultAsync(f => f.Id == id);
    }

    public async Task<PdfFile> UploadMusicAsync(int workspaceId, IFormFile file, FileUploadDto metadata)
    {
        string fileHash;
        using (var stream = file.OpenReadStream())
            fileHash = _fileService.ComputeFileHash(stream);

        var existing = await _context.PdfFiles.FirstOrDefaultAsync(f => f.FileHash == fileHash);
        if (existing != null)
            throw new InvalidOperationException($"Arquivo duplicado encontrado: {existing.Filename}");

        var workspace = await _context.Workspaces.FindAsync(workspaceId)
            ?? throw new InvalidOperationException("Workspace não encontrado");

        var categoryName = metadata.Categories?.FirstOrDefault() ?? "Diversos";
        var categoryFolder = _fileService.GetAbsolutePath($"organized/{workspace.Slug}/{categoryName}");
        Directory.CreateDirectory(categoryFolder);

        var filename = _fileService.GenerateFilename(metadata.SongName, metadata.Artist, file.FileName, metadata.MusicalKey);
        var uniqueFilename = _fileService.GetUniqueFilename(categoryFolder, filename);
        var fullPath = Path.Combine(categoryFolder, uniqueFilename);

        using (var stream = new FileStream(fullPath, FileMode.Create))
            await file.CopyToAsync(stream);

        var pageCount = _fileService.GetPdfPageCount(fullPath);
        var pdfFile = new PdfFile
        {
            Filename = uniqueFilename,
            OriginalName = file.FileName,
            SongName = metadata.SongName,
            MusicalKey = metadata.MusicalKey,
            YoutubeLink = metadata.YoutubeLink,
            FilePath = _fileService.NormalizeToRelativePath(fullPath),
            FileSize = file.Length,
            FileHash = fileHash,
            PageCount = pageCount,
            Description = metadata.Description,
            UploadDate = DateTime.UtcNow,
            WorkspaceId = workspaceId
        };

        _context.PdfFiles.Add(pdfFile);
        await _context.SaveChangesAsync();

        var categories = await ResolveCategoriesAsync(workspaceId, metadata.Categories);
        var artist = await ResolveArtistAsync(metadata.Artist);

        foreach (var c in categories)
            _context.FileCategories.Add(new FileCategory { FileId = pdfFile.Id, CategoryId = c.Id });
        if (artist != null)
            _context.FileArtists.Add(new FileArtist { FileId = pdfFile.Id, ArtistId = artist.Id });

        await ResolveAndSaveCustomFiltersAsync(workspaceId, pdfFile.Id, metadata.CustomFilters);

        await _context.SaveChangesAsync();
        await InvalidateMusicCacheAsync(workspaceId, pdfFile.Id);
        return pdfFile;
    }

    public async Task<bool> UpdateMusicAsync(int id, FileUpdateDto dto)
    {
        var file = await _context.PdfFiles
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileCustomFilters)
            .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
            .FirstOrDefaultAsync(f => f.Id == id);
        if (file == null) return false;

        if (dto.SongName != null) file.SongName = dto.SongName;
        if (dto.MusicalKey != null) file.MusicalKey = dto.MusicalKey;
        if (dto.YoutubeLink != null) file.YoutubeLink = dto.YoutubeLink;
        if (dto.Description != null) file.Description = dto.Description;

        if (dto.Categories != null)
        {
            _context.FileCategories.RemoveRange(file.FileCategories);
            var categories = await ResolveCategoriesAsync(file.WorkspaceId, dto.Categories);
            foreach (var c in categories)
                _context.FileCategories.Add(new FileCategory { FileId = file.Id, CategoryId = c.Id });
        }

        if (dto.CustomFilters != null)
        {
            _context.FileCustomFilters.RemoveRange(file.FileCustomFilters);
            await ResolveAndSaveCustomFiltersAsync(file.WorkspaceId, file.Id, dto.CustomFilters);
        }

        if (dto.Artist != null)
        {
            _context.FileArtists.RemoveRange(file.FileArtists);
            var artist = await ResolveArtistAsync(dto.Artist);
            if (artist != null)
                _context.FileArtists.Add(new FileArtist { FileId = file.Id, ArtistId = artist.Id });
        }

        var categoryName = dto.Categories?.FirstOrDefault()
            ?? file.FileCategories.Select(fc => fc.Category.Name).FirstOrDefault() ?? "Diversos";
        var workspace = await _context.Workspaces.FindAsync(file.WorkspaceId);
        var wsSlug = workspace?.Slug ?? "igreja";
        var oldPath = _fileService.GetAbsolutePath(file.FilePath);
        var newFilename = _fileService.GenerateFilename(file.SongName,
            file.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault(), file.OriginalName, file.MusicalKey);
        var newCategoryFolder = _fileService.GetAbsolutePath($"organized/{wsSlug}/{categoryName}");
        Directory.CreateDirectory(newCategoryFolder);
        var uniqueFilename = _fileService.GetUniqueFilename(newCategoryFolder, newFilename);
        var newFullPath = Path.Combine(newCategoryFolder, uniqueFilename);

        if (File.Exists(oldPath) && oldPath != newFullPath)
        {
            File.Move(oldPath, newFullPath);
            file.Filename = uniqueFilename;
            file.FilePath = _fileService.NormalizeToRelativePath(newFullPath);
        }

        await _context.SaveChangesAsync();
        await InvalidateMusicCacheAsync(file.WorkspaceId, file.Id);
        return true;
    }

    public async Task<PdfFile> ReplacePdfAsync(int id, IFormFile replacementPdf)
    {
        var file = await _context.PdfFiles.FindAsync(id)
            ?? throw new KeyNotFoundException("Arquivo não encontrado");

        string newHash;
        using (var stream = replacementPdf.OpenReadStream())
        {
            newHash = _fileService.ComputeFileHash(stream);
        }

        var duplicate = await _context.PdfFiles.FirstOrDefaultAsync(f => f.FileHash == newHash && f.Id != id);
        if (duplicate != null)
            throw new InvalidOperationException($"O PDF enviado é duplicado de: {duplicate.Filename}");

        var currentPath = _fileService.GetAbsolutePath(file.FilePath);

        if (File.Exists(currentPath))
            File.Delete(currentPath);

        using (var stream = new FileStream(currentPath, FileMode.Create))
        {
            await replacementPdf.CopyToAsync(stream);
        }

        file.FileSize = replacementPdf.Length;
        file.OriginalName = replacementPdf.FileName;
        file.FileHash = newHash;
        file.PageCount = _fileService.GetPdfPageCount(currentPath);

        await _context.SaveChangesAsync();
        await InvalidateMusicCacheAsync(file.WorkspaceId, file.Id);
        return file;
    }

    public async Task<bool> DeleteMusicAsync(int id)
    {
        var file = await _context.PdfFiles.FindAsync(id);
        if (file == null) return false;
        var wsId = file.WorkspaceId;
        _fileService.DeleteFile(file.FilePath);
        _context.PdfFiles.Remove(file);
        await _context.SaveChangesAsync();
        await InvalidateMusicCacheAsync(wsId, id);
        return true;
    }

    public async Task<List<GroupedFilesDto>> GetGroupedByArtistAsync(int workspaceId) =>
        (await _cache.GetOrSetAsync<List<GroupedFilesDto>>(
            $"grouped:artist:{workspaceId}", GroupedTtl,
            async () => (List<GroupedFilesDto>?)await GetGroupedAsync(workspaceId, f => f.FileArtists.Any(),
                f => f.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault() ?? "Sem Artista"),
            MusicTag(workspaceId))) ?? new();

    public async Task<List<GroupedFilesDto>> GetGroupedByCategoryAsync(int workspaceId) =>
        (await _cache.GetOrSetAsync<List<GroupedFilesDto>>(
            $"grouped:category:{workspaceId}", GroupedTtl,
            async () => (List<GroupedFilesDto>?)await GetGroupedAsync(workspaceId, _ => true,
                f => f.FileCategories.Select(fc => fc.Category.Name).FirstOrDefault() ?? "Diversos"),
            MusicTag(workspaceId))) ?? new();

    public async Task<List<GroupedFilesDto>> GetGroupedByCustomFilterAsync(int workspaceId, string groupSlug)
    {
        return (await _cache.GetOrSetAsync<List<GroupedFilesDto>>(
            $"grouped:cf:{workspaceId}:{groupSlug}", GroupedTtl,
            async () => (List<GroupedFilesDto>?)await GetGroupedByCustomFilterCoreAsync(workspaceId, groupSlug),
            MusicTag(workspaceId))) ?? new();
    }

    private async Task<List<GroupedFilesDto>> GetGroupedByCustomFilterCoreAsync(int workspaceId, string groupSlug)
    {
        var files = await _context.PdfFiles
            .AsNoTracking()
            .Where(f => f.WorkspaceId == workspaceId
                && f.FileCustomFilters.Any(fcf => fcf.FilterValue.FilterGroup.Slug == groupSlug))
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileCustomFilters).ThenInclude(fcf => fcf.FilterValue).ThenInclude(v => v.FilterGroup)
            .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
            .ToListAsync();

        return files
            .Where(f => f.FileCustomFilters.Any(fcf => fcf.FilterValue.FilterGroup.Slug == groupSlug))
            .GroupBy(f => f.FileCustomFilters
                .Where(fcf => fcf.FilterValue.FilterGroup.Slug == groupSlug)
                .Select(fcf => fcf.FilterValue.Name)
                .FirstOrDefault() ?? "Sem valor")
            .OrderBy(g => g.Key)
            .Select(g => new GroupedFilesDto(g.Key, g.Count(), g.Select(MapToGroupedItem).ToList()))
            .ToList();
    }

    private async Task<List<GroupedFilesDto>> GetGroupedAsync(int workspaceId,
        Func<PdfFile, bool> filter, Func<PdfFile, string> groupKey)
    {
        var files = await _context.PdfFiles
            .AsNoTracking()
            .Where(f => f.WorkspaceId == workspaceId)
            .Include(f => f.FileCategories).ThenInclude(fc => fc.Category)
            .Include(f => f.FileCustomFilters).ThenInclude(fcf => fcf.FilterValue).ThenInclude(v => v.FilterGroup)
            .Include(f => f.FileArtists).ThenInclude(fa => fa.Artist)
            .ToListAsync();
        return files.Where(filter).GroupBy(groupKey).OrderBy(g => g.Key)
            .Select(g => new GroupedFilesDto(g.Key, g.Count(), g.Select(MapToGroupedItem).ToList())).ToList();
    }

    private static FileDto MapToFileDto(PdfFile f) => new(
        f.Id, f.Filename, f.OriginalName, f.SongName,
        f.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault(),
        f.FileCategories.Select(fc => fc.Category.Name).ToList(),
        MapCustomFilters(f),
        f.MusicalKey, f.YoutubeLink, f.FileSize, f.PageCount, f.UploadDate, f.Description,
        f.ContentType, f.ChordContent, f.ChordContentDraft, f.OcrStatus, f.OcrError);

    private static GroupedFileItemDto MapToGroupedItem(PdfFile f) => new(
        f.Id, f.Filename, f.SongName,
        f.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault(),
        f.MusicalKey,
        f.FileCategories.Select(fc => fc.Category.Name).ToList(),
        MapCustomFilters(f),
        f.YoutubeLink, f.ContentType);

    private static Dictionary<string, FileCustomFilterGroupDto> MapCustomFilters(PdfFile f)
    {
        return f.FileCustomFilters
            .GroupBy(fcf => fcf.FilterValue.FilterGroup.Slug)
            .ToDictionary(
                g => g.Key,
                g => new FileCustomFilterGroupDto
                {
                    GroupName = g.First().FilterValue.FilterGroup.Name,
                    Values = g.Select(fcf => fcf.FilterValue.Name).Distinct().OrderBy(n => n).ToList()
                });
    }

    private async Task<List<Category>> ResolveCategoriesAsync(int workspaceId, List<string>? names)
    {
        if (names == null || names.Count == 0) return new List<Category>();
        var distinct = names.Distinct().ToList();
        var existing = await _context.Categories
            .Where(c => c.WorkspaceId == workspaceId && distinct.Contains(c.Name)).ToListAsync();
        var result = distinct.Select(n =>
            existing.FirstOrDefault(e => e.Name == n) ?? new Category { Name = n, WorkspaceId = workspaceId }
        ).ToList();
        foreach (var c in result.Where(c => c.Id == 0)) _context.Categories.Add(c);
        if (result.Any(c => c.Id == 0)) await _context.SaveChangesAsync();
        return result;
    }

    private async Task ResolveAndSaveCustomFiltersAsync(int workspaceId, int fileId,
        Dictionary<string, List<string>>? customFilters)
    {
        if (customFilters == null || customFilters.Count == 0) return;

        foreach (var (groupSlug, valueNames) in customFilters)
        {
            if (valueNames.Count == 0) continue;

            var group = await _context.CustomFilterGroups
                .FirstOrDefaultAsync(g => g.WorkspaceId == workspaceId && g.Slug == groupSlug);
            if (group == null)
            {
                _logger.LogWarning("Custom filter group not found: slug={Slug}, workspaceId={WorkspaceId}", groupSlug, workspaceId);
                continue;
            }

            var distinctNames = valueNames.Distinct().ToList();
            var existingValues = await _context.CustomFilterValues
                .Where(v => v.FilterGroupId == group.Id && distinctNames.Contains(v.Name))
                .ToListAsync();

            foreach (var name in distinctNames)
            {
                var value = existingValues.FirstOrDefault(v => v.Name == name);
                if (value == null)
                {
                    value = new CustomFilterValue { FilterGroupId = group.Id, Name = name.Trim() };
                    _context.CustomFilterValues.Add(value);
                    await _context.SaveChangesAsync();
                }
                _context.FileCustomFilters.Add(new FileCustomFilter { FileId = fileId, FilterValueId = value.Id });
            }
        }
    }

    private async Task<Artist?> ResolveArtistAsync(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var artist = await _context.Artists.FirstOrDefaultAsync(a => a.Name == name);
        if (artist == null)
        {
            artist = new Artist { Name = name };
            _context.Artists.Add(artist);
            await _context.SaveChangesAsync();
        }
        return artist;
    }

    public async Task<PdfFile> CreateChordSongAsync(int workspaceId, CreateChordSongDto dto)
    {
        var pdfFile = new PdfFile
        {
            SongName = dto.SongName,
            MusicalKey = dto.MusicalKey ?? "C",
            YoutubeLink = dto.YoutubeLink,
            Description = dto.Description,
            ContentType = "chord",
            ChordContent = dto.ChordContent,
            UploadDate = DateTime.UtcNow,
            WorkspaceId = workspaceId
        };

        _context.PdfFiles.Add(pdfFile);
        await _context.SaveChangesAsync();

        var categories = await ResolveCategoriesAsync(workspaceId, dto.Categories);
        var artist = await ResolveArtistAsync(dto.Artist);

        foreach (var c in categories)
            _context.FileCategories.Add(new FileCategory { FileId = pdfFile.Id, CategoryId = c.Id });
        if (artist != null)
            _context.FileArtists.Add(new FileArtist { FileId = pdfFile.Id, ArtistId = artist.Id });

        await ResolveAndSaveCustomFiltersAsync(workspaceId, pdfFile.Id, dto.CustomFilters);
        await _context.SaveChangesAsync();
        await InvalidateMusicCacheAsync(workspaceId, pdfFile.Id);
        return pdfFile;
    }

    public async Task<bool> UpdateChordContentAsync(int id, UpdateChordContentDto dto)
    {
        var file = await _context.PdfFiles
            .Include(f => f.FileArtists)
            .FirstOrDefaultAsync(f => f.Id == id);
            
        if (file == null) return false;

        file.ChordContent = dto.ChordContent;
        file.ChordContentDraft = null;
        if (file.ContentType != "chord")
            file.ContentType = "chord";
        if (dto.MusicalKey != null)
            file.MusicalKey = dto.MusicalKey;
            
        if (dto.SongName != null)
            file.SongName = dto.SongName;
            
        if (dto.Artist != null)
        {
            _context.FileArtists.RemoveRange(file.FileArtists);
            var artist = await ResolveArtistAsync(dto.Artist);
            if (artist != null)
                _context.FileArtists.Add(new FileArtist { FileId = file.Id, ArtistId = artist.Id });
        }

        await _context.SaveChangesAsync();
        await InvalidateMusicCacheAsync(file.WorkspaceId, file.Id);
        return true;
    }

    public async Task<bool> DiscardChordDraftAsync(int id)
    {
        var file = await _context.PdfFiles.FirstOrDefaultAsync(f => f.Id == id);
        if (file == null) return false;

        file.ChordContentDraft = null;
        if (file.OcrStatus is "done" or "done_low_confidence" or "failed")
        {
            file.OcrStatus = null;
            file.OcrError = null;
        }

        await _context.SaveChangesAsync();
        await InvalidateMusicCacheAsync(file.WorkspaceId, file.Id);
        return true;
    }

    public async Task<UserSongPreferenceDto?> GetUserPreferenceAsync(int fileId, string userId)
    {
        var pref = await _context.UserSongPreferences
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.PdfFileId == fileId && p.UserId == userId);

        if (pref == null) return null;

        return new UserSongPreferenceDto(pref.TransposeAmount, pref.CapoFret, pref.ArrangementJson);
    }

    public async Task<bool> UpdateUserPreferenceAsync(int fileId, string userId, UpdateUserSongPreferenceDto dto)
    {
        var fileExists = await _context.PdfFiles.AnyAsync(f => f.Id == fileId);
        if (!fileExists) return false;

        var pref = await _context.UserSongPreferences
            .FirstOrDefaultAsync(p => p.PdfFileId == fileId && p.UserId == userId);

        if (pref == null)
        {
            pref = new UserSongPreference
            {
                PdfFileId = fileId,
                UserId = userId,
                TransposeAmount = dto.TransposeAmount,
                CapoFret = dto.CapoFret,
                ArrangementJson = dto.ArrangementJson
            };
            _context.UserSongPreferences.Add(pref);
        }
        else
        {
            pref.TransposeAmount = dto.TransposeAmount;
            pref.CapoFret = dto.CapoFret;
            pref.ArrangementJson = dto.ArrangementJson;
            pref.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<PdfFile>> GetPdfOnlyFilesAsync(int workspaceId, int[]? ids)
    {
        var q = _context.PdfFiles
            .AsNoTracking()
            .Where(f => f.WorkspaceId == workspaceId && f.ContentType == "pdf_only" && f.FilePath != null);

        if (ids is { Length: > 0 })
            q = q.Where(f => ids.Contains(f.Id));

        return await q.ToListAsync();
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
