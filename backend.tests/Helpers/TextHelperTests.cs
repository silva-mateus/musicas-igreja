using MusicasIgreja.Api.Helpers;

namespace MusicasIgreja.Api.Tests.Helpers;

public class TextHelperTests
{
    #region RemoveAccents Tests

    [Theory]
    [InlineData("música", "musica")]
    [InlineData("José", "Jose")]
    [InlineData("coração", "coracao")]
    [InlineData("canção", "cancao")]
    [InlineData("Glória", "Gloria")]
    [InlineData("São Paulo", "Sao Paulo")]
    [InlineData("ação", "acao")]
    [InlineData("Ñoño", "Nono")]
    [InlineData("über", "uber")]
    [InlineData("naïve", "naive")]
    public void RemoveAccents_ShouldRemoveAccentsCorrectly(string input, string expected)
    {
        var result = TextHelper.RemoveAccents(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void RemoveAccents_WithNullInput_ShouldReturnEmptyString()
    {
        var result = TextHelper.RemoveAccents(null);
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void RemoveAccents_WithEmptyInput_ShouldReturnEmptyString()
    {
        var result = TextHelper.RemoveAccents(string.Empty);
        Assert.Equal(string.Empty, result);
    }

    [Theory]
    [InlineData("ABC123")]
    [InlineData("Hello World")]
    [InlineData("test-file_name.pdf")]
    public void RemoveAccents_WithNoAccents_ShouldReturnSameString(string input)
    {
        var result = TextHelper.RemoveAccents(input);
        Assert.Equal(input, result);
    }

    #endregion

    #region PrepareForSearch Tests

    [Theory]
    [InlineData("Música", "musica")]
    [InlineData("JOSÉ", "jose")]
    [InlineData("Canção do Mar", "cancao do mar")]
    public void PrepareForSearch_ShouldRemoveAccentsAndLowercase(string input, string expected)
    {
        var result = TextHelper.PrepareForSearch(input);
        Assert.Equal(expected, result);
    }

    #endregion

    #region GetMatchPriority Tests

    [Fact]
    public void GetMatchPriority_WhenStartsWith_ShouldReturnPriority1()
    {
        var priority = TextHelper.GetMatchPriority("Música Católica", "Mus");
        Assert.Equal(1, priority);
    }

    [Fact]
    public void GetMatchPriority_WhenContains_ShouldReturnPriority2()
    {
        var priority = TextHelper.GetMatchPriority("Ave Maria", "mar");
        Assert.Equal(2, priority);
    }

    [Fact]
    public void GetMatchPriority_WhenNoMatch_ShouldReturnPriority0()
    {
        var priority = TextHelper.GetMatchPriority("Ave Maria", "xyz");
        Assert.Equal(0, priority);
    }

    [Fact]
    public void GetMatchPriority_WithAccents_ShouldMatchWithoutAccents()
    {
        // Searching "musica" should match "Música"
        var priority = TextHelper.GetMatchPriority("Música", "musica");
        Assert.Equal(1, priority);
    }

    [Fact]
    public void GetMatchPriority_WithNullText_ShouldReturnZero()
    {
        var priority = TextHelper.GetMatchPriority(null, "test");
        Assert.Equal(0, priority);
    }

    #endregion

    #region ContainsIgnoreAccents Tests

    [Theory]
    [InlineData("Música Católica", "musica", true)]
    [InlineData("Ave Maria", "maria", true)]
    [InlineData("Glória a Deus", "gloria", true)]
    [InlineData("São José", "jose", true)]
    [InlineData("Canção Nova", "xyz", false)]
    public void ContainsIgnoreAccents_ShouldMatchCorrectly(string text, string search, bool expected)
    {
        var result = TextHelper.ContainsIgnoreAccents(text, search);
        Assert.Equal(expected, result);
    }

    #endregion
}
