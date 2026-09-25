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
const APP_VERSION = 'v0.5.1';
let parsedReviews = null;
let selectedFileName = 'reviews';

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
        FILE_STATUS.className = 'file-status loaded';
        FILE_STATUS.textContent = `✓ ${file.name} · ${parsedReviews.length} ${parsedReviews.length === 1 ? 'revisión encontrada' : 'revisiones encontradas'}`;
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
  MESSAGE.textContent = 'Preparando la vista para guardar como PDF...';
  const bookletTitle = document.querySelector('#booklet-title').value.trim() || 'Alas de papel';
  const coverTitle = document.querySelector('#cover-title').value.trim() || bookletTitle;
  const subtitle = document.querySelector('#cover-subtitle').value.trim();
  const showEmpty = document.querySelector('#show-empty').checked;
  const printDocument = buildPrintDocument(bookletTitle, coverTitle, subtitle, parsedReviews, showEmpty);
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(printDocument, 'text/html');
  const printRoot = document.createElement('div');
  printRoot.id = 'print-root';
  const printCss = parsedDocument.head.querySelector('style')?.textContent || '';
  printRoot.innerHTML = `<style>${printCss}</style><div class="print-actions"><button id="download-pdf" type="button">Descargar PDF</button><button id="close-print-preview" type="button">Volver</button></div><div id="print-content">${parsedDocument.body.innerHTML}</div>`;
  document.body.appendChild(printRoot);
  document.body.classList.add('previewing');
  printRoot.querySelector('#download-pdf').addEventListener('click', downloadPdfFromPreview);
  printRoot.querySelector('#close-print-preview').addEventListener('click', finishPrint);
  MESSAGE.textContent = 'Vista previa lista. Comprueba el contenido y pulsa «Descargar PDF».';
  GENERATE_BUTTON.disabled = false;
}

