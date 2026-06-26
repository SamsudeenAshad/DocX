# Changelog

## 0.2.0 — 2026-06-26

### Changed — no more LibreOffice
- **Replaced the LibreOffice engine with a 100% pure-JavaScript pipeline.** The
  node now works on any n8n instance (managed hosts, Docker, etc.) with **zero**
  system dependencies — no more `LibreOffice not found` errors.
- PDFs are generated with `pdfkit`; DOCX with `docx`; spreadsheets with `xlsx`
  (SheetJS); DOCX is read with `mammoth`; PDF text via `pdf-parse`.
- Removed the **LibreOffice Path** and **Timeout** node options (no longer used).

### Added
- CSV as a first-class source/target; XLSX → XLSX/CSV; PDF → XLSX/CSV (best-effort).

### Notes
- Pure-JS conversion favours content/structure over pixel-perfect layout. See the
  README fidelity notes.

## 0.1.1 — 2026-06-26

### Fixed
- Corrected `repository`, `homepage`, `bugs` and `author` metadata to point at
  the real project (`github.com/SamsudeenAshad/DocX`).

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
