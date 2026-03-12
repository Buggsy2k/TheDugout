using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TheDugout.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveBinderForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cards_Binders_BinderNumber",
                table: "Cards");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddForeignKey(
                name: "FK_Cards_Binders_BinderNumber",
                table: "Cards",
                column: "BinderNumber",
                principalTable: "Binders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
