using System.Threading.Channels;
using MusicasIgreja.Api.Data;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace MusicasIgreja.Api.Services;

public class OcrJob
{
    public int FileId { get; set; }
    public string FilePath { get; set; } = string.Empty;
}

public class OcrBackgroundService : BackgroundService
{
    private readonly ChannelReader<OcrJob> _channelReader;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<OcrBackgroundService> _logger;
    private readonly SemaphoreSlim _concurrencyLimiter = new(1);
    private const long MaxPdfSizeBytes = 25 * 1024 * 1024;

    public OcrBackgroundService(
        ChannelReader<OcrJob> channelReader,
        IServiceProvider serviceProvider,
        ILogger<OcrBackgroundService> logger)
    {
        _channelReader = channelReader;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OCR background service started");

        await foreach (var job in _channelReader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await _concurrencyLimiter.WaitAsync(stoppingToken);
                try
                {
                    await ProcessOcrAsync(job, stoppingToken);
                }
                finally
                {
                    _concurrencyLimiter.Release();
                    GC.Collect(0, GCCollectionMode.Optimized);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OCR processing failed for file {FileId}", job.FileId);
            }
        }

        _logger.LogInformation("OCR background service stopped");
    }

    private async Task ProcessOcrAsync(OcrJob job, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var file = await context.PdfFiles.FindAsync(new object?[] { job.FileId }, cancellationToken: ct);
        if (file == null)
        {
            _logger.LogWarning("File {FileId} not found for OCR", job.FileId);
            return;
        }

        if (!File.Exists(job.FilePath))
        {
            file.OcrStatus = "failed";
            file.OcrError = "Arquivo não encontrado";
            await context.SaveChangesAsync(ct);
            return;
        }

        var fileInfo = new FileInfo(job.FilePath);
        if (fileInfo.Length > MaxPdfSizeBytes)
        {
            file.OcrStatus = "failed";
            file.OcrError = $"PDF muito grande ({fileInfo.Length / (1024.0 * 1024.0):F1}MB). Máximo: {MaxPdfSizeBytes / (1024.0 * 1024.0):F0}MB";
            await context.SaveChangesAsync(ct);
            _logger.LogWarning("PDF {FileId} exceeds max size: {SizeMB}MB", job.FileId, fileInfo.Length / (1024.0 * 1024.0));
            return;
        }

        file.OcrStatus = "processing";
        file.OcrStartedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        try
        {
            string extractedText = ExtractTextFromPdf(job.FilePath);

            if (string.IsNullOrWhiteSpace(extractedText) || extractedText.Length < 100)
            {
                file.ChordContentDraft = string.IsNullOrWhiteSpace(extractedText) ? null : extractedText;
                file.OcrStatus = "done_low_confidence";
                file.OcrError = "Extração baixa confiança: texto muito curto ou ilegível";
            }
            else
            {
                file.ChordContentDraft = extractedText;
                file.OcrStatus = "done";
                file.OcrError = null;
            }
        }
        catch (Exception ex)
        {
            file.OcrStatus = "failed";
            file.OcrError = ex.Message;
            _logger.LogError(ex, "OCR extraction error for file {FileId}", job.FileId);
        }

        await context.SaveChangesAsync(ct);
    }

    private string ExtractTextFromPdf(string filePath)
    {
        try
        {
            using var doc = PdfDocument.Open(filePath);
            var text = new System.Text.StringBuilder();

            foreach (var page in doc.GetPages())
            {
                var words = page.GetWords().ToList();

                var lines = new List<List<Word>>();
                var sortedWords = words.OrderByDescending(w => w.BoundingBox.Bottom).ToList();

                if (sortedWords.Any())
                {
                    var currentLine = new List<Word> { sortedWords[0] };
                    lines.Add(currentLine);
                    var currentBottom = sortedWords[0].BoundingBox.Bottom;

                    for (int i = 1; i < sortedWords.Count; i++)
                    {
                        var word = sortedWords[i];
                        // Se a diferença no eixo Y for pequena (< 10), consideramos que estão na mesma linha
                        if (Math.Abs(currentBottom - word.BoundingBox.Bottom) < 10)
                        {
                            currentLine.Add(word);
                        }
                        else
                        {
                            currentLine = new List<Word> { word };
                            lines.Add(currentLine);
                            currentBottom = word.BoundingBox.Bottom;
                        }
                    }
                }

                foreach (var line in lines)
                {
                    var sortedLine = line.OrderBy(w => w.BoundingBox.Left).ToList();

                    // Heurística de largura média do caractere
                    double avgCharWidth = 5.0; // Fallback
                    if (sortedLine.Any(w => w.Text.Length > 0))
                    {
                        avgCharWidth = sortedLine.Average(w => w.BoundingBox.Width / Math.Max(1, w.Text.Length));
                    }

                    if (avgCharWidth <= 0) avgCharWidth = 5.0;

                    // Espaços iniciais na linha
                    double currentX = sortedLine[0].BoundingBox.Left;
                    // Reduzimos o leadingSpaces para não ficar extremamente indentado, usamos um offset menor
                    int leadingSpaces = (int)(currentX / avgCharWidth) - 5; 
                    if (leadingSpaces > 0)
                    {
                        text.Append(new string(' ', leadingSpaces));
                    }

                    for (int i = 0; i < sortedLine.Count; i++)
                    {
                        var word = sortedLine[i];

                        if (i > 0)
                        {
                            var prevWord = sortedLine[i - 1];
                            var gap = word.BoundingBox.Left - prevWord.BoundingBox.Right;
                            if (gap > (avgCharWidth * 0.3)) // Se houver um gap significativo
                            {
                                int numSpaces = (int)(gap / avgCharWidth);
                                numSpaces = Math.Max(1, numSpaces); // Garante pelo menos 1 espaço
                                text.Append(new string(' ', numSpaces));
                            }
                        }

                        text.Append(word.Text);
                    }
                    text.AppendLine();
                }
            }

            return text.ToString();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Falha ao extrair texto do PDF: {ex.Message}", ex);
        }
    }
}
