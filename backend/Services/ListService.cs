using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services.Interfaces;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;

namespace MusicasIgreja.Api.Services;

public class ListService : IListService
{
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ILogger<ListService> _logger;

    public ListService(AppDbContext context, IFileService fileService, ILogger<ListService> logger)
    {
        _context = context;
        _fileService = fileService;
        _logger = logger;
    }

    public async Task<List<MergeListSummaryDto>> GetListsAsync(int workspaceId, string? search, string? sortBy, string? sortOrder)
    {
        var query = _context.MergeLists
            .Where(l => l.WorkspaceId == workspaceId)
            .Include(l => l.Items)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(l => l.Name.Contains(search));

        query = (sortBy?.ToLower(), sortOrder?.ToLower()) switch
        {
            ("name", "asc") => query.OrderBy(l => l.Name),
            ("name", "desc") => query.OrderByDescending(l => l.Name),
            ("created_date", "asc") => query.OrderBy(l => l.CreatedDate),
            ("created_date", "desc") => query.OrderByDescending(l => l.CreatedDate),
            ("file_count", "asc") => query.OrderBy(l => l.Items.Count),
            ("file_count", "desc") => query.OrderByDescending(l => l.Items.Count),
            ("updated_date", "asc") => query.OrderBy(l => l.UpdatedDate),
            _ => query.OrderByDescending(l => l.UpdatedDate)
        };

        return await query.Select(l => new MergeListSummaryDto(
            l.Id, l.Name, l.Observations, l.CreatedDate, l.UpdatedDate, l.Items.Count
        )).ToListAsync();
    }

    public async Task<MergeListDetailDto?> GetListByIdAsync(int id)
    {
        var list = await _context.MergeLists
            .Include(l => l.Items).ThenInclude(i => i.PdfFile).ThenInclude(p => p.FileCategories).ThenInclude(fc => fc.Category)
            .Include(l => l.Items).ThenInclude(i => i.PdfFile).ThenInclude(p => p.FileCustomFilters).ThenInclude(fcf => fcf.FilterValue).ThenInclude(v => v.FilterGroup)
            .Include(l => l.Items).ThenInclude(i => i.PdfFile).ThenInclude(p => p.FileArtists).ThenInclude(fa => fa.Artist)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (list == null) return null;

        return new MergeListDetailDto(
            list.Id, list.Name, list.Observations, list.CreatedDate, list.UpdatedDate,
            list.Items.OrderBy(i => i.OrderPosition).Select(i => new MergeListItemDto(
                i.Id, i.OrderPosition,
                new MergeListFileDto(
                    i.PdfFile.Id, i.PdfFile.Filename, i.PdfFile.SongName,
                    i.PdfFile.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault(),
                    i.PdfFile.FileCategories.Select(fc => fc.Category.Name).FirstOrDefault(),
                    i.PdfFile.FileCustomFilters
                        .GroupBy(fcf => fcf.FilterValue.FilterGroup)
                        .ToDictionary(g => g.Key.Slug, g => g.Select(fcf => fcf.FilterValue.Name).ToList()),
                    i.PdfFile.MusicalKey, i.PdfFile.YoutubeLink
                )
            )).ToList()
        );
    }

    public async Task<int> CreateListAsync(int workspaceId, CreateMergeListDto dto)
    {
        var list = new MergeList { Name = dto.Name, Observations = dto.Observations, WorkspaceId = workspaceId };
        _context.MergeLists.Add(list);
        await _context.SaveChangesAsync();

        if (dto.FileIds is { Count: > 0 })
        {
            var validFileIds = await _context.PdfFiles
                .Where(f => dto.FileIds.Contains(f.Id) && f.WorkspaceId == workspaceId)
                .Select(f => f.Id)
                .ToListAsync();

            for (int i = 0; i < validFileIds.Count; i++)
            {
                _context.MergeListItems.Add(new MergeListItem
                {
                    MergeListId = list.Id, PdfFileId = validFileIds[i], OrderPosition = i
                });
            }
            await _context.SaveChangesAsync();
        }

        return list.Id;
    }

