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
const APP_VERSION = 'v1.1.2';
const GOOGLE_SHEET = {
  id: '1MKOfVs0Xaj06G_ym0AUrz2tik3kiH9O8piqMP3bFlDM',
  clientId: '132459448822-ij6plm098g2l2keqrrebr7okqpsg02kd.apps.googleusercontent.com',
};
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
const GOOGLE_IMPORT = document.querySelector('#google-import');
const GOOGLE_BUTTON = document.querySelector('#google-button');
const GENERATE_BUTTON = document.querySelector('#generate-button');
const PREVIEW_BUTTON = document.querySelector('#preview-button');
const MESSAGE = document.querySelector('#message');
const PREVIEW_DIALOG = document.querySelector('#preview-dialog');
const PREVIEW_FRAME = document.querySelector('#preview-frame');
const INCLUDE_COVER = document.querySelector('#include-cover');
const CUSTOM_COVER_TITLE = document.querySelector('#custom-cover-title');
const STATS_SECTION = document.querySelector('#stats-section');
const REVIEWER_CRITERION = document.querySelector('#reviewer-criterion');
const BOOK_CRITERION = document.querySelector('#book-criterion');
let parsedReviews = null;
let reviewStats = null;
let fileReadSequence = 0;
let googleTokenClient = null;
let loadingGoogle = false;
let previewUrl = null;
let busy = false;
let criterionIcons = null;
let iconLoadPromise = null;

document.querySelector('#footer-version').textContent = APP_VERSION;
FILE_INPUT.addEventListener('change', (event) => handleFile(event.target.files[0]));
GOOGLE_BUTTON.addEventListener('click', loadGoogleReviews);
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
if (GOOGLE_SHEET.id && GOOGLE_SHEET.clientId) initializeGoogleImport();
const metricOptions = [['overall', 'Puntuación media'], ...CRITERIA.map(([name], index) => [String(index), name])];
[REVIEWER_CRITERION, BOOK_CRITERION].forEach((select) => {
  metricOptions.forEach(([value, label]) => select.add(new Option(label, value)));
  select.addEventListener('change', renderStats);
});

function updateCoverOptions() {
  document.querySelectorAll('.cover-option').forEach((element) => { element.hidden = !INCLUDE_COVER.checked; });
  document.querySelector('#cover-title-row').hidden = !INCLUDE_COVER.checked || !CUSTOM_COVER_TITLE.checked;
}

async function handleFile(file) {
  if (!file) return;
  const sequence = ++fileReadSequence;
  loadingGoogle = false;
  parsedReviews = null;
  reviewStats = null;
  STATS_SECTION.hidden = true;
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
    acceptReviews(reviews, file.name);
  } catch (error) {
    if (sequence !== fileReadSequence) return;
    showFileError(error.message || 'No se ha podido leer el archivo CSV.');
  }
}

function showFileError(message) {
  parsedReviews = null;
  reviewStats = null;
  STATS_SECTION.hidden = true;
  updateButtons();
  FILE_STATUS.className = 'file-status error';
  FILE_STATUS.textContent = message;
}

function updateButtons() {
  GENERATE_BUTTON.disabled = busy || !parsedReviews;
  PREVIEW_BUTTON.disabled = busy || !parsedReviews;
  GOOGLE_BUTTON.disabled = busy || loadingGoogle || !googleTokenClient;
}

function acceptReviews(reviews, source) {
  parsedReviews = reviews;
  reviewStats = calculateStats(reviews);
  renderStats();
  STATS_SECTION.hidden = false;
  updateButtons();
  const books = new Set(reviews.map((review) => review.bookTitle.toLocaleLowerCase('es'))).size;
  FILE_STATUS.className = 'file-status loaded';
  FILE_STATUS.textContent = `✓ ${source} · ${reviews.length} ${reviews.length === 1 ? 'reseña' : 'reseñas'} de ${books} ${books === 1 ? 'libro' : 'libros'}. Listo para descargar.`;
}

