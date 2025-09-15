'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Brain, Wind, Snowflake, Droplets, Flame, Tornado, Mountain, Globe, Check } from 'lucide-react'
import { toast } from 'sonner'

const aiModels = [
  {
    id: 'apollo',
    name: 'APOLLO',
    icon: Brain,
    iconColor: 'text-amber-500',
    description: 'Master Coordinator - Final diagnostic authority & system-wide decisions'
  },
  {
    id: 'aquilo',
    name: 'AQUILO', 
    icon: Wind,
    iconColor: 'text-sky-500',
    description: 'Electrical Systems Specialist - Power quality & motor diagnostics'
  },
  {
    id: 'boreas',
    name: 'BOREAS',
    icon: Snowflake,
    iconColor: 'text-cyan-500',
    description: 'Refrigeration Systems Specialist - Compressor & refrigerant analysis'
  },
  {
    id: 'naiad',
    name: 'NAIAD',
    icon: Droplets,
    iconColor: 'text-blue-500',
    description: 'Water Systems Specialist - Flow, pumps & hydronic diagnostics'
  },
  {
    id: 'vulcan',
    name: 'VULCAN',
    icon: Flame,
    iconColor: 'text-orange-500',
    description: 'Mechanical Systems Specialist - Vibration & bearing health'
  },
  {
    id: 'zephyrus',
    name: 'ZEPHYRUS',
    icon: Tornado,
    iconColor: 'text-purple-500',
    description: 'Airflow Systems Specialist - Duct pressure & filter diagnostics'
  },
  {
    id: 'colossus',
    name: 'COLOSSUS',
    icon: Mountain,
    iconColor: 'text-gray-500',
    description: 'Master Aggregator - Cross-system correlation & multi-fault detection'
  },
  {
    id: 'gaia',
    name: 'GAIA',
    icon: Globe,
    iconColor: 'text-emerald-500',
    description: 'Final Safety Validator - Emergency response & risk assessment'
  }
]

