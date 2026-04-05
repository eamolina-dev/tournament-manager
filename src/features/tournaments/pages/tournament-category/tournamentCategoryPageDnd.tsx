import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  DroppableZoneProps,
  SortableTeamCardProps,
} from "./tournamentCategoryPage.types";

export const SortableTeamCard = ({ team }: SortableTeamCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm active:cursor-grabbing ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      {team.name}
    </div>
  );
};

export const DroppableZone = ({ zoneId, className, children }: DroppableZoneProps) => {
  const { setNodeRef } = useDroppable({ id: zoneId });
  return (
    <div ref={setNodeRef} id={zoneId} className={className}>
      {children}
    </div>
  );
};