function initializeGoogleImport() {
  GOOGLE_IMPORT.hidden = false;
  document.querySelector('#upload-title').textContent = 'Carga las reseñas';
  document.querySelector('.converter-heading p').textContent = 'Desde Google Sheets o un archivo CSV.';
  document.querySelector('.intro > p:last-child').textContent = 'Carga las respuestas del formulario y descarga un cuadernillo PDF para todo el grupo.';
  const steps = document.querySelectorAll('.quick-guide li');
  steps[0].querySelector('strong').textContent = 'Carga';
  steps[0].querySelector('small').textContent = 'Desde Google o un CSV';
  steps[1].querySelector('strong').textContent = 'Revisa';
  steps[1].querySelector('small').textContent = 'Opciones y estadísticas';
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = () => {
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_SHEET.clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      callback: () => {},
      error_callback: (error) => {
        if (!loadingGoogle) return;
        showFileError(error.type === 'popup_closed' ? 'Has cerrado el acceso a Google. Puedes intentarlo de nuevo.' : 'No se pudo abrir el acceso a Google. Comprueba que el navegador permita ventanas emergentes.');
        loadingGoogle = false;
        updateButtons();
      },
    });
    updateButtons();
  };
  script.onerror = () => {
    GOOGLE_BUTTON.textContent = 'Google no disponible';
    FILE_STATUS.className = 'file-status error';
    FILE_STATUS.textContent = 'No se pudo cargar el acceso a Google. Comprueba la conexión e inténtalo de nuevo más tarde.';
  };
  document.head.append(script);
}

function loadGoogleReviews() {
  if (!googleTokenClient || loadingGoogle || busy) return;
  const sequence = ++fileReadSequence;
  loadingGoogle = true;
  parsedReviews = null;
  reviewStats = null;
  STATS_SECTION.hidden = true;
  FILE_STATUS.className = 'file-status';
  FILE_STATUS.textContent = 'Esperando autorización de Google…';
  MESSAGE.textContent = '';
  updateButtons();
  googleTokenClient.callback = async (response) => {
    if (sequence !== fileReadSequence) return;
    if (response.error || !response.access_token) {
      showFileError('No se autorizó el acceso a Google Sheets. Puedes intentarlo de nuevo o subir un CSV.');
      loadingGoogle = false;
      updateButtons();
      return;
    }
    try {
      FILE_STATUS.textContent = 'Cargando las respuestas de Google…';
      const rows = await fetchGoogleRows(response.access_token);
      const reviews = parseRows(rows);
      if (sequence !== fileReadSequence) return;
      acceptReviews(reviews, 'Google Sheets');
    } catch (error) {
      if (sequence === fileReadSequence) showFileError(error.message || 'No se pudieron cargar las respuestas de Google.');
    } finally {
      if (sequence === fileReadSequence) {
        loadingGoogle = false;
        updateButtons();
      }
    }
  };
  try {
    googleTokenClient.requestAccessToken();
  } catch (error) {
    showFileError('No se pudo abrir el acceso a Google. Comprueba que el navegador permita ventanas emergentes.');
    loadingGoogle = false;
    updateButtons();
  }
}

async function fetchGoogleRows(accessToken) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET.id)}`;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const getJson = async (url) => {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const googleError = await response.json().catch(() => null);
      const detail = String(googleError?.error?.message || '').slice(0, 300);
      if (response.status === 403) {
        if (/has not been used|is disabled|service disabled|SERVICE_DISABLED/i.test(detail)) {
          throw new Error('La API de Google Sheets no está habilitada en el proyecto de Google Cloud de esta web. Actívala y vuelve a intentarlo.');
        }
        throw new Error(`Google ha denegado el acceso a la hoja con esta cuenta. Comprueba que puede abrir el documento.${detail ? ` Detalle de Google: ${detail}` : ''}`);
      }
      if (response.status === 404) throw new Error('No se encontró la hoja de respuestas. Comprueba el ID del documento y que esta cuenta pueda abrirlo.');
      throw new Error(`Google Sheets devolvió un error (${response.status}).${detail ? ` ${detail}` : ''}`);
    }
    return response.json();
  };
  const metadata = await getJson(`${base}?fields=sheets(properties(title))`);
  const tabs = (metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean);
  const rangeUrl = (range) => `${base}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
  let headerMismatch = null;
  for (const tab of tabs) {
    const quotedTab = `'${tab.replaceAll("'", "''")}'`;
    const headerData = await getJson(rangeUrl(`${quotedTab}!A1:W1`));
    const header = headerData.values?.[0] || [];
    if (clean(header[0]) !== REQUIRED_HEADERS[0]) continue;
    const standardOrder = clean(header[1]) === REQUIRED_HEADERS[1] && clean(header[2]) === REQUIRED_HEADERS[2];
    const sheetOrder = clean(header[1]) === REQUIRED_HEADERS[2] && clean(header[2]) === REQUIRED_HEADERS[1];
    if (!standardOrder && !sheetOrder) continue;
    const mismatchedCriterion = CRITERIA.find(([name, index]) => clean(header[index]) !== name);
    if (mismatchedCriterion) {
      const [expected, index] = mismatchedCriterion;
      headerMismatch = `La pestaña «${tab}» tiene «${clean(header[index]) || '(vacía)'}» en la columna ${index + 1}; se esperaba «${expected}».`;
      continue;
    }
    const data = await getJson(rangeUrl(`${quotedTab}!A:W`));
    return (data.values || []).map((row) => {
      const normalized = Array.from({ length: Math.max(23, row.length) }, (_, index) => row[index] ?? '');
      if (sheetOrder) [normalized[1], normalized[2]] = [normalized[2], normalized[1]];
      return normalized;
    });
  }
  if (headerMismatch) throw new Error(headerMismatch);
  throw new Error('No se encontró una pestaña con las columnas del formulario del club.');
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

