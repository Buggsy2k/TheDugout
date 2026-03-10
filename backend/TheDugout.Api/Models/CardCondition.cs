namespace TheDugout.Api.Models;

public enum CardCondition
{
    PR,      // Poor (PSA 1)
    FR,      // Fair (PSA 1.5)
    GD,      // Good (PSA 2-2.5)
    VG,      // Very Good (PSA 3-3.5)
    VGEX,    // VG-EX (PSA 4-4.5)
    EX,      // Excellent (PSA 5-5.5)
    EXMT,    // EX-MT (PSA 6-6.5)
    NM,      // Near Mint (PSA 7-7.5)
    NMMT,    // NM-MT (PSA 8-8.5)
    MT,      // Mint (PSA 9-9.5)
    GEM,     // Gem Mint (PSA 10)
    UNKNOWN  // Not yet assessed
}
