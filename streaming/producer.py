# src/streaming/producer.py

from kafka import KafkaProducer
import pandas as pd
import json
import time
import threading

# Global stop signal
stop_signal = threading.Event()

def stop_streaming():
    """Signal to stop the streaming."""
    stop_signal.set()

def stream_csv(file_path, topic="stroke_data", delay=0.5):
    """
    Stream rows from a CSV file to a Kafka topic.
    
    Parameters:
    - file_path: Path to the CSV file.
    - topic: Kafka topic name.
    - delay: Delay between each message in seconds (default: 0.1s).
    """
    stop_signal.clear()

    # Initialize Kafka producer
    producer = KafkaProducer(
        bootstrap_servers='localhost:9092',
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )

    # Load the CSV into a DataFrame
    df = pd.read_csv(file_path)

    for _, row in df.iterrows():
        if stop_signal.is_set():
            print("🛑 Streaming was stopped.")
            break

        producer.send(topic, row.to_dict())
        print(f"📤 Sent row to topic '{topic}': {row.to_dict()}")
        time.sleep(delay)

    # Finalize
    producer.flush()
    producer.close()
    print("✅ Kafka producer closed.")
