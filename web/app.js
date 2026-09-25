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
const DROP_ZONE = document.querySelector('#drop-zone');
const FILE_INPUT = document.querySelector('#csv-input');
const FILE_STATUS = document.querySelector('#file-status');
const GENERATE_BUTTON = document.querySelector('#generate-button');
const MESSAGE = document.querySelector('#message');
let parsedReviews = null;
let selectedFileName = 'reviews';
let symbolFontPromise;

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
GENERATE_BUTTON.addEventListener('click', generatePdf);

function handleFile(file) {
  if (!file) return;
  selectedFileName = file.name.replace(/\.csv$/i, '') || 'reviews';
  FILE_STATUS.className = 'file-status';
  FILE_STATUS.textContent = 'Leyendo el archivo...';
  MESSAGE.textContent = '';
  file.text().then((text) => {
      try {
        parsedReviews = parseRows(parseCsv(text));
        GENERATE_BUTTON.disabled = parsedReviews.length === 0;
        FILE_STATUS.textContent = `${file.name} · ${parsedReviews.length} ${parsedReviews.length === 1 ? 'revisión encontrada' : 'revisiones encontradas'}`;
        if (!parsedReviews.length) throw new Error('El archivo no contiene ninguna revisión.');
      } catch (error) {
        parsedReviews = null;
        GENERATE_BUTTON.disabled = true;
        FILE_STATUS.className = 'file-status error';
        FILE_STATUS.textContent = error.message;
      }
  }).catch(() => {
    parsedReviews = null;
    GENERATE_BUTTON.disabled = true;
    FILE_STATUS.className = 'file-status error';
    FILE_STATUS.textContent = 'No se ha podido leer el archivo CSV.';
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value); value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value); value = '';
      if (row.some((cell) => clean(cell))) rows.push(row);
      row = [];
    } else value += character;
  }
  if (value || row.length) { row.push(value); if (row.some((cell) => clean(cell))) rows.push(row); }
  return rows;
}

function parseRows(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(clean);
  REQUIRED_HEADERS.forEach((header, index) => {
    if (headers[index] !== header) throw new Error(`Falta la columna «${header}» en el CSV.`);
  });
  CRITERIA.forEach(([name, scoreIndex]) => {
    if (clean(headers[scoreIndex]) !== name) throw new Error(`El CSV no tiene la columna «${name}» en el lugar esperado.`);
  });
  return rows.slice(1).filter((row) => row.some((value) => clean(value))).map((row) => {
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
      bookTitle: valueAt(row, 2),
      averageScore: average(criteria),
      criteria,
    };
  }).sort((left, right) => left.bookTitle.localeCompare(right.bookTitle, 'es', { sensitivity: 'base' }) || left.timestampSortKey - right.timestampSortKey);
}

function generatePdf() {
  if (!parsedReviews) return;
  GENERATE_BUTTON.disabled = true;
  MESSAGE.className = 'message';
  MESSAGE.textContent = 'Preparando el PDF...';
  requestAnimationFrame(async () => {
    try {
      const symbolFontLoaded = await loadSymbolFont();
      const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      configurePdf(pdf, symbolFontLoaded);
      renderPdf(pdf, parsedReviews);
      const title = document.querySelector('#booklet-title').value.trim() || 'Alas de papel';
      pdf.save(`${safeFilename(title)}.pdf`);
      MESSAGE.textContent = `PDF listo: ${parsedReviews.length} revisiones procesadas.`;
    } catch (error) {
      MESSAGE.className = 'message error';
      MESSAGE.textContent = `No se ha podido generar el PDF: ${error.message}`;
    } finally {
      GENERATE_BUTTON.disabled = false;
    }
  });
}

async function loadSymbolFont() {
  if (window.location.protocol === 'file:') return false;
  if (!symbolFontPromise) symbolFontPromise = fetch('fonts/NotoSansSymbols2-Regular.ttf')
    .then((response) => {
      if (!response.ok) throw new Error('symbol font unavailable');
      return response.arrayBuffer();
    })
    .then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
      return btoa(binary);
    })
    .then((base64) => {
      window._symbolFontBase64 = base64;
      return true;
    })
    .catch(() => false);
  return symbolFontPromise;
}

function configurePdf(pdf, fontsLoaded) {
  pdf.setFont('helvetica', 'normal');
  pdf.baseFontFamily = 'helvetica';
  if (fontsLoaded && window._symbolFontBase64) {
    pdf.addFileToVFS('NotoSansSymbols2-Regular.ttf', window._symbolFontBase64);
    pdf.addFont('NotoSansSymbols2-Regular.ttf', 'Symbols', 'normal');
    pdf.symbolFontFamily = 'Symbols';
  }
  pdf.setProperties({ title: document.querySelector('#booklet-title').value.trim() || 'Alas de papel', author: 'Alas de papel' });
}

function renderPdf(pdf, reviews) {
  const includeCover = document.querySelector('#include-cover').checked;
  const showEmpty = document.querySelector('#show-empty').checked;
  if (includeCover) renderCover(pdf, reviews.length);
  reviews.forEach((review, index) => {
    pdf.addPage();
    renderReview(pdf, review, index + 1, reviews.length, showEmpty);
  });
  for (let page = includeCover ? 2 : 1; page <= pdf.getNumberOfPages(); page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(9);
    pdf.setFont(pdf.getFont().fontName, 'italic');
    pdf.text(String(page), 105, 288, { align: 'center' });
  }
}

