import React, { memo } from 'react';

/**
 * CHANGES:
 * 1. [Performance]    StatusIcon wrapped with memo — prevents re-render when
 *                     active/label props haven't changed (critical in 200-row tables).
 * 2. [Accessibility]  Added role="img", aria-label on each icon so screen readers
 *                     announce "Etiqueta: concluído" / "Etiqueta: pendente".
 * 3. [UX]             Active stage now shows a checkmark (✓) inside the circle
 *                     instead of a plain colored dot — instantly readable at a glance.
 * 4. [UX]             Added title tooltip on each icon for mouse users.
 * 5. [UX]             Connector line between stages visualises the pipeline sequence.
 * 6. [Accessibility]  Color is NOT the only differentiator — shape (✓ vs –) added
 *                     for color-blind operators.
 */

const STAGES = [
  { key: 'etiquetaDisponivel', label: 'Etiqueta'  },
  { key: 'etiquetaImportada',  label: 'ERP'        },
  { key: 'picking',            label: 'Picking'    },
  { key: 'packing',            label: 'Packing'    },
  { key: 'transportadora',     label: 'Entregue'   },
];

// memoized so the icon only re-renders when its own active/label prop changes
const StatusIcon = memo(({ active, label }) => (
  <div
    className="flex flex-col items-center"
    role="img"
    aria-label={`${label}: ${active ? 'concluído' : 'pendente'}`}
    title={`${label}: ${active ? 'concluído' : 'pendente'}`}
  >
    <span
      className={`
        w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold
        transition-colors duration-150
        ${
          active
            ? 'bg-green-500 border-green-600 text-white'
            : 'bg-gray-100 border-gray-300 text-gray-400'
        }
      `}
    >
      {active ? '✓' : '–'}
    </span>
    <span className={`mt-1 text-[10px] leading-none ${
      active ? 'text-green-700 font-semibold' : 'text-gray-400'
    }`}>
      {label}
    </span>
  </div>
));
StatusIcon.displayName = 'StatusIcon';

// memoized — only re-renders when the status object reference changes
const OrderStatusBadge = memo(({ status }) => (
  <div
    className="flex items-start space-x-1"
    role="list"
    aria-label="estágios do fulfillment"
  >
    {STAGES.map(({ key, label }, idx) => (
      <React.Fragment key={key}>
        <div role="listitem">
          <StatusIcon active={!!status[key]} label={label} />
        </div>
        {/* connector line between stages, not after the last one */}
        {idx < STAGES.length - 1 && (
          <div
            aria-hidden="true"
            className={`self-start mt-2.5 h-0.5 w-4 flex-shrink-0 ${
              status[STAGES[idx + 1]?.key]
                ? 'bg-green-400'
                : 'bg-gray-200'
            }`}
          />
        )}
      </React.Fragment>
    ))}
  </div>
));
OrderStatusBadge.displayName = 'OrderStatusBadge';

export default OrderStatusBadge;
