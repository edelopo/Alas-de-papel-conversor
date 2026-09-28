# Alas de papel — conversor de reseñas

Aplicación web para que los miembros del club de lectura conviertan las respuestas de su formulario en un cuadernillo PDF listo para compartir. La web es la única interfaz del proyecto: funciona en el navegador, sin instalación, servidor de datos ni aplicación Python.

**Estado actual:** el conversor es funcional para el formato CSV del formulario de *Alas de papel* y puede publicarse como sitio estático en GitHub Pages. No es un conversor de CSV genéricos: si cambian las preguntas o el orden de las columnas del formulario, habrá que adaptar el código.

## Cómo usarlo

1. Abre la URL del sitio publicado. Para probarlo en local, sirve esta carpeta desde un puerto libre, por ejemplo `http://localhost:8766`, y abre [index.html](index.html); si lo abres como archivo, solo funcionará la carga de CSV.
2. Pulsa **Cargar respuestas de Google** y autoriza el acceso con una cuenta que pueda ver la hoja vinculada al formulario. También puedes exportar las respuestas como CSV y subir el archivo. El [CSV de ejemplo](data/Alas%20de%20papel.csv) muestra la estructura esperada.
3. Si quieres cambiar el resultado, abre **Personaliza el cuadernillo**. Puedes ajustar el título y la portada, incluir u omitir el índice, y elegir qué datos y puntuaciones se muestran.
4. Pulsa **Descargar PDF**. Si prefieres comprobar el resultado antes, pulsa **Vista previa**.

La página indica cuántas reseñas y libros ha encontrado y muestra errores concretos cuando el archivo no tiene la estructura esperada. Acepta CSV separados por comas o punto y coma.

También puedes pulsar **Cargar respuestas de Google** para leer la hoja vinculada al formulario sin descargar un CSV. Cada miembro debe iniciar sesión con una cuenta que tenga acceso de lectura a la hoja. La web busca la pestaña con las columnas del formulario, lee las respuestas con permiso `spreadsheets.readonly` y las procesa en el navegador; el CSV sigue disponible como alternativa. En Google Cloud, los orígenes JavaScript autorizados deben incluir `https://edelopo.github.io` y, si quieres probar la carga desde Google en local, el origen exacto del servidor que uses (por ejemplo `http://localhost:8766`). La autenticación no funciona desde `file://`.

Al cargar las reseñas aparece una sección de **Estadísticas del club** debajo de las opciones. Muestra una clasificación de todos los lectores y todos los libros por puntuación media. En cada lista puedes elegir un criterio concreto para comparar sus medias en esa categoría. El número de reseñas puntuadas se muestra junto a cada resultado; las puntuaciones vacías no se incluyen en la media.

## Resultado

El cuadernillo ordena las reseñas por título del libro y después por fecha. Puede incluir una portada y un índice con la primera página de cada libro. Cada reseña empieza en una página nueva y, si es larga, continúa en páginas adicionales. El nombre de quien escribió la reseña siempre se muestra; la fecha, la puntuación media y las puntuaciones de cada criterio son opcionales. Los criterios usan iconos y comentarios justificados.

Por defecto, al final del cuadernillo se añaden gráficos de barras horizontales con la puntuación media de cada lector y los diez libros mejor puntuados. Después aparece una lista por lector con todas sus reseñas ordenadas de mayor a menor puntuación media, para ver cuáles son sus libros favoritos. El índice incluye una entrada «Estadísticas» con la primera página de este apartado. Estas estadísticas se pueden omitir desde **Personaliza el cuadernillo**. Con el CSV de ejemplo ocupan tres páginas; si hay muchos lectores o reseñas, las listas continúan en páginas adicionales. La media de un lector o libro es la media de las puntuaciones medias de sus reseñas, de modo que cada reseña puntuada pesa lo mismo.

Las páginas del PDF se generan como imágenes. Por ahora, el texto del PDF no se puede seleccionar ni buscar.

## Privacidad y requisitos

El CSV se lee y procesa en el navegador. Al usar Google, el navegador pide a Google las respuestas de la hoja autorizada y las procesa localmente; no se envían a un servidor del proyecto. La generación del PDF usa jsPDF, que se carga desde un CDN, por lo que se necesita conexión a Internet. El acceso a Google carga Google Identity Services y requiere conexión. Las fuentes de la interfaz también se solicitan a Google Fonts; si no están disponibles, el navegador usa fuentes alternativas.

## Publicar en GitHub Pages

1. En el repositorio, abre **Settings > Pages**.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)`.
4. Abre la URL de Pages que muestra GitHub.

No hace falta compilar ni instalar dependencias. `index.html` carga `web/app.js`, `web/styles.css` y los SVG de `web/icons/`. Estos iconos son parte de la aplicación y deben permanecer en el repositorio; `.gitignore` solo excluye los PDF generados. El CSV de `data/` sirve como ejemplo de formato.

Los iconos pertenecen al paquete [Lucide](https://www.freeicons.org/icons/lucide). Su licencia se conserva en [web/icons/LICENSE](web/icons/LICENSE).
