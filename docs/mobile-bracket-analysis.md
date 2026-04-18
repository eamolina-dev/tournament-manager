# Mobile Bracket UX Analysis (Práctico)

Date: 2026-04-18  
Scope: análisis orientado a decisión práctica para mejorar la **navegación de brackets en mobile** sin reemplazar la vista de llave pública.

## Contexto y restricción de producto

- La vista de brackets **no se elimina**: es parte central de la experiencia pública.
- El objetivo no es cambiar de representación, sino hacer que la navegación en celular sea más fluida.
- El zoom es secundario; puede existir o no, siempre que navegar sea más simple.

## Situación técnica actual (por qué hoy se siente "trabado")

1. El contenedor de bracket usa `overflow-x-auto`, pero el contenido interno fuerza tamaño grande:
   - `min-w-[960px]`
   - `SVGViewer` con `width={1800}` y `height={880}`
2. Resultado en mobile: hay demasiado lienzo horizontal + vertical, y el gesto de navegación exige mucho paneo para ubicar cruces.
3. Cada nodo renderiza `MatchCardFull`, que es relativamente denso, agregando carga visual/táctil en pantallas chicas.

Referencias:
- `src/features/tournaments/components/TournamentBracket.tsx`
- `src/features/matches/components/MatchCard.tsx`

---

## Opciones viables para mobile (foco práctico)

## Opción 1 — Sacar `SVGViewer` y usar scroll horizontal/vertical simple

### Qué implica
- Mantener `SingleEliminationBracket`.
- Quitar el wrapper actual `SVGViewer`.
- Renderizar la llave en un contenedor scrollable clásico (sin zoom/pinch).
- Ajustar ancho/alto objetivo para mobile (más compacto que el actual).

### Pros
- Implementación más simple y predecible.
- Menos fricción gestual en celular (scroll nativo del navegador).
- Menor riesgo de conflictos entre gestos táctiles y eventos del SVG.
- Fácil de testear y ajustar rápido.

### Contras
- Se pierde zoom in/out fino.
- En llaves muy grandes igual habrá desplazamiento amplio (aunque más natural).
- Si el viewport inicial no cae en un punto útil, el usuario puede tardar en orientarse.

### Riesgo técnico
- **Bajo**.

---

## Opción 2 — Mantener `SVGViewer` y envolver con `react-zoom-pan-pinch`

### Qué implica
- Dejar el bracket como está conceptualmente.
- Agregar capa de interacción para pan/zoom custom.
- Definir límites de escala, doble tap, reset, foco inicial, etc.

### Pros
- Control granular de navegación.
- Permite conservar zoom para quien lo quiera usar.
- Puede mejorar descubribilidad con botón “centrar/fit”.

### Contras
- Mayor complejidad e interacción entre librerías (viewer + transform wrapper + eventos táctiles).
- Riesgo de gestos conflictivos o sensación "pegajosa" en algunos devices.
- Más tiempo de tuning y QA para que realmente quede suave.

### Riesgo técnico
- **Medio**.

---

## Opción 3 — Mantener `SVGViewer`, pero optimizar el viewport móvil (sin nueva librería)

### Qué implica
- No agregar `react-zoom-pan-pinch`.
- Ajustar ancho/alto y mínimos según breakpoint móvil.
- Posicionar el viewport inicial en una sección útil (por ejemplo semifinal/final o ronda activa).
- Reducir densidad visual de nodos en mobile (tipografía/espaciado/alto).

### Pros
- Menos compleja que la Opción 2.
- Conserva comportamiento base actual.
- Mejora percepción inicial sin tocar demasiado la arquitectura.

### Contras
- Sigue arrastrando límites del enfoque desktop-first.
- Puede mejorar bastante, pero no tanto como scroll nativo puro en ciertos teléfonos.

### Riesgo técnico
- **Bajo-Medio**.

---

## Comparativa directa para tu caso

Como vos mismo marcaste, **el zoom hoy da casi lo mismo**. Entonces el criterio principal pasa a ser:

1. fluidez de navegación táctil,
2. robustez cross-device,
3. tiempo de implementación.

Bajo ese criterio, la mejor relación costo/beneficio es:

## ✅ Recomendación principal: Opción 1 (scroll nativo, sin `SVGViewer`)

Porque:
- ataca de forma directa el dolor de mobile,
- evita complejidad de capas de gestures,
- permite iterar rápido con bajo riesgo,
- y no rompe la premisa de mantener la vista de brackets pública.

## Plan B recomendado: Opción 3

Si por alguna razón la Opción 1 pierde demasiada legibilidad visual, avanzar con Opción 3 (optimización del viewer actual) antes de saltar a Opción 2.

## Opción 2 (zoom-pan-pinch) solo si hay requisito explícito de zoom premium

Si en validación real aparece necesidad fuerte de zoom controlado, recién ahí conviene pagar esa complejidad.

---

## Validación práctica sugerida (rápida)

Para decidir con evidencia en poco tiempo:

1. Probar prototipo Opción 1 en 2–3 celulares reales (iOS + Android).
2. Medir tareas concretas:
   - tiempo para encontrar un partido específico,
   - cantidad de gestos para llegar a semifinal/final,
   - percepción subjetiva de “fluido” vs “trabado”.
3. Si Opción 1 mejora claramente, se adopta.
4. Si queda corta, pasar a Opción 3.
5. Opción 2 solo con justificación de producto (zoom realmente requerido).

---

## Decisión recomendada para avanzar

- **Primera implementación:** Opción 1.
- **Fallback técnico:** Opción 3.
- **Escalamiento de complejidad:** Opción 2 únicamente si la validación lo exige.

Esta secuencia maximiza impacto en mobile con mínima complejidad innecesaria.
