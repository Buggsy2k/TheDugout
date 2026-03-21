using OpenCvSharp;

namespace TheDugout.Api.Services;

public class ExtractionParams
{
    public int CannyLow { get; set; } = 30;
    public int CannyHigh { get; set; } = 100;
    public int BlurSize { get; set; } = 5;
    public int MorphIterations { get; set; } = 2;
    public float ContourPadding { get; set; } = 0.02f;
    public float FallbackMargin { get; set; } = 0.03f;
    public double MinCardAreaRatio { get; set; } = 0.25;
    public double MinAspectRatio { get; set; } = 0.45;
    public double MaxAspectRatio { get; set; } = 0.95;
}

public class CardImageExtractionService
{
    private readonly ILogger<CardImageExtractionService> _logger;

    private const int OutputQuality = 97;
    private const double MinEdgeDensity = 0.008;
    private const double MinStdDev = 8;
    /// Padding added around the detected card bounding box (percentage of cell dimensions)
    private const float BoundingPadding = 0.04f;

    public CardImageExtractionService(ILogger<CardImageExtractionService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Extracts individual card images from a binder page photo.
    /// Uses OpenCV contour detection with axis-aligned bounding rect (no perspective warp).
    /// Falls back to margin-based crop when contour detection fails.
    /// </summary>
    public async Task<Dictionary<(int row, int col), string>> ExtractCardsFromPageAsync(
        byte[] imageBytes, string layout, string uploadsPath, int binderNumber, int pageNumber, string side = "front", ExtractionParams? extractionParams = null)
    {
        var p = extractionParams ?? new ExtractionParams();
        var results = new Dictionary<(int row, int col), string>();
        var rows = 3;
        var cols = layout == "6x3" ? 6 : 3;

        using var image = Mat.FromImageData(imageBytes, ImreadModes.Color);
        var cellWidth = (float)image.Width / cols;
        var cellHeight = (float)image.Height / rows;

        var dir = Path.Combine(uploadsPath, "cards", "extracted");
        Directory.CreateDirectory(dir);

        for (int r = 0; r < rows; r++)
        {
            for (int c = 0; c < cols; c++)
            {
                var cellX = (int)(c * cellWidth);
                var cellY = (int)(r * cellHeight);
                var cellW = Math.Min((int)cellWidth, image.Width - cellX);
                var cellH = Math.Min((int)cellHeight, image.Height - cellY);
                if (cellW <= 0 || cellH <= 0) continue;

                using var cell = new Mat(image, new Rect(cellX, cellY, cellW, cellH));

                if (IsCellEmpty(cell))
                {
                    _logger.LogInformation("Skipping empty cell: row={Row}, col={Col}", r + 1, c + 1);
                    continue;
                }

                using var cardImage = ExtractCardFromCell(cell, p);

                var fileName = $"b{binderNumber}_p{pageNumber}_r{r + 1}c{c + 1}_{side}_{Guid.NewGuid():N}.jpg";
                var filePath = Path.Combine(dir, fileName);

                var encodeParams = new[] { new ImageEncodingParam(ImwriteFlags.JpegQuality, OutputQuality) };
                await Task.Run(() => Cv2.ImWrite(filePath, cardImage, encodeParams));

                var row = r + 1;
                var col = c + 1;
                results[(row, col)] = $"/uploads/cards/extracted/{fileName}";

                _logger.LogInformation("Extracted card image: row={Row}, col={Col}, side={Side}, path={Path}",
                    row, col, side, filePath);
            }
        }

        return results;
    }

    /// <summary>
    /// Detects whether a grid cell is empty (no card present).
    /// Uses edge density and color variance — a real card has printed content
    /// that produces many edges and higher color variation than an empty sleeve pocket.
    /// Runs two passes: raw and CLAHE-enhanced, so faded cards aren't missed.
    /// </summary>
    private bool IsCellEmpty(Mat cell)
    {
        using var gray = new Mat();
        Cv2.CvtColor(cell, gray, ColorConversionCodes.BGR2GRAY);

        // Check color variance first — empty pockets have very uniform color
        Cv2.MeanStdDev(gray, out _, out var stdDev);
        if (stdDev[0] < MinStdDev)
        {
            _logger.LogDebug("Cell stddev {StdDev:F1} below threshold", stdDev[0]);
            return true;
        }

        using var blurred = new Mat();
        Cv2.GaussianBlur(gray, blurred, new Size(5, 5), 0);

        // Pass 1: raw edges
        using var edges = new Mat();
        Cv2.Canny(blurred, edges, 50, 150);
        var edgePixels = Cv2.CountNonZero(edges);
        var totalPixels = edges.Rows * edges.Cols;
        var edgeDensity = (double)edgePixels / totalPixels;

        if (edgeDensity >= MinEdgeDensity)
            return false;

        // Pass 2: CLAHE-enhanced edges for faded/low-contrast cards
        using var clahe = Cv2.CreateCLAHE(clipLimit: 3.0, tileGridSize: new Size(8, 8));
        using var enhanced = new Mat();
        clahe.Apply(blurred, enhanced);
        using var edgesEnhanced = new Mat();
        Cv2.Canny(enhanced, edgesEnhanced, 30, 100);
        var enhancedEdgePixels = Cv2.CountNonZero(edgesEnhanced);
        var enhancedDensity = (double)enhancedEdgePixels / totalPixels;

        if (enhancedDensity >= MinEdgeDensity)
            return false;

        _logger.LogDebug("Cell edge density {Density:F4} (enhanced: {Enhanced:F4}) below threshold {Threshold}",
            edgeDensity, enhancedDensity, MinEdgeDensity);
        return true;
    }

    /// <summary>
    /// Attempts contour-based card detection within a grid cell.
    /// Uses axis-aligned bounding rect (no perspective warp) since cards are flat.
    /// Falls back to simple margin crop if no good contour is found.
    /// </summary>
    private Mat ExtractCardFromCell(Mat cell, ExtractionParams p)
    {
        var rect = FindCardBounds(cell, p);
        if (rect != null)
        {
            var padded = PadRect(rect.Value, cell.Width, cell.Height, BoundingPadding);
            if (padded.Width >= 50 && padded.Height >= 50)
            {
                using var cropped = new Mat(cell, padded);
                return cropped.Clone();
            }
        }
        return FallbackCrop(cell, p.FallbackMargin);
    }

    /// <summary>
    /// Pads a rectangle outward by a percentage of the cell dimensions,
    /// clamped to cell bounds.
    /// </summary>
    private static Rect PadRect(Rect r, int maxW, int maxH, float pct)
    {
        var padX = (int)(maxW * pct);
        var padY = (int)(maxH * pct);
        var x = Math.Max(0, r.X - padX);
        var y = Math.Max(0, r.Y - padY);
        var right = Math.Min(maxW, r.X + r.Width + padX);
        var bottom = Math.Min(maxH, r.Y + r.Height + padY);
        return new Rect(x, y, right - x, bottom - y);
    }

    /// <summary>
    /// Finds the bounding rectangle of the card within a grid cell.
    /// Runs multiple detection passes with increasing enhancement for faded cards.
    /// Returns an axis-aligned bounding rect (no perspective warp).
    /// </summary>
    private Rect? FindCardBounds(Mat cell, ExtractionParams p)
    {
        using var gray = new Mat();
        Cv2.CvtColor(cell, gray, ColorConversionCodes.BGR2GRAY);

        var bs = Math.Max(3, p.BlurSize | 1);
        using var blurred = new Mat();
        Cv2.GaussianBlur(gray, blurred, new Size(bs, bs), 0);

        // Pass 1: standard Canny on raw grayscale
        var result = FindBoundsFromEdges(cell, blurred, p);
        if (result != null) return result;

        // Pass 2: CLAHE-enhanced for faded/low-contrast cards
        using var clahe = Cv2.CreateCLAHE(clipLimit: 3.0, tileGridSize: new Size(8, 8));
        using var enhanced = new Mat();
        clahe.Apply(blurred, enhanced);
        result = FindBoundsFromEdges(cell, enhanced, p);
        if (result != null) return result;

        // Pass 3: aggressive CLAHE + lower thresholds for very faded cards
        using var claheStrong = Cv2.CreateCLAHE(clipLimit: 6.0, tileGridSize: new Size(4, 4));
        using var strongEnhanced = new Mat();
        claheStrong.Apply(blurred, strongEnhanced);
        var softParams = new ExtractionParams
        {
            CannyLow = Math.Max(10, p.CannyLow / 2),
            CannyHigh = Math.Max(30, p.CannyHigh / 2),
            BlurSize = p.BlurSize,
            MorphIterations = Math.Max(p.MorphIterations, 3),
            ContourPadding = p.ContourPadding,
            FallbackMargin = p.FallbackMargin,
            MinCardAreaRatio = p.MinCardAreaRatio * 0.8,
            MinAspectRatio = p.MinAspectRatio,
            MaxAspectRatio = p.MaxAspectRatio,
        };
        result = FindBoundsFromEdges(cell, strongEnhanced, softParams);
        if (result != null) return result;

        // Pass 4: adaptive threshold for cases where Canny completely fails
        using var adaptive = new Mat();
        Cv2.AdaptiveThreshold(enhanced, adaptive, 255,
            AdaptiveThresholdTypes.GaussianC, ThresholdTypes.Binary, 15, 4);
        Cv2.BitwiseNot(adaptive, adaptive);
        result = FindBoundsFromBinary(cell, adaptive, p);
        return result;
    }

    /// <summary>
    /// Finds card bounds from a preprocessed grayscale image using Canny edge detection.
    /// </summary>
    private Rect? FindBoundsFromEdges(Mat cell, Mat preprocessed, ExtractionParams p)
    {
        using var edges = new Mat();
        Cv2.Canny(preprocessed, edges, p.CannyLow, p.CannyHigh);

        using var kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new Size(3, 3));
        using var closed = new Mat();
        Cv2.MorphologyEx(edges, closed, MorphTypes.Close, kernel, iterations: Math.Max(1, p.MorphIterations));

        return FindBestBoundingRect(cell, closed, p);
    }

