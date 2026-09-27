# Alas de papel conversor

Web app para convertir las reseñas del club de lectura desde un CSV exportado de Google Forms o Google Sheets a un cuadernillo PDF. Todo el procesamiento de las reseñas ocurre en el navegador; el CSV no se envía a un servidor.

## Usar la aplicación

Abre la [aplicación web](index.html) en un navegador. Sube un CSV con la misma estructura que el [archivo de ejemplo](data/Alas%20de%20papel.csv), ajusta el título y las opciones de portada, y pulsa **Descargar PDF**. El archivo se genera y descarga con un solo clic. Si quieres comprobarlo primero, pulsa **Vista previa**; muestra el mismo PDF en un cuadro dentro de la página.

La aplicación indica cuántas reseñas y libros ha encontrado. Si el CSV no coincide con el formulario del club, muestra qué columna o respuesta hay que revisar. Acepta CSV separados por comas o punto y coma.

La generación del PDF usa jsPDF, cargado desde un CDN, por lo que hace falta conexión a Internet para descargarlo. El contenido del CSV se procesa localmente en la pestaña del navegador.

## Publicar en GitHub Pages

1. Abre **Settings > Pages** en el repositorio.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)`.
4. Abre la URL de Pages que muestra GitHub.

La aplicación está formada por `index.html` y los archivos de `web/`. El CSV de `data/` sirve como ejemplo de formato.
