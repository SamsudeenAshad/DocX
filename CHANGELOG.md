# Changelog

## 0.1.0 — 2026-06-26

Initial release.

### Added
- **n8n community node `DocX Convert`** (`n8n-nodes-docx`) — convert documents
  between Word (DOCX), Excel (XLSX), Markdown, PDF, HTML and plain text.
  - Source-format auto-detection (filename + magic bytes).
  - Configurable input/output binary properties, output filename, LibreOffice
    path override, and per-conversion timeout.
  - Per-item error handling honouring "Continue On Fail".
- **Reusable library** (`convert()`) usable outside n8n.
- **LibreOffice headless** engine with binary auto-resolution
  (`$SOFFICE_PATH` → PATH → common install paths) and isolated per-call
  profiles for safe concurrent conversions.
- Pure-JS Markdown ↔ HTML (no LibreOffice required).

### Notes
- Conversions involving DOCX/XLSX/PDF require LibreOffice installed on the host.