    /// <summary>
    /// Finds card bounds from a binary (thresholded) image.
    /// </summary>
    private Rect? FindBoundsFromBinary(Mat cell, Mat binary, ExtractionParams p)
    {
        using var kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new Size(3, 3));
        using var closed = new Mat();
        Cv2.MorphologyEx(binary, closed, MorphTypes.Close, kernel, iterations: Math.Max(1, p.MorphIterations));

        return FindBestBoundingRect(cell, closed, p);
    }

    /// <summary>
    /// Searches contours in a binary edge image for the largest card-shaped region.
    /// Returns an axis-aligned bounding rectangle — no perspective warp.
    /// </summary>
    private Rect? FindBestBoundingRect(Mat cell, Mat edgeImage, ExtractionParams p)
    {
        Cv2.FindContours(edgeImage, out var contours, out _, RetrievalModes.External,
            ContourApproximationModes.ApproxSimple);

        var minArea = cell.Width * cell.Height * p.MinCardAreaRatio;
        Rect? bestRect = null;
        double bestArea = 0;

        foreach (var contour in contours)
        {
            var area = Cv2.ContourArea(contour);
            if (area < minArea || area <= bestArea) continue;

            var rect = Cv2.BoundingRect(contour);
            var aspectRatio = (double)Math.Min(rect.Width, rect.Height) / Math.Max(rect.Width, rect.Height);
            if (aspectRatio >= p.MinAspectRatio && aspectRatio <= p.MaxAspectRatio)
            {
                bestArea = area;
                bestRect = rect;
            }
        }

        return bestRect;
    }

    /// <summary>
    /// Simple margin-based crop as fallback when contour detection fails.
    /// </summary>
    private static Mat FallbackCrop(Mat cell, float marginPercent)
    {
        var marginX = (int)(cell.Width * marginPercent);
        var marginY = (int)(cell.Height * marginPercent);

        var w = cell.Width - 2 * marginX;
        var h = cell.Height - 2 * marginY;

        if (w <= 0 || h <= 0)
            return cell.Clone();

        using var cropped = new Mat(cell, new Rect(marginX, marginY, w, h));
        return cropped.Clone();
    }
}
