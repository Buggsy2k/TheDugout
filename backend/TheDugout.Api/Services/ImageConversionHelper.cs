using OpenCvSharp;

namespace TheDugout.Api.Services;

/// <summary>
/// Converts unsupported image formats (e.g. TIFF) to PNG for browser compatibility.
/// </summary>
public static class ImageConversionHelper
{
    private static readonly HashSet<string> TiffExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".tif", ".tiff"
    };

    /// <summary>
    /// Returns true if the file extension is a TIFF format.
    /// </summary>
    public static bool IsTiff(string extension) => TiffExtensions.Contains(extension);

    /// <summary>
    /// Converts image bytes from TIFF to PNG. Returns the PNG bytes.
    /// </summary>
    public static byte[] ConvertTiffToPng(byte[] tiffBytes)
    {
        using var mat = Mat.FromImageData(tiffBytes, ImreadModes.Color);
        Cv2.ImEncode(".png", mat, out var pngBytes);
        return pngBytes;
    }

    /// <summary>
    /// Creates an IFormFile-compatible MemoryStream with PNG content from TIFF bytes,
    /// returning the new file name with .png extension.
    /// </summary>
    public static (Stream stream, string fileName) ConvertTiffFileToStream(IFormFile tiffFile)
    {
        using var ms = new MemoryStream();
        tiffFile.CopyTo(ms);
        var pngBytes = ConvertTiffToPng(ms.ToArray());
        var pngStream = new MemoryStream(pngBytes);
        var newFileName = Path.ChangeExtension(tiffFile.FileName, ".png");
        return (pngStream, newFileName);
    }

    /// <summary>
    /// Prepares image bytes for the Claude Vision API by resizing large images
    /// and encoding as JPEG to stay within API size limits.
    /// Returns the processed bytes and the appropriate media type.
    /// </summary>
    public static (byte[] bytes, string mediaType) PrepareForAi(byte[] imageBytes, int maxDimension = 2048)
    {
        using var mat = Mat.FromImageData(imageBytes, ImreadModes.Color);
        var resized = mat;
        var needsDispose = false;

        if (mat.Width > maxDimension || mat.Height > maxDimension)
        {
            var scale = Math.Min((double)maxDimension / mat.Width, (double)maxDimension / mat.Height);
            var newSize = new Size((int)(mat.Width * scale), (int)(mat.Height * scale));
            resized = new Mat();
            needsDispose = true;
            Cv2.Resize(mat, resized, newSize, interpolation: InterpolationFlags.Area);
        }

        try
        {
            var encodeParams = new[] { new ImageEncodingParam(ImwriteFlags.JpegQuality, 90) };
            Cv2.ImEncode(".jpg", resized, out var jpegBytes, encodeParams);
            return (jpegBytes, "image/jpeg");
        }
        finally
        {
            if (needsDispose) resized.Dispose();
        }
    }
}
