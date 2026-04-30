using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using MusicasIgreja.Api.Controllers;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;
using MusicasIgreja.Api.Services.Caching;

namespace MusicasIgreja.Api.Tests.Controllers;

public class SearchControllerTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly SearchController _controller;
    private readonly Mock<IFileService> _fileServiceMock;
    private readonly TestCacheService _cache;

    public SearchControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new AppDbContext(options);
        _fileServiceMock = new Mock<IFileService>();
        _cache = new TestCacheService();

        _controller = new SearchController(_context, _fileServiceMock.Object, _cache);

        SeedDatabase();
        SeedCache();
    }

    private void SeedDatabase()
    {
        var artists = new[]
        {
            new Artist { Id = 1, Name = "Johann Sebastian Bach" },
            new Artist { Id = 2, Name = "George Handel" },
            new Artist { Id = 3, Name = "Antonio Vivaldi" },
            new Artist { Id = 4, Name = "Padre Zezinho" },
            new Artist { Id = 5, Name = "Padre Fábio de Melo" }
        };
        _context.Artists.AddRange(artists);

        var files = new[]
        {
            new PdfFile { Id = 1, Filename = "Ave Maria - G - Bach.pdf", OriginalName = "avemaria.pdf", SongName = "Ave Maria", MusicalKey = "G", FilePath = "organized/Ave Maria.pdf", FileHash = "abc123" },
            new PdfFile { Id = 2, Filename = "Aleluia - D - Handel.pdf", OriginalName = "aleluia.pdf", SongName = "Aleluia", MusicalKey = "D", FilePath = "organized/Aleluia.pdf", FileHash = "def456" },
            new PdfFile { Id = 3, Filename = "Glória - C - Vivaldi.pdf", OriginalName = "gloria.pdf", SongName = "Glória", MusicalKey = "C", FilePath = "organized/Gloria.pdf", FileHash = "ghi789" },
            new PdfFile { Id = 4, Filename = "Música Católica.pdf", OriginalName = "musica.pdf", SongName = "Música Católica", FilePath = "organized/Musica.pdf", FileHash = "jkl012" },
        };
        _context.PdfFiles.AddRange(files);
        _context.SaveChanges();

        _context.FileArtists.AddRange(
            new FileArtist { FileId = 1, ArtistId = 1 },
            new FileArtist { FileId = 2, ArtistId = 2 },
            new FileArtist { FileId = 3, ArtistId = 3 },
            new FileArtist { FileId = 4, ArtistId = 4 }
        );
        _context.SaveChanges();
    }

    private void SeedCache()
    {
        _cache.Set("suggest:ave", new SearchSuggestionsResponse
        {
            Suggestions = new List<SearchSuggestion>
            {
                new() { SongName = "Ave Maria", Artist = "Johann Sebastian Bach" }
            }
        });
        _cache.Set("suggest:musica", new SearchSuggestionsResponse
        {
            Suggestions = new List<SearchSuggestion>
            {
                new() { SongName = "Música Católica", Artist = "Padre Zezinho" }
            }
        });
        _cache.Set("suggest:bach", new SearchSuggestionsResponse
        {
            Suggestions = new List<SearchSuggestion>
            {
                new() { SongName = "Ave Maria", Artist = "Johann Sebastian Bach" }
            }
        });
        _cache.Set("suggest:test", new SearchSuggestionsResponse
        {
            Suggestions = Enumerable.Range(1, 10).Select(i => new SearchSuggestion
            {
                SongName = $"Test Song {i}",
                Artist = "Test Artist"
            }).ToList()
        });
        _cache.Set("artists:padre", new ArtistSearchResponse
        {
            Artists = new List<string> { "Padre Zezinho", "Padre Fábio de Melo" }
        });
        _cache.Set("artists:fabio", new ArtistSearchResponse
        {
            Artists = new List<string> { "Padre Fábio de Melo" }
        });
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    #region SearchSuggestions Tests

    [Fact]
    public async Task GetSearchSuggestions_WithEmptyQuery_ShouldReturnEmptyList()
    {
        var result = await _controller.GetSearchSuggestions("");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<SearchSuggestionsResponse>(okResult.Value);
        Assert.Empty(response.Suggestions);
    }

    [Fact]
    public async Task GetSearchSuggestions_WithShortQuery_ShouldReturnEmptyList()
    {
        var result = await _controller.GetSearchSuggestions("a");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<SearchSuggestionsResponse>(okResult.Value);
        Assert.Empty(response.Suggestions);
    }

    [Fact]
    public async Task GetSearchSuggestions_WithMatchingSongName_ShouldReturnResults()
    {
        var result = await _controller.GetSearchSuggestions("ave");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<SearchSuggestionsResponse>(okResult.Value);
        Assert.Single(response.Suggestions);
        Assert.Equal("Ave Maria", response.Suggestions[0].SongName);
    }

    [Fact]
    public async Task GetSearchSuggestions_WithAccent_ShouldMatchWithoutAccent()
    {
        var result = await _controller.GetSearchSuggestions("musica");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<SearchSuggestionsResponse>(okResult.Value);
        Assert.Contains(response.Suggestions, s => s.SongName!.Contains("Música"));
    }

    [Fact]
    public async Task GetSearchSuggestions_WithArtistName_ShouldReturnResults()
    {
        var result = await _controller.GetSearchSuggestions("bach");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<SearchSuggestionsResponse>(okResult.Value);
        Assert.Single(response.Suggestions);
        Assert.Contains("Bach", response.Suggestions[0].Artist);
    }

    [Fact]
    public async Task GetSearchSuggestions_ShouldLimitTo10Results()
    {
        for (int i = 10; i < 25; i++)
        {
            _context.PdfFiles.Add(new PdfFile
            {
                Id = i, Filename = $"Test Song {i}.pdf", OriginalName = $"test{i}.pdf",
                SongName = $"Test Song {i}", FilePath = $"organized/Test{i}.pdf", FileHash = $"hash{i}"
            });
        }
        await _context.SaveChangesAsync();

        var result = await _controller.GetSearchSuggestions("test");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<SearchSuggestionsResponse>(okResult.Value);
        Assert.True(response.Suggestions.Count <= 10);
    }

    #endregion

    #region SearchArtists Tests

    [Fact]
    public async Task SearchArtists_WithEmptyQuery_ShouldReturnEmptyList()
    {
        var result = await _controller.SearchArtists("");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ArtistSearchResponse>(okResult.Value);
        Assert.Empty(response.Artists);
    }

    [Fact]
    public async Task SearchArtists_WithMatchingQuery_ShouldReturnResults()
    {
        var result = await _controller.SearchArtists("padre");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ArtistSearchResponse>(okResult.Value);
        Assert.Equal(2, response.Artists.Count);
        Assert.All(response.Artists, a => Assert.Contains("Padre", a));
    }

    [Fact]
    public async Task SearchArtists_WithAccent_ShouldMatchWithoutAccent()
    {
        var result = await _controller.SearchArtists("fabio");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ArtistSearchResponse>(okResult.Value);
        Assert.Contains(response.Artists, a => a.Contains("Fábio"));
    }

    #endregion

    #region CheckDuplicate Tests

    [Fact]
    public async Task CheckDuplicate_WithNoFile_ShouldReturnBadRequest()
    {
        var result = await _controller.CheckDuplicate(null!);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task CheckDuplicate_WithNonPdfFile_ShouldReturnBadRequest()
    {
        var fileMock = new Mock<IFormFile>();
        fileMock.Setup(f => f.FileName).Returns("test.txt");
        fileMock.Setup(f => f.Length).Returns(100);

        var result = await _controller.CheckDuplicate(fileMock.Object);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    #endregion

    private sealed class TestCacheService : ICacheService
    {
        private readonly Dictionary<string, object?> _cache = new();

        public void Set<T>(string key, T value) where T : class => _cache[key] = value;

        public Task<T?> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<Task<T?>> factory, params string[] tags)
            where T : class
        {
            if (_cache.TryGetValue(key, out var value) && value is T typed)
                return Task.FromResult<T?>(typed);

            return factory();
        }

        public Task InvalidateAsync(string key)
        {
            _cache.Remove(key);
            return Task.CompletedTask;
        }

        public Task InvalidateTagAsync(string tag) => Task.CompletedTask;
    }
}
