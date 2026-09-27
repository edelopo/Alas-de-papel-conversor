const CRITERIA = [
  ['PREDICTIBILIDAD', 3, 4, 'eye'],
  ['CARISMA PERSONAJES', 5, 6, 'users'],
  ['PUNTOS DE VISTA', 7, 8, 'compass'],
  ['AMBIENTACIÓN (Espacio, entorno, época…)', 9, 10, 'mountain'],
  ['EXPRESIÓN ESCRITA', 11, 12, 'pen-line'],
  ['EMOCIÓMETRO', 13, 14, 'heart'],
  ['DIÁLOGOS', 15, 16, 'message-circle'],
  ['ESTÉTICA DEL LIBRO', 17, 18, 'palette'],
  ['ENGANCHE', 19, 20, 'magnet'],
  ['FINAL', 21, 22, 'flag'],
];
const REQUIRED_HEADERS = ['Marca temporal', '¿Quién eres?', 'Título del libro'];
const APP_VERSION = 'v0.9.0';
const BOOKLET_COLORS = {
  paper: '#fbfaf6',
  coverPaper: '#f5f2e9',
  ink: '#263b34',
  muted: '#64736c',
  accent: '#c35f3b',
  sage: '#e6ede4',
  rule: '#d4ddd2',
  white: '#ffffff',
};
const DROP_ZONE = document.querySelector('#drop-zone');
const FILE_INPUT = document.querySelector('#csv-input');
const FILE_STATUS = document.querySelector('#file-status');
const GENERATE_BUTTON = document.querySelector('#generate-button');
const PREVIEW_BUTTON = document.querySelector('#preview-button');
const MESSAGE = document.querySelector('#message');
const PREVIEW_DIALOG = document.querySelector('#preview-dialog');
const PREVIEW_FRAME = document.querySelector('#preview-frame');
const INCLUDE_COVER = document.querySelector('#include-cover');
const CUSTOM_COVER_TITLE = document.querySelector('#custom-cover-title');
let parsedReviews = null;
let fileReadSequence = 0;
let previewUrl = null;
let busy = false;
let criterionIcons = null;
let iconLoadPromise = null;

document.querySelector('#footer-version').textContent = APP_VERSION;
FILE_INPUT.addEventListener('change', (event) => handleFile(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => DROP_ZONE.addEventListener(eventName, (event) => {
  event.preventDefault();
  DROP_ZONE.classList.add('is-dragging');
}));
['dragleave', 'drop'].forEach((eventName) => DROP_ZONE.addEventListener(eventName, (event) => {
  event.preventDefault();
  DROP_ZONE.classList.remove('is-dragging');
}));
DROP_ZONE.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));
GENERATE_BUTTON.addEventListener('click', () => generatePdf(false));
PREVIEW_BUTTON.addEventListener('click', () => generatePdf(true));
document.querySelector('#close-preview').addEventListener('click', () => PREVIEW_DIALOG.close());
PREVIEW_DIALOG.addEventListener('close', closePreview);
INCLUDE_COVER.addEventListener('change', updateCoverOptions);
CUSTOM_COVER_TITLE.addEventListener('change', () => {
  if (CUSTOM_COVER_TITLE.checked) {
    document.querySelector('#cover-title').value = document.querySelector('#booklet-title').value;
  }
  updateCoverOptions();
});
updateCoverOptions();

function updateCoverOptions() {
  document.querySelectorAll('.cover-option').forEach((element) => { element.hidden = !INCLUDE_COVER.checked; });
  document.querySelector('#cover-title-row').hidden = !INCLUDE_COVER.checked || !CUSTOM_COVER_TITLE.checked;
}

