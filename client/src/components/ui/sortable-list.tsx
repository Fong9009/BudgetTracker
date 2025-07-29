import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableListItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function SortableListItem({ id, children, className = '' }: SortableListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    position: isDragging ? 'relative' as const : 'static' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ${className}`}
      data-draggable="true"
    >
      {children}
      {/* Drag handle - positioned relative to the list item content */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-50 p-2 rounded-md bg-background/95 hover:bg-background drag-handle-mobile border border-border shadow-md"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

interface SortableListProps<T> {
  items: T[];
  onReorder: (newOrder: T[]) => void;
  children: (item: T) => React.ReactNode;
  className?: string;
  getId: (item: T) => string;
}

export function SortableList<T>({ items, onReorder, children, className = '', getId }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Reduced from 250ms for faster response
        tolerance: 8, // Increased tolerance for better touch handling
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Reduced from 8px for more responsive dragging
        tolerance: 8, // Increased tolerance for better touch handling
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(item => getId(item) === active.id);
      const newIndex = items.findIndex(item => getId(item) === over?.id);

      const newOrder = arrayMove(items, oldIndex, newIndex);
      onReorder(newOrder);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(item => getId(item))} strategy={verticalListSortingStrategy}>
        <div className={`space-y-2 ${className}`}>
          {items.map((item) => (
            <SortableListItem key={getId(item)} id={getId(item)}>
              {children(item)}
            </SortableListItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
} 