# FitAI Style — arquitectura React

Esta aplicación es una base modular de migración y se mantiene separada del frontend HTML existente para evitar sustituir la web publicada antes de validar compatibilidad.

## Requisitos
- Node.js 20.19+ o 22.12+
- npm

## Ejecutar
```bash
cd react-app
npm install
npm run dev
```

## Validar compilación
```bash
npm run build
npm run preview
```

## Configuración
Define `VITE_FITAI_API_URL` en un archivo `.env.local` si el backend usa otra URL. El valor predeterminado apunta al backend público de FitAI Style.

## Estructura
- `src/api`: cliente HTTP y manejo de errores de API.
- `src/assets`: estilos y recursos de interfaz.
- `src/components`: componentes reutilizables.
- `src/context`: estado compartido ligero de interfaz.
- `src/data`: navegación y datos estáticos.
- `src/hooks`: hooks de React.
- `src/pages`: páginas.
- `src/redux`: store y slices de Redux Toolkit.
- `src/services`: operaciones de negocio.
- `src/utils`: funciones auxiliares.

La autenticación Firebase, el avatar 3D y las páginas HTML actuales no se sustituyen automáticamente. Deben migrarse y probarse por etapas antes de publicar esta aplicación como reemplazo.