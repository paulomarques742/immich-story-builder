import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ block, idx, selected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <div
        className={`sidebar-item ${selected === block.id ? 'sidebar-item-active' : ''}`}
        onClick={() => onSelect(block.id)}
      >
        <span className="flex items-center gap-2">
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab text-ink-faint/30 text-base leading-none shrink-0 touch-none"
            title="Arrastar"
          >⠿</span>
          <span className="capitalize tracking-tight">{block.type}</span>
        </span>
        <span className={`text-2xs tabular-nums ${selected === block.id ? 'text-accent-soft' : 'text-ink-faint/35'}`}>
          {idx + 1}
        </span>
      </div>
    </div>
  );
}

export default function SortableBlockList({ blocks, selected, onSelect, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    onReorder(arrayMove(blocks, oldIdx, newIdx));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {blocks.map((b, idx) => (
          <SortableItem key={b.id} block={b} idx={idx} selected={selected} onSelect={onSelect} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
