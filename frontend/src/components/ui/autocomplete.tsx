'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'

interface AutocompleteProps {
    options: string[]
    value: string
    onChange: (value: string) => void
    onCreateNew?: (value: string) => void
    placeholder?: string
    createLabel?: string
    className?: string
    disabled?: boolean
}

export function Autocomplete({
    options,
    value,
    onChange,
    onCreateNew,
    placeholder = "Selecionar...",
    createLabel = "Criar novo",
    className,
    disabled = false,
}: AutocompleteProps) {
    const [open, setOpen] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState(value)

    React.useEffect(() => {
        setSearchValue(value)
    }, [value])

    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(searchValue.toLowerCase())
    )

    const handleSelect = (selectedValue: string) => {
        onChange(selectedValue)
        setSearchValue(selectedValue)
        setOpen(false)
    }

    const handleCreateNew = () => {
        if (searchValue.trim() && onCreateNew) {
            onCreateNew(searchValue.trim())
            onChange(searchValue.trim())
            setOpen(false)
        }
    }

    const handleInputChange = (newValue: string) => {
        setSearchValue(newValue)
        onChange(newValue)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between text-left font-normal",
                        !value && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                >
                    <Input
                        value={searchValue}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder={placeholder}
                        className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                        onClick={(e) => {
                            e.stopPropagation()
                            setOpen(true)
                        }}
                        onFocus={() => setOpen(true)}
                    />
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Buscar..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {onCreateNew && searchValue.trim() ? (
                                <div className="flex items-center justify-center p-2">
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start"
                                        onClick={handleCreateNew}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        {createLabel}: &quot;{searchValue.trim()}&quot;
                                    </Button>
                                </div>
                            ) : (
                                "Nenhuma opção encontrada."
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {filteredOptions.map((option) => (
                                <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={() => handleSelect(option)}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option}
                                </CommandItem>
                            ))}
                            {onCreateNew && searchValue.trim() && !filteredOptions.includes(searchValue.trim()) && (
                                <CommandItem
                                    value={searchValue}
                                    onSelect={handleCreateNew}
                                    className="text-primary"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {createLabel}: &quot;{searchValue.trim()}&quot;
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
