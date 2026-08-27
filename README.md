# Tablero

Aplicación de tablero Kanban minimalista, inspirada en Notion, construida como un sitio estático de un único archivo HTML. Sin frameworks, sin dependencias de build ni backend: se abre y funciona.

## Características

- Columnas y tarjetas totalmente editables (click para renombrar o editar contenido).
- Reordenamiento mediante arrastrar y soltar, tanto de tarjetas entre columnas como de columnas completas.
- Persistencia automática en `localStorage`, sin necesidad de guardar manualmente.
- Interfaz responsive, adaptada a pantallas de escritorio y móviles.
- Cero dependencias externas de runtime: un solo archivo HTML con CSS y JavaScript embebidos.

## Stack técnico

| Capa       | Tecnología                  |
|------------|------------------------------|
| Estructura | HTML5                        |
| Estilos    | CSS3 (custom properties)     |
| Lógica     | JavaScript (vanilla, ES5+)   |
| Tipografía | [Inter](https://fonts.google.com/specimen/Inter) vía Google Fonts |
| Persistencia | Web Storage API (`localStorage`) |

## Uso local

No requiere instalación ni servidor. Alcanza con abrir el archivo en cualquier navegador moderno:

```bash
open index.html        # macOS
start index.html        # Windows
xdg-open index.html      # Linux
```

## Despliegue

### Vercel

1. Subí el repositorio a GitHub (o arrastrá la carpeta directamente a [vercel.com/new](https://vercel.com/new)).
2. En Vercel: **Add New → Project** e importá el repositorio.
3. No requiere configuración de build: dejá el *Build Command* y el *Output Directory* vacíos, o el *Output Directory* como `.`.
4. **Deploy**.

### GitHub Pages

1. Subí `index.html` a la raíz de un repositorio en GitHub.
2. Andá a **Settings → Pages**.
3. En *Source*, seleccioná la rama `main` y la carpeta `/ (root)`.
4. Guardá los cambios. El sitio queda publicado en `https://<tu-usuario>.github.io/<tu-repo>/`.

### Otros hosts estáticos

Cualquier servicio que sirva archivos estáticos (Netlify, Cloudflare Pages, GitHub, un bucket S3, etc.) funciona igual: no hay paso de build.

## Estructura del proyecto

```
.
├── index.html   # Aplicación completa: markup, estilos y lógica
└── README.md
```

Todo el estado de la aplicación vive en un único objeto en memoria (`board`), con la forma:

```js
{
  title: "Mi tablero",
  columns: [
    {
      id: "…",
      title: "Por hacer",
      color: "#2383E2",
      cards: [{ id: "…", text: "…" }]
    }
  ]
}
```

Cada cambio de estado se persiste inmediatamente en `localStorage` mediante `saveBoard()`, y la interfaz se re-renderiza por completo con `render()`. No hay build step: cualquier edición al archivo se refleja recargando la página.

## Limitaciones conocidas

- Los datos se almacenan por navegador y dispositivo. `localStorage` no sincroniza entre distintos navegadores ni entre computadora y celular.
- Al ser una aplicación de un único usuario, no incluye autenticación, backend ni sincronización multi-dispositivo.
- Borrar los datos de navegación del sitio elimina el contenido del tablero.

## Licencia

Uso libre y personal. Sin restricciones para modificar o redistribuir.
