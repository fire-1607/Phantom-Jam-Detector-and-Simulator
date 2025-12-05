# Phantom-Jam-Detector-and-Simulator
This repository contains a complete system for detecting phantom traffic jams—congestion events that form spontaneously without any visible cause—using a combination of machine learning (DBSCAN anomaly detection) and a custom-built traffic simulator created with Phaser.js and a Python backend.
Phantom jams are difficult to detect using traditional rule-based methods because they arise from subtle fluctuations in traffic flow. This project approaches the problem using unsupervised learning, modeling what "normal" traffic looks like and identifying deviations as potential jam events.

The system consists of two major components:

1. DBSCAN-Based Phantom Jam Detector (Python, Scikit-Learn)

The ML pipeline uses features such as:

Local car density

Average vehicle speed

Brake event frequency

Traffic data is split using an 80/20 stratified train-test method. After scaling with StandardScaler, DBSCAN is trained only on non-jam data to learn the structure of stable traffic flow. Any point significantly distant from DBSCAN’s core samples is flagged as anomalous.

Key features include:

Automated anomaly scoring using Euclidean distance

Threshold selection tuned to improve jam detection sensitivity

Evaluation metrics: accuracy, F1 score, confusion matrix, TP/FP/FN/TN

Export of scaler, core samples, and detection threshold via Joblib

This creates a lightweight detector suitable for embedded systems, IoT edge devices, or backend traffic analytics.

2. Real-Time Traffic Simulator (Phaser.js + Python Server)

To test the model under realistic conditions, a web-based simulator was developed using Phaser. It generates dynamic vehicle movement across multiple road segments while varying density, speed, and braking frequency.

The Python backend handles:

Telemetry streaming

Model inference

Data logging for analysis

This simulation environment allows rapid experimentation with different scenarios to observe when and how phantom jams emerge.

🎯 Purpose

The combined system provides a practical framework for researching traffic instability, validating anomaly detection methods, and prototyping intelligent transportation applications capable of predicting phantom jams before they fully form.