    public async Task<bool> UpdateListAsync(int id, UpdateMergeListDto dto)
    {
        var list = await _context.MergeLists.FindAsync(id);
        if (list == null) return false;

        if (dto.Name != null) list.Name = dto.Name;
        if (dto.Observations != null) list.Observations = dto.Observations;
        list.UpdatedDate = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteListAsync(int id)
    {
        var list = await _context.MergeLists.FindAsync(id);
        if (list == null) return false;

        _context.MergeLists.Remove(list);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<int>> AddItemsAsync(int id, List<int> fileIds)
    {
        var list = await _context.MergeLists.Include(l => l.Items).FirstOrDefaultAsync(l => l.Id == id);
        if (list == null) return new List<int>();

        var validFileIds = await _context.PdfFiles
            .Where(f => fileIds.Contains(f.Id) && f.WorkspaceId == list.WorkspaceId)
            .Select(f => f.Id)
            .ToListAsync();

        var maxPos = list.Items.Any() ? list.Items.Max(i => i.OrderPosition) : -1;
        var newItemIds = new List<int>();

        foreach (var fileId in validFileIds)
        {
            var item = new MergeListItem { MergeListId = id, PdfFileId = fileId, OrderPosition = ++maxPos };
            _context.MergeListItems.Add(item);
            newItemIds.Add(item.Id);
        }

        list.UpdatedDate = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return newItemIds;
    }

    public async Task<bool> ReorderItemsAsync(int id, List<int> itemOrder)
    {
        var list = await _context.MergeLists.Include(l => l.Items).FirstOrDefaultAsync(l => l.Id == id);
        if (list == null) return false;

        for (int i = 0; i < itemOrder.Count; i++)
        {
            var item = list.Items.FirstOrDefault(it => it.Id == itemOrder[i]);
            if (item != null) item.OrderPosition = i;
        }

        list.UpdatedDate = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<int> DuplicateListAsync(int id, string? newName)
    {
        var original = await _context.MergeLists.Include(l => l.Items).FirstOrDefaultAsync(l => l.Id == id);
        if (original == null) return -1;

        var newList = new MergeList
        {
            Name = newName ?? $"{original.Name} (cópia)",
            Observations = original.Observations,
            WorkspaceId = original.WorkspaceId
        };
        _context.MergeLists.Add(newList);
        await _context.SaveChangesAsync();

        foreach (var item in original.Items.OrderBy(i => i.OrderPosition))
        {
            _context.MergeListItems.Add(new MergeListItem
            {
                MergeListId = newList.Id, PdfFileId = item.PdfFileId, OrderPosition = item.OrderPosition
            });
        }
        await _context.SaveChangesAsync();
        return newList.Id;
    }

    public async Task<string?> GenerateReportAsync(int id)
    {
        var list = await _context.MergeLists
            .Include(l => l.Items).ThenInclude(i => i.PdfFile).ThenInclude(p => p.FileArtists).ThenInclude(fa => fa.Artist)
            .FirstOrDefaultAsync(l => l.Id == id);
        if (list == null || !list.Items.Any()) return null;

        var lines = list.Items.OrderBy(i => i.OrderPosition).Select(item =>
        {
            var parts = new List<string>();
            parts.Add(!string.IsNullOrEmpty(item.PdfFile.SongName)
                ? item.PdfFile.SongName
                : item.PdfFile.Filename?.Replace(".pdf", "") ?? "Sem título");

            var artist = item.PdfFile.FileArtists.Select(fa => fa.Artist.Name).FirstOrDefault();
            if (!string.IsNullOrEmpty(artist)) parts.Add(artist);
            if (!string.IsNullOrEmpty(item.PdfFile.YoutubeLink)) parts.Add(item.PdfFile.YoutubeLink);

            return string.Join(" - ", parts);
        });

        return string.Join("\n", lines);
    }

    public async Task<(Stream? Stream, string? ListName)> ExportListAsync(int id)
    {
        var list = await _context.MergeLists
            .Include(l => l.Items).ThenInclude(i => i.PdfFile)
            .FirstOrDefaultAsync(l => l.Id == id);
        if (list == null || !list.Items.Any()) return (null, null);

        var orderedItems = list.Items.OrderBy(i => i.OrderPosition).ToList();
        var filePaths = new List<string>();
        foreach (var item in orderedItems)
        {
            var absPath = _fileService.GetAbsolutePath(item.PdfFile.FilePath);
            if (System.IO.File.Exists(absPath)) filePaths.Add(absPath);
        }
        if (filePaths.Count == 0) return (null, list.Name);

        if (filePaths.Count == 1)
            return (new FileStream(filePaths[0], FileMode.Open, FileAccess.Read), list.Name);

        using var output = new PdfDocument();
        output.Info.Title = list.Name;
        foreach (var path in filePaths)
        {
            try
            {
                using var input = PdfReader.Open(path, PdfDocumentOpenMode.Import);
                for (int i = 0; i < input.PageCount; i++)
                    output.AddPage(input.Pages[i]);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error processing PDF: {Path}", path);
            }
        }
        if (output.PageCount == 0) return (null, list.Name);

        var ms = new MemoryStream();
        output.Save(ms, false);
        ms.Position = 0;
        return (ms, list.Name);
    }
}
