using Microsoft.EntityFrameworkCore;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Services;

public class DashboardService : IDashboardService
{
    private readonly AppDbContext _context;

    public DashboardService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardStatsDto> GetStatsAsync(int workspaceId)
    {
        var filesQuery = _context.PdfFiles.Where(f => f.WorkspaceId == workspaceId);
        var totalMusics = await filesQuery.CountAsync();
        var totalLists = await _context.MergeLists.Where(m => m.WorkspaceId == workspaceId).CountAsync();
        var totalCategories = await _context.Categories.Where(c => c.WorkspaceId == workspaceId).CountAsync();
        var totalFilterGroups = await _context.CustomFilterGroups.Where(g => g.WorkspaceId == workspaceId).CountAsync();
        var totalArtists = await _context.FileArtists
            .Where(fa => fa.PdfFile.WorkspaceId == workspaceId)
            .Select(fa => fa.ArtistId)
            .Distinct()
            .CountAsync();

        var totalFileSizeBytes = await filesQuery.SumAsync(f => f.FileSize ?? 0);
        var totalFileSizeMb = totalFileSizeBytes / (1024.0 * 1024.0);
        var totalPages = await filesQuery.SumAsync(f => f.PageCount ?? 0);
        var musicsWithYoutube = await filesQuery.CountAsync(f => !string.IsNullOrEmpty(f.YoutubeLink));

        double avgMusicsPerList = 0;
        if (totalLists > 0)
        {
            var listIds = await _context.MergeLists.Where(m => m.WorkspaceId == workspaceId).Select(m => m.Id).ToListAsync();
            var totalItems = await _context.MergeListItems.Where(mli => listIds.Contains(mli.MergeListId)).CountAsync();
            avgMusicsPerList = (double)totalItems / totalLists;
        }

        LargestListDto? largestList = null;
        var largestListData = await _context.MergeLists
            .Where(m => m.WorkspaceId == workspaceId)
            .Select(m => new { m.Name, Count = m.Items.Count })
            .OrderByDescending(x => x.Count)
            .FirstOrDefaultAsync();
        if (largestListData != null && largestListData.Count > 0)
            largestList = new LargestListDto { Name = largestListData.Name, Count = largestListData.Count };

        MostPopularCategoryDto? mostPopularCategory = null;
        var categoryData = await _context.FileCategories
            .Where(fc => fc.PdfFile.WorkspaceId == workspaceId)
            .GroupBy(fc => new { fc.Category.Name })
            .Select(g => new { Name = g.Key.Name, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .FirstOrDefaultAsync();
        if (categoryData != null)
            mostPopularCategory = new MostPopularCategoryDto { Name = categoryData.Name, Count = categoryData.Count };

        return new DashboardStatsDto
        {
            TotalMusics = totalMusics,
            TotalLists = totalLists,
            TotalCategories = totalCategories,
            TotalFilterGroups = totalFilterGroups,
            TotalArtists = totalArtists,
            TotalFileSizeMb = Math.Round(totalFileSizeMb, 2),
            TotalPages = totalPages,
            MusicsWithYoutube = musicsWithYoutube,
            AvgMusicsPerList = Math.Round(avgMusicsPerList, 2),
            LargestList = largestList,
            MostPopularCategory = mostPopularCategory
        };
    }

    public async Task<List<FilterOptionDto>> GetCategoriesAsync(int workspaceId)
    {
        return await _context.Categories
            .Where(c => c.WorkspaceId == workspaceId)
            .OrderBy(c => c.Name)
            .Select(c => new FilterOptionDto(c.Slug, c.Name))
            .ToListAsync();
    }

    public async Task<List<CustomFilterGroupDto>> GetCustomFilterGroupsAsync(int workspaceId)
    {
        return await _context.CustomFilterGroups
            .Where(g => g.WorkspaceId == workspaceId)
            .OrderBy(g => g.SortOrder)
            .Select(g => new CustomFilterGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                Slug = g.Slug,
                SortOrder = g.SortOrder,
                Values = g.Values.OrderBy(v => v.SortOrder).Select(v => new CustomFilterValueDto
                {
                    Id = v.Id,
                    Name = v.Name,
                    Slug = v.Slug,
                    SortOrder = v.SortOrder,
                    FileCount = v.FileCustomFilters.Count
                }).ToList()
            })
            .ToListAsync();
    }

    public async Task<List<FilterOptionDto>> GetArtistsAsync(int workspaceId)
    {
        var artists = await _context.FileArtists
            .Where(fa => fa.PdfFile.WorkspaceId == workspaceId)
            .Select(fa => new { fa.Artist.Slug, fa.Artist.Name })
            .Distinct()
            .OrderBy(a => a.Name)
            .ToListAsync();

        return artists.Select(a => new FilterOptionDto(a.Slug, a.Name)).ToList();
    }

    public async Task<object> GetTopArtistsAsync(int workspaceId, int limit = 10)
    {
        var topArtists = await _context.FileArtists
            .Where(fa => fa.PdfFile.WorkspaceId == workspaceId)
            .GroupBy(fa => new { fa.Artist.Name })
            .Select(g => new { artist = g.Key.Name, song_count = g.Count() })
            .OrderByDescending(x => x.song_count)
            .Take(limit)
            .ToListAsync();
        return new { artists = topArtists };
    }

    public async Task<object> GetTopSongsByCategoryAsync(int workspaceId, string categorySlug)
    {
        var category = await _context.Categories
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Slug == categorySlug);
        if (category == null)
            return new { songs = Array.Empty<object>() };

        var songs = await _context.FileCategories
            .Where(fc => fc.CategoryId == category.Id && fc.PdfFile.WorkspaceId == workspaceId)
            .Select(fc => fc.PdfFile)
            .Distinct()
            .Select(f => new
            {
                id = f.Id,
                song_name = f.SongName,
                artists = f.FileArtists.Select(fa => fa.Artist.Name).ToList(),
                musical_key = f.MusicalKey,
                usage_count = f.MergeListItems.Count
            })
            .OrderByDescending(f => f.usage_count)
            .ThenBy(f => f.song_name)
            .Take(10)
            .ToListAsync();

        return new { songs };
    }

    public async Task<object> GetUploadsTimelineAsync(int workspaceId, int months = 12)
    {
        var startDate = DateTime.UtcNow.AddMonths(-months);
        var files = await _context.PdfFiles
            .Where(f => f.WorkspaceId == workspaceId && f.UploadDate >= startDate)
            .Select(f => new { f.UploadDate })
            .ToListAsync();

        var monthlyData = files
            .GroupBy(f => new { f.UploadDate.Year, f.UploadDate.Month })
            .Select(g => new { Year = g.Key.Year, Month = g.Key.Month, Count = g.Count() })
            .OrderBy(x => x.Year)
            .ThenBy(x => x.Month)
            .ToList();

        var monthNames = new[] { "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez" };
        var timeline = monthlyData.Select(m => new
        {
            month_name = $"{monthNames[m.Month]}/{m.Year}",
            upload_count = m.Count
        }).ToList();

        return new { timeline };
    }
}
