# Análisis de factibilidad — mejoras en torneos/rankings/admin

Fecha: 2026-04-23

## Resumen ejecutivo

Sí, **todos los cambios solicitados son factibles** con la base actual, y pueden implementarse sin sobre-ingeniería si se separan por fases.

Puntos clave:

1. **Tabs en vista pública de tournament category (entre categorías del mismo torneo):** factible con bajo riesgo.
2. **Simplificación de rankings por categorías/género con puntos:** factible y recomendable; elimina hardcode y tablas vacías.
3. **Cambio de “Editar/Eliminar” por “Gestionar” + reorganización de gestión admin:** factible en fases para no romper flujos actuales.
4. **Compresión de imágenes al subir:** parcialmente implementada hoy (JPEG + canvas); se puede mejorar con utilidad compartida y estrategia dual (original + optimizada).
5. **Contraste/legibilidad y performance general:** conviene tratarlos luego, como indicó el requerimiento, con una mini auditoría técnica antes de tocar estilos globales.

---

## Estado actual relevante (hallazgos)

### 1) Tabs públicas de categoría/torneo

- La página pública de categoría reutiliza `TournamentCategoryPage` vía `PublicTournamentPage`.
- Hoy existen tabs internas de secciones (`Zonas`, `Cruces`, etc.), pero **no tabs para saltar entre categorías del mismo torneo**.
- El header muestra botón “Volver al inicio”, lo que confirma el dolor de navegación actual.

Impacto: bajo. Se puede inyectar un “selector/tabs de categorías del torneo” en el header o encima de tabs internas.

### 2) Rankings

- El front de rankings hoy usa categorías visibles hardcodeadas (`6ta`, `7ma`, `8va`).
- Además separa selección de categoría y género en dos grupos de tabs.
- El service ya calcula puntos por categoría/género y filtra puntos `> 0`; es decir, ya tenemos base para derivar “solo combinaciones con datos”.

Impacto: bajo a medio. Principalmente refactor de estado/UI en página de rankings.

### 3) Gestión admin de torneos

- En cards de admin (pantalla de torneos) hoy aparecen botones `Editar` y `Eliminar`.
- El flujo de edición/creación está centralizado en `TournamentCreatePage` y ya distingue modo admin.
- En edición ya existe un segundo contenedor para fotos (útil como punto de extensión para “Fotos / Inscriptos / Configuración”).

Impacto: medio. Conviene introducir una navegación secundaria dentro de “Gestionar” para no romper la creación.

### 4) Subida de fotos

- Ya existe compresión cliente-side en `uploadTournamentPhoto` (canvas), con resize a 1920 y salida JPEG calidad 0.72.
- No hay distinción entre “original” y “derivada optimizada”. Se guarda una sola URL pública en `photos`.

Impacto: medio. Funciona, pero para cubrir “compartir original en Instagram” hace falta cambiar modelo de datos o bucket/path strategy.

---

## Propuesta simple por requerimiento

## A) Tabs públicas para cambiar de torneo/categoría sin volver

### Objetivo funcional
Desde `/{tenant}/tournament/{slug}/{tournamentCategoryId}` permitir navegar entre categorías del mismo torneo (misma UX que admin).

### Implementación simple

1. En carga de datos de `TournamentCategoryPage`, obtener también todas las categorías del torneo (id + label formateado + disponibilidad de fixture opcional).
2. Renderizar un bloque de tabs/chips arriba de las tabs internas.
3. Al click:
   - navegar a la misma ruta pública cambiando `category` (id de `tournament_category`),
   - preservar query de owner si existiera.

### Riesgos
- Bajo. Solo cuidar que la categoría destino pueda no tener partidos (mostrar mensaje actual de “próximamente”).

---

## B) Simplificar tabla de rankings

### Objetivo funcional
Mostrar **solo combinaciones categoría-género con puntos**, en tabs con notación corta: `6ta - M`, `7ma - F`, etc.

### Implementación simple

1. En `RankingsPage`, derivar una lista `availableSegments` desde `rankings` cargado:
   - recorrer categorías existentes,
   - incluir solo `(cat, gender)` con filas de puntos `> 0`.
2. Reemplazar los dos grupos de tabs (categoría + género) por **un solo grupo** de tabs compactas.
3. Selección inicial:
   - primera combinación disponible,
   - fallback a estado vacío si no hay datos.
4. Mantener búsqueda y tabla tal como está.

### Beneficio
- Menos ruido visual.
- Evita tablas vacías y hardcode.

### Riesgo
- Bajo.

---

