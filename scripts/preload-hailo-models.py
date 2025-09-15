#!/usr/bin/env python3
"""
Preload all Hailo models at boot for faster inference
"""
import os
import sys
import time
from pathlib import Path
from hailo_platform import (
    HEF,
    VDevice,
    HailoStreamInterface,
    InferVStreams,
    ConfigureParams,
    FormatType
)

MODELS_DIR = "/home/Automata/mydata/apollo-nexus/models"
MODEL_FILES = [
    "apollo_simple.hef",
    "aquilo_simple.hef", 
    "boreas_simple.hef",
    "naiad_simple.hef",
    "vulcan_simple.hef",
    "zephyrus_simple.hef",
    "colossus_simple.hef",
    "gaia_simple.hef"
]

def preload_models():
    """Preload all models to Hailo device"""
    print("Starting Hailo model preloading...")
    
    # Initialize device without multi-process service
    with VDevice() as vdevice:
        print(f"Hailo device opened successfully")
        
        loaded_models = []
        for model_file in MODEL_FILES:
            model_path = Path(MODELS_DIR) / model_file
            if not model_path.exists():
                print(f"Warning: Model file not found: {model_path}")
                continue
                
            try:
                print(f"Loading model: {model_file}")
                hef = HEF(str(model_path))
                
                # Configure network group
                configure_params = ConfigureParams.create_from_hef(
                    hef=hef,
                    interface=HailoStreamInterface.PCIe
                )
                
                network_groups = vdevice.configure(hef, configure_params)
                
                if network_groups:
                    loaded_models.append({
                        'name': model_file.replace('_simple.hef', ''),
                        'path': str(model_path),
                        'network_group': network_groups[0]
                    })
                    print(f"  ✓ Model {model_file} loaded successfully")
                    
            except Exception as e:
                print(f"  ✗ Error loading {model_file}: {e}")
        
        print(f"\nSuccessfully preloaded {len(loaded_models)} models:")
        for model in loaded_models:
            print(f"  - {model['name']}")
        
        # Keep models in memory for a moment to ensure they're cached
        time.sleep(2)
        
    print("Model preloading complete")
    return True

if __name__ == "__main__":
    try:
        # Wait a moment for system to stabilize after boot
        time.sleep(5)
        preload_models()
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)