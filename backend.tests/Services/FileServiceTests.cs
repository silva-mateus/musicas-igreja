using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Tests.Services;

public class FileServiceTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly FileService _fileService;
    private readonly Mock<ILogger<FileService>> _loggerMock;
    private readonly string _testOrganizedFolder;

    public FileServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new AppDbContext(options);
        _loggerMock = new Mock<ILogger<FileService>>();
        
        _testOrganizedFolder = Path.Combine(Path.GetTempPath(), $"test_organized_{Guid.NewGuid()}");
        Directory.CreateDirectory(_testOrganizedFolder);

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:OrganizedFolder"] = _testOrganizedFolder
            })
            .Build();

        _fileService = new FileService(_context, configuration, _loggerMock.Object);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();

        if (Directory.Exists(_testOrganizedFolder))
        {
            try
            {
                Directory.Delete(_testOrganizedFolder, true);
            }
            catch
            {
                // Ignore cleanup errors
            }
        }
    }

    #region GenerateFilename Tests

    [Theory]
    [InlineData("Ave Maria", "Bach", "original.pdf", "G", "Ave Maria - G - Bach.pdf")]
    [InlineData("Aleluia", "Handel", "test.pdf", null, "Aleluia - Handel.pdf")]
    [InlineData("Gloria", null, "file.pdf", "D", "Gloria - D.pdf")]
    [InlineData("Santo", null, "original.pdf", null, "Santo.pdf")]
    [InlineData(null, "Artista", "original.pdf", null, "Artista.pdf")]
    [InlineData(null, null, "original.pdf", null, "original.pdf")]
    public void GenerateFilename_ShouldGenerateCorrectFilename(
        string? songName, string? artist, string originalFilename, string? musicalKey, string expected)
    {
        var result = _fileService.GenerateFilename(songName, artist, originalFilename, musicalKey);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("Música: Test", "artist", "test.pdf", "C", "Música_ Test - C - Artist.pdf")]
    [InlineData("Song<>Name", "Art/ist", "test.pdf", null, "Song__name - Art_ist.pdf")] // TitleCase preserves first word capital, rest follows rules
    public void GenerateFilename_ShouldSanitizeInvalidCharacters(
        string? songName, string? artist, string originalFilename, string? musicalKey, string expected)
    {
        var result = _fileService.GenerateFilename(songName, artist, originalFilename, musicalKey);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void GenerateFilename_ShouldApplyTitleCase()
    {
        var result = _fileService.GenerateFilename("ave maria", "johann bach", "test.pdf", null);
        Assert.Equal("Ave Maria - Johann Bach.pdf", result);
    }

    #endregion

    #region NormalizeToRelativePath Tests

    [Theory]
    [InlineData("organized/Entrada/file.pdf", "organized/Entrada/file.pdf")]
    [InlineData("/organized/Entrada/file.pdf", "organized/Entrada/file.pdf")]
    [InlineData("C:/Users/test/organized/Entrada/file.pdf", "organized/Entrada/file.pdf")]
    [InlineData("/mnt/c/Users/test/organized/Entrada/file.pdf", "organized/Entrada/file.pdf")]
    [InlineData("/app/organized/Entrada/file.pdf", "organized/Entrada/file.pdf")]
    public void NormalizeToRelativePath_ShouldNormalizeCorrectly(string input, string expected)
    {
        var result = _fileService.NormalizeToRelativePath(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void NormalizeToRelativePath_WithNullInput_ShouldReturnEmptyString()
    {
        var result = _fileService.NormalizeToRelativePath(null!);
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void NormalizeToRelativePath_WithEmptyInput_ShouldReturnEmptyString()
    {
        var result = _fileService.NormalizeToRelativePath(string.Empty);
        Assert.Equal(string.Empty, result);
    }

    #endregion

    #region GetAbsolutePath Tests

    [Fact]
    public void GetAbsolutePath_ShouldReturnCorrectAbsolutePath()
    {
        var relativePath = "organized/Entrada/file.pdf";
        var result = _fileService.GetAbsolutePath(relativePath);

        var expected = Path.Combine(_testOrganizedFolder, "Entrada", "file.pdf");
        Assert.Equal(expected, result);
    }

    [Fact]
    public void GetAbsolutePath_WithLeadingSlash_ShouldNormalizeAndReturn()
    {
        var relativePath = "/organized/Entrada/file.pdf";
        var result = _fileService.GetAbsolutePath(relativePath);

        var expected = Path.Combine(_testOrganizedFolder, "Entrada", "file.pdf");
        Assert.Equal(expected, result);
    }

    #endregion

    #region ComputeFileHash Tests

    [Fact]
    public void ComputeFileHash_ShouldReturnConsistentHash()
    {
        var content = "Test PDF content"u8.ToArray();
        using var stream1 = new MemoryStream(content);
        using var stream2 = new MemoryStream(content);

        var hash1 = _fileService.ComputeFileHash(stream1);
        var hash2 = _fileService.ComputeFileHash(stream2);

        Assert.Equal(hash1, hash2);
    }

    [Fact]
    public void ComputeFileHash_DifferentContent_ShouldReturnDifferentHash()
    {
        using var stream1 = new MemoryStream("Content 1"u8.ToArray());
        using var stream2 = new MemoryStream("Content 2"u8.ToArray());

        var hash1 = _fileService.ComputeFileHash(stream1);
        var hash2 = _fileService.ComputeFileHash(stream2);

        Assert.NotEqual(hash1, hash2);
    }

    [Fact]
    public void ComputeFileHash_ShouldReturnLowercaseHexString()
    {
        using var stream = new MemoryStream("Test"u8.ToArray());
        var hash = _fileService.ComputeFileHash(stream);

        Assert.Matches("^[a-f0-9]+$", hash);
    }

    #endregion

    #region GetPdfPageCount Tests

    [Fact]
    public void GetPdfPageCount_WithNonexistentFile_ShouldReturn1()
    {
        var result = _fileService.GetPdfPageCount("/nonexistent/file.pdf");
        Assert.Equal(1, result);
    }

    #endregion
}
