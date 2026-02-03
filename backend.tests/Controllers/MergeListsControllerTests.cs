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

public class MergeListsControllerTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly MergeListsController _controller;
    private readonly Mock<IFileService> _fileServiceMock;
    private readonly Mock<ILogger<MergeListsController>> _loggerMock;

    public MergeListsControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new AppDbContext(options);
        _fileServiceMock = new Mock<IFileService>();
        _loggerMock = new Mock<ILogger<MergeListsController>>();

        _controller = new MergeListsController(_context, _fileServiceMock.Object, _loggerMock.Object);

        SeedDatabase();
    }

    private void SeedDatabase()
    {
        // Add test files
        _context.PdfFiles.AddRange(
            new PdfFile
            {
                Id = 1,
                Filename = "Ave Maria.pdf",
                OriginalName = "avemaria.pdf",
                SongName = "Ave Maria",
                Artist = "Bach",
                Category = "Entrada",
                FilePath = "organized/Entrada/Ave Maria.pdf",
                FileHash = "abc123"
            },
            new PdfFile
            {
                Id = 2,
                Filename = "Aleluia.pdf",
                OriginalName = "aleluia.pdf",
                SongName = "Aleluia",
                Artist = "Handel",
                Category = "Comunhão",
                FilePath = "organized/Comunhão/Aleluia.pdf",
                FileHash = "def456"
            },
            new PdfFile
            {
                Id = 3,
                Filename = "Gloria.pdf",
                OriginalName = "gloria.pdf",
                SongName = "Glória",
                Artist = "Vivaldi",
                Category = "Final",
                FilePath = "organized/Final/Gloria.pdf",
                FileHash = "ghi789"
            }
        );

        // Add test merge list
        _context.MergeLists.Add(new MergeList
        {
            Id = 1,
            Name = "Lista de Teste",
            Observations = "Observações de teste"
        });

        _context.MergeListItems.AddRange(
            new MergeListItem { Id = 1, MergeListId = 1, PdfFileId = 1, OrderPosition = 0 },
            new MergeListItem { Id = 2, MergeListId = 1, PdfFileId = 2, OrderPosition = 1 }
        );

        _context.SaveChanges();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    #region GetLists Tests

    [Fact]
    public async Task GetLists_ShouldReturnAllLists()
    {
        var result = await _controller.GetLists();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var lists = Assert.IsType<List<MergeListSummaryDto>>(okResult.Value);

        Assert.Single(lists);
        Assert.Equal("Lista de Teste", lists[0].Name);
        Assert.Equal(2, lists[0].FileCount);
    }

    #endregion

    #region GetList Tests

    [Fact]
    public async Task GetList_WithValidId_ShouldReturnList()
    {
        var result = await _controller.GetList(1);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task GetList_WithInvalidId_ShouldReturnNotFound()
    {
        var result = await _controller.GetList(999);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion

    #region CreateList Tests

    [Fact]
    public async Task CreateList_WithValidData_ShouldCreateList()
    {
        var dto = new CreateMergeListDto 
        { 
            Name = "Nova Lista", 
            Observations = "Observações", 
            FileIds = new List<int> { 1, 2 } 
        };

        var result = await _controller.CreateList(dto);

        var createdResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(201, createdResult.StatusCode);

        var createdList = await _context.MergeLists
            .Include(l => l.Items)
            .FirstOrDefaultAsync(l => l.Name == "Nova Lista");
        
        Assert.NotNull(createdList);
        Assert.Equal(2, createdList.Items.Count);
    }

    [Fact]
    public async Task CreateList_WithEmptyName_ShouldReturnBadRequest()
    {
        var dto = new CreateMergeListDto { Name = "" };

        var result = await _controller.CreateList(dto);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task CreateList_WithWhitespaceName_ShouldReturnBadRequest()
    {
        var dto = new CreateMergeListDto { Name = "   " };

        var result = await _controller.CreateList(dto);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    #endregion

    #region UpdateList Tests

    [Fact]
    public async Task UpdateList_WithValidData_ShouldUpdateList()
    {
        var dto = new UpdateMergeListDto { Name = "Lista Atualizada", Observations = "Novas observações" };

        var result = await _controller.UpdateList(1, dto);

        Assert.IsType<OkObjectResult>(result.Result);

        var updatedList = await _context.MergeLists.FindAsync(1);
        Assert.Equal("Lista Atualizada", updatedList!.Name);
        Assert.Equal("Novas observações", updatedList.Observations);
    }

    [Fact]
    public async Task UpdateList_WithInvalidId_ShouldReturnNotFound()
    {
        var dto = new UpdateMergeListDto { Name = "Test" };

        var result = await _controller.UpdateList(999, dto);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion

    #region DeleteList Tests

    [Fact]
    public async Task DeleteList_WithValidId_ShouldDeleteList()
    {
        var result = await _controller.DeleteList(1);

        Assert.IsType<OkObjectResult>(result.Result);

        var deletedList = await _context.MergeLists.FindAsync(1);
        Assert.Null(deletedList);
    }

    [Fact]
    public async Task DeleteList_WithInvalidId_ShouldReturnNotFound()
    {
        var result = await _controller.DeleteList(999);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion

    #region AddItems Tests

    [Fact]
    public async Task AddItems_WithValidData_ShouldAddItems()
    {
        var dto = new AddItemsDto { FileIds = new List<int> { 3 } };

        var result = await _controller.AddItems(1, dto);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);

        var list = await _context.MergeLists
            .Include(l => l.Items)
            .FirstAsync(l => l.Id == 1);
        
        Assert.Equal(3, list.Items.Count);
    }

    [Fact]
    public async Task AddItems_WithInvalidListId_ShouldReturnNotFound()
    {
        var dto = new AddItemsDto { FileIds = new List<int> { 1 } };

        var result = await _controller.AddItems(999, dto);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task AddItems_WithNonexistentFileId_ShouldNotAddItem()
    {
        var dto = new AddItemsDto { FileIds = new List<int> { 999 } };

        var result = await _controller.AddItems(1, dto);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);

        var list = await _context.MergeLists
            .Include(l => l.Items)
            .FirstAsync(l => l.Id == 1);
        
        Assert.Equal(2, list.Items.Count); // Still 2, nothing added
    }

    #endregion

    #region ReorderItems Tests

    [Fact]
    public async Task ReorderItems_ShouldUpdatePositions()
    {
        var dto = new ReorderItemsDto { ItemOrder = new List<int> { 2, 1 } }; // Reverse order

        var result = await _controller.ReorderItems(1, dto);

        Assert.IsType<OkObjectResult>(result.Result);

        var items = await _context.MergeListItems
            .Where(i => i.MergeListId == 1)
            .OrderBy(i => i.OrderPosition)
            .ToListAsync();

        Assert.Equal(2, items[0].Id); // Item 2 is now first
        Assert.Equal(1, items[1].Id); // Item 1 is now second
    }

    #endregion

    #region DuplicateList Tests

    [Fact]
    public async Task DuplicateList_ShouldCreateCopy()
    {
        var dto = new CreateMergeListDto { Name = "Lista Cópia" };

        var result = await _controller.DuplicateList(1, dto);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);

        var copiedList = await _context.MergeLists
            .Include(l => l.Items)
            .FirstOrDefaultAsync(l => l.Name == "Lista Cópia");
        
        Assert.NotNull(copiedList);
        Assert.Equal(2, copiedList.Items.Count);
    }

    [Fact]
    public async Task DuplicateList_WithInvalidId_ShouldReturnNotFound()
    {
        var dto = new CreateMergeListDto { Name = "Cópia" };

        var result = await _controller.DuplicateList(999, dto);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion

    #region GenerateReport Tests

    [Fact]
    public async Task GenerateReport_WithValidId_ShouldReturnReport()
    {
        var result = await _controller.GenerateReport(1);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task GenerateReport_WithEmptyList_ShouldReturnEmptyReport()
    {
        // Create empty list
        _context.MergeLists.Add(new MergeList { Id = 2, Name = "Lista Vazia" });
        await _context.SaveChangesAsync();

        var result = await _controller.GenerateReport(2);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task GenerateReport_WithInvalidId_ShouldReturnNotFound()
    {
        var result = await _controller.GenerateReport(999);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    #endregion
}
