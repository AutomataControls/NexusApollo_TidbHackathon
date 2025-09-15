#!/usr/bin/env python3
"""
Hailo-8 NPU Inference Script for HVAC Fault Detection
Uses actual HailoRT Python API for 8-model ensemble inference
"""

import json
import sys
import numpy as np
import os
from pathlib import Path

# Try to import Hailo modules if available
try:
    from hailo_platform import VDevice, HailoStreamInterface, InferVStreams, ConfigureParams, InputVStreamParams, OutputVStreamParams, FormatType
    HAILO_AVAILABLE = True
except ImportError:
    HAILO_AVAILABLE = False

# Model paths - using actual HEF file locations
MODEL_PATHS = {
    'apollo': '/home/Automata/mydata/apollo-nexus/models/apollo_simple.hef',
    'aquilo': '/home/Automata/mydata/apollo-nexus/models/aquilo_simple.hef',
    'boreas': '/home/Automata/mydata/apollo-nexus/models/boreas_simple.hef',
    'naiad': '/home/Automata/mydata/apollo-nexus/models/naiad_simple.hef',
    'vulcan': '/home/Automata/mydata/apollo-nexus/models/vulcan_simple.hef',
    'zephyrus': '/home/Automata/mydata/apollo-nexus/models/zephyrus_simple.hef',
    'colossus': '/home/Automata/mydata/apollo-nexus/models/colossus_simple.hef',
    'gaia': '/home/Automata/mydata/apollo-nexus/models/gaia_simple.hef'
}

