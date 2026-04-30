using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;
using MusicasIgreja.Api.Services.Caching;

namespace MusicasIgreja.Api.Tests.Services;

public class MusicServiceTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly MusicService _service;
    private readonly Mock<IFileService> _fileServiceMock;
    private readonly ICacheService _cache;

    public MusicServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new AppDbContext(options);
        _fileServiceMock = new Mock<IFileService>();
        _cache = new NullCacheService();

        _service = new MusicService(_context, _fileServiceMock.Object, Mock.Of<ILogger<MusicService>>(), _cache);

        SeedData();
    }

    private void SeedData()
    {
        var ws = new Workspace { Id = 1, Name = "Igreja", Slug = "igreja" };
        _context.Workspaces.Add(ws);

        var artists = new[]
        {
            new Artist { Id = 1, Name = "Bach" },
            new Artist { Id = 2, Name = "Vivaldi" }
        };
        _context.Artists.AddRange(artists);

        var cat = new Category { Id = 1, Name = "Entrada", WorkspaceId = 1 };
        _context.Categories.Add(cat);

        _context.PdfFiles.AddRange(
            new PdfFile { Id = 1, Filename = "Ave Maria.pdf", OriginalName = "ave.pdf", SongName = "Ave Maria", MusicalKey = "G", FilePath = "p1", FileHash = "h1", FileSize = 1024, PageCount = 2, WorkspaceId = 1 },
            new PdfFile { Id = 2, Filename = "Aleluia.pdf", OriginalName = "aleluia.pdf", SongName = "Aleluia", MusicalKey = "D", FilePath = "p2", FileHash = "h2", FileSize = 2048, PageCount = 3, WorkspaceId = 1 },
            new PdfFile { Id = 3, Filename = "Other.pdf", OriginalName = "other.pdf", SongName = "Other", FilePath = "p3", FileHash = "h3", WorkspaceId = 2 }
        );
        _context.SaveChanges();

        _context.FileArtists.AddRange(
            new FileArtist { FileId = 1, ArtistId = 1 },
            new FileArtist { FileId = 2, ArtistId = 2 }
        );
        _context.FileCategories.Add(new FileCategory { FileId = 1, CategoryId = 1 });
        _context.SaveChanges();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    #region GetMusicByIdAsync

    [Fact]
    public async Task GetMusicByIdAsync_ExistingId_ShouldReturnFileDto()
    {
        var dto = await _service.GetMusicByIdAsync(1);

        Assert.NotNull(dto);
        Assert.Equal("Ave Maria", dto!.SongName);
        Assert.Equal("Bach", dto.Artist);
        Assert.Contains("Entrada", dto.Categories);
    }

    [Fact]
    public async Task GetMusicByIdAsync_NonexistentId_ShouldReturnNull()
    {
        Assert.Null(await _service.GetMusicByIdAsync(999));
    }

    #endregion

    #region GetFileRecordByIdAsync

    [Fact]
    public async Task GetFileRecordByIdAsync_ShouldReturnRawPdfFile()
    {
        var file = await _service.GetFileRecordByIdAsync(1);

        Assert.NotNull(file);
        Assert.Equal("Ave Maria.pdf", file!.Filename);
    }

    [Fact]
    public async Task GetFileRecordByIdAsync_NonexistentId_ShouldReturnNull()
    {
        Assert.Null(await _service.GetFileRecordByIdAsync(999));
    }

    #endregion

    #region DeleteMusicAsync

    [Fact]
    public async Task DeleteMusicAsync_ExistingId_ShouldDeleteAndReturnTrue()
    {
        _fileServiceMock.Setup(f => f.DeleteFile(It.IsAny<string>()));

        var result = await _service.DeleteMusicAsync(1);

        Assert.True(result);
        Assert.Null(await _context.PdfFiles.FindAsync(1));
        _fileServiceMock.Verify(f => f.DeleteFile("p1"), Times.Once);
    }

    [Fact]
    public async Task DeleteMusicAsync_NonexistentId_ShouldReturnFalse()
    {
        Assert.False(await _service.DeleteMusicAsync(999));
    }

    #endregion

    #region Workspace Isolation

    [Fact]
    public async Task GetGroupedByArtistAsync_ShouldFilterByWorkspace()
    {
        var groups = await _service.GetGroupedByArtistAsync(1);

        Assert.Equal(2, groups.Count);
        Assert.DoesNotContain(groups, g => g.Files.Any(f => f.Id == 3));
    }

    [Fact]
    public async Task GetGroupedByCategoryAsync_ShouldReturnCategoryGroups()
    {
        var groups = await _service.GetGroupedByCategoryAsync(1);

        Assert.True(groups.Count >= 1);
    }

    #endregion
}
