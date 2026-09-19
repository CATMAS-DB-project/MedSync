import { Icon } from '../ui/Icon';
import { getInitials, formatFullName } from '../../utils/formatters';
import type { CurrentUser, Branch } from '../../types';

export interface TopbarProps {
  currentUser: CurrentUser;
  branches: Branch[];
  onMenuClick?: () => void;
}

export function Topbar({ currentUser, branches, onMenuClick }: TopbarProps) {
  return (
    <header className="flex justify-between items-center h-14 px-container-padding w-full bg-surface border-b border-outline-variant fixed top-0 z-50 md:left-sidebar-width md:w-[calc(100%-240px)]">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden text-primary cursor-pointer active:opacity-80"
          aria-label="Open menu"
        >
          <Icon name="menu" />
        </button>
        <div className="flex items-center gap-2">
          <Icon name="clinical_notes" className="text-primary" />
          <h1 className="text-headline-sm text-primary">CATMS</h1>
        </div>
        <div className="hidden sm:flex items-center ml-4 border-l border-outline-variant pl-4">
          <select
            className="bg-transparent border-none text-body-md text-on-surface focus:ring-0 cursor-pointer py-1 pr-8"
            defaultValue="all"
          >
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.branchId} value={branch.branchId}>
                {branch.branchName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center bg-surface-container-low rounded px-3 h-8 w-64">
          <Icon name="search" className="text-outline text-[18px]" />
          <input
            type="text"
            placeholder="Search... (Ctrl+K)"
            className="bg-transparent border-none outline-none text-body-sm text-on-surface placeholder:text-outline flex-1 pl-2"
          />
        </div>
        <button
          type="button"
          className="md:hidden text-on-surface-variant p-2 rounded-full hover:bg-surface-container-low"
          aria-label="Search"
        >
          <Icon name="search" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-bold cursor-pointer">
          {getInitials(formatFullName(currentUser.firstName, currentUser.lastName))}
        </div>
      </div>
    </header>
  );
}