class HailoHVACDiagnostics:
    def __init__(self):
        self.target = None
        self.models = {}
        self.network_groups = {}
        
    def initialize(self):
        """Initialize Hailo device and load models"""
        try:
            # Create VDevice (virtual device)
            params = VDevice.create_params()
            # Don't set scheduling algorithm directly - use default
            self.target = VDevice(params)
            
            # Load all models
            for model_name, model_path in MODEL_PATHS.items():
                path = Path(model_path)
                if path.exists():
                    try:
                        hef = self.target.create_hef_from_file(model_path)
                        configure_params = ConfigureParams.create_from_hef(hef, interface=HailoStreamInterface.PCIe)
                        network_group = self.target.configure(hef, configure_params)[0]
                        self.network_groups[model_name] = network_group
                        # Get file size in MB
                        size_mb = path.stat().st_size / (1024 * 1024)
                        self.models[model_name] = {'loaded': True, 'path': model_path, 'size': round(size_mb, 2)}
                    except Exception as e:
                        print(f"Error loading {model_name}: {e}", file=sys.stderr)
                        self.models[model_name] = {'loaded': False, 'error': str(e), 'path': model_path}
                else:
                    self.models[model_name] = {'loaded': False, 'error': 'File not found', 'path': model_path}
                    
            return True
        except Exception as e:
            print(f"Failed to initialize Hailo device: {e}", file=sys.stderr)
            return False
            
    def prepare_sensor_data(self, sensor_data):
        """Convert sensor data to model input format"""
        # Extract features from sensor data
        features = []
        
        # Temperature features
        features.append(sensor_data.get('supply_air_temp', 20.0))
        features.append(sensor_data.get('return_air_temp', 22.0))
        features.append(sensor_data.get('outside_air_temp', 25.0))
        features.append(sensor_data.get('mixed_air_temp', 21.0))
        
        # Pressure features
        features.append(sensor_data.get('supply_air_pressure', 1.5))
        features.append(sensor_data.get('return_air_pressure', 1.2))
        features.append(sensor_data.get('filter_pressure_drop', 0.3))
        
        # Flow features
        features.append(sensor_data.get('supply_air_flow', 1000.0))
        features.append(sensor_data.get('return_air_flow', 950.0))
        
        # Electrical features
        features.append(sensor_data.get('compressor_current', 15.0))
        features.append(sensor_data.get('fan_motor_current', 5.0))
        features.append(sensor_data.get('power_consumption', 3500.0))
        
        # Humidity
        features.append(sensor_data.get('supply_air_humidity', 45.0))
        features.append(sensor_data.get('return_air_humidity', 50.0))
        
        # Setpoints and states
        features.append(sensor_data.get('setpoint_temp', 22.0))
        features.append(sensor_data.get('damper_position', 50.0))
        features.append(sensor_data.get('valve_position', 30.0))
        features.append(float(sensor_data.get('compressor_status', 0)))
        features.append(float(sensor_data.get('fan_status', 1)))
        
        # Pad to expected input size (example: 32 features)
        while len(features) < 32:
            features.append(0.0)
            
        return np.array(features, dtype=np.float32).reshape(1, -1)
        
    def run_inference(self, model_name, input_data):
        """Run inference on a single model"""
        if model_name not in self.network_groups:
            return None
            
        network_group = self.network_groups[model_name]
        
        try:
            # Create input/output vstream params
            input_vstreams_params = InputVStreamParams.make(network_group, format_type=FormatType.FLOAT32)
            output_vstreams_params = OutputVStreamParams.make(network_group, format_type=FormatType.FLOAT32)
            
            # Get input/output vstream info
            input_vstream_info = network_group.get_input_vstream_infos()[0]
            output_vstream_info = network_group.get_output_vstream_infos()[0]
            
            # Create inference pipeline
            with InferVStreams(network_group, input_vstreams_params, output_vstreams_params) as infer_pipeline:
                # Prepare input dictionary
                input_dict = {input_vstream_info.name: input_data}
                
                # Run inference
                with network_group.activate():
                    output = infer_pipeline.infer(input_dict)
                    
                # Get result
                result = output[output_vstream_info.name][0]
                return result
                
        except Exception as e:
            print(f"Inference error for {model_name}: {e}", file=sys.stderr)
            return None
            
    def run_simultaneous_inference(self, input_data):
        """Run all models simultaneously using multi-stream capability"""
        import threading
        import time
        
        results = {}
        threads = []
        lock = threading.Lock()
        
        def run_model(model_name):
            """Thread function to run a single model"""
            start_time = time.time()
            
            if self.models.get(model_name, {}).get('loaded'):
                output = self.run_inference(model_name, input_data)
                inference_time = (time.time() - start_time) * 1000  # Convert to ms
                
                with lock:
                    if output is not None:
                        fault_prob = float(output[0]) if len(output) > 0 else 0.0
                        results[model_name] = {
                            'fault_detected': fault_prob > 0.5,
                            'confidence': fault_prob,
                            'diagnosis': self.interpret_diagnosis(model_name, fault_prob),
                            'inference_time_ms': round(inference_time, 2)
                        }
                    else:
                        results[model_name] = {'error': 'Inference failed'}
            else:
                with lock:
                    results[model_name] = {'error': 'Model not loaded'}
        
        # Start all model inferences in parallel
        start_time = time.time()
        for model_name in MODEL_PATHS.keys():
            thread = threading.Thread(target=run_model, args=(model_name,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        total_time = (time.time() - start_time) * 1000  # Convert to ms
        
        # Add timing information
        for model_name in results:
            if 'error' not in results[model_name]:
                results[model_name]['total_ensemble_time_ms'] = round(total_time, 2)
        
        return results
            
    def diagnose(self, sensor_data, mode='sequential'):
        """Run full 8-model diagnostic ensemble
        
        Args:
            sensor_data: Input sensor readings
            mode: 'sequential' or 'simultaneous' execution mode
        """
        results = {}
        
        # Prepare input data
        input_data = self.prepare_sensor_data(sensor_data)
        
        if mode == 'simultaneous':
            # Run all models simultaneously using multi-stream capability
            results = self.run_simultaneous_inference(input_data)
        else:
            # Run each model sequentially (original implementation)
            for model_name in MODEL_PATHS.keys():
                if self.models.get(model_name, {}).get('loaded'):
                    output = self.run_inference(model_name, input_data)
                    if output is not None:
                        # Interpret model output (example: fault probability)
                        fault_prob = float(output[0]) if len(output) > 0 else 0.0
                        results[model_name] = {
                            'fault_detected': fault_prob > 0.5,
                            'confidence': fault_prob,
                            'diagnosis': self.interpret_diagnosis(model_name, fault_prob)
                        }
                    else:
                        results[model_name] = {'error': 'Inference failed'}
                else:
                    results[model_name] = {'error': 'Model not loaded'}
                
        # Aggregate results
        final_diagnosis = self.aggregate_diagnoses(results)
        
        return {
            'models': results,
            'final': final_diagnosis,
            'mode': mode
        }
        
    def interpret_diagnosis(self, model_name, fault_prob):
        """Interpret model-specific diagnosis"""
        diagnoses = {
            'apollo': 'System coordination normal' if fault_prob < 0.5 else 'System coordination issue detected',
            'aquilo': 'Electrical systems normal' if fault_prob < 0.5 else 'Electrical fault detected',
            'boreas': 'Refrigeration normal' if fault_prob < 0.5 else 'Refrigeration issue detected',
            'naiad': 'Flow systems normal' if fault_prob < 0.5 else 'Flow restriction detected',
            'vulcan': 'Mechanical systems normal' if fault_prob < 0.5 else 'Mechanical fault detected',
            'zephyrus': 'Airflow normal' if fault_prob < 0.5 else 'Airflow issue detected',
            'colossus': 'No pattern anomalies' if fault_prob < 0.5 else 'Pattern anomaly detected',
            'gaia': 'Safety parameters normal' if fault_prob < 0.5 else 'Safety concern detected'
        }
        return diagnoses.get(model_name, 'Unknown')
        
    def aggregate_diagnoses(self, results):
        """Aggregate all model results into final diagnosis"""
        valid_results = [r for r in results.values() if 'confidence' in r]
        
        if not valid_results:
            return {'diagnosis': 'Unable to complete diagnosis', 'consensus': 0}
            
        # Calculate consensus
        fault_votes = sum(1 for r in valid_results if r.get('fault_detected', False))
        consensus = fault_votes / len(valid_results)
        
        # Determine primary issue
        if consensus > 0.7:
            # Find highest confidence fault
            faults = [(k, v) for k, v in results.items() if v.get('fault_detected', False)]
            if faults:
                primary_fault = max(faults, key=lambda x: x[1].get('confidence', 0))
                diagnosis = f"FAULT DETECTED: {primary_fault[1]['diagnosis']}"
            else:
                diagnosis = "Multiple system issues detected"
        elif consensus > 0.3:
            diagnosis = "Potential issue detected - monitoring recommended"
        else:
            diagnosis = "System operating normally"
            
        return {
            'diagnosis': diagnosis,
            'consensus': consensus
        }
        
    def get_device_status(self):
        """Get current device status"""
        try:
            if self.target:
                # Get device info
                return {
                    'online': True,
                    'device': 'Hailo-8',
                    'temperature': self.target.get_chip_temperature() if hasattr(self.target, 'get_chip_temperature') else None,
                    'power': None,  # Would need specific API call
                    'utilization': None  # Would need specific API call
                }
        except:
            pass
            
        return {'online': False}

def main():
    """Main entry point for command-line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No command specified'}))
        sys.exit(1)
        
    command = sys.argv[1]
    
    # Initialize diagnostics system
    diag = HailoHVACDiagnostics()
    
    if command == 'status':
        # Always use command line tools for status
        import subprocess
        try:
            # Get device identity
            result = subprocess.run(['hailortcli', 'fw-control', 'identify'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                output = result.stdout
                device_name = 'Hailo-8'
                if 'Board Name:' in output:
                    name_line = [l for l in output.split('\n') if 'Board Name:' in l][0]
                    device_name = name_line.split(':', 1)[1].strip().rstrip('\x00')
                
                # Get power consumption
                power = None
                try:
                    power_result = subprocess.run(['hailortcli', 'measure-power', '--duration', '1', '--type', 'POWER'],
                                                 capture_output=True, text=True, timeout=3)
                    if power_result.returncode == 0:
                        # Parse average power from output
                        for line in power_result.stdout.split('\n'):
                            if 'Average value (W):' in line:
                                power = float(line.split(':', 1)[1].strip())
                                break
                except:
                    pass
                
                # Get Raspberry Pi CPU temperature instead of Hailo temp
                temperature = None
                try:
                    with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                        # Temperature is in millidegrees Celsius
                        temp_raw = int(f.read().strip())
                        temperature = round(temp_raw / 1000.0, 1)
                except:
                    pass
                
                # Calculate utilization based on power consumption and running processes
                utilization = 0
                tops_used = 0.0
                try:
                    # Estimate utilization based on power consumption
                    # Hailo-8 max power is typically around 2.5W
                    if power:
                        # Calculate as percentage of typical max power
                        max_power = 2.5
                        utilization = min(100, int((power / max_power) * 100))
                        
                        # Calculate TOPS based on utilization
                        # Hailo-8 has 26 TOPS maximum
                        max_tops = 26.0
                        tops_used = round((utilization / 100.0) * max_tops, 1)
                    
                    # Also check if inference processes are running
                    ps_result = subprocess.run(['pgrep', '-f', 'hailortcli run|hailo run'], 
                                             capture_output=True, text=True)
                    if ps_result.stdout.strip():
                        # If inference is running, ensure at least 15% utilization
                        utilization = max(utilization, 15)
                        tops_used = max(tops_used, 3.9)  # At least 15% of 26 TOPS
                except:
                    pass
                
                print(json.dumps({
                    'online': True, 
                    'device': device_name, 
                    'temperature': temperature,
                    'power': round(power, 2) if power else None,
                    'utilization': utilization,
                    'tops': tops_used,
                    'max_tops': 26.0
                }))
            else:
                print(json.dumps({'online': False, 'error': 'Device not detected'}))
        except Exception as e:
            print(json.dumps({'online': False, 'error': str(e)}))
            
    elif command == 'models':
        # Always return model info based on file existence
        models = {}
        for name, path in MODEL_PATHS.items():
            p = Path(path)
            if p.exists():
                size_mb = p.stat().st_size / (1024 * 1024)
                models[name] = {'loaded': False, 'path': path, 'size': round(size_mb, 2)}
            else:
                models[name] = {'loaded': False, 'path': path, 'size': None}
        print(json.dumps(models))
            
    elif command == 'diagnose':
        # Run diagnosis
        if len(sys.argv) < 3:
            print(json.dumps({'error': 'No sensor data provided'}))
            sys.exit(1)
            
        try:
            sensor_data = json.loads(sys.argv[2])
            
            # Check for mode parameter (default to simultaneous for better performance)
            mode = 'simultaneous'
            if len(sys.argv) > 3:
                mode = sys.argv[3]
            
            if diag.initialize():
                result = diag.diagnose(sensor_data, mode=mode)
                print(json.dumps(result))
            else:
                print(json.dumps({'error': 'Failed to initialize Hailo device'}))
                
        except json.JSONDecodeError:
            print(json.dumps({'error': 'Invalid JSON sensor data'}))
        except Exception as e:
            print(json.dumps({'error': str(e)}))
            
    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))
        
if __name__ == '__main__':
    main()