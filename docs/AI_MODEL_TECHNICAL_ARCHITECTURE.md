# Technical Architecture Documentation - 8-Model HVAC Diagnostic System

## Neural Network Architectures

### 1. AQUILO - Electrical Systems Specialist

```python
Architecture: Sequential + Multi-Head
├── Input Layer: (batch_size, 64, 7) → Reshaped to (batch_size, 168)
├── Feature Extractors:
│   ├── Voltage Analyzer: Linear(56) → BN → ReLU → Dropout(0.2) → Linear(64)
│   ├── Current Analyzer: Linear(56) → BN → ReLU → Dropout(0.2) → Linear(64)
│   └── Power Quality: Linear(56) → ReLU → Linear(32)
├── Main Network:
│   ├── Linear(328) → BN → GELU → Dropout(0.3)
│   ├── Linear(512) → BN → GELU → Dropout(0.3)
│   └── Linear(256) → BN → ReLU → Dropout(0.2)
└── Output Heads:
    ├── Fault Classification: Linear(256) → Softmax(13 classes)
    ├── Severity Estimation: Linear(256) → Softmax(5 levels)
    ├── Phase Health: Linear(256) → Sigmoid(3 phases)
    └── Power Quality Score: Linear(256) → Sigmoid(1 score)
```

**Key Features**:
- Harmonic analysis through specialized FFT preprocessing
- Phase-aware architecture for 3-phase systems
- Attention mechanism for electrical transients
- Total parameters: 607,990

### 2. BOREAS - Refrigeration Systems Specialist

```python
Architecture: ResNet-inspired + LSTM
├── Input Layer: (batch_size, 80, 7) → (batch_size, 560)
├── Thermodynamic Analyzers:
│   ├── Pressure Networks (High/Low side analysis)
│   ├── Temperature Networks (Superheat/Subcool calculation)
│   └── Flow Networks (Mass flow estimation)
├── ResNet Blocks (3):
│   └── Each: Conv1D → BN → ReLU → Conv1D → BN → Skip Connection
├── LSTM Layer: 256 hidden units (for cycle analysis)
├── Attention Layer: Multi-head (8 heads) for component correlation
└── Output Heads:
    ├── Fault Detection: 16 refrigeration-specific faults
    ├── Efficiency Score: Regression (0-100%)
    ├── Refrigerant Charge: Classification (5 levels)
    └── Component Health: 8 components × health scores
```

**Key Features**:
- Psychrometric calculations embedded
- P-h diagram awareness
- Refrigerant-specific transfer functions
- Total parameters: 1,241,510

### 3. NAIAD - Water Systems Specialist

```python
Architecture: CNN + Attention
├── Input Layer: (batch_size, 64, 7)
├── Convolutional Feature Extraction:
│   ├── Conv1D(64) → ReLU → MaxPool
│   ├── Conv1D(128) → ReLU → MaxPool
│   └── Conv1D(256) → ReLU → GlobalAvgPool
├── Flow Dynamics Module:
│   └── Specialized layers for Reynolds number estimation
├── Self-Attention: For system-wide water balance
└── Output Heads:
    ├── Fault Classification: 11 water system faults
    ├── Flow Anomaly Detection: Binary + confidence
    ├── Water Quality Index: Regression
    └── Pump Efficiency: Per-pump scoring
```

**Key Features**:
- Fluid dynamics aware architecture
- Pump curve integration
- Water chemistry modeling
- Total parameters: 532,966

### 4. VULCAN - Mechanical Systems Specialist

```python
Architecture: Wide & Deep + Vibration Analysis
├── Input Layer: (batch_size, 96, 7)
├── Vibration Analysis Branch:
│   ├── FFT Layer (custom): Time → Frequency domain
│   ├── Spectral Feature Extraction
│   └── Peak Detection Network
├── Wide Network: Direct sensor → fault mapping
├── Deep Network: 
│   └── 5 hidden layers with batch normalization
├── Fusion Layer: Concatenate wide + deep + vibration
└── Output Heads:
    ├── Mechanical Faults: 15 fault types
    ├── Bearing Health: Per-bearing scoring
    ├── Vibration Severity: ISO 10816 classification
    └── Remaining Useful Life: Regression (hours)
```

**Key Features**:
- 3-axis vibration processing
- Bearing fault frequency calculations
- Acoustic signature analysis
- Total parameters: 1,109,830

### 5. ZEPHYRUS - Airflow Systems Specialist

```python
Architecture: Graph Neural Network + CNN
├── Input Layer: (batch_size, 72, 7)
├── Duct Network Modeling:
│   ├── Graph Construction: Sensors as nodes
│   ├── Edge Features: Pressure differentials
│   └── Graph Convolution: 3 layers
├── Spatial CNN: For zone relationships
├── Pressure-Flow Coupling:
│   └── Physics-informed layers
└── Output Heads:
    ├── Airflow Faults: 12 fault types
    ├── Filter Loading: Percentage (0-100%)
    ├── Duct Leakage: Location probability map
    └── IAQ Score: Multi-parameter index
```

