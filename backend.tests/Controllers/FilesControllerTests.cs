using Core.Auth.Models;
using Core.Auth.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using MusicasIgreja.Api.Controllers;
using MusicasIgreja.Api.DTOs;
using MusicasIgreja.Api.Models;
using MusicasIgreja.Api.Services;
using MusicasIgreja.Api.Services.Interfaces;
using System.Threading.Channels;

namespace MusicasIgreja.Api.Tests.Controllers;

public class FilesControllerTests
{
    private readonly FilesController _controller;
    private readonly Mock<IMusicService> _musicServiceMock;
    private readonly Mock<IFileService> _fileServiceMock;
    private readonly Mock<ICoreAuthService> _authServiceMock;
    private readonly Mock<IMonitoringService> _monitoringServiceMock;
    private readonly Mock<IChordPdfRenderer> _chordRendererMock;
    private readonly Mock<ChannelWriter<OcrJob>> _ocrWriterMock;
    private readonly Mock<ILogger<FilesController>> _loggerMock;

    public FilesControllerTests()
    {
        _musicServiceMock = new Mock<IMusicService>();
        _fileServiceMock = new Mock<IFileService>();
        _authServiceMock = new Mock<ICoreAuthService>();
        _monitoringServiceMock = new Mock<IMonitoringService>();
        _chordRendererMock = new Mock<IChordPdfRenderer>();
        _ocrWriterMock = new Mock<ChannelWriter<OcrJob>>();
        _loggerMock = new Mock<ILogger<FilesController>>();

        _controller = new FilesController(
            _musicServiceMock.Object,
            _fileServiceMock.Object,
            _authServiceMock.Object,
            _monitoringServiceMock.Object,
            _chordRendererMock.Object,
            _ocrWriterMock.Object,
            _loggerMock.Object);

        var httpContext = new DefaultHttpContext();
        var testSession = new TestSession(new Dictionary<string, byte[]>
        {
            ["UserId"] = BitConverter.GetBytes(1),
            ["RoleId"] = BitConverter.GetBytes(1),
            ["Username"] = System.Text.Encoding.UTF8.GetBytes("testuser")
        });
        httpContext.Features.Set<ISessionFeature>(new TestSessionFeature { Session = testSession });
        httpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1");
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        _authServiceMock.Setup(a => a.UserHasPermissionAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(true);
    }

    private static FileListResponseDto MakeFileListResponse(int count, int page = 1, int perPage = 20)
    {
        var files = Enumerable.Range(1, count).Select(i => new FileDto(
            i, $"file{i}.pdf", $"original{i}.pdf", $"Song {i}", "Artist",
            new List<string> { "Entrada" }, new Dictionary<string, FileCustomFilterGroupDto>(),
            "C", null, 1024, 2, DateTime.UtcNow, null, "pdf_only", null, null, null, null
        )).ToList();

        return new FileListResponseDto(files,
            new PaginationDto(page, perPage, count, (int)Math.Ceiling(count / (double)perPage)));
    }

    #region GetFiles Tests

    [Fact]
    public async Task GetFiles_WithNoFilters_ShouldReturnAllFiles()
    {
        _musicServiceMock.Setup(m => m.GetMusicsAsync(
                It.IsAny<int>(), null, null, null, null, null,
                1, 20, "upload_date", "desc", null))
            .ReturnsAsync(MakeFileListResponse(3));

        var result = await _controller.GetFiles();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<FileListResponseDto>(okResult.Value);
        Assert.Equal(3, response.Files.Count);
        Assert.Equal(3, response.Pagination.Total);
    }

    [Fact]
    public async Task GetFiles_WithPagination_ShouldReturnCorrectPage()
    {
        _musicServiceMock.Setup(m => m.GetMusicsAsync(
                It.IsAny<int>(), null, null, null, null, null,
                1, 2, "upload_date", "desc", null))
            .ReturnsAsync(MakeFileListResponse(2, 1, 2));

        var result = await _controller.GetFiles(page: 1, per_page: 2);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<FileListResponseDto>(okResult.Value);
        Assert.Equal(2, response.Files.Count);
    }

    [Fact]
    public async Task GetFiles_WithCategoryAndArtist_ShouldPassFilters()
    {
        _musicServiceMock.Setup(m => m.GetMusicsAsync(
                It.IsAny<int>(),
                "gloria",
                It.Is<List<string>>(c => c.Count == 1 && c[0] == "entrada"),
                null,
                It.Is<List<string>>(a => a.Count == 1 && a[0] == "bach"),
                "C",
                1, 20, "upload_date", "desc", null))
            .ReturnsAsync(MakeFileListResponse(1));

        var result = await _controller.GetFiles(
            workspace_id: 1,
            q: "gloria",
            category: new List<string> { "entrada" },
            artist: new List<string> { "bach" },
            musical_key: "C");

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<FileListResponseDto>(okResult.Value);
        Assert.Single(response.Files);
    }

    [Fact]
    public async Task GetFiles_WithCustomFilters_ShouldParseQuery()
    {
        var httpContext = _controller.ControllerContext.HttpContext;
        httpContext.Request.QueryString = new QueryString("?custom_filter_tempo-liturgico=advento&custom_filter_tempo-liturgico=pascoa");

        _musicServiceMock.Setup(m => m.GetMusicsAsync(
                It.IsAny<int>(),
                null,
                null,
                It.Is<Dictionary<string, List<string>>>(cf =>
                    cf.ContainsKey("tempo-liturgico") &&
                    cf["tempo-liturgico"].Contains("advento") &&
                    cf["tempo-liturgico"].Contains("pascoa")),
                null,
                null,
                1, 20, "upload_date", "desc", null))
            .ReturnsAsync(MakeFileListResponse(1));

        var result = await _controller.GetFiles();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<FileListResponseDto>(okResult.Value);
        Assert.Single(response.Files);
    }

    #endregion

    #region GetFile Tests

    [Fact]
    public async Task GetFile_WithValidId_ShouldReturnFile()
    {
        _musicServiceMock.Setup(m => m.GetMusicByIdAsync(1))
            .ReturnsAsync(new FileDto(1, "file.pdf", "orig.pdf", "Song", "Artist",
                new List<string>(), new Dictionary<string, FileCustomFilterGroupDto>(),
                "C", null, 1024, 2, DateTime.UtcNow, null, "pdf_only", null, null, null, null));

        var result = await _controller.GetFile(1);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task GetFile_WithInvalidId_ShouldReturnNotFound()
    {
        _musicServiceMock.Setup(m => m.GetMusicByIdAsync(999))
            .ReturnsAsync((FileDto?)null);

        var result = await _controller.GetFile(999);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion

    #region DeleteFile Tests

    [Fact]
    public async Task DeleteFile_WithValidId_ShouldDeleteFile()
    {
        _musicServiceMock.Setup(m => m.DeleteMusicAsync(1)).ReturnsAsync(true);

        var result = await _controller.DeleteFile(1);

        Assert.IsType<OkObjectResult>(result.Result);
        _musicServiceMock.Verify(m => m.DeleteMusicAsync(1), Times.Once);
    }

    [Fact]
    public async Task DeleteFile_WithInvalidId_ShouldReturnNotFound()
    {
        _musicServiceMock.Setup(m => m.DeleteMusicAsync(999)).ReturnsAsync(false);

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

        Assert.IsType<BadRequestObjectResult>(result.Result);
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
        _musicServiceMock.Setup(m => m.UpdateMusicAsync(1, It.IsAny<FileUpdateDto>()))
            .ReturnsAsync(true);

        var dto = new FileUpdateDto { SongName = "Updated Song", Artist = "New Artist", MusicalKey = "A" };

        var result = await _controller.UpdateFile(1, dto);

        Assert.IsType<OkObjectResult>(result.Result);
        _musicServiceMock.Verify(m => m.UpdateMusicAsync(1, dto), Times.Once);
    }

    [Fact]
    public async Task UpdateFile_WithInvalidId_ShouldReturnNotFound()
    {
        _musicServiceMock.Setup(m => m.UpdateMusicAsync(999, It.IsAny<FileUpdateDto>()))
            .ReturnsAsync(false);

        var dto = new FileUpdateDto { SongName = "Test" };

        var result = await _controller.UpdateFile(999, dto);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion

    #region Grouped Endpoints Tests

    [Fact]
    public async Task GetFilesGroupedByArtist_ShouldReturnGroups()
    {
        _musicServiceMock.Setup(m => m.GetGroupedByArtistAsync(It.IsAny<int>()))
            .ReturnsAsync(new List<GroupedFilesDto>
            {
                new("Bach", 2, new List<GroupedFileItemDto>())
            });

        var result = await _controller.GetFilesGroupedByArtist();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task GetFilesGroupedByCategory_ShouldReturnGroups()
    {
        _musicServiceMock.Setup(m => m.GetGroupedByCategoryAsync(It.IsAny<int>()))
            .ReturnsAsync(new List<GroupedFilesDto>
            {
                new("Entrada", 3, new List<GroupedFileItemDto>())
            });

        var result = await _controller.GetFilesGroupedByCategory();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(okResult.Value);
    }

    #endregion
}

internal sealed class TestSession : ISession
{
    private readonly Dictionary<string, byte[]> _data;

    public TestSession(Dictionary<string, byte[]> data) => _data = data;

    public bool IsAvailable => true;
    public string Id => "test-session-id";
    public IEnumerable<string> Keys => _data.Keys;

    public void Clear() => _data.Clear();
    public void Remove(string key) => _data.Remove(key);
    public void Set(string key, byte[] value) => _data[key] = value;

    public bool TryGetValue(string key, [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out byte[]? value) =>
        _data.TryGetValue(key, out value);

    public Task LoadAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
}

internal sealed class TestSessionFeature : ISessionFeature
{
    public ISession Session { get; set; } = null!;
}
