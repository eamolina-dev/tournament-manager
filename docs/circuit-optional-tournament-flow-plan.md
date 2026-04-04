# Simplificación del flujo de creación de torneos (circuito implícito)

## 1) Análisis

### Complejidad introducida recientemente
- Se agregó un selector explícito de tipo de torneo ("competitivo" vs "independiente") en el wizard.
- Esa decisión apareció demasiado temprano en el flujo, aumentando fricción en una tarea operativa que antes era directa.
- También se sumaron mensajes de estado extra vinculados a configuración de circuito, visibles en UI.

### Dependencias nuevas de selección explícita
- El formulario de creación/edición pasó a persistir `circuit_id` en base a la selección manual.
- La validación y el estado del submit quedaron condicionados por esa selección.

### Estrategia de simplificación
- Volver al flujo original del wizard (sin selector de tipo).
- Resolver el circuito en segundo plano al crear el torneo.
- Mantener el modelo preparado para `circuit_id` opcional, pero sin exponer esa decisión en UI por ahora.

## 2) Decisión implementada

### Flujo de creación
- Se eliminó el selector de tipo de torneo y cualquier paso/estado asociado.
- El wizard mantiene su secuencia habitual (nombre/fechas + categorías, luego setup por categoría).

### Asignación implícita de circuito activo
- Al crear torneo, el sistema obtiene `client_id` actual desde configuración (`VITE_CLIENT_ID`).
- Con ese cliente, resuelve el circuito activo de forma simple:
  1. prioriza circuito del año actual,
  2. si no existe, usa el más reciente por año/creación.
- El usuario no interactúa con estos datos en UI.

### Compatibilidad
- Se conserva soporte de datos para `circuit_id` opcional (no se elimina del modelo).
- No se rompen torneos existentes: edición mantiene comportamiento previo sin exigir nuevos pasos en interfaz.
