# Simulador de modulaciones digitales binarias

## Requisitos

- Node.js 24 

## Inicializacion

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
Las frecuencias, tasas, límites y colores iniciales están en `src/config/constants.ts`. Cambiarlos obliga a revisar las pruebas que dependen de esos números.