async function downloadPdfFromPreview() {
  const button = document.querySelector('#download-pdf');
  if (!button) return;
  button.disabled = true;
  button.textContent = 'Preparando PDF...';
  try {
    const pages = renderBookletCanvases(parsedReviews);
    if (!pages.length || pages.some((canvas) => canvas.width === 0 || canvas.height === 0 || !hasInk(canvas))) {
      throw new Error('La vista no contiene contenido visible.');
    }
    const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pages.forEach((canvas, index) => {
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    });
    const title = document.querySelector('#booklet-title').value.trim() || 'Alas de papel';
    pdf.save(`${safeFilename(title)}.pdf`);
    MESSAGE.textContent = `PDF descargado: ${parsedReviews.length} revisiones procesadas.`;
  } catch (error) {
    MESSAGE.className = 'message error';
    MESSAGE.textContent = `No se ha podido descargar el PDF: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = 'Descargar PDF';
  }
}

function renderBookletCanvases(reviews) {
  const pages = [];
  const includeCover = document.querySelector('#include-cover').checked;
  const showEmpty = document.querySelector('#show-empty').checked;
  const title = document.querySelector('#booklet-title').value.trim() || 'Alas de papel';
  if (includeCover) {
    const canvas = newCanvas();
    const context = canvas.getContext('2d');
    context.textAlign = 'center';
    context.fillStyle = '#24302d';
    context.font = '600 48px Georgia, serif';
    context.fillText(document.querySelector('#cover-title').value.trim() || title, 620, 520);
    context.font = 'italic 25px Georgia, serif';
    context.fillText(document.querySelector('#cover-subtitle').value.trim(), 620, 575);
    context.font = '22px Arial, sans-serif';
    context.fillText(`Total de revisiones: ${reviews.length}`, 620, 630);
    pages.push(canvas);
  }
  reviews.forEach((review, index) => renderReviewCanvases(review, index + 1, reviews.length, title, showEmpty, pages));
  return pages;
}

function newCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext('2d');
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
  const lineHeight = 28;
  const startPage = () => {
    pages.push(canvas);
    canvas = newCanvas();
    context = canvas.getContext('2d');
    y = 75;
    drawHeader(context, title, index, total);
  };
  drawHeader(context, title, index, total);
  context.fillStyle = '#24302d';
  context.textAlign = 'left';
  context.font = '600 34px Georgia, serif';
  y = drawWrapped(context, review.bookTitle || 'Libro sin título', left, y, right - left, 40, '600 34px Georgia, serif');
  context.fillStyle = '#52605a';
  y += 12;
  y = drawWrapped(context, `Revisado por: ${review.reviewerName || 'Desconocido'} · ${review.timestamp} · Media: ${review.averageScore === null ? '-' : review.averageScore.toFixed(1)}`, left, y, right - left, 24, '20px Arial, sans-serif');
  y += 30;
  review.criteria.forEach((criterion) => {
    if (!showEmpty && !criterion.comment) return;
    if (y > 1600) startPage();
    context.fillStyle = '#24302d';
    y = drawWrapped(context, criterion.name, left, y, 760, lineHeight, '600 21px Arial, sans-serif');
    drawCanvasScore(context, criterion.score, right, y - lineHeight);
    context.textAlign = 'left';
    y += 7;
    context.fillStyle = '#24302d';
    y = drawWrapped(context, criterion.comment || 'Sin comentario.', left, y, right - left, lineHeight, '20px "Segoe UI Emoji", "Noto Color Emoji", Arial, sans-serif');
    y += 22;
  });
  pages.push(canvas);
}

function drawHeader(context, title, index, total) {
  context.fillStyle = '#6b7771';
  context.font = 'italic 17px Arial, sans-serif';
  context.textAlign = 'left';
  context.fillText(title, 95, 38);
  context.textAlign = 'right';
  context.fillText(`${index} / ${total}`, 1145, 38);
  context.textAlign = 'left';
}

function drawWrapped(context, text, x, y, width, lineHeight, font) {
  context.font = font;
  const words = String(text).split(/\s+/);
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > width && line) {
      context.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else line = candidate;
  });
  if (line) { context.fillText(line, x, y); y += lineHeight; }
  return y;
}

function drawCanvasScore(context, value, right, baseline) {
  const numeric = Number.parseFloat(String(value).replace(',', '.'));
  const numericText = Number.isNaN(numeric) ? (value || '-') : (Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1));
  const score = Number.isNaN(numeric) ? 0 : Math.max(0, Math.min(10, numeric));
  const fullStars = Math.floor(score / 2);
  const hasHalfStar = score % 2 >= 1;
  const starSize = 20;
  const starGap = 5;
  const starsWidth = (starSize * 5) + (starGap * 4);
  context.font = '22px Arial, sans-serif';
  const numberWidth = context.measureText(numericText).width;
  const starsLeft = right - numberWidth - 18 - starsWidth;
  for (let index = 0; index < 5; index += 1) {
    const starX = starsLeft + index * (starSize + starGap) + starSize / 2;
    const starY = baseline - 8;
    if (index < fullStars) drawCanvasStar(context, starX, starY, starSize / 2, 'full');
    else if (index === fullStars && hasHalfStar) drawCanvasStar(context, starX, starY, starSize / 2, 'half');
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

function hasInk(canvas) {
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 0; index < pixels.length; index += 32) {
    if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) return true;
  }
  return false;
}

function finishPrint() {
  document.body.classList.remove('previewing', 'printing');
  document.querySelector('#print-root')?.remove();
}

function buildPrintDocument(bookletTitle, coverTitle, subtitle, reviews, showEmpty) {
  const cover = document.querySelector('#include-cover').checked
    ? `<section class="cover"><h1>${escapeHtml(coverTitle)}</h1><p>${escapeHtml(subtitle)}</p><small>Total de revisiones: ${reviews.length}</small></section>`
    : '';
  const reviewMarkup = reviews.map((review, index) => buildReviewMarkup(review, index + 1, reviews.length, showEmpty, bookletTitle)).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(bookletTitle)}</title><style>${printStyles()}</style></head><body>${cover}${reviewMarkup}</body></html>`;
}

function buildReviewMarkup(review, index, total, showEmpty, bookletTitle) {
  const criteria = review.criteria.filter((criterion) => showEmpty || criterion.comment).map((criterion) => `
    <article class="criterion">
      <div class="criterion-heading"><strong>${escapeHtml(criterion.name)}</strong><span class="score">${renderStars(criterion.score)} <b>${escapeHtml(criterion.score || '-')}</b></span></div>
      <p class="comment">${escapeHtml(criterion.comment || 'Sin comentario.').replace(/\r?\n/g, '<br>')}</p>
    </article>`).join('');
  return `<section class="review"><header><span>${escapeHtml(bookletTitle)}</span><span>${index} / ${total}</span></header><h2>${escapeHtml(review.bookTitle || 'Libro sin título')}</h2><p class="meta">Revisado por: ${escapeHtml(review.reviewerName || 'Desconocido')} · ${escapeHtml(review.timestamp)} · Media: ${review.averageScore === null ? '-' : review.averageScore.toFixed(1)}</p>${criteria}</section>`;
}

function renderStars(value) {
  const numeric = Number.parseFloat(String(value).replace(',', '.'));
  if (Number.isNaN(numeric)) return '<span class="stars">☆☆☆☆☆</span>';
  const score = Math.max(0, Math.min(10, numeric));
  const full = Math.floor(score / 2);
  const half = score % 2 >= 1 ? '<span class="half-star">★</span>' : '';
  return `<span class="stars" aria-label="${numeric} de 10">${'★'.repeat(full)}${half}${'☆'.repeat(5 - full - (half ? 1 : 0))}</span>`;
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function printStyles() {
  return `@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#24302d;font-family:"Segoe UI","Noto Sans",Arial,sans-serif;font-size:11pt;line-height:1.38}.cover{height:265mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}.cover h1{font-family:Georgia,serif;font-size:30pt;margin:0 0 12mm}.cover p{font-style:italic;font-size:13pt}.cover small{margin-top:8mm;font-size:11pt}.review{page-break-before:always}.review header{display:flex;justify-content:space-between;color:#6b7771;font-size:9pt;font-style:italic;border-bottom:1px solid #dfe3da;padding-bottom:3mm;margin-bottom:7mm}.review h2{font-family:Georgia,serif;font-size:18pt;margin:0 0 2mm}.meta{font-size:10pt;color:#52605a;margin:0 0 7mm}.criterion{break-inside:avoid;margin:0 0 4mm}.criterion-heading{display:flex;justify-content:space-between;gap:8mm;align-items:baseline;font-size:11pt}.criterion-heading strong{max-width:75%}.score{white-space:nowrap}.stars{font-family:"Segoe UI Symbol","Noto Sans Symbols 2",serif;letter-spacing:.03em}.half-star{background:linear-gradient(90deg,#d45535 50%,#fff 50%);background-clip:text;-webkit-background-clip:text;color:transparent}.score b{font-weight:500}.comment{margin:1mm 0 0;white-space:normal}`;
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
function safeText(value) { return String(value).replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[\u00a0\u202f]/g, ' ').replace(/[\u{1F000}-\u{1FAFF}]/gu, ''); }
function safeFilename(value) { return value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[_\.]+|[_\.]+$/g, '') || 'reviews_booklet'; }