export default function AIModelsPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [selectedEquipment, setSelectedEquipment] = useState<string>('')
  const [customers, setCustomers] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [filteredEquipment, setFilteredEquipment] = useState<any[]>([])
  const [aiModelConfig, setAiModelConfig] = useState({
    apollo_enabled: true,
    aquilo_enabled: true,
    boreas_enabled: true,
    naiad_enabled: true,
    vulcan_enabled: true,
    zephyrus_enabled: true,
    colossus_enabled: true,
    gaia_enabled: true
  })
  const [aiConfigChanged, setAiConfigChanged] = useState(false)
  const [savingAiConfig, setSavingAiConfig] = useState(false)
  const [savedMessageVisible, setSavedMessageVisible] = useState(false)

  // Fetch customers and equipment
  useEffect(() => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo data
      const demoCustomers = [
        { id: 1, name: 'Demo Facility 1', company_name: 'Demo Facility 1' },
        { id: 2, name: 'Demo Facility 2', company_name: 'Demo Facility 2' }
      ];
      const demoEquipment = [
        { id: 1, customer_id: 1, location_name: 'RTU-1', equipment_type: 'RTU' },
        { id: 2, customer_id: 1, location_name: 'Chiller-1', equipment_type: 'Chiller' },
        { id: 3, customer_id: 1, location_name: 'AHU-1', equipment_type: 'AHU' },
        { id: 4, customer_id: 2, location_name: 'RTU-2', equipment_type: 'RTU' },
        { id: 5, customer_id: 2, location_name: 'Boiler-1', equipment_type: 'Boiler' }
      ];

      setCustomers(demoCustomers);
      setEquipment(demoEquipment);
      setSelectedCustomer('1');
      return;
    }

    // Fetch customers
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setCustomers(Array.isArray(data) ? data : [])
        if (data && data.length > 0 && !selectedCustomer) {
          setSelectedCustomer(data[0].id.toString())
        }
      })
      .catch(err => {
        console.error('Failed to fetch customers:', err)
        setCustomers([])
      })

    // Fetch all equipment
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setEquipment(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        console.error('Failed to fetch equipment:', err)
        setEquipment([])
      })
  }, [])

  // Filter equipment when customer changes
  useEffect(() => {
    if (selectedCustomer && equipment.length > 0) {
      const filtered = equipment.filter(eq => eq.customer_id.toString() === selectedCustomer)
      setFilteredEquipment(filtered)
      if (filtered.length > 0) {
        setSelectedEquipment(filtered[0].id.toString())
      } else {
        setSelectedEquipment('')
      }
    }
  }, [selectedCustomer, equipment])

  // Load AI model configuration when equipment changes
  useEffect(() => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (selectedEquipment) {
      if (isDemoMode) {
        // Demo mode - all models enabled by default
        setAiModelConfig({
          apollo_enabled: true,
          aquilo_enabled: true,
          boreas_enabled: true,
          naiad_enabled: true,
          vulcan_enabled: true,
          zephyrus_enabled: true,
          colossus_enabled: true,
          gaia_enabled: true
        });
        setAiConfigChanged(false);
        return;
      }

      fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai-models/config/${selectedEquipment}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
        .then(res => res.json())
        .then(data => {
          setAiModelConfig({
            apollo_enabled: data.apollo_enabled ?? true,
            aquilo_enabled: data.aquilo_enabled ?? true,
            boreas_enabled: data.boreas_enabled ?? true,
            naiad_enabled: data.naiad_enabled ?? true,
            vulcan_enabled: data.vulcan_enabled ?? true,
            zephyrus_enabled: data.zephyrus_enabled ?? true,
            colossus_enabled: data.colossus_enabled ?? true,
            gaia_enabled: data.gaia_enabled ?? true
          })
          setAiConfigChanged(false)
        })
        .catch(err => console.error('Failed to fetch AI config:', err))
    }
  }, [selectedEquipment])

  const handleAiModelToggle = (modelId: string) => {
    setAiModelConfig(prev => ({
      ...prev,
      [`${modelId}_enabled`]: !prev[`${modelId}_enabled` as keyof typeof prev]
    }))
    setAiConfigChanged(true)
  }

  const saveAiConfiguration = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // In demo mode, just simulate saving
      setSavingAiConfig(true)
      setTimeout(() => {
        setAiConfigChanged(false)
        setSavedMessageVisible(true)
        setTimeout(() => setSavedMessageVisible(false), 3000)
        setSavingAiConfig(false)
      }, 500)
      return;
    }

    setSavingAiConfig(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai-models/config/${selectedEquipment}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(aiModelConfig)
      })

      if (response.ok) {
        setAiConfigChanged(false)
        setSavedMessageVisible(true)
        setTimeout(() => setSavedMessageVisible(false), 3000)
      } else {
        console.error('Failed to save configuration')
      }
    } catch (err) {
      console.error('Failed to save AI config:', err)
    } finally {
      setSavingAiConfig(false)
    }
  }

  const currentEquipment = equipment.find(e => e.id.toString() === selectedEquipment)

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Nexus AI Models</h1>
        <p className="text-gray-600 mt-2">Configure AI-powered fault detection and optimization models for your equipment</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Equipment Selection</CardTitle>
          <CardDescription>Select location and equipment to configure AI models</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Location</label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name || customer.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Equipment</label>
                <Select value={selectedEquipment} onValueChange={setSelectedEquipment} disabled={!selectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEquipment.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id.toString()}>
                        {eq.location_name || `Equipment ${eq.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={saveAiConfiguration}
                disabled={!aiConfigChanged || !selectedEquipment || savingAiConfig}
                className="bg-black hover:bg-gray-800 text-white hover:shadow-lg transition-all duration-200"
              >
                {savingAiConfig ? 'Saving...' : savedMessageVisible ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Saved
                  </>
                ) : (
                  `Apply Settings${currentEquipment ? ` for ${currentEquipment.location_name || `Equipment ${currentEquipment.id}`}` : ''}`
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {aiModels.map((model) => {
          const Icon = model.icon
          const isEnabled = aiModelConfig[`${model.id}_enabled` as keyof typeof aiModelConfig]
          
          return (
            <Card 
              key={model.id}
              className={`bg-white hover:shadow-xl transition-all duration-200 cursor-pointer border-gray-200 ${!isEnabled ? 'opacity-60' : ''}`}
              onClick={() => handleAiModelToggle(model.id)}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gray-50">
                    <Icon className={`h-6 w-6 ${isEnabled ? model.iconColor : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{model.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => {
                    handleAiModelToggle(model.id)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-400"
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}