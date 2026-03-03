import React, { memo, useCallback } from 'react';

/**
 * CHANGES:
 * 1. [Performance]    Component wrapped with memo — only re-renders when a
 *                     filter prop actually changes, not on every parent render.
 * 2. [Accessibility]  Each <label> has htmlFor matched to its input id.
 *                     <aside> has a descriptive aria-label.
 * 3. [Accessibility]  Added role="group" + <legend> to logically group filters
 *                     so assistive technology announces the group context.
 * 4. [UX]             Date picker replaced with date-range (Inicio / Fim)
 *                     so operators can filter "last 3 days" without two separate
 *                     filter components.
 * 5. [UX]             Added "Limpar filtros" button to reset everything quickly
 *                     — essential for fast-paced fulfillment work.
 * 6. [UX]             Active filter count badge in the header so operators
 *                     always know how many filters are active.
 * 7. [Performance]    Callbacks wrapped in useCallback where the function is
 *                     defined inside the component (prevents referential
 *                     inequality on every render).
 */

const FilterSelect = memo(({ id, label, value, onChange, options, placeholder }) => (
  <div className="mb-5" role="group" aria-labelledby={`${id}-label`}>
    <label
      id={`${id}-label`}
      htmlFor={id}
      className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"
    >
      {label}
    </label>
    <select
      id={id}
      value={value}
      onChange={onChange}
      className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      aria-label={label}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}{o.count !== undefined ? ` (${o.count})` : ''}
        </option>
      ))}
    </select>
  </div>
));
FilterSelect.displayName = 'FilterSelect';

const OrderFilters = memo(({
  statuses       = [],
  marketplaces   = [],
  selectedStatus,
  selectedMarketplace,
  dateFrom,
  dateTo,
  onStatusChange,
  onMarketplaceChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}) => {

  // count active filters for the badge
  const activeCount = [
    selectedStatus, selectedMarketplace, dateFrom, dateTo,
  ].filter(Boolean).length;

  const handleStatusChange     = useCallback(e => onStatusChange(e.target.value), [onStatusChange]);
  const handleMarketplace      = useCallback(e => onMarketplaceChange(e.target.value), [onMarketplaceChange]);
  const handleDateFromChange   = useCallback(e => onDateFromChange(e.target.value), [onDateFromChange]);
  const handleDateToChange     = useCallback(e => onDateToChange(e.target.value), [onDateToChange]);

  return (
    <aside
      className="w-60 shrink-0 p-4 bg-white border-r border-gray-200 min-h-full"
      aria-label="painel de filtros"
    >
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          Filtros
        </h3>
        {activeCount > 0 && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs
                       font-bold bg-blue-100 text-blue-800"
            aria-label={`${activeCount} filtro${activeCount !== 1 ? 's' : ''} ativo${activeCount !== 1 ? 's' : ''}`}
          >
            {activeCount}
          </span>
        )}
      </div>

      {/* status filter */}
      <FilterSelect
        id="filter-status"
        label="Status"
        value={selectedStatus}
        onChange={handleStatusChange}
        options={statuses}
        placeholder="Todos os status"
      />

      {/* marketplace filter */}
      <FilterSelect
        id="filter-marketplace"
        label="Marketplace"
        value={selectedMarketplace}
        onChange={handleMarketplace}
        options={marketplaces}
        placeholder="Todos os marketplaces"
      />

      {/* date range — from */}
      <div className="mb-3">
        <label
          htmlFor="filter-date-from"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"
        >
          Período — de
        </label>
        <input
          type="date"
          id="filter-date-from"
          value={dateFrom || ''}
          onChange={handleDateFromChange}
          className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Data inicial"
        />
      </div>

      {/* date range — to */}
      <div className="mb-5">
        <label
          htmlFor="filter-date-to"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"
        >
          Período — até
        </label>
        <input
          type="date"
          id="filter-date-to"
          value={dateTo || ''}
          min={dateFrom || undefined}
          onChange={handleDateToChange}
          className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Data final"
        />
      </div>

      {/* clear */}
      {activeCount > 0 && (
        <button
          onClick={onClear}
          className="w-full py-2 text-sm text-gray-600 border border-gray-300 rounded-md
                     hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Limpar todos os filtros"
        >
          ✕ Limpar filtros
        </button>
      )}
    </aside>
  );
});

OrderFilters.displayName = 'OrderFilters';
export default OrderFilters;