function calculateStats(reviews) {
  const makeGroups = (key) => {
    const groups = new Map();
    reviews.forEach((review) => {
      const name = clean(review[key]) || (key === 'reviewerName' ? 'Sin nombre' : 'Sin título');
      const id = name.toLocaleLowerCase('es');
      if (!groups.has(id)) groups.set(id, { name, values: Array.from({ length: CRITERIA.length + 1 }, () => []) });
      const group = groups.get(id);
      group.values[0].push(review.averageScore);
      review.criteria.forEach((criterion, index) => {
        const value = Number(criterion.score.replace(',', '.'));
        group.values[index + 1].push(criterionHasScore(criterion) && Number.isFinite(value) ? value : null);
      });
    });
    return Array.from(groups.values()).map(({ name, values }) => ({
      name,
      metrics: values.map((numbers) => {
        const scored = numbers.filter((value) => value !== null);
        return { mean: scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null, count: scored.length };
      }),
    }));
  };
  return { reviewers: makeGroups('reviewerName'), books: makeGroups('bookTitle') };
}

function rankedStats(groups, metricIndex) {
  return [...groups].sort((left, right) => {
    const a = left.metrics[metricIndex].mean;
    const b = right.metrics[metricIndex].mean;
    return (b === null ? -1 : b) - (a === null ? -1 : a) || left.name.localeCompare(right.name, 'es', { sensitivity: 'base' });
  });
}

function renderStats() {
  if (!reviewStats) return;
  [[reviewStats.reviewers, REVIEWER_CRITERION, '#reviewer-stats'], [reviewStats.books, BOOK_CRITERION, '#book-stats']].forEach(([groups, select, target]) => {
    const metricIndex = select.value === 'overall' ? 0 : Number(select.value) + 1;
    const list = document.querySelector(target);
    const fragment = document.createDocumentFragment();
    rankedStats(groups, metricIndex).forEach((group, index) => {
      const { mean, count } = group.metrics[metricIndex];
      const row = document.createElement('div');
      row.className = 'stats-row';
      const label = document.createElement('div');
      label.className = 'stats-row-label';
      const name = document.createElement('span');
      name.textContent = `${index + 1}. ${group.name}`;
      const score = document.createElement('strong');
      score.textContent = mean === null ? '—' : mean.toFixed(1);
      label.append(name, score);
      const track = document.createElement('div');
      track.className = 'stats-track';
      const bar = document.createElement('div');
      bar.className = 'stats-bar';
      bar.style.width = `${mean === null ? 0 : Math.max(0, Math.min(100, mean * 10))}%`;
      track.append(bar);
      const detail = document.createElement('small');
      detail.textContent = `${count} ${count === 1 ? 'reseña puntuada' : 'reseñas puntuadas'}`;
      row.append(label, track, detail);
      fragment.append(row);
    });
    list.replaceChildren(fragment);
  });
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
  const includeStats = document.querySelector('#include-stats').checked;
  const statsEntry = includeStats ? { title: 'Estadísticas', isStats: true, startPage: null } : null;
  if (INCLUDE_COVER.checked) {
    const canvas = newCanvas();
    const context = canvas.getContext('2d');
    const coverTitle = CUSTOM_COVER_TITLE.checked ? document.querySelector('#cover-title').value.trim() || title : title;
    drawCover(context, coverTitle, document.querySelector('#cover-subtitle').value.trim(), reviews.length, books.length);
    pages.push(canvas);
  }
  const contents = document.querySelector('#include-contents').checked ? paginateContents(statsEntry ? [...books, statsEntry] : books) : [];
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
  if (includeStats) {
    statsEntry.startPage = pages.length + 1;
    const stats = reviewStats || calculateStats(reviews);
    appendStatsPages(pages, title, 'Lectores', 'Puntuación media por lector', rankedStats(stats.reviewers, 0));
    appendStatsPages(pages, title, 'Libros', 'Los 10 libros mejor puntuados', rankedStats(stats.books, 0).slice(0, 10));
    appendFavoritePages(pages, title, reviews);
  }
  contents.forEach((entries, index) => {
    pages[contentsStart + index] = drawContentsPage(entries, title, contentsStart + index + 1, index + 1, contents.length);
  });
  return pages;
}