async function handleFile(file) {
  if (!file) return;
  const sequence = ++fileReadSequence;
  parsedReviews = null;
  updateButtons();
  MESSAGE.textContent = '';
  MESSAGE.className = 'message';
  FILE_STATUS.className = 'file-status';
  FILE_STATUS.textContent = 'Leyendo el archivo…';
  if (!/\.csv$/i.test(file.name)) {
    showFileError('Selecciona un archivo .csv exportado desde Google Forms o Google Sheets.');
    return;
  }
  try {
    const text = await file.text();
    if (sequence !== fileReadSequence) return;
    const reviews = parseRows(parseCsv(text));
    parsedReviews = reviews;
    updateButtons();
    const books = new Set(reviews.map((review) => review.bookTitle.toLocaleLowerCase('es'))).size;
    FILE_STATUS.className = 'file-status loaded';
    FILE_STATUS.textContent = `✓ ${file.name} · ${reviews.length} ${reviews.length === 1 ? 'reseña' : 'reseñas'} de ${books} ${books === 1 ? 'libro' : 'libros'}. Listo para descargar.`;
  } catch (error) {
    if (sequence !== fileReadSequence) return;
    showFileError(error.message || 'No se ha podido leer el archivo CSV.');
  }
}

function showFileError(message) {
  parsedReviews = null;
  updateButtons();
  FILE_STATUS.className = 'file-status error';
  FILE_STATUS.textContent = message;
}

function updateButtons() {
  GENERATE_BUTTON.disabled = busy || !parsedReviews;
  PREVIEW_BUTTON.disabled = busy || !parsedReviews;
}

function detectDelimiter(text) {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (character === '\n' || character === '\r')) break;
    else if (!quoted && character === ',') commas += 1;
    else if (!quoted && character === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value); value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value); value = '';
      if (row.some((cell) => clean(cell))) rows.push(row);
      row = [];
    } else value += character;
  }
  if (quoted) throw new Error('El CSV tiene unas comillas sin cerrar. Vuelve a exportarlo desde Google Forms o Google Sheets.');
  if (value || row.length) { row.push(value); if (row.some((cell) => clean(cell))) rows.push(row); }
  return rows;
}

function parseRows(rows) {
  if (!rows.length) throw new Error('El archivo está vacío. Exporta las respuestas como CSV e inténtalo de nuevo.');
  const headers = rows[0].map(clean);
  if (headers.length < 23) {
    throw new Error('El CSV tiene menos columnas de las esperadas. Usa la exportación de respuestas del formulario del club.');
  }
  REQUIRED_HEADERS.forEach((header, index) => {
    if (headers[index] !== header) throw new Error(`La columna ${index + 1} debe ser «${header}». Comprueba que has exportado las respuestas del formulario del club.`);
  });
  CRITERIA.forEach(([name, scoreIndex]) => {
    if (clean(headers[scoreIndex]) !== name) throw new Error(`La columna ${scoreIndex + 1} debe ser «${name}». Usa el CSV del formulario del club sin reorganizar las columnas.`);
  });
  const reviews = rows.slice(1).filter((row) => row.some((value) => clean(value))).map((row, index) => {
    const bookTitle = valueAt(row, 2);
    if (!bookTitle) throw new Error(`Falta el título del libro en una respuesta (aprox. fila ${index + 2} del CSV). Corrígelo antes de generar el PDF.`);
    const criteria = CRITERIA.map(([name, scoreIndex, commentIndex]) => ({
      name,
      score: valueAt(row, scoreIndex),
      comment: valueAt(row, commentIndex),
    }));
    const timestamp = valueAt(row, 0);
    return {
      timestamp,
      timestampSortKey: parseTimestamp(timestamp),
      reviewerName: valueAt(row, 1),
      bookTitle,
      averageScore: average(criteria),
      criteria,
    };
  });
  if (!reviews.length) throw new Error('El CSV no contiene reseñas. Exporta las respuestas, no una hoja vacía.');
  return reviews.sort((left, right) => left.bookTitle.localeCompare(right.bookTitle, 'es', { sensitivity: 'base' }) || left.timestampSortKey - right.timestampSortKey);
}

