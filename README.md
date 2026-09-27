# Alas de papel — conversor de reseñas

Aplicación web para que los miembros del club de lectura conviertan las respuestas de su formulario en un cuadernillo PDF listo para compartir. La web es la única interfaz del proyecto: funciona en el navegador, sin instalación, servidor de datos ni aplicación Python.

**Estado actual:** el conversor es funcional para el formato CSV del formulario de *Alas de papel* y puede publicarse como sitio estático en GitHub Pages. No es un conversor de CSV genéricos: si cambian las preguntas o el orden de las columnas del formulario, habrá que adaptar el código.

## Cómo usarlo

1. Abre [index.html](index.html) o la URL del sitio publicado.
2. Exporta las respuestas de Google Forms o Google Sheets como CSV y súbelo a la página. Puedes consultar el [CSV de ejemplo](data/Alas%20de%20papel.csv) para ver la estructura esperada.
3. Ajusta el título, la portada y la opción de mostrar apartados sin comentario.
4. Pulsa **Descargar PDF**. Si prefieres comprobar el resultado antes, pulsa **Vista previa**.

La página indica cuántas reseñas y libros ha encontrado y muestra errores concretos cuando el archivo no tiene la estructura esperada. Acepta CSV separados por comas o punto y coma.

## Resultado

El cuadernillo ordena las reseñas por título del libro y después por fecha. Incluye una portada opcional, un índice con la primera página de cada libro y una página inicial para cada reseña. Las reseñas largas continúan en páginas adicionales. Cada reseña muestra a quien la escribió, la fecha, la puntuación media y los criterios evaluados con estrellas, iconos y comentarios justificados.

Las páginas del PDF se generan como imágenes. Por ahora, el texto del PDF no se puede seleccionar ni buscar.

## Privacidad y requisitos

El CSV se lee y procesa en el navegador; sus respuestas no se suben a un servidor. La generación del PDF usa jsPDF, que se carga desde un CDN, por lo que se necesita conexión a Internet. Las fuentes de la interfaz también se solicitan a Google Fonts; si no están disponibles, el navegador usa fuentes alternativas.

## Publicar en GitHub Pages

1. En el repositorio, abre **Settings > Pages**.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)`.
4. Abre la URL de Pages que muestra GitHub.

No hace falta compilar ni instalar dependencias. `index.html` carga `web/app.js`, `web/styles.css` y los SVG de `web/icons/`. Estos iconos son parte de la aplicación y deben permanecer en el repositorio; `.gitignore` solo excluye los PDF generados. El CSV de `data/` sirve como ejemplo de formato.

Los iconos pertenecen al paquete [Lucide](https://www.freeicons.org/icons/lucide). Su licencia se conserva en [web/icons/LICENSE](web/icons/LICENSE).
