import React, { useMemo } from 'react';
import type { Category, CategoryGroup } from '../types';
import type { MVSelectOption } from './MVSelect';
import { MVSearchableSelect } from './MVSearchableSelect';
import '../mvSearchableSelect.css';

export const CATEGORY_SEARCH_THRESHOLD = 12;

interface LeadingOption {
  value: string;
  label: string;
}

export interface CategorySelectProps {
  id: string;
  value: string;
  categories: Category[];
  categoryGroups: CategoryGroup[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  leadingOption?: LeadingOption;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  searchableThreshold?: number;
}

export const CategorySelect: React.FC<CategorySelectProps> = ({
  id,
  value,
  categories,
  categoryGroups,
  onValueChange,
  ariaLabel,
  placeholder = 'Choose category',
  leadingOption,
  required = false,
  disabled = false,
  invalid = false,
  className = '',
  searchableThreshold = CATEGORY_SEARCH_THRESHOLD,
}) => {
  const groupNames = useMemo(
    () => new Map(categoryGroups.map((group) => [group.id, group.name])),
    [categoryGroups]
  );

  const searchableOptions = useMemo<MVSelectOption[]>(() => {
    const categoryOptions = categories.map((category) => {
      const groupName = groupNames.get(category.groupId) || 'Category';
      return {
        value: category.id,
        label: category.name,
        textValue: `${category.name} ${groupName}`,
        secondary: groupName,
      } satisfies MVSelectOption;
    });

    return leadingOption
      ? [{ value: leadingOption.value, label: leadingOption.label, textValue: leadingOption.label }, ...categoryOptions]
      : categoryOptions;
  }, [categories, groupNames, leadingOption]);

  const useSearchableList = categories.length >= searchableThreshold;

  if (useSearchableList) {
    return (
      <MVSearchableSelect
        id={id}
        value={value}
        options={searchableOptions}
        onValueChange={onValueChange}
        placeholder={placeholder}
        searchPlaceholder="Search categories"
        noMatchesMessage="No matching categories"
        ariaLabel={ariaLabel}
        required={required}
        disabled={disabled}
        invalid={invalid}
        className={className}
        showSelectedSecondary
      />
    );
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      className={className}
      aria-label={ariaLabel}
      required={required}
      disabled={disabled}
      aria-invalid={invalid || undefined}
    >
      {leadingOption ? (
        <option value={leadingOption.value}>{leadingOption.label}</option>
      ) : (
        <option value="">{placeholder}</option>
      )}
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
};
