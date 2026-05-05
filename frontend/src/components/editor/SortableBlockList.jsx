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
    padding: '7px 14px',
    borderLeft: '2px solid transparent',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 300,
    userSelect: 'none',
    color: 'var(--ink-faint)',
    transition: 'background 0.15s, color 0.15s',
  },
  active: {
    background: 'rgba(196,121,90,0.12)',
    borderLeft: '2px solid var(--mv-accent)',
    paddingLeft: 12,
    color: 'rgba(250,248,245,0.9)',
  },
  handle: {
    cursor: 'grab',
    color: 'rgba(184,178,168,0.3)',
    fontSize: 13,
    lineHeight: 1,
    flexShrink: 0,
    touchAction: 'none',
  },
  type: { flex: 1, textTransform: 'capitalize', letterSpacing: '-0.01em' },
  pos: { color: 'rgba(184,178,168,0.4)', fontSize: 10, flexShrink: 0, fontWeight: 400 },
};