function appendFavoritePages(pages, title, reviews) {
  const readers = new Map();
  reviews.forEach((review) => {
    const name = clean(review.reviewerName) || 'Sin nombre';
    const id = name.toLocaleLowerCase('es');
    if (!readers.has(id)) readers.set(id, { name, reviews: [] });
    readers.get(id).reviews.push(review);
  });
  const orderedReaders = Array.from(readers.values()).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  orderedReaders.forEach((reader) => reader.reviews.sort((a, b) => {
    if (a.averageScore === null) return b.averageScore === null ? a.bookTitle.localeCompare(b.bookTitle, 'es') : 1;
    if (b.averageScore === null) return -1;
    return b.averageScore - a.averageScore || a.bookTitle.localeCompare(b.bookTitle, 'es', { sensitivity: 'base' }) || a.timestampSortKey - b.timestampSortKey;
  }));

  let context;
  let y;
  const startPage = () => {
    const canvas = newCanvas();
    context = canvas.getContext('2d');
    const colors = BOOKLET_COLORS;
    const pageNumber = pages.length + 1;
    context.fillStyle = colors.accent;
    context.fillRect(0, 0, 1240, 14);
    context.fillStyle = colors.muted;
    context.font = '600 16px Arial, sans-serif';
    context.fillText(title.toLocaleUpperCase('es'), 110, 76, 800);
    context.textAlign = 'right';
    context.fillText('ESTADÍSTICAS', 1130, 76);
    context.textAlign = 'left';
    context.strokeStyle = colors.rule;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(110, 101);
    context.lineTo(1130, 101);
    context.moveTo(110, 1660);
    context.lineTo(1130, 1660);
    context.stroke();
    context.fillStyle = colors.accent;
    context.font = '600 18px Arial, sans-serif';
    context.fillText('FAVORITOS DE CADA LECTOR', 110, 174);
    context.fillStyle = colors.ink;
    context.font = '67px Georgia, serif';
    context.fillText('Los libros de cada lector', 110, 270, 1020);
    context.fillStyle = colors.muted;
    context.font = '19px Arial, sans-serif';
    context.fillText('Todas sus reseñas, de mayor a menor puntuación media', 110, 321);
    context.font = '15px Arial, sans-serif';
    context.fillText('CLUB DE LECTURA', 110, 1697);
    context.textAlign = 'right';
    context.fillText(String(pageNumber).padStart(2, '0'), 1130, 1697);
    context.textAlign = 'left';
    pages.push(canvas);
    y = 370;
  };
  startPage();
  orderedReaders.forEach((reader) => {
    let firstOnPage = true;
    reader.reviews.forEach((review, index) => {
      if (y + (firstOnPage ? 102 : 58) > 1580) { startPage(); firstOnPage = true; }
      if (firstOnPage) {
        context.fillStyle = BOOKLET_COLORS.sage;
        context.fillRect(110, y - 30, 1020, 54);
        context.fillStyle = BOOKLET_COLORS.ink;
        context.font = '600 28px Georgia, serif';
        context.fillText(reader.name, 126, y + 6, 740);
        context.fillStyle = BOOKLET_COLORS.muted;
        context.font = '17px Arial, sans-serif';
        context.textAlign = 'right';
        context.fillText(index ? 'continúa' : `${reader.reviews.length} ${reader.reviews.length === 1 ? 'reseña' : 'reseñas'}`, 1114, y + 4);
        context.textAlign = 'left';
        y += 62;
        firstOnPage = false;
      }
      context.fillStyle = BOOKLET_COLORS.accent;
      context.font = '600 18px Arial, sans-serif';
      context.fillText(String(index + 1).padStart(2, '0'), 122, y);
      context.fillStyle = BOOKLET_COLORS.ink;
      context.font = '25px Georgia, serif';
      context.fillText(review.bookTitle, 177, y, 800);
      context.textAlign = 'right';
      context.font = '600 24px Arial, sans-serif';
      context.fillText(review.averageScore === null ? '—' : `${review.averageScore.toFixed(1)} / 10`, 1114, y);
      context.textAlign = 'left';
      context.strokeStyle = BOOKLET_COLORS.rule;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(110, y + 16);
      context.lineTo(1130, y + 16);
      context.stroke();
      y += 58;
    });
    y += 28;
  });
}

