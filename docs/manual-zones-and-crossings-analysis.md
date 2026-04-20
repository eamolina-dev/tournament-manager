# Análisis: zonas manuales y cruces configurables

## 1) Caso reportado: 16 parejas, 1 zona de 4 + resto de 3, con 3 parejas “Sin zona”

### Hallazgo
El comportamiento observado es consistente con una limitación funcional del paso de armado de zonas:

- La generación automática de zonas en UI limita la cantidad de zonas a `2..4`.
- Para 16 parejas, esa lógica arma **4 zonas** (típicamente de 4 equipos), porque usa `Math.min(4, Math.ceil(teams/4))`.
- El caso requerido por el cliente (16 = 4 + 3 + 3 + 3 + 3) necesita **5 zonas**.
- Como en el tablero de drag-and-drop no existe acción para “agregar zona”, el usuario no puede crear la quinta columna y, al redistribuir, sobran 3 parejas en la columna virtual “Sin zona”.

Además, al guardar zonas hoy solo se valida que no haya duplicados, pero **no** que todos los equipos queden asignados a alguna zona.

### Conclusión de causa raíz
No es un error visual del drag-and-drop en sí, sino una combinación de:

1. Tope de 4 zonas en autogeneración.
2. Falta de UX para crear/eliminar zonas manuales.
3. Falta de validación “cobertura total” al guardar.

## 2) Requerimiento: editar posición/letra de zonas (incluyendo dónde van las zonas de 4)

### Problema actual
Al guardar, el sistema reordena automáticamente las zonas:

- Prioriza zonas de 4 equipos al inicio.
- Luego renombra secuencialmente `Zona A`, `Zona B`, ...

Esto impide que el cliente elija explícitamente en qué letra ubicar cada zona de 4.

### Propuesta simple
Adoptar “orden explícito del usuario” con mínima invasión:

1. **No reordenar ni renombrar automáticamente** en `handleSaveZones`.
2. Mantener un campo editable de etiqueta/letra por zona (ya existe `name` editable).
3. Al persistir, derivar `group_key` de ese orden manual:
   - opción simple: primera zona visual => `A`, segunda => `B`, etc. (sin re-sorting), o
   - opción preferible: extraer letra ingresada (`Zona C` => `C`) y validarla única.
4. Mostrar validaciones claras:
   - letras repetidas,
   - letras inválidas,
   - faltan equipos asignados.

Con este cambio, si el cliente quiere que la zona de 4 sea “Zona C”, puede ubicarla y nombrarla así antes de guardar.

## 3) Requerimiento: cruces manuales (fase eliminatoria inicial y siguiente)

### Problema actual
Los cruces se generan por plantilla/seeding automático. Existe incluso un override hardcodeado por `tournamentCategoryId`, lo cual no escala para operación diaria.

### Propuesta simple (MVP)
Agregar una capa de configuración manual **previa a generar partidos**:

1. Nuevo paso en setup: **“Cruces manuales”** (opcional).
2. Inputs por partido de fase eliminatoria inicial (y segunda ronda si aplica):
   - `team1_source` (ej: `1A`, `2C`, `W-1-1`)
   - `team2_source` (ej: `3B`, `W-2-1`)
3. Botón “Autocompletar sugerencia” que precargue la plantilla actual, para luego editar.
4. Validaciones mínimas antes de guardar/generar:
   - formato de tokens válido,
   - no repetir un mismo source dentro de la misma ronda,
   - para round 2, que los `W-x-y` apunten a partidos existentes.
5. Persistencia en tabla/config JSON por `tournament_category_id`.
6. En generación, usar:
   - configuración manual si existe,
   - fallback a plantilla automática si no existe.

### Ventajas
- Evita hardcodes por categoría.
- Da control total al cliente sin rediseñar el motor de bracket.
- Mantiene compatibilidad retroactiva (si no hay config manual, todo sigue como hoy).

## 4) Implementación incremental sugerida (sin romper flujo actual)

1. **Bloqueante del bug reportado**
   - Permitir agregar/remover zonas en UI.
   - Exigir asignación completa de equipos al guardar.
2. **Control de posiciones de zonas**
   - Eliminar sorting forzado por tamaño/puntos en guardado.
   - Persistir orden/etiqueta manual.
3. **Cruces manuales MVP**
   - Nuevo draft editable + validación + persistencia.
   - Integración en `generateEliminationMatches` como source prioritario.

Con esto se resuelven ambos pedidos con cambios acotados y bajo riesgo.
