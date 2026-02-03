using System.Globalization;
using System.Text;

namespace MusicasIgreja.Api.Helpers;

/// <summary>
/// Helper class for text manipulation, including accent removal and fuzzy search support.
/// </summary>
public static class TextHelper
{
    /// <summary>
    /// Removes diacritics (accents) from a string for fuzzy search matching.
    /// Example: "Música" becomes "Musica", "José" becomes "Jose"
    /// </summary>
    public static string RemoveAccents(string? text)
    {
        if (string.IsNullOrEmpty(text))
            return string.Empty;

        // Normalize the string to decompose accented characters
        var normalizedString = text.Normalize(NormalizationForm.FormD);
        var stringBuilder = new StringBuilder(normalizedString.Length);

        foreach (var c in normalizedString)
        {
            // Skip non-spacing marks (diacritics)
            var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
            if (unicodeCategory != UnicodeCategory.NonSpacingMark)
            {
                stringBuilder.Append(c);
            }
        }

        // Normalize back to composed form
        return stringBuilder.ToString().Normalize(NormalizationForm.FormC);
    }

    /// <summary>
    /// Prepares text for fuzzy search by removing accents and converting to lowercase.
    /// </summary>
    public static string PrepareForSearch(string? text)
    {
        return RemoveAccents(text).ToLowerInvariant();
    }

    /// <summary>
    /// Checks if the search term matches the text (fuzzy, accent-insensitive).
    /// Returns the match priority: 0 = no match, 1 = starts with, 2 = contains.
    /// </summary>
    public static int GetMatchPriority(string? text, string searchTerm)
    {
        if (string.IsNullOrEmpty(text))
            return 0;

        var normalizedText = PrepareForSearch(text);
        var normalizedSearch = PrepareForSearch(searchTerm);

        if (normalizedText.StartsWith(normalizedSearch))
            return 1;

        if (normalizedText.Contains(normalizedSearch))
            return 2;

        return 0;
    }

    /// <summary>
    /// Checks if text contains the search term (accent-insensitive).
    /// </summary>
    public static bool ContainsIgnoreAccents(string? text, string searchTerm)
    {
        return GetMatchPriority(text, searchTerm) > 0;
    }
}
