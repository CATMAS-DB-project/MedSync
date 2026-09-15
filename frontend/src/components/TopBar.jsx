export default function TopBar() {
  return (
    <header className="flex justify-between items-center h-14 px-6 w-full bg-surface border-b border-outline-variant fixed top-0 z-50 left-0 md:left-sidebar-width md:w-[calc(100%-240px)]">
      <div className="flex items-center gap-4">
        <span className="material-symbols-outlined text-primary cursor-pointer active:opacity-80 md:hidden">
          menu
        </span>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">clinical_notes</span>
          <h1 className="text-headline-sm font-bold text-primary">CATMS</h1>
        </div>

        <div className="hidden sm:flex items-center ml-4 border-l border-outline-variant pl-4">
          <select className="bg-transparent border-none text-body-md text-on-surface focus:ring-0 cursor-pointer py-1 pr-8">
            <option>All Branches</option>
            <option>Central Branch</option>
            <option>North Clinic</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center bg-surface-container-low rounded px-3 py-1.5 border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
          <span className="material-symbols-outlined text-on-surface-variant text-sm mr-2">
            search
          </span>
          <input
            className="bg-transparent border-none focus:ring-0 outline-none text-body-sm w-48 p-0"
            placeholder="Search patients, staff..."
            type="text"
          />
          <span className="text-[10px] text-outline ml-2 border border-outline rounded px-1">
            Ctrl+K
          </span>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-container-low transition-colors rounded p-1 md:hidden">
          search
        </span>
      </div>
    </header>
  );
}
