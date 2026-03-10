using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using NpgsqlTypes;

#nullable disable

namespace TheDugout.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Binders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TotalPages = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Binders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Cards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BinderNumber = table.Column<int>(type: "integer", nullable: false),
                    PageNumber = table.Column<int>(type: "integer", nullable: false),
                    Row = table.Column<int>(type: "integer", nullable: false),
                    Column = table.Column<int>(type: "integer", nullable: false),
                    PlayerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    SetName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CardNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Team = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Manufacturer = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    EstimatedCondition = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ConditionNotes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ValueRangeLow = table.Column<decimal>(type: "numeric(10,2)", nullable: true),
                    ValueRangeHigh = table.Column<decimal>(type: "numeric(10,2)", nullable: true),
                    ImagePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SourceImagePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Tags = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsGraded = table.Column<bool>(type: "boolean", nullable: false),
                    GradingService = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    GradeValue = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SearchVector = table.Column<NpgsqlTsVector>(type: "tsvector", nullable: true)
                        .Annotation("Npgsql:TsVectorConfig", "english")
                        .Annotation("Npgsql:TsVectorProperties", new[] { "PlayerName", "SetName", "Team", "Manufacturer", "Notes", "Tags" })
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Cards_Binders_BinderNumber",
                        column: x => x.BinderNumber,
                        principalTable: "Binders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Binders_Name",
                table: "Binders",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Card_Location",
                table: "Cards",
                columns: new[] { "BinderNumber", "PageNumber", "Row", "Column" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cards_PlayerName",
                table: "Cards",
                column: "PlayerName");

            migrationBuilder.CreateIndex(
                name: "IX_Cards_SearchVector",
                table: "Cards",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_Cards_SetName",
                table: "Cards",
                column: "SetName");

            migrationBuilder.CreateIndex(
                name: "IX_Cards_Team",
                table: "Cards",
                column: "Team");

            migrationBuilder.CreateIndex(
                name: "IX_Cards_Year",
                table: "Cards",
                column: "Year");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Cards");

            migrationBuilder.DropTable(
                name: "Binders");
        }
    }
}