## C) Admin: “Gestionar” y reorganización de pantalla

### Objetivo funcional
Unificar entrada de administración y ordenar acciones secundarias.

### Implementación recomendada (sin sobre-ingeniería)

#### Fase C1 (rápida y segura)
1. En cards admin de torneos, reemplazar `Editar` + `Eliminar` por botón único **Gestionar**.
2. `Gestionar` navega a `/admin/tournaments/:id/edit`.
3. Mover `Eliminar torneo` dentro de la pantalla de edición, en sección “Configuración” simple.

#### Fase C2 (estructura interna en edit)
En `TournamentCreatePage` (solo `isAdminMode && isEditMode`), crear sub-tabs locales:
- `Datos` (form actual: nombre, fechas, categorías/género, crear/guardar, volver),
- `Fotos` (mover bloque actual de fotos),
- `Inscriptos` (CTA que redirige a ruta existente),
- `Configuración`.

#### Fase C3 (configuración mínima)
Opciones sugeridas en `Configuración` (pocas y simples):
- Eliminar torneo (acción destructiva confirmada),
- Valores por defecto de setup:
  - `courts_count_default`,
  - `match_interval_minutes_default`.

> Nota: hoy esos defaults existen en runtime de `TournamentCategoryPage`; persistirlos por torneo requiere columnas nuevas o tabla de settings.

### Riesgo
- C1 bajo, C2 medio, C3 medio (por migración DB).

---

## D) Compresión de imágenes y estrategia original vs optimizada

### Estado y decisión
Ya hay compresión en cliente. Para cumplir mejor el requerimiento y escalar UX, recomiendo:

### Opción 1 (más simple, inmediata)
- Mantener **una sola versión optimizada** al subir.
- Mejorar compresión con util reusable (puede ser `browser-image-compression`) en `shared/utils/optimizeImages.ts`.
- Ajustes sugeridos para este proyecto:
  - `maxSizeMB: 0.6–0.9`,
  - `maxWidthOrHeight: 1600–1920`,
  - `fileType: image/webp` (si no rompe flujos de share),
  - `initialQuality: 0.82–0.88`.

### Opción 2 (recomendada para requisito de compartir original)
- Subir y guardar **dos archivos**:
  - `original_url` (archivo original),
  - `display_url` (webp optimizada para galería).
- En UI:
  - mostrar siempre `display_url`,
  - botón compartir usa `original_url` (o fallback `display_url`).

### Sobre “mostrar webp y compartir original a Instagram”
- Sí, es posible a nivel producto si guardamos ambas URLs.
- Limitación: compartir “directo a Instagram” depende de capacidades del navegador/dispositivo y APIs del sistema operativo.
- Implementación web estándar: compartir URL de la original; no garantiza deep integration nativa en todos los casos.

### Riesgo
- Opción 1: bajo.
- Opción 2: medio (requiere migración en `photos` + ajuste queries/UI).

---

## E) Cambios de contraste/legibilidad y mejora de performance (postergados)

Correcto postergarlos para una segunda etapa.

### Recomendación de alcance mínimo futuro

1. **UI/Contraste (rápido):** tokenizar colores de texto/borde y validar AA en vistas principales.
2. **Performance (rápido):**
   - evitar N+1 de `getMatchesByCategory` por categoría en Home,
   - lazy-load de secciones pesadas (brackets/fotos),
   - revisar tamaño de imágenes y cache-control.

---

## Plan de implementación seguro (orden sugerido)

1. **Sprint 1 — Bajo riesgo / alto valor visible**
   - B) Simplificación rankings.
   - A) Tabs públicas de categorías en tournament page.

2. **Sprint 2 — Reordenamiento admin sin cambios de datos**
   - C1) Botón Gestionar en cards.
   - C2 parcial) sub-tabs en edit: Datos/Fotos/Inscriptos (sin Config avanzada).
   - C3) Configuración mínima persistida por torneo.

3. **Sprint 3 — Datos y media**
   - D) Estrategia de imágenes elegida:
     - Opción 1 directa, o
     - Opción 2 con migración `photos` (`original_url`, `display_url`).

4. **Sprint 4 — UX transversal (postergado)**
   - Contraste/legibilidad.
   - Optimización de tiempos de carga.

---

## Recomendación final

Para cumplir rápido y estable:

- Implementar primero **A + B + C1**.
- Luego **C2**.
- Definir con producto si realmente necesitan compartir original (si sí, ir con **D opción 2**; si no, opción 1).
- Dejar contraste/performance para fase dedicada, con métricas base antes/después.
