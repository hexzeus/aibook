import type { Page } from '../lib/api';

/**
 * Generate print-friendly HTML for a book
 */
export function generatePrintHTML(
  title: string,
  subtitle: string | undefined,
  pages: Page[],
  includePageNumbers: boolean = true
): string {
  const pageBreak = includePageNumbers ? 'page-break-after: always;' : '';

  const pagesHTML = pages
    .map((page, index) => {
      const isLastPage = index === pages.length - 1;
      return `
        <div class="print-page" style="${!isLastPage ? pageBreak : ''}">
          ${includePageNumbers ? `<div class="page-number">Page ${page.page_number}</div>` : ''}
          <div class="page-section">${page.section}</div>
          <div class="page-content">${page.content.replace(/\n/g, '<br>')}</div>
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.6;
      color: #000;
      max-width: 21cm;
      margin: 0 auto;
      padding: 20px;
    }

    .title-page {
      text-align: center;
      padding: 100px 0;
      page-break-after: always;
    }

    .book-title {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 20px;
    }

    .book-subtitle {
      font-size: 24px;
      color: #666;
      margin-bottom: 40px;
    }

    .print-page {
      min-height: 90vh;
      padding: 20px 0;
    }

    .page-number {
      text-align: right;
      font-size: 12px;
      color: #666;
      margin-bottom: 10px;
    }

    .page-section {
      font-size: 14px;
      font-weight: bold;
      color: #333;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .page-content {
      font-size: 14px;
      text-align: justify;
      white-space: pre-wrap;
    }

    @media print {
      body {
        padding: 0;
      }

      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="title-page">
    <div class="book-title">${title}</div>
    ${subtitle ? `<div class="book-subtitle">${subtitle}</div>` : ''}
  </div>

  ${pagesHTML}
</body>
</html>
  `;
}

/**
 * Print a book using the browser's print dialog
 */
export function printBook(
  title: string,
  subtitle: string | undefined,
  pages: Page[],
  includePageNumbers: boolean = true
): void {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('Please allow pop-ups to print your book');
    return;
  }

  const html = generatePrintHTML(title, subtitle, pages, includePageNumbers);

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load before printing
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

/**
 * Download book as HTML file
 */
export function downloadBookHTML(
  title: string,
  subtitle: string | undefined,
  pages: Page[]
): void {
  const html = generatePrintHTML(title, subtitle, pages, true);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
