# Bracket templates

Estas plantillas describen los cruces eliminatorios predefinidos para una cantidad y composición de zonas específicas.

## Convenciones

- `qualifiedCount`: cantidad de parejas/equipos que acceden a eliminación.
- `groupSizePattern`: tamaños esperados de zonas por letra (`A`, `B`, `C`, etc.).
- `matches[].round`: tamaño lógico de la ronda en el sistema actual:
  - `8` = octavos de final (`round_of_16`)
  - `4` = cuartos de final (`quarter`)
  - `2` = semifinal (`semi`)
  - `1` = final (`final`)
- `group_seed`: source de clasificado de zona, por ejemplo `1A`, `2D` o `3B`.
- `winner`: referencia al ganador de otro partido de la misma plantilla mediante `matchId`.

Las semifinales y la final se incluyen con encadenamiento estándar para que cada archivo represente un cuadro eliminatorio completo, aunque el cruce diferencial cargado por el usuario sea de octavos y/o cuartos.
