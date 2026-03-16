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
    private const double MinEdgeDensity = 0.02;

    public CardImageExtractionService(ILogger<CardImageExtractionService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Extracts individual card images from a binder page photo.
    /// Uses OpenCV contour detection + perspective correction to handle skew.
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
    /// </summary>
    private bool IsCellEmpty(Mat cell)
    {
        using var gray = new Mat();
        Cv2.CvtColor(cell, gray, ColorConversionCodes.BGR2GRAY);

        using var blurred = new Mat();
        Cv2.GaussianBlur(gray, blurred, new Size(5, 5), 0);

        // Check edge density — cards have printed text/graphics that produce many edges
        using var edges = new Mat();
        Cv2.Canny(blurred, edges, 50, 150);
        var edgePixels = Cv2.CountNonZero(edges);
        var totalPixels = edges.Rows * edges.Cols;
        var edgeDensity = (double)edgePixels / totalPixels;

        if (edgeDensity < MinEdgeDensity)
        {
            _logger.LogDebug("Cell edge density {Density:F4} below threshold {Threshold}",
                edgeDensity, MinEdgeDensity);
            return true;
        }

        // Check color variance — empty pockets have very uniform color
        Cv2.MeanStdDev(gray, out _, out var stdDev);
        if (stdDev[0] < 15)
        {
            _logger.LogDebug("Cell stddev {StdDev:F1} below threshold", stdDev[0]);
            return true;
        }

        return false;
    }

    /// <summary>
    /// Attempts contour-based card detection within a grid cell.
    /// Falls back to simple margin crop if no good quadrilateral is found.
    /// </summary>
    private Mat ExtractCardFromCell(Mat cell, ExtractionParams p)
    {
        var quad = FindCardContour(cell, p);
        if (quad != null)
        {
            var padded = ExpandQuad(quad, cell.Width, cell.Height, p.ContourPadding);
            var result = PerspectiveCorrect(cell, padded);
            if (result != null)
                return result;
        }
        return FallbackCrop(cell, p.FallbackMargin);
    }

    /// <summary>
    /// Expands a quadrilateral outward from its center by a percentage so the
    /// resulting crop includes a small border around the card edges.
    /// Points are clamped to the cell bounds.
    /// </summary>
    private static Point2f[] ExpandQuad(Point2f[] quad, int maxW, int maxH, float pct)
    {
        var cx = quad.Average(p => p.X);
        var cy = quad.Average(p => p.Y);

        var expanded = new Point2f[4];
        for (int i = 0; i < 4; i++)
        {
            var dx = quad[i].X - cx;
            var dy = quad[i].Y - cy;
            var nx = quad[i].X + dx * pct;
            var ny = quad[i].Y + dy * pct;
            expanded[i] = new Point2f(
                Math.Clamp(nx, 0, maxW - 1),
                Math.Clamp(ny, 0, maxH - 1));
        }
        return expanded;
    }

    /// <summary>
    /// Finds the largest convex quadrilateral in the cell that could be a card.
    /// Uses Gaussian blur + Canny edges with moderate morphological closing.
    /// </summary>
    private Point2f[]? FindCardContour(Mat cell, ExtractionParams p)
    {
        using var gray = new Mat();
        Cv2.CvtColor(cell, gray, ColorConversionCodes.BGR2GRAY);

        using var blurred = new Mat();
        var bs = Math.Max(3, p.BlurSize | 1); // must be odd
        Cv2.GaussianBlur(gray, blurred, new Size(bs, bs), 0);

        using var edges = new Mat();
        Cv2.Canny(blurred, edges, p.CannyLow, p.CannyHigh);

        using var kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new Size(3, 3));
        using var closed = new Mat();
        Cv2.MorphologyEx(edges, closed, MorphTypes.Close, kernel, iterations: Math.Max(1, p.MorphIterations));

        Cv2.FindContours(closed, out var contours, out _, RetrievalModes.External,
            ContourApproximationModes.ApproxSimple);

        var minArea = cell.Width * cell.Height * p.MinCardAreaRatio;
        Point2f[]? bestQuad = null;
        double bestArea = 0;

        foreach (var contour in contours)
        {
            var area = Cv2.ContourArea(contour);
            if (area < minArea || area <= bestArea) continue;

            var peri = Cv2.ArcLength(contour, true);

            // Try two epsilon values to handle slight sleeve distortion
            foreach (var epsFactor in new[] { 0.02, 0.04 })
            {
                var approx = Cv2.ApproxPolyDP(contour, epsFactor * peri, true);
                if (approx.Length == 4 && Cv2.IsContourConvex(approx))
                {
                    var quad = OrderQuadPoints(approx.Select(p => new Point2f(p.X, p.Y)).ToArray());
                    if (IsCardAspectRatio(quad, p.MinAspectRatio, p.MaxAspectRatio))
                    {
                        bestArea = area;
                        bestQuad = quad;
                        break;
                    }
                }
            }
        }

        return bestQuad;
    }

    /// <summary>
    /// Validates that a quadrilateral has roughly standard card proportions (2.5:3.5).
    /// </summary>
    private static bool IsCardAspectRatio(Point2f[] quad, double minRatio, double maxRatio)
    {
        var widthTop = Distance(quad[0], quad[1]);
        var widthBottom = Distance(quad[3], quad[2]);
        var heightLeft = Distance(quad[0], quad[3]);
        var heightRight = Distance(quad[1], quad[2]);

        var avgWidth = (widthTop + widthBottom) / 2;
        var avgHeight = (heightLeft + heightRight) / 2;

        if (avgWidth < 10 || avgHeight < 10) return false;

        var ratio = Math.Min(avgWidth, avgHeight) / Math.Max(avgWidth, avgHeight);
        return ratio >= minRatio && ratio <= maxRatio;
    }

    /// <summary>
    /// Orders 4 points as: top-left, top-right, bottom-right, bottom-left.
    /// Uses sum/difference heuristic standard in OpenCV literature.
    /// </summary>
    private static Point2f[] OrderQuadPoints(Point2f[] pts)
    {
        // Smallest sum (x+y) = top-left, largest = bottom-right
        // Smallest difference (y-x) = top-right, largest = bottom-left
        var indexed = pts.Select((p, i) => (p, i)).ToArray();

        var tl = indexed.OrderBy(x => x.p.X + x.p.Y).First().p;
        var br = indexed.OrderByDescending(x => x.p.X + x.p.Y).First().p;
        var tr = indexed.OrderBy(x => x.p.Y - x.p.X).First().p;
        var bl = indexed.OrderByDescending(x => x.p.Y - x.p.X).First().p;

        return [tl, tr, br, bl];
    }

    /// <summary>
    /// Applies perspective warp to straighten a detected card quadrilateral.
    /// Uses bicubic interpolation for high quality output.
    /// </summary>
    private Mat? PerspectiveCorrect(Mat cell, Point2f[] quad)
    {
        var widthTop = Distance(quad[0], quad[1]);
        var widthBottom = Distance(quad[3], quad[2]);
        var outWidth = (int)Math.Max(widthTop, widthBottom);

        var heightLeft = Distance(quad[0], quad[3]);
        var heightRight = Distance(quad[1], quad[2]);
        var outHeight = (int)Math.Max(heightLeft, heightRight);

        if (outWidth < 50 || outHeight < 50)
            return null;

        var dst = new Point2f[]
        {
            new(0, 0),
            new(outWidth - 1, 0),
            new(outWidth - 1, outHeight - 1),
            new(0, outHeight - 1)
        };

        using var transform = Cv2.GetPerspectiveTransform(quad, dst);
        var warped = new Mat();
        Cv2.WarpPerspective(cell, warped, transform, new Size(outWidth, outHeight),
            InterpolationFlags.Cubic, BorderTypes.Replicate);

        return warped;
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

    private static float Distance(Point2f a, Point2f b)
    {
        var dx = a.X - b.X;
        var dy = a.Y - b.Y;
        return MathF.Sqrt(dx * dx + dy * dy);
    }
}
