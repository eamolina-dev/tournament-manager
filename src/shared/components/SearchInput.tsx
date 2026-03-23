import type { ChangeEvent } from "react"

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const SearchInput = ({
  value,
  onChange,
  placeholder = "Buscar jugadores...",
}: SearchInputProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
  }

  return (
    <input
      type="search"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
    />
  )
}