function appendStatsPages(pages, title, category, heading, groups) {
  const rowsPerPage = 13;
  for (let offset = 0; offset < groups.length; offset += rowsPerPage) {
    const canvas = newCanvas();
    const context = canvas.getContext('2d');
    const colors = BOOKLET_COLORS;
    const pageNumber = pages.length + 1;
    context.fillStyle = colors.accent;
    context.fillRect(0, 0, 1240, 14);
    context.fillStyle = colors.muted;
    context.font = '600 16px Arial, sans-serif';
    context.fillText(title.toLocaleUpperCase('es'), 110, 76, 800);
    context.textAlign = 'right';
    context.fillText('ESTADÍSTICAS', 1130, 76);
    context.textAlign = 'left';
    context.strokeStyle = colors.rule;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(110, 101);
    context.lineTo(1130, 101);
    context.moveTo(110, 1660);
    context.lineTo(1130, 1660);
    context.stroke();
    context.fillStyle = colors.accent;
    context.font = '600 18px Arial, sans-serif';
    context.fillText(category.toLocaleUpperCase('es'), 110, 174);
    context.fillStyle = colors.ink;
    context.font = '64px Georgia, serif';
    context.fillText(heading, 110, 270, 1020);
    context.fillStyle = colors.muted;
    context.font = '19px Arial, sans-serif';
    context.fillText('Media sobre 10 · cada reseña puntuada cuenta una vez', 110, 321);
    groups.slice(offset, offset + rowsPerPage).forEach((group, index) => {
      const { mean, count } = group.metrics[0];
      const y = 394 + index * 91;
      context.fillStyle = colors.ink;
      context.font = '27px Georgia, serif';
      context.fillText(`${offset + index + 1}. ${group.name}`, 110, y, 730);
      context.fillStyle = colors.muted;
      context.textAlign = 'right';
      context.font = '17px Arial, sans-serif';
      context.fillText(`${count} ${count === 1 ? 'reseña' : 'reseñas'}`, 990, y);
      context.textAlign = 'left';
      context.fillStyle = colors.rule;
      context.fillRect(110, y + 17, 880, 23);
      context.fillStyle = colors.accent;
      context.fillRect(110, y + 17, mean === null ? 0 : 880 * Math.max(0, Math.min(1, mean / 10)), 23);
      context.fillStyle = colors.ink;
      context.textAlign = 'right';
      context.font = '600 30px Arial, sans-serif';
      context.fillText(mean === null ? '—' : mean.toFixed(1), 1130, y + 39);
      context.textAlign = 'left';
    });
    context.fillStyle = colors.muted;
    context.font = '15px Arial, sans-serif';
    context.fillText('CLUB DE LECTURA', 110, 1697);
    context.textAlign = 'right';
    context.fillText(String(pageNumber).padStart(2, '0'), 1130, 1697);
    context.textAlign = 'left';
    pages.push(canvas);
  }
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
  context.fillText('CONTENIDO', 180, 356);
  context.textAlign = 'right';
  context.fillText('PÁGINA', 1130, 356);
  context.textAlign = 'left';
  entries.forEach(({ book, lines, y, height }) => {
    context.fillStyle = colors.accent;
    context.font = '600 19px Arial, sans-serif';
    context.fillText(book.isStats ? '✦' : String(book.bookNumber).padStart(2, '0'), 110, y + 33);
    context.fillStyle = colors.ink;
    context.font = '40px Georgia, serif';
    lines.forEach((line, lineIndex) => context.fillText(line, 180, y + 39 + lineIndex * 48));
    context.fillStyle = colors.muted;
    context.font = '18px Arial, sans-serif';
    context.fillText(book.isStats ? 'Gráficos y favoritos por lector' : `${book.reviewCount} ${book.reviewCount === 1 ? 'reseña' : 'reseñas'}`, 180, y + 37 + lines.length * 48);
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
  const iso = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s+([ap])\.\s*m\.)?/i);
  const local = iso ? null : value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  const match = iso || local;
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[4]);
  if (iso && match[7]?.toLowerCase() === 'p' && hour < 12) hour += 12;
  if (iso && match[7]?.toLowerCase() === 'a' && hour === 12) hour = 0;
  const [year, month, day] = iso ? [Number(match[1]), Number(match[2]), Number(match[3])] : [Number(match[3]), Number(match[2]), Number(match[1])];
  return Date.UTC(year, month - 1, day, hour, Number(match[5]), Number(match[6]));
}
function valueAt(row, index) { return clean(row[index]); }
function clean(value) { return String(value ?? '').replace(/^\uFEFF/, '').trim(); }
function safeFilename(value) { return value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[_\.]+|[_\.]+$/g, '') || 'reviews_booklet'; }
