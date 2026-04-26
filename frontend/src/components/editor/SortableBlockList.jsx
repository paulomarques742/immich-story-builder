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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div
        style={{
          ...s.item,
          ...(selected === block.id ? s.active : {}),
        }}
        onClick={() => onSelect(block.id)}
      >
        <span {...attributes} {...listeners} style={s.handle} title="Arrastar">
          ⠿
        </span>
        <span style={s.type}>{block.type}</span>
        <span style={s.pos}>{idx + 1}</span>
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
          <SortableItem
            key={b.id}
            block={b}
            idx={idx}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

const s = {
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 13,
    userSelect: 'none',
    color: 'var(--text-muted)',
    transition: 'background 0.1s, color 0.1s',
  },
  active: {
    background: '#f3f4f6',
    color: 'var(--text)',
    fontWeight: 600,
  },
  handle: {
    cursor: 'grab',
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 1,
    flexShrink: 0,
    touchAction: 'none',
  },
  type: { flex: 1, textTransform: 'capitalize', letterSpacing: '-0.01em' },
  pos: { color: 'var(--text-faint)', fontSize: 10, flexShrink: 0, fontWeight: 600 },
};
