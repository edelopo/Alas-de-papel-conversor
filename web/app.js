const CRITERIA = [
  ['PREDICTIBILIDAD', 3, 4],
  ['CARISMA PERSONAJES', 5, 6],
  ['PUNTOS DE VISTA', 7, 8],
  ['AMBIENTACIÓN (Espacio, entorno, época…)', 9, 10],
  ['EXPRESIÓN ESCRITA', 11, 12],
  ['EMOCIÓMETRO', 13, 14],
  ['DIÁLOGOS', 15, 16],
  ['ESTÉTICA DEL LIBRO', 17, 18],
  ['ENGANCHE', 19, 20],
  ['FINAL', 21, 22],
];
const REQUIRED_HEADERS = ['Marca temporal', '¿Quién eres?', 'Título del libro'];
const APP_VERSION = 'v0.6.0';
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

document.querySelector('#app-version').textContent = APP_VERSION;
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

function closePreview() {
  PREVIEW_FRAME.removeAttribute('src');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

function renderBookletCanvases(reviews, title) {
  const pages = [];
  if (INCLUDE_COVER.checked) {
    const canvas = newCanvas();
    const context = canvas.getContext('2d');
    const coverTitle = CUSTOM_COVER_TITLE.checked ? document.querySelector('#cover-title').value.trim() || title : title;
    const titleLines = wrapLines(context, coverTitle, 1040, '600 48px Georgia, serif');
    context.fillStyle = '#24302d';
    context.textAlign = 'center';
    let y = 510 - ((titleLines.length - 1) * 28);
    titleLines.forEach((line) => { context.font = '600 48px Georgia, serif'; context.fillText(line, 620, y); y += 58; });
    const subtitleLines = wrapLines(context, document.querySelector('#cover-subtitle').value.trim(), 1040, 'italic 25px Georgia, serif');
    y += 5;
    subtitleLines.forEach((line) => { context.font = 'italic 25px Georgia, serif'; context.fillText(line, 620, y); y += 34; });
    context.font = '22px Arial, sans-serif';
    context.fillText(`Total de reseñas: ${reviews.length}`, 620, y + 20);
    pages.push(canvas);
  }
  const showEmpty = document.querySelector('#show-empty').checked;
  reviews.forEach((review, index) => renderReviewCanvases(review, index + 1, reviews.length, title, showEmpty, pages));
  return pages;
}

function newCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este navegador no permite crear las páginas del PDF.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function renderReviewCanvases(review, index, total, title, showEmpty, pages) {
  let canvas = newCanvas();
  let context = canvas.getContext('2d');
  let y = 75;
  const left = 95;
  const right = 1145;
  const bottom = 1640;
  const startPage = () => {
    pages.push(canvas);
    canvas = newCanvas();
    context = canvas.getContext('2d');
    y = 75;
    drawHeader(context, title, index, total);
  };
  const ensureSpace = (height) => { if (y + height > bottom) startPage(); };
  const drawBlock = (value, width, font, lineHeight, color) => {
    const lines = wrapLines(context, value, width, font);
    context.textAlign = 'left';
    context.fillStyle = color;
    context.font = font;
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      context.fillStyle = color;
      context.font = font;
      context.fillText(line, left, y);
      y += lineHeight;
    });
  };
  drawHeader(context, title, index, total);
  drawBlock(review.bookTitle, right - left, '600 34px Georgia, serif', 40, '#24302d');
  y += 12;
  drawBlock(`Revisado por: ${review.reviewerName || 'Desconocido'} · ${review.timestamp} · Media: ${review.averageScore === null ? '-' : review.averageScore.toFixed(1)}`, right - left, '20px Arial, sans-serif', 26, '#52605a');
  y += 30;
  review.criteria.forEach((criterion) => {
    if (!showEmpty && !criterion.comment) return;
    const headingLines = wrapLines(context, criterion.name, 760, '600 21px Arial, sans-serif');
    ensureSpace((headingLines.length * 28) + 35);
    context.fillStyle = '#24302d';
    context.font = '600 21px Arial, sans-serif';
    headingLines.forEach((line, lineIndex) => {
      context.fillText(line, left, y);
      if (lineIndex === 0) drawCanvasScore(context, criterion.score, right, y);
      y += 28;
    });
    y += 7;
    drawBlock(criterion.comment || 'Sin comentario.', right - left, '20px "Segoe UI Emoji", "Noto Color Emoji", Arial, sans-serif', 28, '#24302d');
    y += 22;
  });
  pages.push(canvas);
}

function drawHeader(context, title, index, total) {
  context.fillStyle = '#6b7771';
  context.font = 'italic 17px Arial, sans-serif';
  context.textAlign = 'left';
  context.fillText(title, 95, 38, 850);
  context.textAlign = 'right';
  context.fillText(`${index} / ${total}`, 1145, 38);
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
  const starSize = 20;
  const starGap = 5;
  const starsWidth = (starSize * 5) + (starGap * 4);
  context.font = '22px Arial, sans-serif';
  const numberWidth = context.measureText(numericText).width;
  const starsLeft = right - numberWidth - 18 - starsWidth;
  for (let starIndex = 0; starIndex < 5; starIndex += 1) {
    const starX = starsLeft + starIndex * (starSize + starGap) + starSize / 2;
    const starY = baseline - 8;
    if (starIndex < fullStars) drawCanvasStar(context, starX, starY, starSize / 2, 'full');
    else if (starIndex === fullStars && hasHalfStar) drawCanvasStar(context, starX, starY, starSize / 2, 'half');
    else drawCanvasStar(context, starX, starY, starSize / 2, 'empty');
  }
  context.fillStyle = '#24302d';
  context.textAlign = 'right';
  context.font = '22px Arial, sans-serif';
  context.fillText(numericText, right, baseline);
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
  context.strokeStyle = '#d45535';
  context.fillStyle = '#d45535';
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