async function generatePdf(preview) {
  if (!parsedReviews || busy) return;
  busy = true;
  updateButtons();
  MESSAGE.className = 'message';
  MESSAGE.textContent = preview ? 'Preparando la vista previa…' : 'Preparando el PDF…';
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
    if (!window.jspdf?.jsPDF) throw new Error('No se pudo cargar la biblioteca de PDF. Comprueba la conexión a Internet y recarga la página.');
    await loadCriterionIcons();
    const title = document.querySelector('#booklet-title').value.trim() || 'Alas de papel';
    const pages = renderBookletCanvases(parsedReviews, title);
    const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.setProperties({ title, author: 'Alas de papel' });
    pages.forEach((canvas, index) => {
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    });
    if (preview) {
      closePreview();
      previewUrl = URL.createObjectURL(pdf.output('blob'));
      PREVIEW_FRAME.src = previewUrl;
      PREVIEW_DIALOG.showModal();
      MESSAGE.textContent = `Vista previa lista: ${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}.`;
    } else {
      pdf.save(`${safeFilename(title)}.pdf`);
      MESSAGE.textContent = `PDF descargado: ${parsedReviews.length} ${parsedReviews.length === 1 ? 'reseña' : 'reseñas'} en ${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}.`;
    }
  } catch (error) {
    MESSAGE.className = 'message error';
    MESSAGE.textContent = `No se pudo generar el PDF: ${error.message}`;
  } finally {
    busy = false;
    updateButtons();
  }
}

function loadCriterionIcons() {
  if (criterionIcons) return Promise.resolve(criterionIcons);
  if (!iconLoadPromise) {
    iconLoadPromise = Promise.all(CRITERIA.map(([, , , name]) => new Promise((resolve, reject) => {
      const icon = new Image();
      icon.onload = () => resolve(icon);
      icon.onerror = () => reject(new Error(`No se pudo cargar el icono «${name}». Recarga la página e inténtalo de nuevo.`));
      icon.src = new URL(`web/icons/${name}.svg`, document.baseURI).href;
    }))).then((icons) => { criterionIcons = icons; return icons; }).catch((error) => {
      iconLoadPromise = null;
      throw error;
    });
  }
  return iconLoadPromise;
}

