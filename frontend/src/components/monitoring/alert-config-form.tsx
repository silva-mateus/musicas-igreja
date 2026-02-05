'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AlertConfiguration, AlertConfigurationInput, EventSeverity, ComparisonOperator } from '@/types'

interface AlertConfigFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    config?: AlertConfiguration
    onSave: (config: AlertConfigurationInput) => Promise<void>
}

export function AlertConfigForm({ open, onOpenChange, config, onSave }: AlertConfigFormProps) {
    const [formData, setFormData] = useState<AlertConfigurationInput>({
        config_key: config?.config_key || '',
        name: config?.name || '',
        description: config?.description || '',
        metric_type: config?.metric_type || 'disk_usage',
        threshold_value: config?.threshold_value || 80,
        threshold_unit: config?.threshold_unit || '%',
        comparison_operator: config?.comparison_operator || 'greater_than',
        severity: config?.severity || 'medium',
        is_enabled: config?.is_enabled ?? true,
    })
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            await onSave(formData)
            onOpenChange(false)
        } catch (error) {
            console.error('Error saving config:', error)
        } finally {
            setIsSaving(false)
        }
    }

    const metricTypes = [
        { value: 'disk_usage', label: 'Uso de Disco', units: ['%'] },
        { value: 'storage_size', label: 'Tamanho de Armazenamento', units: ['MB', 'GB'] },
        { value: 'failed_logins_24h', label: 'Logins Falhados (24h)', units: ['count'] },
        { value: 'uploads_24h', label: 'Uploads (24h)', units: ['count'] },
        { value: 'memory_usage', label: 'Uso de Memória', units: ['MB', 'GB'] },
    ]

    const comparisonOperators: { value: ComparisonOperator; label: string }[] = [
        { value: 'greater_than', label: 'Maior que (>)' },
        { value: 'greater_than_or_equal', label: 'Maior ou igual (>=)' },
        { value: 'less_than', label: 'Menor que (<)' },
        { value: 'less_than_or_equal', label: 'Menor ou igual (<=)' },
        { value: 'equals', label: 'Igual (=)' },
    ]

    const severities: { value: EventSeverity; label: string; color: string }[] = [
        { value: 'low', label: 'Baixo', color: 'text-blue-500' },
        { value: 'medium', label: 'Médio', color: 'text-yellow-500' },
        { value: 'high', label: 'Alto', color: 'text-orange-500' },
        { value: 'critical', label: 'Crítico', color: 'text-red-500' },
    ]

    const selectedMetric = metricTypes.find(m => m.value === formData.metric_type)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {config ? 'Editar Configuração de Alerta' : 'Nova Configuração de Alerta'}
                    </DialogTitle>
                    <DialogDescription>
                        Configure os limites e condições para gerar alertas automaticamente
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome do Alerta *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Disco Quase Cheio"
                            required
                        />
                    </div>

                    {!config && (
                        <div className="space-y-2">
                            <Label htmlFor="config_key">Chave de Configuração *</Label>
                            <Input
                                id="config_key"
                                value={formData.config_key}
                                onChange={(e) => setFormData({ ...formData, config_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                placeholder="Ex: disk_usage_custom"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Identificador único (apenas letras minúsculas, números e underscores)
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Descrição opcional do alerta"
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="metric_type">Tipo de Métrica *</Label>
                            <Select
                                value={formData.metric_type}
                                onValueChange={(value) => setFormData({ 
                                    ...formData, 
                                    metric_type: value,
                                    threshold_unit: metricTypes.find(m => m.value === value)?.units[0] || '%'
                                })}
                            >
                                <SelectTrigger id="metric_type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {metricTypes.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="severity">Severidade *</Label>
                            <Select
                                value={formData.severity}
                                onValueChange={(value: EventSeverity) => setFormData({ ...formData, severity: value })}
                            >
                                <SelectTrigger id="severity">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {severities.map((sev) => (
                                        <SelectItem key={sev.value} value={sev.value}>
                                            <span className={sev.color}>{sev.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="comparison">Condição *</Label>
                            <Select
                                value={formData.comparison_operator}
                                onValueChange={(value: ComparisonOperator) => setFormData({ ...formData, comparison_operator: value })}
                            >
                                <SelectTrigger id="comparison">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {comparisonOperators.map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                            {op.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="threshold">Limite *</Label>
                            <Input
                                id="threshold"
                                type="number"
                                step="0.01"
                                value={formData.threshold_value}
                                onChange={(e) => setFormData({ ...formData, threshold_value: parseFloat(e.target.value) })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="unit">Unidade *</Label>
                            <Select
                                value={formData.threshold_unit}
                                onValueChange={(value) => setFormData({ ...formData, threshold_unit: value })}
                            >
                                <SelectTrigger id="unit">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedMetric?.units.map((unit) => (
                                        <SelectItem key={unit} value={unit}>
                                            {unit}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="enabled"
                            checked={formData.is_enabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
                        />
                        <Label htmlFor="enabled" className="cursor-pointer">
                            Alerta ativo
                        </Label>
                    </div>

                    <div className="bg-muted p-3 rounded-md text-sm">
                        <strong>Prévia:</strong> Alerta será disparado quando{' '}
                        <span className="font-mono">{selectedMetric?.label}</span>{' '}
                        {comparisonOperators.find(o => o.value === formData.comparison_operator)?.label.toLowerCase()}{' '}
                        <span className="font-mono">{formData.threshold_value} {formData.threshold_unit}</span>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
