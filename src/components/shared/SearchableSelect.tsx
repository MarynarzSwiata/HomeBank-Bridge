import React, { useState, useRef, useEffect, useMemo } from 'react';

interface SearchableSelectProps {
  label?: string;
  options: { id: any; name: string; icon?: string }[];
  value: string;
  onChange: (id: string) => void;
  onAddNew?: (name: string) => void;
  placeholder: string;
  className?: string;
  showAllOption?: boolean;
  allLabel?: string;
  searchable?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options,
  value,
  onChange,
  onAddNew,
  placeholder,
  className = "",
  showAllOption = false,
  allLabel = "All Items",
  searchable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    return options.filter((o) =>
      (o.name || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const selectedItem = useMemo(() => {
    if (showAllOption && value === "")
      return { name: allLabel, icon: undefined };
    return options.find((o) => String(o.id) === value);
  }, [options, value, showAllOption, allLabel]);

  const showAddButton =
    search &&
    searchable &&
    !options.find(
      (o) => (o.name || "").toLowerCase() === search.toLowerCase()
    ) &&
    onAddNew;

  return (
    <div
      className={`relative group ${isOpen ? "z-[2100]" : "z-10"} ${className}`}
      ref={dropdownRef}
    >
      {label && (
        <div className="flex justify-between items-center mb-1.5 px-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {label}
          </label>
        </div>
      )}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 text-sm font-bold cursor-pointer flex justify-between items-center group-hover:border-indigo-500/50 transition-all h-[60px]`}
      >
        <div className="flex items-center gap-3">
          {selectedItem?.icon && (
            <svg
              className="w-4 h-4 text-indigo-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d={selectedItem.icon}
              />
            </svg>
          )}
          <span
            className={
              (selectedItem && selectedItem.name !== allLabel) || (!selectedItem && value)
                ? "text-slate-200"
                : "text-slate-600 uppercase text-[10px] tracking-widest font-black"
            }
          >
            {selectedItem?.name || value || placeholder}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-600 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-[2000] top-full mt-2 w-full bg-slate-900 opacity-100 border border-slate-700 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-200 min-w-[200px] backdrop-blur-none ring-1 ring-slate-800">
          {searchable && (
            <div className="relative mb-2">
              <input
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 pr-10 text-white"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg
                className="absolute right-3 top-3.5 w-4 h-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto no-scrollbar space-y-1">
            {showAllOption && !search && (
              <div
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                  setSearch("");
                }}
                className="px-4 py-3 rounded-xl hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-indigo-400 cursor-pointer transition-colors"
              >
                {allLabel}
              </div>
            )}
            {filtered.map((o) => (
              <div
                key={o.id}
                onClick={() => {
                  onChange(String(o.id));
                  setIsOpen(false);
                  setSearch("");
                }}
                className="px-4 py-3 rounded-xl hover:bg-indigo-600 text-sm font-bold cursor-pointer transition-colors text-white flex items-center gap-3"
              >
                {o.icon && (
                  <svg
                    className="w-4 h-4 text-indigo-400 group-hover:text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d={o.icon}
                    />
                  </svg>
                )}
                {o.name}
              </div>
            ))}
            {showAddButton && (
              <div
                onClick={() => {
                  onAddNew!(search);
                  setIsOpen(false);
                  setSearch("");
                }}
                className="px-4 py-3 rounded-xl bg-indigo-600/20 text-indigo-400 text-sm font-black cursor-pointer hover:bg-indigo-600 hover:text-white transition-all border border-indigo-500/30"
              >
                + Add "{search}"
              </div>
            )}
            {filtered.length === 0 && !showAddButton && !showAllOption && (
              <div className="px-4 py-3 text-slate-600 text-xs font-bold italic">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