**Key Features**:
- Graph representation of duct networks
- Bernoulli equation constraints
- Psychrometric state tracking
- Total parameters: 844,614

### 6. COLOSSUS - Master Aggregator

```python
Architecture: Transformer-based Ensemble
├── Input: Concatenated specialist outputs
│   └── Aquilo(256) + Boreas(384) + Naiad(256) + Vulcan(384) + Zephyrus(320)
├── Feature Projection: Linear layers per specialist
├── Cross-Specialist Attention:
│   ├── 12 attention heads
│   ├── Specialist reliability weighting
│   └── Temporal attention (if time-series)
├── Correlation Detection Network:
│   └── Identifies cross-system interactions
└── Output Heads:
    ├── System-wide Faults: 24 integrated fault types
    ├── Cascade Probability: Multi-fault sequences
    ├── System Health Score: Overall assessment
    └── Specialist Confidence: Trust scores per model
```

**Key Features**:
- Cross-attention between specialists
- Cascade failure detection
- Voting mechanism with learned weights
- Total parameters: 1,544,518

### 7. GAIA - Safety Validator

```python
Architecture: Adversarial + Rule-Enhanced
├── Input: All specialist outputs + Colossus output
├── Safety Rule Encoder:
│   ├── Hard-coded safety constraints
│   └── Learned safety patterns
├── Adversarial Network:
│   └── Attempts to find safety violations
├── Validation Network:
│   ├── Cross-checks all recommendations
│   └── Bayesian uncertainty estimation
└── Output Heads:
    ├── Validation State: 5 states (OK to EMERGENCY)
    ├── Safety Score: Risk assessment (0-1)
    ├── Override Recommendations: Binary per action
    └── Confidence Intervals: Uncertainty bounds
```

**Key Features**:
- Adversarial robustness
- Regulatory compliance encoding
- Fail-safe mechanisms
- Total parameters: 896,198

### 8. APOLLO - Master Coordinator

```python
Architecture: Hierarchical Attention Network
├── Input Processing:
│   ├── Specialist Features: All 7 model outputs
│   ├── Raw Sensor Access: Direct sensor validation
│   └── Historical Context: Previous decisions
├── Multi-Level Attention:
│   ├── Specialist-level: Weight specialist inputs
│   ├── Fault-level: Cross-fault correlations  
│   └── Temporal-level: Time-series patterns
├── Decision Networks:
│   ├── Consensus Building: Weighted voting
│   ├── Conflict Resolution: Disagreement handling
│   └── Confidence Calibration: Uncertainty aware
├── Cost-Benefit Analysis:
│   └── Economic optimization module
└── Output Heads:
    ├── Final Diagnosis: 12 system-wide categories
    ├── Cost Optimization: 6 strategies
    ├── Action Priority: Ranked recommendations
    └── Confidence Scores: Per-decision certainty
```

**Key Features**:
- Hierarchical decision making
- Economic optimization
- Explainable AI outputs
- Total parameters: 1,820,296

## Data Flow Through the 8-Model System

```python
# Pseudo-code for inference pipeline
def diagnose_hvac_system(sensor_data):
    # Stage 1: Parallel specialist inference
    specialist_outputs = parallel_execute([
        aquilo.forward(sensor_data.electrical),
        boreas.forward(sensor_data.refrigeration),
        naiad.forward(sensor_data.water),
        vulcan.forward(sensor_data.mechanical),
        zephyrus.forward(sensor_data.airflow)
    ])
    
    # Stage 2: Aggregation
    colossus_input = concatenate(specialist_outputs)
    colossus_output = colossus.forward(colossus_input)
    
    # Stage 3: Safety validation  
    gaia_input = concatenate(specialist_outputs, colossus_output)
    gaia_output = gaia.forward(gaia_input)
    
    # Stage 4: Master coordination
    apollo_input = {
        'specialists': specialist_outputs,
        'colossus': colossus_output,
        'gaia': gaia_output,
        'raw_sensors': sensor_data
    }
    final_diagnosis = apollo.forward(apollo_input)
    
    return final_diagnosis
```

## Hailo-8 Optimization Details

### Quantization Strategy

```python
# INT8 Quantization with calibration
for model in all_models:
    # Collect calibration data
    calibration_data = collect_representative_samples()
    
    # Quantize with per-channel optimization
    quantized_model = hailo_sdk.quantize(
        model,
        calibration_data,
        optimization_level=2,  # Balanced accuracy/speed
        per_channel=True
    )
    
    # Verify accuracy drop < 2%
    validate_quantized_accuracy(quantized_model)
```

### Model Pipelining on Hailo-8

