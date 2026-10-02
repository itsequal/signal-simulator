# Simulador de modulaciones digitales binarias

Laboratorio educativo que se ejecuta en el navegador. Genera y compara ASK, OOK, FSK binaria de fase continua y BPSK a partir de una secuencia de bits, de un texto UTF-8 o de una grabación de voz.

No demodula, no recupera la voz y no envía nada a un servidor. Los bits, el texto y las grabaciones viven sólo en la pestaña y se pierden al recargar.

## Requisitos

- Node.js 24 (o 26 o posterior) y npm 11.3 o posterior. El archivo `.nvmrc` pide la 24.
- En esta máquina puede haber un `npm` 9 antiguo con prioridad en el `PATH`. Usa el npm que acompaña a Node 24 antes de instalar.

## Puesta en marcha

```bash
npm ci
npm run dev
```

Abre la dirección que muestra Vite (incluye la ruta base si defines `BASE_PATH`). El micrófono exige HTTPS o `localhost`; abrir `index.html` con `file://` no sirve.

```bash
npm test
npm run lint
npm run build
npm run e2e
```

`npm run e2e` construye la aplicación, la sirve bajo `/pages-test/` y la prueba en Chromium (con micrófono sintético) y, en el humo, en Firefox. `npm run e2e:win` usa Chrome y Edge instalados. La comprobación con micrófono y altavoces reales está en `docs/verificacion-manual.md` y no la sustituyen estas pruebas.

## Publicación

El flujo `.github/workflows/pages.yml` instala con `npm ci`, ejecuta lint, pruebas y build, y publica `dist` en GitHub Pages al empujar a `main`.

- Repositorio de proyecto: la base es `/<REPOSITORIO>/` y la dirección queda `https://<USUARIO_GITHUB>.github.io/<REPOSITORIO>/`.
- Repositorio `<USUARIO_GITHUB>.github.io`: la base es `/`.
- Dominio propio: define la variable de repositorio `BASE_PATH` como `/`.

En el repositorio, Settings → Pages → Source debe ser GitHub Actions.

## Qué se puede cambiar

Las frecuencias, tasas, límites y colores iniciales están en `src/config/constants.ts`. Cambiarlos obliga a revisar las pruebas que dependen de esos números.
