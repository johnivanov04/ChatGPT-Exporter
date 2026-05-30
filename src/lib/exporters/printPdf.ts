/**
 * Triggers the browser's Print dialog. The browser provides "Save as PDF"
 * as a destination on every modern platform — the design doc explicitly
 * accepts browser print-to-PDF for the MVP.
 *
 * We temporarily swap document.title so the default filename suggested in
 * the print dialog matches the conversation title.
 */
export function printConversation(
  baseFilename: string,
  win: Window = window,
): void {
  const doc = win.document;
  const originalTitle = doc.title;
  const restore = () => {
    doc.title = originalTitle;
    win.removeEventListener("afterprint", restore);
  };

  doc.title = baseFilename;
  win.addEventListener("afterprint", restore);
  // Fallback restore if afterprint never fires (some headless environments).
  win.setTimeout(restore, 60_000);

  win.print();
}
