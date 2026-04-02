# UX/UI Audit – Tournament Management System

Date: 2026-04-02
Scope: Admin and public tournament workflows in the current frontend implementation.

## High impact (must fix)

1. **Unify navigation labels and IA between admin/public**
   - Current app mixes “Torneos”, “Eventos”, and “Gestión de torneos” across routes and page headers.
   - Recommendation: standardize to one domain term (e.g., “Eventos” as container + “Categorías” as children) and keep it consistent in nav, titles, buttons, and URLs.

2. **Replace technical flow-state labels with human-readable progress**
   - “Estado actual: draft / teams_ready / groups_ready / matches_ready” is internal language.
   - Recommendation: show user-facing copy with explicit next action (e.g., “Paso 1 de 4: Cargar equipos”).

3. **Prevent destructive actions without guardrails**
   - Tournament/category deletion buttons are visually low-emphasis (“x”, emoji buttons) and can trigger destructive actions quickly.
   - Recommendation: use explicit labels (“Eliminar categoría”), danger hierarchy, and modal confirmation with affected records summary.

4. **Improve save feedback persistence and location**
   - Success/error feedback exists, but it is often inline small text and can be missed after long forms.
   - Recommendation: sticky top inline alert/toast per section after key saves (teams, zones, schedules, results) with timestamp and undo guidance where possible.

5. **Eliminate dead-end interactions in admin category access**
   - Admin category chips in Home show alert if no fixture exists, but do not offer CTA to continue setup.
   - Recommendation: route directly to setup with clear status chip (“Sin fixture”) and primary CTA (“Configurar ahora”).

## Medium impact

1. **Make required/optional fields explicit in all forms**
   - Inputs rely on validation but don’t consistently label mandatory fields.
   - Recommendation: add visible “*” and helper text per field (“Obligatorio” / “Opcional”).

2. **Increase clarity of form labels and placeholders**
   - Generic placeholders like “Nombre” and “Seleccionar categoría...” appear in different contexts.
   - Recommendation: rename to context-rich labels (“Nombre del torneo”, “Categoría de la pareja”, “Fecha de inicio”).

3. **Surface current filter count and result count in tables**
   - Player/result tables have filters but no “N resultados” indicator.
   - Recommendation: add live counters and “Limpiar filtros” action near filter controls.

4. **Add sorting affordances in data tables**
   - Standings/players/ranking tables are static and don’t indicate sort behavior.
   - Recommendation: sortable headers with active sort icon and persisted sort state.

5. **Standardize action button language and casing**
   - Mixed patterns: “Guardar Zonas”, “Guardar Horarios”, “Guardar equipos”, “Asociar”, “x”.
   - Recommendation: apply consistent action verb + object format and sentence case.

6. **Improve tab persistence transparency**
   - Tabs persist via local storage, which is useful but implicit.
   - Recommendation: add subtle hint (“Se recuerda tu pestaña anterior”) where context switching is frequent.

## Nice to have

1. **Add status badges to category chips and cards**
   - Show badges such as “Sin equipos”, “Zonas listas”, “Fixture generado”, “Resultados incompletos”.

2. **Clarify ranking/positions status icon semantics**
   - Current status dots in Posiciones rely on color only.
   - Recommendation: add text label and tooltip, and avoid color-only meaning.

3. **Improve schedule grid readability for dense days**
   - Add sticky header row for courts + subtle row striping + compact mode for mobile.

4. **Provide empty-state CTAs for every major section**
   - Existing empty states are descriptive but not always actionable.
   - Recommendation: add direct CTA buttons (e.g., “Crear primer equipo”, “Asignar día a zonas”).

5. **Harmonize visual system tokens with utility classes**
   - Some screens use tm-* tokens; others use raw slate classes.
   - Recommendation: migrate repeated controls (buttons/inputs/chips/tabs) to shared variants for consistent spacing, contrast, and focus styles.