function renderCover(pdf, count) {
  const title = document.querySelector('#cover-title').value.trim() || document.querySelector('#booklet-title').value.trim() || 'Alas de papel';
  const subtitle = document.querySelector('#cover-subtitle').value.trim();
  pdf.setFontSize(22); pdf.setFont(pdf.getFont().fontName, 'bold'); pdf.text(title, 105, 58, { align: 'center', maxWidth: 175 });
  if (subtitle) { pdf.setFontSize(11); pdf.setFont(pdf.getFont().fontName, 'italic'); pdf.text(subtitle, 105, 75, { align: 'center', maxWidth: 175 }); }
  pdf.setFontSize(13); pdf.setFont(pdf.getFont().fontName, 'normal'); pdf.text(`Total de revisiones: ${count}`, 105, 89, { align: 'center' });
}

function renderReview(pdf, review, index, total, showEmpty) {
  const left = 16; const width = 178; const bottom = 282;
  let y = 16;
  const font = pdf.getFont().fontName;
  pdf.setFont(font, 'italic'); pdf.setFontSize(9); pdf.text(document.querySelector('#booklet-title').value.trim() || 'Alas de papel', 194, 10, { align: 'right' });
  pdf.setFont(font, 'bold'); pdf.setFontSize(16); y = write(pdf, review.bookTitle || 'Libro sin título', left, y, width, 9, 16, 'bold');
  y += 1; pdf.setFont(font, 'normal'); pdf.setFontSize(11);
  const meta = [];
  if (review.reviewerName) meta.push(`Revisado por: ${review.reviewerName}`);
  meta.push(`Revisión ${index} de ${total}`);
  y = write(pdf, meta.join('                                      '), left, y, width, 7, 11, 'normal');
  y = write(pdf, `Fecha de revisión: ${review.timestamp}`, left, y, width, 7, 11, 'normal');
  y = write(pdf, `Puntuación media: ${review.averageScore === null ? '-' : review.averageScore.toFixed(1)}`, left, y, width, 7, 11, 'normal');
  y += 4;
  review.criteria.forEach((criterion) => {
    if (!showEmpty && !criterion.comment) return;
    const score = formatScore(criterion.score);
    if (y + 14 > bottom) { pdf.addPage(); addContinuationHeader(pdf); y = 18; }
    pdf.setFont(font, 'bold'); pdf.setFontSize(12);
    const titleLines = pdf.splitTextToSize(criterion.name, 140);
    pdf.text(titleLines, left, y);
    pdf.setFont(font, 'normal'); pdf.setFontSize(11); drawTextWithSymbols(pdf, score, 194, y, 'normal', 'right');
    y += Math.max(7, titleLines.length * 7);
    const text = criterion.comment || 'Sin comentario.';
    y = write(pdf, text, left, y, width, 6, 11, criterion.comment ? 'normal' : 'italic');
    y += 2;
  });
}

function addContinuationHeader(pdf) {
  pdf.setFont(pdf.getFont().fontName, 'italic'); pdf.setFontSize(9);
  pdf.text(document.querySelector('#booklet-title').value.trim() || 'Alas de papel', 194, 10, { align: 'right' });
}

function write(pdf, text, x, y, width, lineHeight, size, style) {
  pdf.setFontSize(size); pdf.setFont(pdf.getFont().fontName, style);
  const lines = pdf.splitTextToSize(safeText(text), width);
  lines.forEach((line, index) => drawTextWithSymbols(pdf, line, x, y + (index * lineHeight), style));
  return y + lines.length * lineHeight;
}

function drawTextWithSymbols(pdf, text, x, y, style, align = 'left') {
  const symbolPattern = /([\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27FF}\uFE0E\uFE0F])/u;
  const segments = symbolPattern.test(text) ? text.split(symbolPattern).filter(Boolean) : [text];
  let totalWidth = 0;
  segments.forEach((segment) => {
    const isSymbol = symbolPattern.test(segment) && Boolean(pdf.symbolFontFamily);
    pdf.setFont(isSymbol ? pdf.symbolFontFamily : pdf.baseFontFamily, isSymbol ? 'normal' : style);
    totalWidth += pdf.getTextWidth(segment);
  });
  let cursor = align === 'right' ? x - totalWidth : x;
  segments.forEach((segment) => {
    const isSymbol = symbolPattern.test(segment) && Boolean(pdf.symbolFontFamily);
    pdf.setFont(isSymbol ? pdf.symbolFontFamily : pdf.baseFontFamily, isSymbol ? 'normal' : style);
    pdf.text(segment, cursor, y);
    cursor += pdf.getTextWidth(segment);
  });
}

function formatScore(value) {
  if (!value) return '-';
  const number = Number.parseFloat(value.replace(',', '.'));
  if (Number.isNaN(number)) return value;
  const rounded = Math.max(0, Math.min(10, Math.round(number)));
  return `${'★'.repeat(Math.floor(rounded / 2))}${rounded % 2 ? '⯨' : ''}${'☆'.repeat(5 - Math.ceil(rounded / 2))} ${Number.isInteger(number) ? number : number.toFixed(1)}`;
}

function average(criteria) {
  const scores = criteria.map((criterion) => Number.parseFloat(criterion.score.replace(',', '.'))).filter((value) => !Number.isNaN(value));
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
}
function parseTimestamp(value) {
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+([ap])\.\s*m\./i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[4]);
  if (match[7].toLowerCase() === 'p' && hour < 12) hour += 12;
  if (match[7].toLowerCase() === 'a' && hour === 12) hour = 0;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, Number(match[5]), Number(match[6]));
}
function valueAt(row, index) { return clean(row[index]); }
function clean(value) { return String(value ?? '').replace(/^\uFEFF/, '').trim(); }
function safeText(value) { return String(value).replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[\u00a0\u202f]/g, ' '); }
function safeFilename(value) { return value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[_\.]+|[_\.]+$/g, '') || 'reviews_booklet'; }
