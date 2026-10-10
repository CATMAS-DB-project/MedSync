import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  onClear?: () => void;
  containerClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onClear, className, containerClassName, id, placeholder = 'Search', ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hasValue = typeof value === 'string' && value.length > 0;

  return (
    <div className={cn('flex flex-col', containerClassName)}>
      <div
        className={cn(
          'relative flex h-10 items-center rounded-xl bg-surface-container-lowest',
          'border border-outline-variant',
          'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          'transition-shadow duration-150',
        )}
      >
        <Icon name="search" size={18} className="ml-3 shrink-0 text-on-surface-variant" />
        <input
          id={inputId}
          ref={ref}
          type="search"
          value={value}
          placeholder={placeholder}
          className={cn(
            'h-full w-full flex-1 bg-transparent pl-2 pr-10 text-body-sm text-on-surface',
            'placeholder:text-on-surface-variant/60',
            'border-0 focus:border-0 focus:ring-0',
            '[&::-webkit-search-cancel-button]:hidden',
            className,
          )}
          {...rest}
        />
        {hasValue && onClear && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <IconButton
              icon="close"
              size="sm"
              aria-label="Clear search"
              onClick={onClear}
            />
          </span>
        )}
      </div>
    </div>
  );
});