function closePreview() {
  PREVIEW_FRAME.removeAttribute('src');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

function renderBookletCanvases(reviews, title) {
  const pages = [];
  const books = groupBooks(reviews);
  if (INCLUDE_COVER.checked) {
    const canvas = newCanvas();
    const context = canvas.getContext('2d');
    const coverTitle = CUSTOM_COVER_TITLE.checked ? document.querySelector('#cover-title').value.trim() || title : title;
    drawCover(context, coverTitle, document.querySelector('#cover-subtitle').value.trim(), reviews.length, books.length);
    pages.push(canvas);
  }
  const contents = document.querySelector('#include-contents').checked ? paginateContents(books) : [];
  const contentsStart = pages.length;
  contents.forEach(() => pages.push(null));
  const showEmpty = document.querySelector('#show-empty').checked;
  let bookIndex = 0;
  reviews.forEach((review, index) => {
    if (books[bookIndex]?.firstReviewIndex === index) {
      books[bookIndex].startPage = pages.length + 1;
      bookIndex += 1;
    }
    renderReviewCanvases(review, index + 1, reviews.length, title, showEmpty, pages);
  });
  contents.forEach((entries, index) => {
    pages[contentsStart + index] = drawContentsPage(entries, title, contentsStart + index + 1, index + 1, contents.length);
  });
  return pages;
}

function groupBooks(reviews) {
  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  const books = [];
  reviews.forEach((review, index) => {
    const last = books[books.length - 1];
    if (last && collator.compare(last.title, review.bookTitle) === 0) last.reviewCount += 1;
    else books.push({ title: review.bookTitle, bookNumber: books.length + 1, reviewCount: 1, firstReviewIndex: index, startPage: null });
  });
  return books;
}

function paginateContents(books) {
  const context = newCanvas().getContext('2d');
  const chunks = [[]];
  let y = 405;
  books.forEach((book) => {
    const lines = wrapLines(context, book.title, 750, '40px Georgia, serif');
    const height = Math.max(142, lines.length * 48 + 75);
    if (y + height > 1530 && chunks[chunks.length - 1].length) {
      chunks.push([]);
      y = 405;
    }
    chunks[chunks.length - 1].push({ book, lines, y, height });
    y += height;
  });
  return chunks;
}

function drawContentsPage(entries, title, pageNumber, part, totalParts) {
  const canvas = newCanvas();
  const context = canvas.getContext('2d');
  const colors = BOOKLET_COLORS;
  context.fillStyle = colors.accent;
  context.fillRect(0, 0, 1240, 14);
  context.fillStyle = colors.muted;
  context.font = '600 16px Arial, sans-serif';
  context.fillText(title.toLocaleUpperCase('es'), 110, 76, 800);
  context.strokeStyle = colors.rule;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(110, 101);
  context.lineTo(1130, 101);
  context.moveTo(110, 1660);
  context.lineTo(1130, 1660);
  context.stroke();
  context.fillStyle = colors.accent;
  context.font = '600 17px Arial, sans-serif';
  context.fillText(totalParts > 1 ? `ÍNDICE · ${part} / ${totalParts}` : 'ÍNDICE', 110, 174);
  context.fillStyle = colors.ink;
  context.font = '78px Georgia, serif';
  context.fillText('Contenido', 110, 280);
  context.fillStyle = colors.muted;
  context.font = '18px Arial, sans-serif';
  context.fillText('LIBROS RESEÑADOS', 180, 356);
  context.textAlign = 'right';
  context.fillText('PÁGINA', 1130, 356);
  context.textAlign = 'left';
  entries.forEach(({ book, lines, y, height }) => {
    context.fillStyle = colors.accent;
    context.font = '600 19px Arial, sans-serif';
    context.fillText(String(book.bookNumber).padStart(2, '0'), 110, y + 33);
    context.fillStyle = colors.ink;
    context.font = '40px Georgia, serif';
    lines.forEach((line, lineIndex) => context.fillText(line, 180, y + 39 + lineIndex * 48));
    context.fillStyle = colors.muted;
    context.font = '18px Arial, sans-serif';
    context.fillText(`${book.reviewCount} ${book.reviewCount === 1 ? 'reseña' : 'reseñas'}`, 180, y + 37 + lines.length * 48);
    context.fillStyle = colors.accent;
    context.textAlign = 'right';
    context.font = '40px Georgia, serif';
    context.fillText(String(book.startPage).padStart(2, '0'), 1130, y + 39);
    context.textAlign = 'left';
    context.strokeStyle = colors.rule;
    context.beginPath();
    context.moveTo(110, y + height - 8);
    context.lineTo(1130, y + height - 8);
    context.stroke();
  });
  context.fillStyle = colors.muted;
  context.font = '15px Arial, sans-serif';
  context.fillText('CLUB DE LECTURA', 110, 1697);
  context.textAlign = 'right';
  context.fillText(String(pageNumber).padStart(2, '0'), 1130, 1697);
  context.textAlign = 'left';
  return canvas;
}

function drawCover(context, title, subtitle, reviewCount, bookCount) {
  const border = '#a64036';
  const ink = '#24211d';
  context.fillStyle = '#eee9df';
  context.fillRect(0, 0, 1240, 1754);
  context.strokeStyle = border;
  context.lineWidth = 5;
  context.strokeRect(72, 72, 1096, 1610);
  context.textAlign = 'center';
  context.fillStyle = border;
  context.font = '600 22px Arial, sans-serif';
  context.fillText('CLUB DE LECTURA', 620, 184);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(490, 216);
  context.lineTo(750, 216);
  context.stroke();
  context.fillStyle = ink;
  context.font = '32px Georgia, serif';
  context.fillText('Cuadernillo de reseñas', 620, 438);
  const words = title.trim().split(/\s+/);
  let titleSize = 118;
  let titleFont = `bold ${titleSize}px Georgia, serif`;
  let titleLines = words.length >= 2 && words.length <= 4 && words.every((word) => word.length <= 12)
    ? words
    : wrapLines(context, title, 890, titleFont);
  while ((titleLines.length > 4 || titleLines.some((line) => {
    context.font = titleFont;
    return context.measureText(line).width > 890;
  })) && titleSize > 56) {
    titleSize -= 8;
    titleFont = `bold ${titleSize}px Georgia, serif`;
    if (words.length > 4) titleLines = wrapLines(context, title, 890, titleFont);
  }
  let y = 740 - (titleLines.length - 1) * 62;
  context.fillStyle = ink;
  context.font = titleFont;
  titleLines.forEach((line) => { context.fillText(line, 620, y); y += titleSize + 15; });
  if (subtitle) {
    context.fillStyle = border;
    context.font = 'italic 30px Georgia, serif';
    wrapLines(context, subtitle, 820, 'italic 30px Georgia, serif').forEach((line) => {
      context.fillText(line, 620, y + 54);
      y += 42;
    });
  }
  context.strokeStyle = border;
  context.beginPath();
  context.moveTo(290, 1455);
  context.lineTo(950, 1455);
  context.stroke();
  context.fillStyle = ink;
  context.font = '22px Arial, sans-serif';
  context.fillText(`${reviewCount} ${reviewCount === 1 ? 'reseña' : 'reseñas'} · ${bookCount} ${bookCount === 1 ? 'libro' : 'libros'}`, 620, 1518);
  context.fillStyle = border;
  context.font = '600 17px Arial, sans-serif';
  context.fillText('ALAS DE PAPEL', 620, 1625);
  context.textAlign = 'left';
}

function newCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este navegador no permite crear las páginas del PDF.');
  context.fillStyle = BOOKLET_COLORS.paper;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function renderReviewCanvases(review, index, total, title, showEmpty, pages) {
  let canvas = newCanvas();
  let context = canvas.getContext('2d');
  let y = 195;
  const left = 110;
  const right = 1130;
  const bottom = 1608;
  const colors = BOOKLET_COLORS;
  const showDate = document.querySelector('#show-review-date').checked;
  const showAverage = document.querySelector('#show-average-score').checked;
  const showCriterionScores = document.querySelector('#show-criterion-scores').checked;
  const startPage = (continuation) => {
    pages.push(canvas);
    canvas = newCanvas();
    context = canvas.getContext('2d');
    drawPageFrame(context, title, index, total, pages.length + 1);
    context.fillStyle = colors.accent;
    context.font = '600 17px Arial, sans-serif';
    context.fillText(`CONTINÚA · ${continuation}`, left, 154, right - left);
    y = 210;
  };
  const ensureSpace = (height, continuation = review.bookTitle) => { if (y + height > bottom) startPage(continuation); };
  const drawBlock = (value, x, width, font, lineHeight, color, continuation = review.bookTitle) => {
    const lines = wrapLines(context, value, width, font);
    context.textAlign = 'left';
    context.fillStyle = color;
    context.font = font;
    lines.forEach((line) => {
      ensureSpace(lineHeight, continuation);
      context.fillStyle = color;
      context.font = font;
      context.fillText(line, x, y);
      y += lineHeight;
    });
  };
  const drawReviewText = (value, color, continuation) => {
    const font = '23px Georgia, "Segoe UI Emoji", serif';
    String(value).split(/\r?\n/).forEach((paragraph) => {
      if (!paragraph.trim()) {
        ensureSpace(34, continuation);
        y += 34;
        return;
      }
      const lines = wrapLines(context, paragraph, right - left, font);
      lines.forEach((line, lineIndex) => {
        ensureSpace(34, continuation);
        context.fillStyle = color;
        context.font = font;
        context.textAlign = 'left';
        if (lineIndex < lines.length - 1) drawJustifiedLine(context, line, left, y, right - left);
        else context.fillText(line, left, y);
        y += 34;
      });
    });
  };
  drawPageFrame(context, title, index, total, pages.length + 1);
  drawBlock(review.bookTitle, left, right - left, '46px Georgia, serif', 58, colors.ink);
  y += 12;
  const metaTextWidth = showAverage ? 650 : right - left - 56;
  const reviewerLines = wrapLines(context, review.reviewerName || 'Desconocido', metaTextWidth, '46px Georgia, serif');
  const dateLines = showDate ? wrapLines(context, review.timestamp || 'Sin fecha', metaTextWidth, '17px Arial, sans-serif') : [];
  const metaHeight = 82 + (reviewerLines.length * 52) + (dateLines.length * 24);
  ensureSpace(metaHeight + 42);
  context.fillStyle = colors.sage;
  context.fillRect(left, y, right - left, metaHeight);
  context.fillStyle = colors.accent;
  context.fillRect(left, y, 7, metaHeight);
  context.fillStyle = colors.muted;
  context.font = '600 15px Arial, sans-serif';
  context.fillText('RESEÑA DE', left + 28, y + 31);
  let metaY = y + 82;
  context.fillStyle = colors.ink;
  context.font = '46px Georgia, serif';
  reviewerLines.forEach((line) => { context.fillText(line, left + 28, metaY); metaY += 52; });
  context.fillStyle = colors.muted;
  context.font = '17px Arial, sans-serif';
  dateLines.forEach((line) => { context.fillText(line, left + 28, metaY + 2); metaY += 24; });
  if (showAverage) {
    context.fillStyle = colors.muted;
    context.font = '600 15px Arial, sans-serif';
    context.fillText('PUNTUACIÓN MEDIA', right - 240, y + 31);
    context.fillStyle = colors.ink;
    context.font = '52px Georgia, serif';
    context.fillText(review.averageScore === null ? '—' : review.averageScore.toFixed(1), right - 240, y + 104);
    context.fillStyle = colors.muted;
    context.font = '18px Arial, sans-serif';
    context.fillText('/ 10', right - 115, y + 101);
  }
  y += metaHeight + 38;

  review.criteria.forEach((criterion, criterionIndex) => {
    if (!showEmpty && !criterion.comment) return;
    const headingLines = wrapLines(context, criterion.name, showCriterionScores ? 720 : right - left - 48, '600 20px Arial, sans-serif');
    ensureSpace((headingLines.length * 29) + 78);
    context.strokeStyle = colors.rule;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    y += 34;
    context.drawImage(criterionIcons[criterionIndex], left, y - 22, 24, 24);
    context.fillStyle = colors.ink;
    context.font = '600 20px Arial, sans-serif';
    headingLines.forEach((line, lineIndex) => {
      context.fillText(line, left + 48, y);
      if (lineIndex === 0 && showCriterionScores) drawCanvasScore(context, criterion.score, right, y);
      y += 29;
    });
    y += 9;
    drawReviewText(criterion.comment || 'Sin comentario.', criterion.comment ? colors.ink : colors.muted, criterion.name);
    y += 27;
  });
  pages.push(canvas);
}

function drawJustifiedLine(context, line, left, baseline, width) {
  const words = line.trim().split(/\s+/);
  if (words.length < 2) {
    context.fillText(line, left, baseline);
    return;
  }
  const textWidth = words.reduce((sum, word) => sum + context.measureText(word).width, 0);
  const gap = (width - textWidth) / (words.length - 1);
  let x = left;
  words.forEach((word) => {
    context.fillText(word, x, baseline);
    x += context.measureText(word).width + gap;
  });
}

function drawPageFrame(context, title, index, total, pageNumber) {
  const colors = BOOKLET_COLORS;
  context.fillStyle = colors.accent;
  context.fillRect(0, 0, 1240, 14);
  context.fillStyle = colors.muted;
  context.font = '600 16px Arial, sans-serif';
  context.textAlign = 'left';
  context.fillText(title.toLocaleUpperCase('es'), 110, 76, 800);
  context.textAlign = 'right';
  context.fillText(`RESEÑA ${index} / ${total}`, 1130, 76);
  context.textAlign = 'left';
  context.strokeStyle = colors.rule;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(110, 101);
  context.lineTo(1130, 101);
  context.moveTo(110, 1660);
  context.lineTo(1130, 1660);
  context.stroke();
  context.fillStyle = colors.muted;
  context.font = '15px Arial, sans-serif';
  context.fillText('CLUB DE LECTURA', 110, 1697);
  context.textAlign = 'right';
  context.fillText(String(pageNumber).padStart(2, '0'), 1130, 1697);
  context.textAlign = 'left';
}

function wrapLines(context, text, width, font) {
  context.font = font;
  const result = [];
  String(text).split(/\r?\n/).forEach((paragraph) => {
    if (!paragraph.trim()) { result.push(''); return; }
    let line = '';
    paragraph.trim().split(/\s+/).forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= width) { line = candidate; return; }
      if (line) { result.push(line); line = ''; }
      for (const character of Array.from(word)) {
        if (line && context.measureText(line + character).width > width) {
          result.push(line);
          line = character;
        } else line += character;
      }
    });
    result.push(line);
  });
  return result.length ? result : [''];
}

