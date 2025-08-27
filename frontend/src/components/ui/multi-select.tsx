'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

interface MultiSelectProps {
    options: string[]
    value: string[]
    onChange: (value: string[]) => void
    onCreateNew?: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    maxSelected?: number
    createLabel?: string
}

export function MultiSelect({
    options,
    value,
    onChange,
    onCreateNew,
    placeholder = "Selecionar...",
    className,
    disabled = false,
    maxSelected,
    createLabel = "Criar novo",
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState('')

    const handleUnselect = (option: string) => {
        onChange(value.filter((v) => v !== option))
    }

    const handleSelect = (option: string) => {
        if (value.includes(option)) {
            handleUnselect(option)
        } else {
            if (maxSelected && value.length >= maxSelected) {
                return
            }
            onChange([...value, option])
        }
    }

    const handleCreateNew = () => {
        if (searchValue.trim() && onCreateNew && !options.includes(searchValue.trim()) && !value.includes(searchValue.trim())) {
            const newValue = searchValue.trim()
            onCreateNew(newValue)
            onChange([...value, newValue])
            setSearchValue('')
        }
    }

    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(searchValue.toLowerCase()) &&
        !value.includes(option)
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between text-left font-normal",
                        !value.length && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                >
                    <div className="flex gap-1 flex-wrap">
                        {value.length === 0 && placeholder}
                        {value.map((item) => (
                            <Badge
                                variant="secondary"
                                key={item}
                                className="mr-1 mb-1 cursor-pointer hover:bg-secondary/80 pr-1"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleUnselect(item)
                                }}
                            >
                                {item}
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground ml-1" />
                            </Badge>
                        ))}
                    </div>
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
                                        {createLabel}: "{searchValue.trim()}"
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
                                            value.includes(option) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option}
                                </CommandItem>
                            ))}
                            {onCreateNew && searchValue.trim() && !options.includes(searchValue.trim()) && !value.includes(searchValue.trim()) && (
                                <CommandItem
                                    value={searchValue}
                                    onSelect={handleCreateNew}
                                    className="text-primary"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {createLabel}: "{searchValue.trim()}"
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
