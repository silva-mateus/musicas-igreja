using System.Text.RegularExpressions;
using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;
using MusicasIgreja.Api.Services.Interfaces;

namespace MusicasIgreja.Api.Services;

public class ChordPdfRenderer : IChordPdfRenderer
{
    private static readonly string[] Notes = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"];
    private const int MarginLeft = 40;
    private const int MarginRight = 40;
    private const int MarginTop = 40;
    private const int MarginBottom = 40;
    private const float FontSize = 9;
    private const float LineSpacing = 14;

    public PdfDocument Render(string chordContent, string? key = null, bool useCapo = false, int? capoFret = null)
    {
        var doc = new PdfDocument();
        var page = doc.AddPage();
        XGraphics gfx = XGraphics.FromPdfPage(page);

        var font = new XFont("Courier New", FontSize, XFontStyle.Regular);
        var boldFont = new XFont("Courier New", FontSize, XFontStyle.Bold);

        float y = MarginTop;

        // Parse ChordPro header
        var (title, artist, songKey, capo) = ParseChordProHeader(chordContent);
        title ??= "Sem título";
        key ??= songKey ?? "C";

        // Calculate capo if transposing
        int? displayCapo = null;
        if (useCapo && capoFret.HasValue && capoFret.Value != 0)
        {
            displayCapo = capoFret.Value;
        }

        // Draw header
        var headerText = string.IsNullOrEmpty(artist) ? title : $"{title} — {artist}";
        gfx.DrawString(headerText, boldFont, XBrushes.Black, new XPoint(MarginLeft, y + boldFont.GetHeight()));
        y += 20;
        gfx.DrawString($"Tom: {key}" + (displayCapo.HasValue ? $" | Capo {displayCapo}" : ""), font, XBrushes.Black, new XPoint(MarginLeft, y + font.GetHeight()));
        y += 25;

        // Parse and render lyrics with chords
        var lines = chordContent.Split('\n');

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line))
                continue;

            // Skip ChordPro header directives
            if (line.StartsWith("{") && line.EndsWith("}"))
                continue;

            if (y > (float)page.Height - MarginBottom - LineSpacing * 2)
            {
                gfx.Dispose();
                page = doc.AddPage();
                gfx = XGraphics.FromPdfPage(page);
                y = MarginTop;
            }

            var (chordLine, lyricLine) = SeparateChordAndLyric(line, useCapo, capoFret);

            // Draw chord line
            if (!string.IsNullOrEmpty(chordLine))
            {
                gfx.DrawString(chordLine, font, XBrushes.Black, new XPoint(MarginLeft, y + font.GetHeight()));
            }

            y += LineSpacing;

            // Draw lyric line
            gfx.DrawString(lyricLine, font, XBrushes.Black, new XPoint(MarginLeft, y + font.GetHeight()));
            y += LineSpacing;
        }

        gfx.Dispose();
        return doc;
    }

    private (string? Title, string? Artist, string? Key, int? Capo) ParseChordProHeader(string content)
    {
        string? title = null;
        string? artist = null;
        string? key = null;
        int? capo = null;

        var lines = content.Split('\n');
        foreach (var line in lines)
        {
            if (line.StartsWith("{title:"))
                title = ExtractDirectiveValue(line);
            else if (line.StartsWith("{artist:"))
                artist = ExtractDirectiveValue(line);
            else if (line.StartsWith("{key:"))
                key = ExtractDirectiveValue(line);
            else if (line.StartsWith("{capo:"))
            {
                var capoStr = ExtractDirectiveValue(line);
                if (int.TryParse(capoStr, out int capoVal))
                    capo = capoVal;
            }
        }

        return (title, artist, key, capo);
    }

    private string? ExtractDirectiveValue(string line)
    {
        var match = Regex.Match(line, @"\{[^:]+:\s*([^}]*)\}");
        return match.Success ? match.Groups[1].Value.Trim() : null;
    }

    private (string ChordLine, string LyricLine) SeparateChordAndLyric(string line, bool useCapo, int? capoFret)
    {
        var chords = new List<(int Position, string Chord)>();
        var lyricOnly = new System.Text.StringBuilder();
        var chordLine = new System.Text.StringBuilder();

        var chordPattern = @"\[([^\]]+)\]";
        int lastEnd = 0;

        foreach (Match match in Regex.Matches(line, chordPattern))
        {
            string chord = match.Groups[1].Value;
            int chordPos = match.Index;

            // Add lyric text before this chord
            string lyricPart = line.Substring(lastEnd, chordPos - lastEnd);
            lyricOnly.Append(lyricPart);

            // Transpose chord if needed
            if (!useCapo && capoFret.HasValue && capoFret.Value != 0)
            {
                chord = TransposeChord(chord, capoFret.Value);
            }

            chords.Add((lyricOnly.Length, chord));
            lastEnd = match.Index + match.Length;
        }

        // Add remaining lyric
        if (lastEnd < line.Length)
        {
            lyricOnly.Append(line.Substring(lastEnd));
        }

        string finalLyric = lyricOnly.ToString();

        // Build chord line with proper spacing
        if (chords.Count == 0)
            return ("", finalLyric);

        int cursorPos = 0;
        foreach (var (pos, chord) in chords)
        {
            int padding = pos - cursorPos;
            if (padding > 0)
                chordLine.Append(new string(' ', padding));
            chordLine.Append(chord);
            cursorPos = pos + chord.Length;
        }

        return (chordLine.ToString(), finalLyric);
    }

    private string TransposeChord(string chord, int semitones)
    {
        // Extract root note and suffix
        var match = Regex.Match(chord, @"^([A-G][#b]?)(.*)$");
        if (!match.Success)
            return chord;

        string root = match.Groups[1].Value;
        string suffix = match.Groups[2].Value;

        // Normalize enharmonic (Db -> C#, etc.)
        root = NormalizeNote(root);

        // Find index and transpose
        int idx = Array.IndexOf(Notes, root);
        if (idx < 0)
            return chord;

        int newIdx = (idx + semitones) % 12;
        if (newIdx < 0)
            newIdx += 12;

        return Notes[newIdx].Split('/')[0] + suffix;
    }

    private string NormalizeNote(string note)
    {
        return note switch
        {
            "Db" => "C#/Db",
            "Eb" => "D#/Eb",
            "Gb" => "F#/Gb",
            "Ab" => "G#/Ab",
            "Bb" => "A#/Bb",
            _ => note
        };
    }
}