function drawCanvasScore(context, value, right, baseline) {
  const numeric = Number(String(value).replace(',', '.'));
  const valid = value !== '' && Number.isFinite(numeric);
  const numericText = valid ? (Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1)) : (value || '-');
  const score = valid ? Math.max(0, Math.min(10, numeric)) : 0;
  const fullStars = Math.floor(score / 2);
  const hasHalfStar = score % 2 >= 1;
  const starSize = 17;
  const starGap = 4;
  const starsLeft = right - 190;
  context.font = '600 20px Arial, sans-serif';
  for (let starIndex = 0; starIndex < 5; starIndex += 1) {
    const starX = starsLeft + starIndex * (starSize + starGap) + starSize / 2;
    const starY = baseline - 8;
    if (starIndex < fullStars) drawCanvasStar(context, starX, starY, starSize / 2, 'full');
    else if (starIndex === fullStars && hasHalfStar) drawCanvasStar(context, starX, starY, starSize / 2, 'half');
    else drawCanvasStar(context, starX, starY, starSize / 2, 'empty');
  }
  context.fillStyle = BOOKLET_COLORS.ink;
  context.textAlign = 'right';
  context.font = '600 20px Arial, sans-serif';
  context.fillText(numericText, right, baseline, 66);
  context.textAlign = 'left';
}

