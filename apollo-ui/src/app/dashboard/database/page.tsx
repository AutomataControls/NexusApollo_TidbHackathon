'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Database, Search, RefreshCw, Eye, Download, Filter, ChevronLeft, ChevronRight, HardDrive, Server, Cloud } from 'lucide-react'
import { toast } from 'sonner'

interface TableInfo {
  name: string
  type: 'postgres' | 'sqlite' | 'tidb'
  rowCount: number
  columns: Array<{
    name: string
    type: string
    nullable: boolean
  }>
}

interface RecordDetail {
  table: string
  data: Record<string, any>
}

export default function DatabasePage() {
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [tableData, setTableData] = useState<any[]>([])
  const [tableInfo, setTableInfo] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<RecordDetail | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedDatabase, setSelectedDatabase] = useState<'postgres' | 'sqlite' | 'tidb'>('postgres')
  const [refreshing, setRefreshing] = useState(false)

  // PostgreSQL tables
  const postgresTables = [
    'customers',
    'equipment', 
    'users',
    'alarms',
    'maintenance_logs',
    'fault_history',
    'ai_model_configs',
    'alarm_recipients',
    'diagnostic_results',
    'equipment_types',
    'report_schedules',
    'saved_reports',
    'sensor_configs',
    'system_settings'
  ]

  // SQLite tables
  const sqliteTables = [
    'sensor_readings',
    'sensor_trends'
  ]

  // TiDB tables (vector tables)
  const tidbTables = [
    'fault_pattern_vectors',
    'model_inference_vectors',
    'sensor_embeddings',
    'solution_vectors'
  ]

  useEffect(() => {
    fetchTableInfo()
  }, [])

  useEffect(() => {
    if (selectedTable) {
      fetchTableData()
    }
  }, [selectedTable, currentPage, searchQuery])

  const fetchTableInfo = async () => {
    try {
      const response = await fetch('http://localhost:8001/api/database/info', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setTableInfo(data)
      }
    } catch (error) {
      console.error('Failed to fetch table info:', error)
    }
  }

  const fetchTableData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        table: selectedTable,
        page: currentPage.toString(),
        limit: '50',
        db: selectedDatabase
      })
      
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`http://localhost:8001/api/database/query?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setTableData(data.rows || [])
        setTotalPages(Math.ceil(data.total / 50))
      }
    } catch (error) {
      console.error('Failed to fetch table data:', error)
      toast.error('Failed to fetch table data')
    } finally {
      setLoading(false)
    }
  }

  const refreshTable = async () => {
    setRefreshing(true)
    await fetchTableData()
    setRefreshing(false)
    toast.success('Table refreshed')
  }

  const viewRecord = (record: any) => {
    setSelectedRecord({
      table: selectedTable,
      data: record
    })
  }

  const exportData = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({
        table: selectedTable,
        format: format,
        db: selectedDatabase
      })
      
      const response = await fetch(`http://localhost:8001/api/database/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${selectedTable}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success(`Exported ${selectedTable} as ${format.toUpperCase()}`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Export failed')
    }
  }

  const getColumnValue = (value: any): string => {
    if (value === null) return 'NULL'
    if (value === undefined) return ''
    if (typeof value === 'object') {
      if (value instanceof Date) {
        return new Date(value).toLocaleString()
      }
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const tables = selectedDatabase === 'postgres' ? postgresTables :
                selectedDatabase === 'sqlite' ? sqliteTables : tidbTables

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Database Management</h1>
          <p className="text-gray-600 mt-2">View and manage PostgreSQL, SQLite, and TiDB databases</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="px-3 py-1">
            <Server className="w-3 h-3 mr-1" />
            PostgreSQL
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            <HardDrive className="w-3 h-3 mr-1" />
            SQLite
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            <Cloud className="w-3 h-3 mr-1" />
            TiDB Cloud
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar with tables */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Database Tables</CardTitle>
            <CardDescription>Select a table to view its data</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedDatabase} onValueChange={(value) => {
              setSelectedDatabase(value as 'postgres' | 'sqlite' | 'tidb')
              setSelectedTable('')
              setTableData([])
            }}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="postgres">PostgreSQL</TabsTrigger>
                <TabsTrigger value="sqlite">SQLite</TabsTrigger>
                <TabsTrigger value="tidb">TiDB</TabsTrigger>
              </TabsList>
              
              <TabsContent value="postgres" className="mt-4">
                <div className="space-y-2">
                  {postgresTables.map(table => (
                    <Button
                      key={table}
                      variant={selectedTable === table && selectedDatabase === 'postgres' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedTable(table)
                        setCurrentPage(1)
                      }}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      {table}
                    </Button>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="sqlite" className="mt-4">
                <div className="space-y-2">
                  {sqliteTables.map(table => (
                    <Button
                      key={table}
                      variant={selectedTable === table && selectedDatabase === 'sqlite' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedTable(table)
                        setCurrentPage(1)
                      }}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      {table}
                    </Button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tidb" className="mt-4">
                <div className="space-y-2">
                  {tidbTables.map(table => (
                    <Button
                      key={table}
                      variant={selectedTable === table && selectedDatabase === 'tidb' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedTable(table)
                        setCurrentPage(1)
                      }}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      {table}
                    </Button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Main content area */}
        <div className="lg:col-span-3">
          {selectedTable ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      {selectedTable}
                    </CardTitle>
                    <CardDescription>
                      Database: {selectedDatabase === 'postgres' ? 'PostgreSQL' :
                                selectedDatabase === 'sqlite' ? 'SQLite' : 'TiDB Cloud'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="pl-9 w-[200px]"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={refreshTable}
                      disabled={refreshing}
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportData('csv')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportData('json')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="min-w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {tableData.length > 0 && Object.keys(tableData[0]).map((column) => (
                            <TableHead key={column} className="whitespace-nowrap">
                              {column}
                            </TableHead>
                          ))}
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={100} className="text-center py-8">
                              Loading...
                            </TableCell>
                          </TableRow>
                        ) : tableData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={100} className="text-center py-8 text-gray-500">
                              No data found
                            </TableCell>
                          </TableRow>
                        ) : (
                          tableData.map((row, index) => (
                            <TableRow key={index}>
                              {Object.entries(row).map(([key, value]) => (
                                <TableCell key={key} className="max-w-[200px] truncate">
                                  {getColumnValue(value)}
                                </TableCell>
                              ))}
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewRecord(row)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <CardContent className="text-center">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Table Selected</h3>
                <p className="text-gray-600">Select a table from the sidebar to view its data</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Record Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Record Details - {selectedRecord?.table}</DialogTitle>
            <DialogDescription>Full record data</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] w-full">
            <div className="space-y-4">
              {selectedRecord && Object.entries(selectedRecord.data).map(([key, value]) => (
                <div key={key} className="border-b pb-2">
                  <div className="text-sm font-medium text-gray-700 mb-1">{key}</div>
                  <div className="text-sm bg-gray-50 p-2 rounded">
                    <pre className="whitespace-pre-wrap break-all">
                      {getColumnValue(value)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}