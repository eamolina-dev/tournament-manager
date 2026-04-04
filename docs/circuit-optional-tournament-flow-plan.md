# Adaptación del flujo de torneos con `circuit_id` opcional

## 1) Análisis de impacto

### Creación (wizard)
- Antes, la creación exigía `circuit_id` en frontend (`createTournament` + `EventCreatePage`).
- Con `circuit_id` opcional, el wizard debe permitir:
  - Torneo competitivo: guardar `circuit_id`.
  - Torneo independiente: guardar `circuit_id = null`.
- El resto del wizard (jugadores/parejas, zonas, partidos, horarios) puede mantenerse sin bifurcar el flujo porque depende de `tournament_category_id`.

### Edición
- El formulario de edición debe reflejar el estado actual:
  - Si el torneo tiene circuito, abrir como competitivo.
  - Si no tiene circuito, abrir como independiente.
- Debe permitir cambiar entre ambos tipos sin romper torneos existentes.

### Generación de partidos
- No requiere cambios estructurales: la generación ya trabaja por categoría (`tournament_category_id`) y no por circuito.

### Rankings
- Para torneos sin circuito no deben aplicarse reglas de ranking por circuito.
- La lógica de recálculo ya contempla este caso: si no hay `circuit_id`, usa reglas vacías.

## 2) Supuestos actuales que requerían circuito

1. `createTournament` lanzaba error si faltaba `circuit_id`.
2. `updateTournament` lanzaba error si el torneo quedaba sin `circuit_id`.
3. Validación de superposición por fechas se aplicaba siempre, en lugar de aplicar sólo dentro de un circuito.
4. El formulario de creación siempre intentaba usar `VITE_CIRCUIT_ID`.

## 3) Decisión UX

Se recomienda **selector explícito de tipo** al inicio del formulario:
- "Competitivo (con circuito)"
- "Independiente (sin circuito)"

Motivo:
- Hace visible la decisión de producto.
- Evita inferencias implícitas difíciles de entender.
- Permite mantener el resto del wizard intacto.

## 4) Riesgos UX y mitigación

- **Confusión por falta de circuito configurado** en modo competitivo:
  - Mitigar con mensaje claro y deshabilitar guardado competitivo sin circuito.
- **Flujo más largo**:
  - Mitigar agregando sólo un selector simple, sin nuevos pasos.
- **Estados inconsistentes**:
  - Mitigar inicializando tipo según `tournament.circuit_id` en edición.

## 5) Plan por etapas

### Etapa 1 (mínima)
- Permitir `circuit_id = null` en creación/edición.
- Limitar validación de solapamiento de fechas sólo cuando hay circuito.
- Mantener estructura del wizard.

### Etapa 2 (UX)
- Agregar selector de tipo de torneo en el formulario.
- Mensajería contextual para casos competitivos sin circuito configurado.
- Evitar pasos extra para torneos independientes.