function drawCanvasStar(context, centerX, centerY, radius, fillMode) {
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI / 5);
    const distance = index % 2 === 0 ? radius : radius * 0.43;
    points.push([centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance]);
  }
  context.save();
  context.beginPath();
  points.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
  context.closePath();
  context.lineWidth = 2;
  context.strokeStyle = BOOKLET_COLORS.accent;
  context.fillStyle = BOOKLET_COLORS.accent;
  if (fillMode === 'half') {
    context.save();
    context.clip();
    context.fillRect(centerX - radius, centerY - radius, radius, radius * 2);
    context.restore();
  } else if (fillMode === 'full') context.fill();
  context.stroke();
  context.restore();
}

function average(criteria) {
  const scores = criteria.map((criterion) => Number(criterion.score.replace(',', '.'))).filter((value, index) => criterionHasScore(criteria[index]) && Number.isFinite(value));
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
}
function criterionHasScore(criterion) { return criterion.score !== ''; }
function parseTimestamp(value) {
  const match = value.match(/^(\d{4})[/-](\d{2})[/-](\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s+([ap])\.\s*m\.)?/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[4]);
  if (match[7]?.toLowerCase() === 'p' && hour < 12) hour += 12;
  if (match[7]?.toLowerCase() === 'a' && hour === 12) hour = 0;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, Number(match[5]), Number(match[6]));
}
function valueAt(row, index) { return clean(row[index]); }
function clean(value) { return String(value ?? '').replace(/^\uFEFF/, '').trim(); }
function safeFilename(value) { return value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[_\.]+|[_\.]+$/g, '') || 'reviews_booklet'; }