```python
# Hailo Application Code
class HailoHVACPipeline:
    def __init__(self):
        self.device = hailo.Device()
        self.models = self.load_models()
        self.configure_pipeline()
    
    def configure_pipeline(self):
        # Create computation graph
        self.graph = self.device.create_graph()
        
        # Add specialist models (parallel)
        specialist_nodes = []
        for model in ['aquilo', 'boreas', 'naiad', 'vulcan', 'zephyrus']:
            node = self.graph.add_node(self.models[model])
            specialist_nodes.append(node)
        
        # Add aggregation layer
        colossus_node = self.graph.add_node(self.models['colossus'])
        for spec_node in specialist_nodes:
            self.graph.add_edge(spec_node, colossus_node)
        
        # Add validation layer
        gaia_node = self.graph.add_node(self.models['gaia'])
        self.graph.add_edge(colossus_node, gaia_node)
        
        # Add master coordinator
        apollo_node = self.graph.add_node(self.models['apollo'])
        self.graph.add_edge(gaia_node, apollo_node)
        
        # Compile for Hailo-8
        self.graph.compile(target='hailo8')
```

### Memory Optimization

```python
# Shared buffer management
class SensorBufferManager:
    def __init__(self, buffer_size_mb=1024):
        # Circular buffer for sensor data
        self.buffer = np.zeros((buffer_size_mb * 1024 * 1024 // 4,), dtype=np.float32)
        self.write_ptr = 0
        self.read_ptr = 0
        
    def add_sensor_data(self, data):
        # Zero-copy insertion
        self.buffer[self.write_ptr:self.write_ptr + len(data)] = data
        self.write_ptr = (self.write_ptr + len(data)) % len(self.buffer)
        
    def get_batch(self, size):
        # Return view, not copy
        batch = self.buffer[self.read_ptr:self.read_ptr + size]
        self.read_ptr = (self.read_ptr + size) % len(self.buffer)
        return batch.reshape(-1, 64, 7)  # Reshape for models
```

## Real-time Performance Optimization

### Inference Scheduling

```python
class ModelScheduler:
    def __init__(self):
        self.priority_queue = PriorityQueue()
        self.inference_times = {
            'aquilo': 8, 'boreas': 12, 'naiad': 7,
            'vulcan': 10, 'zephyrus': 9,
            'colossus': 15, 'gaia': 10, 'apollo': 20
        }
    
    def schedule_inference(self, urgency_scores):
        # Dynamic scheduling based on urgency
        for model, urgency in urgency_scores.items():
            priority = urgency / self.inference_times[model]
            self.priority_queue.put((-priority, model))
    
    def get_next_model(self):
        return self.priority_queue.get()[1]
```

### Edge-Cloud Hybrid Mode

```python
# Fallback to cloud for complex scenarios
class HybridInference:
    def __init__(self, edge_models, cloud_endpoint):
        self.edge_models = edge_models
        self.cloud_api = cloud_endpoint
        self.complexity_threshold = 0.85
    
    async def diagnose(self, sensor_data):
        # Quick complexity assessment
        complexity = self.assess_complexity(sensor_data)
        
        if complexity < self.complexity_threshold:
            # Run on edge (Hailo-8)
            return self.edge_inference(sensor_data)
        else:
            # Complex case - use cloud
            return await self.cloud_inference(sensor_data)
```

## Database Schema for Multi-Model System

```sql
-- Model inference results
CREATE TABLE model_inferences (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    equipment_id INTEGER REFERENCES equipment(id),
    model_name VARCHAR(20) NOT NULL,
    fault_detected INTEGER,
    confidence FLOAT,
    inference_time_ms FLOAT,
    raw_output JSONB
);

-- Specialist consensus tracking
CREATE TABLE specialist_consensus (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    equipment_id INTEGER REFERENCES equipment(id),
    consensus_score FLOAT,
    agreeing_models TEXT[],
    dissenting_models TEXT[],
    apollo_decision VARCHAR(100),
    decision_confidence FLOAT
);

-- Model performance metrics
CREATE TABLE model_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    model_name VARCHAR(20) NOT NULL,
    accuracy FLOAT,
    precision_scores JSONB,
    recall_scores JSONB,
    inference_count INTEGER,
    avg_inference_time_ms FLOAT,
    false_positives INTEGER,
    false_negatives INTEGER
);

-- Energy optimization tracking
CREATE TABLE energy_optimizations (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    equipment_id INTEGER REFERENCES equipment(id),
    optimization_type VARCHAR(50),
    predicted_savings_kwh FLOAT,
    predicted_cost_savings DECIMAL(10,2),
    implemented BOOLEAN DEFAULT FALSE,
    actual_savings_kwh FLOAT,
    actual_cost_savings DECIMAL(10,2)
);
```

This technical documentation provides the deep implementation details needed to understand and deploy the 8-model system on your Raspberry Pi 5 with Hailo-8.