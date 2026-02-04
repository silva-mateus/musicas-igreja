using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using MusicasIgreja.Api.Controllers;
using MusicasIgreja.Api.Data;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;

namespace MusicasIgreja.Api.Tests.Controllers;

public class FilesControllerTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly FilesController _controller;
    private readonly Mock<IFileService> _fileServiceMock;
    private readonly Mock<IAuthService> _authServiceMock;
    private readonly Mock<ILogger<FilesController>> _loggerMock;

    public FilesControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new AppDbContext(options);
        _fileServiceMock = new Mock<IFileService>();
        _authServiceMock = new Mock<IAuthService>();
        _loggerMock = new Mock<ILogger<FilesController>>();

        _controller = new FilesController(_context, _fileServiceMock.Object, _authServiceMock.Object, _loggerMock.Object);

        // Setup HttpContext with session for authentication tests
        var httpContext = new DefaultHttpContext();
        var sessionMock = new Mock<ISession>();
        var sessionData = new Dictionary<string, byte[]>
        {
            ["UserId"] = BitConverter.GetBytes(1),
            ["RoleId"] = BitConverter.GetBytes(1)
        };
        
        sessionMock.Setup(s => s.TryGetValue(It.IsAny<string>(), out It.Ref<byte[]>.IsAny))
            .Returns((string key, out byte[] value) =>
            {
                var exists = sessionData.TryGetValue(key, out var data);
                value = data!;
                return exists;
            });
        
        httpContext.Session = sessionMock.Object;
        httpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1");
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        // Setup AuthService mock to return permissions
        var mockRole = new Role
        {
            Id = 1,
            Name = "admin",
            CanUploadMusic = true,
            CanEditMusicMetadata = true,
            CanDeleteMusic = true
        };
        _authServiceMock.Setup(a => a.GetRoleByIdAsync(It.IsAny<int>()))
            .ReturnsAsync(mockRole);

        SeedDatabase();
    }

    private void SeedDatabase()
    {
        // Add test categories
        _context.Categories.AddRange(
            new Category { Id = 1, Name = "Entrada" },
            new Category { Id = 2, Name = "Comunhão" },
            new Category { Id = 3, Name = "Final" }
        );

        // Add test liturgical times
        _context.LiturgicalTimes.AddRange(
            new LiturgicalTime { Id = 1, Name = "Tempo Comum" },
            new LiturgicalTime { Id = 2, Name = "Advento" }
        );

        // Add test files
        _context.PdfFiles.AddRange(
            new PdfFile
            {
                Id = 1,
                Filename = "Ave Maria - G - Bach.pdf",
                OriginalName = "avemaria.pdf",
                SongName = "Ave Maria",
                Artist = "Bach",
                Category = "Entrada",
                MusicalKey = "G",
                FilePath = "organized/Entrada/Ave Maria - G - Bach.pdf",
                FileSize = 1024,
                FileHash = "abc123",
                PageCount = 2
            },
            new PdfFile
            {
                Id = 2,
                Filename = "Aleluia - D - Handel.pdf",
                OriginalName = "aleluia.pdf",
                SongName = "Aleluia",
                Artist = "Handel",
                Category = "Comunhão",
                MusicalKey = "D",
                FilePath = "organized/Comunhão/Aleluia - D - Handel.pdf",
                FileSize = 2048,
                FileHash = "def456",
                PageCount = 3
            },
            new PdfFile
            {
                Id = 3,
                Filename = "Glória - C - Vivaldi.pdf",
                OriginalName = "gloria.pdf",
                SongName = "Glória",
                Artist = "Vivaldi",
                Category = "Entrada",
                MusicalKey = "C",
                FilePath = "organized/Entrada/Glória - C - Vivaldi.pdf",
                FileSize = 3072,
                FileHash = "ghi789",
                PageCount = 4
            }
        );

        _context.SaveChanges();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    #region GetFiles Tests

    [Fact]
    public async Task GetFiles_WithNoFilters_ShouldReturnAllFiles()
    {
        var result = await _controller.GetFiles();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<FileListResponseDto>(okResult.Value);

        Assert.Equal(3, response.Files.Count);
        Assert.Equal(3, response.Pagination.Total);
    }

    [Fact]
    public async Task GetFiles_WithCategoryFilter_ShouldReturnFilteredFiles()
    {
        var result = await _controller.GetFiles(category: "Entrada");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<FileListResponseDto>(okResult.Value);

        Assert.Equal(2, response.Files.Count);
        Assert.All(response.Files, f => Assert.Equal("Entrada", f.PrimaryCategory));
    }

    [Fact]
    public async Task GetFiles_WithPagination_ShouldReturnCorrectPage()
    {
        var result = await _controller.GetFiles(page: 1, per_page: 2);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<FileListResponseDto>(okResult.Value);

        Assert.Equal(2, response.Files.Count);
        Assert.Equal(2, response.Pagination.TotalPages);
        Assert.Equal(1, response.Pagination.Page);
    }

    [Fact]
    public async Task GetFiles_SecondPage_ShouldReturnRemainingFiles()
    {
        var result = await _controller.GetFiles(page: 2, per_page: 2);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<FileListResponseDto>(okResult.Value);

        Assert.Single(response.Files);
        Assert.Equal(2, response.Pagination.Page);
    }

    #endregion

    #region GetFile Tests

    [Fact]
    public async Task GetFile_WithValidId_ShouldReturnFile()
    {
        var result = await _controller.GetFile(1);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = okResult.Value;
        
        Assert.NotNull(response);
    }

    [Fact]
    public async Task GetFile_WithInvalidId_ShouldReturnNotFound()
    {
        var result = await _controller.GetFile(999);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion

    #region DeleteFile Tests

    [Fact]
    public async Task DeleteFile_WithValidId_ShouldDeleteFile()
    {
        _fileServiceMock.Setup(x => x.DeleteFile(It.IsAny<string>()));

        var result = await _controller.DeleteFile(1);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        
        // Verify file is deleted from database
        var deletedFile = await _context.PdfFiles.FindAsync(1);
        Assert.Null(deletedFile);
    }

    [Fact]
    public async Task DeleteFile_WithInvalidId_ShouldReturnNotFound()
    {
        var result = await _controller.DeleteFile(999);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion

    #region Upload Tests

    [Fact]
    public async Task UploadFile_WithNoFile_ShouldReturnBadRequest()
    {
        var result = await _controller.UploadFile(null!);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UploadFile_WithNonPdfFile_ShouldReturnBadRequest()
    {
        var fileMock = new Mock<IFormFile>();
        fileMock.Setup(f => f.FileName).Returns("test.txt");
        fileMock.Setup(f => f.Length).Returns(100);

        var result = await _controller.UploadFile(fileMock.Object);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UploadFile_WithEmptyFile_ShouldReturnBadRequest()
    {
        var fileMock = new Mock<IFormFile>();
        fileMock.Setup(f => f.FileName).Returns("test.pdf");
        fileMock.Setup(f => f.Length).Returns(0);

        var result = await _controller.UploadFile(fileMock.Object);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    #endregion

    #region UpdateFile Tests

    [Fact]
    public async Task UpdateFile_WithValidData_ShouldUpdateFile()
    {
        _fileServiceMock.Setup(x => x.GenerateFilename(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Returns("Updated Song - A - New Artist.pdf");

        var updateDto = new FileUpdateDto
        {
            SongName = "Updated Song",
            Artist = "New Artist",
            MusicalKey = "A"
        };

        var result = await _controller.UpdateFile(1, updateDto);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        
        var updatedFile = await _context.PdfFiles.FindAsync(1);
        Assert.Equal("Updated Song", updatedFile!.SongName);
        Assert.Equal("New Artist", updatedFile.Artist);
    }

    [Fact]
    public async Task UpdateFile_WithInvalidId_ShouldReturnNotFound()
    {
        var updateDto = new FileUpdateDto { SongName = "Test" };

        var result = await _controller.UpdateFile(999, updateDto);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion

    #region Grouped Endpoints Tests

    [Fact]
    public async Task GetFilesGroupedByArtist_ShouldGroupCorrectly()
    {
        var result = await _controller.GetFilesGroupedByArtist();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task GetFilesGroupedByCategory_ShouldGroupCorrectly()
    {
        var result = await _controller.GetFilesGroupedByCategory();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(okResult.Value);
    }

    #endregion
}
